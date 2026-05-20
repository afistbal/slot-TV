import videoCoverPlaceholderLogo from '@/assets/images/img_logo@2x.png';
import { cn } from '@/lib/utils';

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
                className="video-cover-placeholder__logo"
            />
        </div>
    );
}
