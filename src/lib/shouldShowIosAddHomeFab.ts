import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { isStandaloneDisplay } from '@/lib/isStandaloneDisplay';

/** Flutter 壳内不展示；iOS/iPad 且非 standalone 时展示底部「加入主画面」入口 */
export function shouldShowIosAddHomeFab(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    const w = window as unknown as { flutter_inappwebview?: unknown };
    if (w.flutter_inappwebview) {
        return false;
    }
    return isIosLikeDevice() && !isStandaloneDisplay();
}
