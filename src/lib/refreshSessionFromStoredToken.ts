import { api, type TData } from '@/api';
import { useUserStore } from '@/stores/user';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

/**
 * 与 `App.tsx` 初始化里带 `localStorage.token` 的分支一致：`POST login/token` 后写入 `userStore`。
 * 用于支付成功后刷新 VIP 等字段，避免 `location.reload`。
 *
 * 仅在明确鉴权失败时清除 token；网络/5xx 不重试会误删会话。
 */
export async function refreshSessionFromStoredToken(): Promise<boolean> {
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
        if (result.m === 'Authentication Failure.') {
            localStorage.removeItem('token');
            useUserStore.getState().signout();
            return false;
        }
        if (attempt < maxAttempts) {
            await sleep(350 * attempt);
        }
    }
    return false;
}
