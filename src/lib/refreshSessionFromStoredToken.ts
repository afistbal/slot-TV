import { api, type TData } from '@/api';
import { useUserStore } from '@/stores/user';

/**
 * 与 `App.tsx` 初始化里带 `localStorage.token` 的分支一致：`POST login/token` 后写入 `userStore`。
 * 用于支付成功后刷新 VIP 等字段，避免 `location.reload`。
 *
 * `c !== 0`（`m` 可为英文或中文等任意文案，如「登入失敗」）：清除无效 token 并 signout，便于上层改为走 `login/anonymous` 换新会话。
 */
export async function refreshSessionFromStoredToken(): Promise<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
        return false;
    }
    const result = await api<TData>('login/token', {
        method: 'post',
        data: { token },
        loading: false,
        toastOnError: false,
        persistSessionOn401: true,
    });
    if (result.c === 0) {
        localStorage.setItem('token', token);
        const raw = result.d as TData;
        const info = (raw['info'] as TData | undefined) ?? raw;
        useUserStore.getState().signin(info);
        return true;
    }
    localStorage.removeItem('token');
    useUserStore.getState().signout();
    return false;
}
