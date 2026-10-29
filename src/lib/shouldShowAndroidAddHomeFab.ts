import { isStandaloneDisplay } from '@/lib/isStandaloneDisplay';

/** Android H5 also offers manual instructions when the browser has no install event. */
export function shouldShowAndroidAddHomeFab(): boolean {
    if (typeof window === 'undefined' || import.meta.env.VITE_PLATFORM === 'tiktok') return false;
    const shell = window as Window & { flutter_inappwebview?: unknown };
    return !shell.flutter_inappwebview && /Android/i.test(navigator.userAgent) && !isStandaloneDisplay();
}
