import videoCoverPlaceholderLogo from '@/assets/images/img_logo@2x.png';
import { cn } from '@/lib/utils';
import '@/styles/video-cover-placeholder.scss';

/** 视频封面未加载时的 logo 占位（`img_logo@2x.png`） */
export function VideoCoverPlaceholder({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'video-cover-placeholder flex h-full w-full flex-col items-center justify-center p-2',
                className,
            )}
            aria-hidden
        >
            <img
                src={videoCoverPlaceholderLogo}
                alt=""
                decoding="sync"
                loading="eager"
                fetchPriority="high"
                className="video-cover-placeholder__logo"
            />
        </div>
    );
}

/** 封面骨架层：灰底 + 居中 logo，无 pulse，实图加载前始终可见 */
export function VideoCoverPlaceholderShell({
    className,
    innerClassName,
}: {
    className?: string;
    innerClassName?: string;
}) {
    return (
        <div className={cn('video-cover-skeleton', className)} aria-hidden>
            <VideoCoverPlaceholder className={cn('absolute inset-0', innerClassName)} />
        </div>
    );
}
