const KEY = 'isAnonymous';

export function getClientIsAnonymous(): 0 | 1 | null {
    const v = localStorage.getItem(KEY);
    if (v === '1') return 1;
    if (v === '0') return 0;
    return null;
}

export function setClientIsAnonymous(value: 0 | 1): void {
    localStorage.setItem(KEY, String(value));
}

function fromInfo(info: { [key: string]: unknown } | undefined): 0 | 1 | null {
    const a = info?.['anonymous'];
    if (a === 1 || a === '1') return 1;
    if (a === 0 || a === '0') return 0;
    return null;
}

/** email / uid 登录成功：直接写接口返回的 anonymous */
export function setIsAnonymousFromInfo(info: { [key: string]: unknown } | undefined): void {
    const v = fromInfo(info);
    if (v !== null) {
        setClientIsAnonymous(v);
    }
}

/** login/token：仅 localStorage 还没有 isAnonymous 时写入 */
export function initIsAnonymousFromInfo(info: { [key: string]: unknown } | undefined): void {
    if (getClientIsAnonymous() !== null) return;
    const v = fromInfo(info);
    if (v !== null) {
        setClientIsAnonymous(v);
    }
}
