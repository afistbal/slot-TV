import { api, type TData } from '@/api';

import { getOrCreateDeviceUuid } from './browserFingerprint';

/** 匿名登录：附带 device_uuid（浏览器指纹 MD5） */
export async function loginAnonymous(options?: {
    loading?: boolean;
    toastOnError?: boolean;
}) {
    return api<TData>('login/anonymous', {
        loading: options?.loading ?? false,
        toastOnError: options?.toastOnError ?? false,
        data: { device_uuid: getOrCreateDeviceUuid() },
    });
}
