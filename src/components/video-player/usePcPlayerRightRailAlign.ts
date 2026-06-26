import { useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

/** PC 右侧抽屉轨与 9:16 播放舞台同高、同顶对齐 */
export function usePcPlayerRightRailAlign(
    shellRef: RefObject<HTMLElement | null>,
    stageRef: RefObject<HTMLElement | null>,
    enabled: boolean,
): CSSProperties {
    const [style, setStyle] = useState<CSSProperties>({});

    useLayoutEffect(() => {
        if (!enabled) {
            setStyle({});
            return;
        }

        const sync = () => {
            const shell = shellRef.current;
            const stage = stageRef.current;
            if (!shell || !stage) {
                return;
            }
            /** Safari：flex + w-auto + aspect-ratio 首次宽度塌缩，用高度反推 9:16 宽 */
            const h = stage.clientHeight;
            if (h > 0) {
                const maxW = stage.parentElement?.clientWidth ?? shell.clientWidth;
                stage.style.width = `${Math.round(Math.min(maxW, (h * 9) / 16))}px`;
            }
            const shellRect = shell.getBoundingClientRect();
            const stageRect = stage.getBoundingClientRect();
            setStyle({
                top: `${Math.round(stageRect.top - shellRect.top)}px`,
                height: `${Math.round(stageRect.height)}px`,
            });
        };

        sync();
        const ro = new ResizeObserver(sync);
        const shell = shellRef.current;
        const stage = stageRef.current;
        const cluster = stage?.parentElement;
        if (shell) {
            ro.observe(shell);
        }
        if (cluster) {
            ro.observe(cluster);
        }
        if (stage) {
            ro.observe(stage);
        }
        window.addEventListener('resize', sync);
        return () => {
            stageRef.current?.style.removeProperty('width');
            ro.disconnect();
            window.removeEventListener('resize', sync);
        };
    }, [shellRef, stageRef, enabled]);

    return style;
}
