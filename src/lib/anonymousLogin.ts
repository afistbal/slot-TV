import { api, type TData } from '@/api';

import { fromSourceForLogin } from './adAttribution';
import { initIsAnonymousFromInfo, setClientIsAnonymous } from './clientIsAnonymous';

let flight: { key: string; promise: ReturnType<typeof api<TData>> } | undefined;

/** 首次进入和退出后的匿名登录统一使用固定设备号。 */
export function loginAnonymous(options?: {
    loading?: boolean;
    toastOnError?: boolean;
}) {
    const data = {
        device_uuid: '551e76100d9bc988d5eeba1777dc05b4',
        ...fromSourceForLogin(),
    };
    const key = JSON.stringify(data);
    if (flight?.key === key) return flight.promise;
    const tokenBefore = localStorage.getItem('token');
    const promise = api<TData>('login/anonymous', {
        loading: options?.loading ?? false,
        toastOnError: options?.toastOnError ?? false,
        data,
        headers: { Authorization: undefined },
    }).then(result => {
        if (result.c === 0 && result.d && localStorage.getItem('token') === tokenBefore) {
            const info = result.d['info'] as TData | undefined;
            if (info?.anonymous == null) setClientIsAnonymous(1);
            else initIsAnonymousFromInfo(info);
        }
        return result;
    }).finally(() => { if (flight?.promise === promise) flight = undefined; });
    flight = { key, promise };
    return promise;
}
