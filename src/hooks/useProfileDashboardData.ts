import { useEffect, useState } from 'react';
import { api, type IPagination, type TData } from '@/api';
import { getAffiliateEligibility, type AffiliateEligibility } from '@/api/affiliate';
import { useRootStore } from '@/stores/root';
import { useUserStore } from '@/stores/user';
import type { IBalanceHistoryRow } from '@/pages/user/WalletTransactionHistory';

export function useProfileDashboardData(revision: number) {
    const ready = useRootStore(state => state.sessionBootstrapReady);
    const userId = useUserStore(state => state.info?.id);
    const [data, setData] = useState<{
        history: TData[]; favorites: TData[]; logs: IBalanceHistoryRow[];
        invite?: AffiliateEligibility;
    }>({ history: [], favorites: [], logs: [] });

    useEffect(() => {
        if (!ready) return;
        let active = true;
        // Reuse the project's existing contracts; unavailable fields remain zero.
        void Promise.allSettled([
            api<IPagination>('movie/history', { data: { page: 1 }, loading: false, toastOnError: false }),
            api<IPagination>('movie/my-list', { data: { page: 1 }, loading: false, toastOnError: false }),
            api<IBalanceHistoryRow[]>('user/balance/history', { loading: false, toastOnError: false }),
            getAffiliateEligibility(),
        ]).then(([history, favorites, logs, invite]) => {
            if (!active) return;
            setData({
                history: history.status === 'fulfilled' && history.value.c === 0 && Array.isArray(history.value.d?.data) ? history.value.d.data : [],
                favorites: favorites.status === 'fulfilled' && favorites.value.c === 0 && Array.isArray(favorites.value.d?.data) ? favorites.value.d.data : [],
                logs: logs.status === 'fulfilled' && logs.value.c === 0 && Array.isArray(logs.value.d) ? logs.value.d : [],
                invite: invite.status === 'fulfilled' ? invite.value : undefined,
            });
        });
        return () => { active = false; };
    }, [ready, userId, revision]);
    return data;
}
