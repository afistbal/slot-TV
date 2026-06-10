/** douyin-feed-player + movie/info + episodes/batch 演示页 */
export const V_DEMO_PATH = '/v-demo';

export function isVDemoPathname(pathname: string): boolean {
    return pathname === V_DEMO_PATH || pathname.startsWith(`${V_DEMO_PATH}/`);
}
