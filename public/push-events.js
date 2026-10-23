/* Extends the existing PWA worker without changing its cache/update behavior. */
self.addEventListener('push', event => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() }; }
    if (!data || typeof data !== 'object') data = {};
    let url = new URL('/lucky', self.location.origin).href;
    try { const target = new URL(data.url || '/lucky', self.location.origin); if (target.origin === self.location.origin && ['https:', 'http:'].includes(target.protocol)) url = target.href; } catch { /* safe default */ }
    event.waitUntil(self.registration.showNotification(typeof data.title === 'string' ? data.title : 'YogoShort', {
        body: typeof data.body === 'string' ? data.body : '', tag: typeof data.tag === 'string' ? data.tag : undefined, data: { url },
    }));
});
self.addEventListener('notificationclick', event => {
    event.notification.close();
    let target = new URL('/lucky', self.location.origin);
    try { const url = new URL(event.notification.data?.url, self.location.origin); if (url.origin === self.location.origin) target = url; } catch { /* safe default */ }
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
        const client = clients.find(item => item.url === target.href);
        if (client) return client.focus();
        return self.clients.openWindow(target.href);
    }));
});
self.addEventListener('pushsubscriptionchange', event => {
    // Re-registration requires the logged-in page; never store auth in the worker.
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        for (const client of clients) client.postMessage({ type: 'yogo-push-subscription-changed' });
    }));
});
