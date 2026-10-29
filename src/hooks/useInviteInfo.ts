import { useEffect, useState } from 'react';
import { getInviteInfo } from '@/api/invite';
import { normalizeInviteInfo, type InviteInfo } from '@/lib/inviteData';
import { useRootStore } from '@/stores/root';
import { useUserStore } from '@/stores/user';
import { useLuckyStore } from '@/stores/lucky';

export function useInviteInfo() {
    const ready = useRootStore(state => state.sessionBootstrapReady);
    const signed = useUserStore(state => state.signed && !state.isAnonymous());
    const userId = useUserStore(state => state.info?.id);
    const revision = useLuckyStore(state => state.revision);
    const token = localStorage.getItem('token') ?? '';
    const [retry, setRetry] = useState(0);
    const [snapshot, setSnapshot] = useState<{ token: string; data: InviteInfo; error: string }>({ token: '', data: normalizeInviteInfo(null), error: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!ready || !signed) return;
        let active = true;
        const refresh = () => {
            if (document.visibilityState !== 'visible') return;
            setLoading(true);
            void getInviteInfo().then(data => {
                if (active && token === localStorage.getItem('token')) setSnapshot({ token, data, error: '' });
            }).catch(reason => {
                if (active && token === localStorage.getItem('token')) setSnapshot(previous => ({
                    token, data: previous.token === token ? previous.data : normalizeInviteInfo(null),
                    error: reason instanceof Error ? reason.message : String(reason),
                }));
            }).finally(() => { if (active) setLoading(false); });
        };
        refresh();
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            active = false;
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [ready, signed, userId, token, revision, retry]);

    const current = signed && snapshot.token === token;
    return { data: current ? snapshot.data : normalizeInviteInfo(null), loading: ready && signed && loading,
        failed: current && Boolean(snapshot.error), error: current ? snapshot.error : '', retry: () => setRetry(value => value + 1) };
}
