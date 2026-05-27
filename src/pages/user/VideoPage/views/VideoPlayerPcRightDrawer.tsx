import { X } from 'lucide-react';
import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';

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

    useLayoutEffect(() => {
        const sync = () => {
            const anchor = anchorRef.current;
            if (!anchor) {
                return;
            }
            const h = anchor.getBoundingClientRect().height;
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
            <div className="video-pc-right-drawer__panel">
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
