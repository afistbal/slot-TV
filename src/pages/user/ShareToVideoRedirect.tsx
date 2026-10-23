import { Navigate, useLocation, useParams, useSearchParams } from 'react-router';

/** 推广分享落 For You；剧集分享落剧详情。 */
export default function ShareToVideoRedirect() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    if (!id) {
        return <Navigate to="/" replace />;
    }
    const rest = new URLSearchParams(searchParams);
    if (id.startsWith('cf')) {
        if (!rest.get('ref') && id.length > 2) rest.set('ref', id.slice(2));
        rest.set('s', 'share');
        return <Navigate to={`/foryou?${rest.toString()}`} replace state={location.state} />;
    }
    rest.delete('v');
    const qs = rest.toString();
    const suffix = qs ? `?${qs}` : '';
    return <Navigate to={`/drama/${id}${suffix}`} replace state={location.state} />;
}
