/** react-vertical-feed + foryou 接口演示页 */
export const FOR_DEMO_PATH = '/for-demo';

export function isForDemoPathname(pathname: string): boolean {
    return pathname === FOR_DEMO_PATH || pathname.startsWith(`${FOR_DEMO_PATH}/`);
}
