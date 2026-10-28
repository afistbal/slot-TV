import {
    getLuckyPushConfig,
    saveLuckyPushSubscription,
} from '@/api/lucky';
import { isIosLikeDevice } from '@/lib/isIosLikeDevice';

const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;
const PUSH_OPERATION_TIMEOUT_MS = 30_000;
export type LuckyPushProgress = 'permission' | 'connection' | 'saving';

async function pushOperation<T>(promise: Promise<T>, message: string): Promise<T> {
    let timer = 0;
    try {
        return await Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                timer = window.setTimeout(() => reject(new Error(message)), PUSH_OPERATION_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timer) window.clearTimeout(timer);
    }
}

// Same capability checks as the reference site's supported/requestAndSubscribe.
function missingPushFeatures(): string[] {
    const missing: string[] = [];
    if (!('serviceWorker' in navigator)) missing.push('ServiceWorker');
    if (!('PushManager' in window)) missing.push('PushManager');
    if (!('Notification' in window)) missing.push('Notification');
    return missing;
}

function ensurePushSupport(): void {
    const missing = missingPushFeatures();
    if (!missing.length) return;

    const guidance = isIosLikeDevice()
        ? '请使用支持推送的 iOS 版本，并从添加到主屏幕的图标打开。'
        : '请使用最新版 Chrome 的普通标签页打开，勿使用无痕模式。';
    throw new Error(`当前浏览器未提供推送能力（缺少 ${missing.join('、')}）。${guidance}`);
}

function vapidKey(value: string): Uint8Array<ArrayBuffer> {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
    return Uint8Array.from(raw, character => character.charCodeAt(0));
}

async function getPushWorker(
    preferredRegistration?: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
    if (preferredRegistration?.active) return preferredRegistration;

    const current = await navigator.serviceWorker.getRegistration('/');
    if (current?.active) return current;

    let timer = 0;
    try {
        const registration = await Promise.race([
            navigator.serviceWorker.ready,
            new Promise<never>((_, reject) => {
                timer = window.setTimeout(() => reject(new Error('当前页面的推送服务尚未就绪，请更新并重新打开页面后重试。')), SERVICE_WORKER_READY_TIMEOUT_MS);
            }),
        ]);
        if (!registration.active) throw new Error('当前页面的推送服务尚未就绪，请更新并重新打开页面后重试。');
        return registration;
    } finally {
        if (timer) window.clearTimeout(timer);
    }
}

export async function enableLuckyPushSubscription(
    preferredRegistration?: ServiceWorkerRegistration,
    onProgress?: (stage: LuckyPushProgress) => void,
): Promise<PushSubscription> {
    ensurePushSupport();

    if (Notification.permission === 'denied') {
        throw new Error('通知权限已被浏览器禁止，请在浏览器设置中允许通知后重试。');
    }

    // Keep the permission prompt directly inside the user's click call stack.
    // Fetching config or waiting for the worker before this can make Safari and
    // Chromium treat the prompt as no longer user initiated.
    if (Notification.permission !== 'granted') {
        onProgress?.('permission');
        const permission = await pushOperation(Notification.requestPermission(), '等待通知授权超时，请检查地址栏旁的通知提示，或在网站设置中允许通知后重试。');
        if (permission !== 'granted') throw new Error('未获得通知权限，请在浏览器设置中允许通知后重试。');
    }

    onProgress?.('connection');
    const registration = await getPushWorker(preferredRegistration);
    const previous = await registration.pushManager.getSubscription();
    let subscription = previous;
    if (!subscription) {
        // Like the reference, reuse the browser subscription before creating one.
        // Our VAPID key belongs to our backend, so only fetch it when subscribing.
        const config = await getLuckyPushConfig();
        subscription = await pushOperation(registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey(config.publicKey),
        }), '连接浏览器通知服务超时，请检查网络后重试。');
    }

    try {
        onProgress?.('saving');
        await saveLuckyPushSubscription(subscription);
        return subscription;
    } catch (reason) {
        if (!previous) await subscription.unsubscribe().catch(() => false);
        throw reason;
    }
}

/**
 * Repairs an expired/missing browser subscription after login. This never asks
 * for permission on its own; only users who already granted permission are
 * silently re-subscribed and synchronized with the server.
 */
export async function syncLuckyPushSubscription(
    preferredRegistration?: ServiceWorkerRegistration,
): Promise<boolean> {
    if (missingPushFeatures().length || Notification.permission !== 'granted') return false;
    await enableLuckyPushSubscription(preferredRegistration);
    return true;
}
