import { loginAnonymous } from '@/lib/anonymousLogin';
import { setClientIsAnonymous } from '@/lib/clientIsAnonymous';
import { api, type TData } from '@/api';
import { auth } from '@/firebase';
import { trackAnonymousCompleteRegistration } from '@/hooks/usePixel';
import { useLoadingStore } from '@/stores/loading';
import {
    refreshVideoShoppingProductsAfterSessionChange,
    resetVideoShoppingProducts,
} from '@/stores/videoShoppingProducts';
import { useUserStore } from '@/stores/user';
import { clearShoppingProductCache } from '@/lib/shoppingProductCache';

export async function logoutToAnonymousSession(): Promise<boolean> {
    setClientIsAnonymous(1);
    useLoadingStore.getState().show();
    try {
        // @ts-expect-error - injected by Flutter InAppWebView
        if (window.flutter_inappwebview) {
            // @ts-expect-error - injected by Flutter InAppWebView
            await window.flutter_inappwebview.callHandler('logout');
        } else {
            await auth.signOut();
        }

        localStorage.removeItem('token');
        const result = await loginAnonymous({ toastOnError: false });

        if (result.c !== 0) {
            localStorage.removeItem('login-method');
            localStorage.removeItem('user-avatar');
            clearShoppingProductCache();
            resetVideoShoppingProducts();
            useUserStore.getState().signout();
            useUserStore.getState().setBalance(-1);
            return false;
        }

        localStorage.setItem('token', result.d['token'] as string);
        localStorage.removeItem('login-method');
        localStorage.removeItem('user-avatar');
        clearShoppingProductCache();
        refreshVideoShoppingProductsAfterSessionChange();
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
