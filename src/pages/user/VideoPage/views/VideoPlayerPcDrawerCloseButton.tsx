import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    onClose: () => void;
    className?: string;
    tabIndex?: number;
};

export function VideoPlayerPcDrawerCloseButton({ onClose, className, tabIndex = 0 }: Props) {
    return (
        <button
            type="button"
            className={cn('video-pc-right-drawer__close video-pc-right-drawer__close--inline', className)}
            onClick={onClose}
            aria-label="Close"
            tabIndex={tabIndex}
        >
            <X className="h-5 w-5" aria-hidden />
        </button>
    );
}
