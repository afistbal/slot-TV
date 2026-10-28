import { useEffect } from 'react';
import { Navigate } from 'react-router';
import { useTopUpStore } from '@/stores/topUp';

export default function TopUpRoute() {
    useEffect(() => useTopUpStore.getState().show(), []);
    return <Navigate to="/profile" replace />;
}
