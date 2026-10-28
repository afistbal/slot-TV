import {
    getLuckyPushConfig,
    saveLuckyPushSubscription,
} from '@/api/lucky';

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

function ensurePushSupport(): void {
    if (!window.isSecureContext
        || !('Notification' in window)
        || !('serviceWorker' in navigator)
        || !('PushManager' in window)) {
        throw new Error('当前浏览器不支持推送通知；iPhone 请先添加到主屏幕后打开。');
    }
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
    const [config, registration] = await Promise.all([
        getLuckyPushConfig(),
        getPushWorker(preferredRegistration),
    ]);
    const previous = await registration.pushManager.getSubscription();
    const subscription = previous ?? await pushOperation(registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(config.publicKey),
    }), '连接浏览器通知服务超时，请检查网络后重试。');

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
    ensurePushSupport();
    if (Notification.permission !== 'granted') return false;
    await enableLuckyPushSubscription(preferredRegistration);
    return true;
}
