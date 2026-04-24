import { FormattedMessage } from 'react-intl';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
    /** 点击的移除按钮，用于定位气泡 */
    anchorEl: HTMLElement | null;
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
};

/**
 * PC /profile Library 海报网格：移除确认（ReelShort 式气泡，无全屏蒙层）。
 */
export function MyListCabinetConfirmPopover({ anchorEl, open, onClose, onConfirm }: Props) {
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const [coords, setCoords] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

    const updatePosition = () => {
        if (!anchorEl) {
            return;
        }
        const r = anchorEl.getBoundingClientRect();
        setCoords({
            left: r.left + r.width / 2,
            top: r.top - 10,
        });
    };

    useLayoutEffect(() => {
        if (!open || !anchorEl) {
            return;
        }
        updatePosition();
    }, [open, anchorEl]);

    useEffect(() => {
        if (!open || !anchorEl) {
            return;
        }
        updatePosition();
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);
        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [open, anchorEl]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) {
            return;
        }
        const onPointerDown = (e: PointerEvent) => {
            const t = e.target as Node;
            if (panelRef.current?.contains(t)) {
                return;
            }
            if (anchorEl?.contains(t)) {
                return;
            }
            onClose();
        };
        document.addEventListener('pointerdown', onPointerDown, true);
        return () => document.removeEventListener('pointerdown', onPointerDown, true);
    }, [open, onClose, anchorEl]);

    if (!open || !anchorEl || typeof document === 'undefined') {
        return null;
    }

    return createPortal(
        <div
            ref={panelRef}
            className="rs-cabinet-confirm-popover"
            style={{
                position: 'fixed',
                left: coords.left,
                top: coords.top,
                transform: 'translate(-50%, -100%)',
                zIndex: 280,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <div className="rs-cabinet-confirm-popover__inner">
                <div className="rs-cabinet-confirm-popover__row">
                    <span className="rs-cabinet-confirm-popover__warnIcon" aria-hidden>
                        !
                    </span>
                    <p id={titleId} className="rs-cabinet-confirm-popover__text">
                        <FormattedMessage id="my_list_confirm_remove_story" />
                    </p>
                </div>
                <div className="rs-cabinet-confirm-popover__actions">
                    <button type="button" className="rs-cabinet-confirm-popover__btnCancel" onClick={onClose}>
                        <FormattedMessage id="cancel" />
                    </button>
                    <button type="button" className="rs-cabinet-confirm-popover__btnOk" onClick={onConfirm}>
                        <FormattedMessage id="my_list_confirm_ok" />
                    </button>
                </div>
            </div>
            <div className="rs-cabinet-confirm-popover__caret" aria-hidden />
        </div>,
        document.body,
    );
}
