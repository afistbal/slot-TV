let isPwaUpdateInstall = false;
const RELOAD_MESSAGE_TYPE = 'PWA_FORCE_RELOAD';
const RELOAD_ACK_TYPE = 'PWA_FORCE_RELOAD_ACK';
const RELOAD_ACK_TIMEOUT_MS = 2500;

function shouldHandleWindowUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/op_new/')) return false;
  if (url.pathname === '/airwallex.html') return false;
  return true;
}

function isPwaReloadDeferredPath(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0] || '';
  const second = segments[1] || '';
  const isLocalePrefix = /^[a-z]{2}(?:-[a-z]{2,4})?$/i.test(first);
  const route = isLocalePrefix ? second : first;

  return route === 'video' ||
    route === 'v-demo' ||
    route === 'foryou' ||
    route === 'for-you' ||
    route === 'for-demo' ||
    route === 'episodes';
}

function shouldFallbackNavigateClient(rawUrl) {
  const url = new URL(rawUrl);
  return !isPwaReloadDeferredPath(url.pathname);
}

function requestClientReload(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), RELOAD_ACK_TIMEOUT_MS);

    channel.port1.onmessage = (event) => {
      if (event.data && event.data.type === RELOAD_ACK_TYPE) {
        clearTimeout(timer);
        resolve(true);
      }
    };

    try {
      client.postMessage({ type: RELOAD_MESSAGE_TYPE }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

self.addEventListener('install', () => {
  isPwaUpdateInstall = Boolean(self.registration.active);
});

self.addEventListener('activate', (event) => {
  if (!isPwaUpdateInstall) return;

  event.waitUntil((async () => {
    await self.clients.claim();
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    await Promise.all(windows.map((client) => {
      if (!shouldHandleWindowUrl(client.url)) return undefined;
      return requestClientReload(client).then((acked) => {
        if (acked) return undefined;
        if (!shouldFallbackNavigateClient(client.url)) return undefined;
        return client.navigate(client.url).catch(() => undefined);
      });
    }));
  })());
});
