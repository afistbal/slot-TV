import { formatApiFailure, type TData } from '@/api';
import { loginAnonymous } from './anonymousLogin';
import { refreshSessionFromStoredToken } from './refreshSessionFromStoredToken';
import { useUserStore } from '@/stores/user';
import { trackAnonymousCompleteRegistration } from '@/hooks/usePixel';

export async function bootstrapSession(isCurrent: () => boolean): Promise<void> {
    if (localStorage.getItem('token')) {
        if (await refreshSessionFromStoredToken({ throwOnFailure: true })) return;
        if (!isCurrent()) return;
        // A different login may have completed while the old request was pending.
        if (localStorage.getItem('token')) throw new Error('登录状态已变化，请重试');
    }
    const tokenBefore = localStorage.getItem('token');
    const result = await loginAnonymous({ toastOnError: false });
    if (!isCurrent()) return;
    if (localStorage.getItem('token') !== tokenBefore) {
        if (useUserStore.getState().signed) return;
        throw new Error('登录状态已变化，请重试');
    }
    if (result.c !== 0) throw new Error(formatApiFailure('POST', 'login/anonymous', result));
    const token = result.d?.token;
    const info = result.d?.info;
    if (typeof token !== 'string' || !token.trim() || !info || typeof info !== 'object' || Array.isArray(info)) {
        throw new Error('登录接口返回的数据不完整，请重试');
    }
    // A recovered guest session must not retain an old account's UI metadata.
    localStorage.setItem('token', token);
    localStorage.removeItem('login-method');
    localStorage.removeItem('user-avatar');
    useUserStore.getState().signin(info as TData);
    trackAnonymousCompleteRegistration();
}
