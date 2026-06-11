/** douyin-feed-player + movie/info + episodes/batch（生产路由 /video） */
export const V_DEMO_PATH = '/video';

const LEGACY_V_DEMO_PATH = '/v-demo';

export function buildVDemoPath(movieId: number, episodeNo?: number): string {
    if (episodeNo != null && episodeNo > 0) {
        return `${V_DEMO_PATH}/${movieId}/${episodeNo}`;
    }
    return `${V_DEMO_PATH}/${movieId}`;
}

export function isVDemoPathname(pathname: string): boolean {
    return (
        pathname === V_DEMO_PATH ||
        pathname.startsWith(`${V_DEMO_PATH}/`) ||
        pathname === LEGACY_V_DEMO_PATH ||
        pathname.startsWith(`${LEGACY_V_DEMO_PATH}/`)
    );
}
