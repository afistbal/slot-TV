import { useCallback, useEffect, useRef, useState } from 'react';

export const OVERLAY_AUTO_HIDE_MS = 3000;

/** Feed 底栏（info + 进度 + 工具栏）：3s 无操作自动隐藏 */
export function useOverlayAutoHide(enabled: boolean, resetKey?: number) {
    const [visible, setVisible] = useState(true);
    const timerRef = useRef<number | null>(null);
    const enabledRef = useRef(enabled);
    enabledRef.current = enabled;

    const clearTimer = useCallback(() => {
        if (timerRef.current != null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const scheduleHide = useCallback(() => {
        clearTimer();
        timerRef.current = window.setTimeout(() => {
            if (enabledRef.current) {
                setVisible(false);
            }
            timerRef.current = null;
        }, OVERLAY_AUTO_HIDE_MS);
    }, [clearTimer]);

    const hide = useCallback(() => {
        if (!enabledRef.current) return;
        clearTimer();
        setVisible(false);
    }, [clearTimer]);

    const show = useCallback(() => {
        if (!enabledRef.current) return;
        setVisible(true);
        scheduleHide();
    }, [scheduleHide]);

    const bump = useCallback(() => {
        show();
    }, [show]);

    useEffect(() => {
        if (!enabled) {
            clearTimer();
            setVisible(true);
            return;
        }
        show();
    }, [clearTimer, enabled, show]);

    useEffect(() => {
        if (!enabled || resetKey == null) return;
        show();
    }, [enabled, resetKey, show]);

    useEffect(() => () => clearTimer(), [clearTimer]);

    return { visible, show, hide, bump };
}
