import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router';
import { topUpTabForUrl, useTopUpStore } from '@/stores/topUp';

export default function TopUpRoute() {
    const location = useLocation();
    useEffect(() => useTopUpStore.getState().show(topUpTabForUrl(new URL(`${location.pathname}${location.search}`, window.location.origin))), [location.pathname, location.search]);
    return <Navigate to="/profile" replace />;
}
