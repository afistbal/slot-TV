const ACCOUNT_PROTECTED_FIRST_SEGMENTS = new Set([
    'affiliate',
    'creator',
    'lucky',
    'my-list',
    'search',
    'shopping',
    'tagsearch',
    'wallet',
]);

const LOCALE_SEGMENT = /^[a-z]{2}(?:-[a-z]{2,4})?$/i;

/** 这些页面允许已登录账号进入；游客点击入口时必须停留在原页并弹登录框。 */
export function isAccountProtectedPath(pathname: string): boolean {
    const segments = pathname.toLowerCase().split('/').filter(Boolean);
    if (ACCOUNT_PROTECTED_FIRST_SEGMENTS.has(segments[0] ?? '')) return true;
    if (segments[0] === 'page' && segments[1] === 'search') return true;
    const first = LOCALE_SEGMENT.test(segments[0] ?? '') ? segments[1] : segments[0];
    return ACCOUNT_PROTECTED_FIRST_SEGMENTS.has(first ?? '');
}

export function isAccountProtectedUrl(url: URL): boolean {
    if (isAccountProtectedPath(url.pathname)) return true;
    const segments = url.pathname.toLowerCase().split('/').filter(Boolean);
    const first = LOCALE_SEGMENT.test(segments[0] ?? '') ? segments[1] : segments[0];
    if (first !== 'profile') return false;

    const tab = url.searchParams.get('tab')?.toLowerCase();
    return tab === 'topup' || tab === 'wallet' || tab === 'mylist' || tab === 'history';
}
