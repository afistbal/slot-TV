import { api, type TData } from '@/api';

import { fromSourceForLogin } from './adAttribution';
import { getOrCreateDeviceUuid } from './browserFingerprint';
import { initIsAnonymousFromInfo } from './clientIsAnonymous';

/** 匿名登录：附带 device_uuid（浏览器指纹 MD5） */
export async function loginAnonymous(options?: {
    loading?: boolean;
    toastOnError?: boolean;
}) {
    const result = await api<TData>('login/anonymous', {
        loading: options?.loading ?? false,
        toastOnError: options?.toastOnError ?? false,
        data: { device_uuid: getOrCreateDeviceUuid(), ...fromSourceForLogin() },
    });
    if (result.c === 0) {
        initIsAnonymousFromInfo(result.d['info'] as TData);
    }
    return result;
}
