import { useCallback, useEffect, useRef, useState } from 'react';

export const OVERLAY_AUTO_HIDE_MS = 3000;

/** Feed 底栏：播放中 3s 无操作自动隐藏；暂停时常显 */
export function useOverlayAutoHide(
    enabled: boolean,
    resetKey?: number,
    autoHideActive = true,
) {
    const [visible, setVisible] = useState(true);
    const timerRef = useRef<number | null>(null);
    const enabledRef = useRef(enabled);
    const autoHideActiveRef = useRef(autoHideActive);
    enabledRef.current = enabled;
    autoHideActiveRef.current = autoHideActive;

    const clearTimer = useCallback(() => {
        if (timerRef.current != null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const scheduleHide = useCallback(() => {
        if (!enabledRef.current || !autoHideActiveRef.current) return;
        clearTimer();
        timerRef.current = window.setTimeout(() => {
            if (enabledRef.current && autoHideActiveRef.current) {
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
        if (autoHideActiveRef.current) {
            scheduleHide();
        } else {
            clearTimer();
        }
    }, [clearTimer, scheduleHide]);

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

    useEffect(() => {
        if (!enabled) return;
        if (!autoHideActive) {
            clearTimer();
            setVisible(true);
            return;
        }
        scheduleHide();
    }, [autoHideActive, clearTimer, enabled, scheduleHide]);

    useEffect(() => () => clearTimer(), [clearTimer]);

    return { visible, show, hide, bump };
};
