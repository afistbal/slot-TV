import { useCallback, useRef } from 'react';

/** 视频 VIP 抽屉/弹窗关闭：先走挽留，返回 false 时保持打开 */
export function useVideoPanelCloseGuard(onVipOpenChange: (open: boolean) => void) {
    const handlerRef = useRef<(() => boolean) | null>(null);

    const registerPanelClose = useCallback((handler: () => boolean) => {
        handlerRef.current = handler;
    }, []);

    const onVipOpenChangeGuarded = useCallback(
        (next: boolean) => {
            if (next) {
                onVipOpenChange(true);
                return;
            }
            if (handlerRef.current && !handlerRef.current()) {
                return;
            }
            onVipOpenChange(false);
        },
        [onVipOpenChange],
    );

    return { registerPanelClose, onVipOpenChangeGuarded };
}
