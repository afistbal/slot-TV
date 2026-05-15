import { Navigate } from 'react-router';

/** 旧路由 `/page/my-balance` → `/wallet` */
export default function Component() {
    return <Navigate to="/wallet" replace />;
}
