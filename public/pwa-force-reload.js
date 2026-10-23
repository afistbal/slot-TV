let isPwaUpdateInstall = false;
const RELOAD_MESSAGE_TYPE = 'PWA_FORCE_RELOAD';
const RELOAD_ACK_TYPE = 'PWA_FORCE_RELOAD_ACK';
const RELOAD_ACK_TIMEOUT_MS = 2500;
const RELOAD_QUERY_KEY = '_pwa_update';

const SAFE_NAVIGATE_ROUTES = new Set([
  '',
  'categories',
  'search',
  'tagSearch',
  'shelf',
  'drama',
  'share',
  'my-list',
]);

const SAFE_NAVIGATE_PAGE_ROUTES = new Set([
  '',
  'about',
  'text',
  'ios-add-home',
  'search',
]);

function getRouteParts(pathname) {
  const segments = pathname.split('/').filter(Boolean);
  const hasLocalePrefix = /^[a-z]{2}(?:-[a-z]{2,4})?$/i.test(segments[0] || '');
  const offset = hasLocalePrefix ? 1 : 0;
  return {
    route: segments[offset] || '',
    childRoute: segments[offset + 1] || '',
  };
}

function shouldHandleWindowUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/op_new/')) return false;
  if (url.pathname === '/airwallex.html') return false;
  if (/\/[^/]+\.html$/i.test(url.pathname)) return false;
  return true;
}

/**
 * Legacy pages do not know how to acknowledge an update. Navigate only known
 * read-only routes; unknown routes may represent a future checkout, form or
 * player and therefore default to staying put. They remain usable through the
 * seven-day asset-retention window.
 */
function shouldFallbackNavigate(rawUrl) {
  const url = new URL(rawUrl);
  const { route, childRoute } = getRouteParts(url.pathname);
  if (SAFE_NAVIGATE_ROUTES.has(route)) return true;
  return route === 'page' && SAFE_NAVIGATE_PAGE_ROUTES.has(childRoute);
}

function requestClientReload(client, updateId) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let settled = false;

    const finish = (acknowledged) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      channel.port1.onmessage = null;
      channel.port1.close();
      resolve(acknowledged);
    };

    const timer = setTimeout(() => finish(false), RELOAD_ACK_TIMEOUT_MS);
    channel.port1.onmessage = (event) => {
      if (event.data && event.data.type === RELOAD_ACK_TYPE) {
        finish(true);
      }
    };

    try {
      client.postMessage({ type: RELOAD_MESSAGE_TYPE, updateId }, [channel.port2]);
    } catch {
      finish(false);
    }
  });
}

async function reloadClientWhenNeeded(client, updateId) {
  const acknowledged = await requestClientReload(client, updateId);
  if (acknowledged || !shouldFallbackNavigate(client.url)) return;

  const nextUrl = new URL(client.url);
  nextUrl.searchParams.set(RELOAD_QUERY_KEY, updateId);
  try {
    await client.navigate(nextUrl.toString());
  } catch {
    // The page may have closed or navigated while the acknowledgement timed out.
  }
}

self.addEventListener('install', () => {
  isPwaUpdateInstall = Boolean(self.registration.active);
});

self.addEventListener('activate', (event) => {
  if (!isPwaUpdateInstall) return;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const updateId = `${Date.now().toString(36)}`;

    await Promise.all(windows.map((client) => {
      if (!shouldHandleWindowUrl(client.url)) return undefined;
      return reloadClientWhenNeeded(client, updateId);
    }));
  })());
});
