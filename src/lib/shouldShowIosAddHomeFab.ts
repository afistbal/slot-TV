import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { isStandaloneDisplay } from '@/lib/isStandaloneDisplay';
import { isTikTokPlatform } from '@/platform';

/** TikTok Minis、Flutter 壳内不展示；普通 iOS/iPad H5 且非 standalone 时展示「添加桌面」入口 */
export function shouldShowIosAddHomeFab(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    if (isTikTokPlatform()) {
        return false;
    }
    const w = window as unknown as { flutter_inappwebview?: unknown };
    if (w.flutter_inappwebview) {
        return false;
    }
    return isIosLikeDevice() && !isStandaloneDisplay();
}
