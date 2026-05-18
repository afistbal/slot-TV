import { demoBus, DEMO_EVENT_KEY } from './bus';

declare global {
    interface Window {
        isMoved?: boolean;
        isMuted?: boolean;
        showMutedNotice?: boolean;
    }
}

export function initDemoDouyinGlobals(): () => void {
    window.isMoved = false;
    window.isMuted = true;
    window.showMutedNotice = true;

    const resetVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    resetVh();
    window.addEventListener('resize', resetVh);

    const hideNoticeTimer = window.setTimeout(() => {
        demoBus.emit(DEMO_EVENT_KEY.HIDE_MUTED_NOTICE);
        window.showMutedNotice = false;
    }, 2000);

    const onRemoveMuted = () => {
        window.isMuted = false;
    };
    demoBus.on(DEMO_EVENT_KEY.REMOVE_MUTED, onRemoveMuted);

    return () => {
        window.clearTimeout(hideNoticeTimer);
        window.removeEventListener('resize', resetVh);
        demoBus.off(DEMO_EVENT_KEY.REMOVE_MUTED, onRemoveMuted);
    };
}
