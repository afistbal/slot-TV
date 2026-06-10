import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type FeedPlayerBottomBarProps = {
    children: ReactNode;
    className?: string;
    /** 全屏态底栏（仅进度 + 工具条，无 info 时可加） */
    fullscreen?: boolean;
};

/** Feed 底栏容器：渐变背景与 padding，与 For You / Video PC 的 `video-player-h5-bottom` 一致 */
export function FeedPlayerBottomBar({ children, className, fullscreen }: FeedPlayerBottomBarProps) {
    return (
        <div
            className={cn(
                'video-player-h5-bottom w-full',
                fullscreen && 'video-player-h5-bottom--fullscreen',
                className,
            )}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>
    );
}
