/** react-vertical-feed + foryou 接口（生产路由 /foryou） */
export const FOR_DEMO_PATH = '/foryou';

const LEGACY_FOR_DEMO_PATH = '/for-demo';

export function isForDemoPathname(pathname: string): boolean {
    return (
        pathname === FOR_DEMO_PATH ||
        pathname.startsWith(`${FOR_DEMO_PATH}/`) ||
        pathname === LEGACY_FOR_DEMO_PATH ||
        pathname.startsWith(`${LEGACY_FOR_DEMO_PATH}/`)
    );
}
