import { api } from '@/api';
import { useUserStore } from '@/stores/user';

type Preference = { token: string; enabled: boolean; wallet: Record<string, unknown> };
let cached: Preference | undefined;
let flight: { token: string; id: number; promise: Promise<boolean | null> } | undefined;
let revision = 0;
let requestId = 0;

function sessionToken(): string {
    const user = useUserStore.getState();
    return user.signed && !user.isAnonymous() ? localStorage.getItem('token') ?? '' : '';
}

/** Unknown/failed settings must never authorize an automatic coin charge. */
export function readAutoUnlockNext(refresh = false): Promise<boolean | null> {
    const token = sessionToken();
    if (!token) return Promise.resolve(null);
    if (flight?.token === token) return flight.promise;
    if (!refresh && cached?.token === token) return Promise.resolve(cached.enabled);
    const version = revision;
    const id = ++requestId;
    const promise = (async () => {
        try {
            const result = await api<{ wallet?: Record<string, unknown> }>('user/config', { loading: false, toastOnError: false });
            if (sessionToken() !== token || result.c !== 0) return null;
            const wallet = result.d?.wallet ?? {};
            const value = wallet.auto_unlock_next;
            const enabled = value === true || value === 1 || value === '1' || value === 'true';
            if (revision === version) cached = { token, enabled, wallet };
            return cached?.token === token ? cached.enabled : null;
        } catch { return null; }
        finally { if (flight?.id === id) flight = undefined; }
    })();
    flight = { token, id, promise };
    return promise;
}

export async function saveAutoUnlockNext(enabled: boolean): Promise<boolean> {
    const token = sessionToken();
    if (!token || cached?.token !== token) return false;
    const wallet = { ...cached.wallet, auto_unlock_next: enabled };
    revision++;
    try {
        const result = await api('user/config', { data: { wallet }, loading: false, toastOnError: false });
        if (result.c !== 0 || sessionToken() !== token) return false;
        cached = { token, enabled, wallet };
        return true;
    } catch { return false; }
}
