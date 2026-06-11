import { X } from 'lucide-react';
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
    type RefObject,
} from 'react';
import { cn } from '@/lib/utils';
import { PC_DRAWER_DURATION_MS } from '../videoPlayerPcDrawerMotion';

export type VideoPlayerPcRightDrawerProps = {
    open: boolean;
    /** 与 open 错开一帧，驱动面板 translate 过渡 */
    entered: boolean;
    onClose: () => void;
    ariaLabel: string;
    children: ReactNode;
    className?: string;
    anchorRef: RefObject<HTMLElement | null>;
    /** 分集/简介抽屉在内容区自定义顶栏时设为 false */
    showPanelClose?: boolean;
};

/**
 * PC 右侧抽屉：面板 translate3d 滑入（与舞台共用 --pc-drawer-duration / --pc-drawer-ease）。
 * 滑入结束后移除 transform 合成层（--settled），减轻文字发糊。
 */
export function VideoPlayerPcRightDrawer({
    open,
    entered,
    onClose,
    ariaLabel,
    children,
    className,
    anchorRef,
    showPanelClose = true,
}: VideoPlayerPcRightDrawerProps) {
    const [frame, setFrame] = useState<Pick<CSSProperties, 'height' | 'minHeight'>>({});
    const [panelSettled, setPanelSettled] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const sync = () => {
            const anchor = anchorRef.current;
            if (!anchor) {
                return;
            }
            const h = Math.round(anchor.getBoundingClientRect().height);
            setFrame({ height: h, minHeight: h });
        };

        sync();
        const ro = new ResizeObserver(sync);
        const anchor = anchorRef.current;
        if (anchor) {
            ro.observe(anchor);
        }
        window.addEventListener('resize', sync);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', sync);
        };
    }, [anchorRef, open]);

    useEffect(() => {
        if (!open || !entered) {
            setPanelSettled(false);
        }
    }, [open, entered]);

    useEffect(() => {
        const panel = panelRef.current;
        if (!panel || !open || !entered) {
            return;
        }

        const settle = () => setPanelSettled(true);

        const onEnd = (e: TransitionEvent) => {
            if (e.target === panel && e.propertyName === 'transform') {
                settle();
            }
        };

        panel.addEventListener('transitionend', onEnd);
        const fallback = window.setTimeout(settle, PC_DRAWER_DURATION_MS + 80);
        return () => {
            panel.removeEventListener('transitionend', onEnd);
            window.clearTimeout(fallback);
        };
    }, [open, entered]);

    return (
        <aside
            className={cn(
                'video-pc-right-drawer',
                open && 'video-pc-right-drawer--open',
                entered && 'video-pc-right-drawer--entered',
                className,
            )}
            style={frame}
            role="dialog"
            aria-modal={open ? 'true' : undefined}
            aria-label={ariaLabel}
            aria-hidden={!open}
        >
            <div
                ref={panelRef}
                className={cn(
                    'video-pc-right-drawer__panel',
                    panelSettled && 'video-pc-right-drawer__panel--settled',
                )}
                style={frame}
            >
                {showPanelClose ? (
                    <button
                        type="button"
                        className="video-pc-right-drawer__close"
                        onClick={onClose}
                        aria-label="Close"
                        tabIndex={open ? 0 : -1}
                    >
                        <X className="h-5 w-5" aria-hidden />
                    </button>
                ) : null}
                {children}
            </div>
        </aside>
    );
}
