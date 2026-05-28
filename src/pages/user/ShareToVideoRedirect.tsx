import { Navigate, useLocation, useParams, useSearchParams } from 'react-router';

const SHARE_EPISODE_QUERY_KEY = 'v';

/** `/share/:id?v=` → `/video/:id/:episode` */
export default function ShareToVideoRedirect() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    if (!id) {
        return <Navigate to="/" replace />;
    }
    const rest = new URLSearchParams(searchParams);
    const episode = rest.get(SHARE_EPISODE_QUERY_KEY)?.trim();
    rest.delete(SHARE_EPISODE_QUERY_KEY);
    const qs = rest.toString();
    const suffix = qs ? `?${qs}` : '';
    if (episode) {
        return <Navigate to={`/video/${id}/${episode}${suffix}`} replace state={location.state} />;
    }
    return <Navigate to={`/video/${id}${suffix}`} replace state={location.state} />;
}
