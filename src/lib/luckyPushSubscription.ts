import {
    getLuckyPushConfig,
    removeLuckyPushSubscription,
    saveLuckyPushSubscription,
} from '@/api/lucky';

const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;

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

export async function inspectLuckyPushSubscription(): Promise<{ subscribed: boolean }> {
    ensurePushSupport();
    const [, registration] = await Promise.all([
        getLuckyPushConfig(),
        getPushWorker(),
    ]);
    return { subscribed: Boolean(await registration.pushManager.getSubscription()) };
}

export async function enableLuckyPushSubscription(
    preferredRegistration?: ServiceWorkerRegistration,
): Promise<PushSubscription> {
    ensurePushSupport();

    if (Notification.permission === 'denied') {
        throw new Error('通知权限已被浏览器禁止，请在浏览器设置中允许通知后重试。');
    }

    // Keep the permission prompt directly inside the user's click call stack.
    // Fetching config or waiting for the worker before this can make Safari and
    // Chromium treat the prompt as no longer user initiated.
    if (Notification.permission !== 'granted'
        && await Notification.requestPermission() !== 'granted') {
        throw new Error('未获得通知权限，请在浏览器设置中允许通知后重试。');
    }

    const [config, registration] = await Promise.all([
        getLuckyPushConfig(),
        getPushWorker(preferredRegistration),
    ]);
    const previous = await registration.pushManager.getSubscription();
    const subscription = previous ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey(config.publicKey),
    });

    try {
        await saveLuckyPushSubscription(subscription);
        return subscription;
    } catch (reason) {
        if (!previous) await subscription.unsubscribe().catch(() => false);
        throw reason;
    }
}

export async function disableLuckyPushSubscription(): Promise<void> {
    ensurePushSupport();
    const registration = await getPushWorker();
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    await removeLuckyPushSubscription(subscription.endpoint);
    if (!await subscription.unsubscribe()) {
        throw new Error('浏览器未能取消订阅，请重试。');
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
