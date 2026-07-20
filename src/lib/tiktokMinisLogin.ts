import { api, type TData } from '@/api';
import { getPlatform, isTikTokPlatform } from '@/platform';

export interface TikTokMinisLoginData extends TData {
    token: string;
    info: TData;
    is_new_user?: boolean;
}

/** Exchange TikTok's one-time code for this app's existing session token. */
export async function loginTikTokMinis() {
    if (!isTikTokPlatform()) {
        throw new Error('TikTok silent login can only run in the TikTok build.');
    }

    const silentLogin = getPlatform().auth.silentLogin;
    if (!silentLogin) {
        throw new Error('TikTok silent login is unavailable.');
    }

    const { code } = await silentLogin();
    return api<TikTokMinisLoginData>('login/tiktok', {
        method: 'post',
        loading: false,
        toastOnError: false,
        data: { code },
    });
}
