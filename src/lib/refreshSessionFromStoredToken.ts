import { api, formatApiFailure, type TData } from '@/api';
import { initIsAnonymousFromInfo } from '@/lib/clientIsAnonymous';
import { useUserStore } from '@/stores/user';

import { getOrCreateDeviceUuid } from './browserFingerprint';

/**
 * 与 `App.tsx` 初始化里带 `localStorage.token` 的分支一致：`POST login/token` 后写入 `userStore`。
 * 用于支付成功后刷新 VIP 等字段，避免 `location.reload`。
 *
 * 明确的鉴权失败才清除 token；网络异常、限流和服务端错误保留会话，允许重试。
 */
export async function refreshSessionFromStoredToken(options?: { throwOnFailure?: boolean }): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
        return false;
    }
    const result = await api<TData>('login/token', {
        method: 'post',
        data: { token, device_uuid: getOrCreateDeviceUuid() },
        loading: false,
        toastOnError: false,
    });
    if (localStorage.getItem('token') !== token) return false;
    if (result.c === 0 && result.d && typeof result.d === 'object') {
        localStorage.setItem('token', token);
        const raw = result.d as TData;
        const info = (raw['info'] as TData | undefined) ?? raw;
        initIsAnonymousFromInfo(info);
        useUserStore.getState().signin(info);
        /** Balance is not needed for first playback; refresh it without blocking video bootstrap. */
        void api<number>('user/balance', { loading: false, toastOnError: false })
            .then((bal) => {
                if (bal.c === 0 && localStorage.getItem('token') === token) {
                    useUserStore.getState().setBalance(bal.d);
                }
            })
            .catch(() => undefined);
        return true;
    }
    if (result.c === 0 || result.httpStatus === 0 || result.httpStatus === 408 || result.httpStatus === 429 || (result.httpStatus ?? 0) >= 500) {
        if (options?.throwOnFailure) throw new Error(formatApiFailure('POST', 'login/token', result));
        return false;
    }
    localStorage.removeItem('token');
    localStorage.removeItem('isAnonymous');
    localStorage.removeItem('login-method');
    localStorage.removeItem('user-avatar');
    useUserStore.getState().signout();
    return false;
}
