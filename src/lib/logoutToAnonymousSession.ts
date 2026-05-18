import { api, type TData } from '@/api';
import { auth } from '@/firebase';
import { trackAnonymousCompleteRegistration } from '@/hooks/usePixel';
import { useLoadingStore } from '@/stores/loading';
import { useUserStore } from '@/stores/user';

/**
 * 退出到匿名会话：先换新 token，再更新 store，避免中间态无 token 触发 balance 等接口 401。
 */
export async function logoutToAnonymousSession(): Promise<boolean> {
    useLoadingStore.getState().show();
    try {
        // @ts-expect-error - injected by Flutter InAppWebView
        if (window.flutter_inappwebview) {
            // @ts-expect-error - injected by Flutter InAppWebView
            await window.flutter_inappwebview.callHandler('logout');
        } else {
            await auth.signOut();
        }

        const result = await api<{ token: string; info: { [key: string]: unknown } }>('login/anonymous', {
            loading: false,
            toastOnError: false,
        });

        if (result.c !== 0) {
            localStorage.removeItem('token');
            localStorage.removeItem('login-method');
            localStorage.removeItem('user-avatar');
            useUserStore.getState().signout();
            useUserStore.getState().setBalance(-1);
            return false;
        }

        localStorage.setItem('token', result.d['token'] as string);
        localStorage.removeItem('login-method');
        localStorage.removeItem('user-avatar');
        useUserStore.getState().signin(result.d['info'] as TData);
        const bal = await api<number>('user/balance', { loading: false, toastOnError: false });
        if (bal.c === 0) {
            useUserStore.getState().setBalance(bal.d);
        } else {
            useUserStore.getState().setBalance(-1);
        }
        trackAnonymousCompleteRegistration();
        return true;
    } finally {
        useLoadingStore.getState().hide();
    }
}
