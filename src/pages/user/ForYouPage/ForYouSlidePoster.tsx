import { cn } from '@/lib/utils';

type Props = {
    posterUrl: string;
    /** 当前条：起播前模糊，起播后渐清；邻条：静态封面 */
    variant: 'neighbor' | 'active-loading' | 'active-ready';
};

/**
 * For You 占位封面：active 条「模糊 → 清晰」，对齐旧 demo 竖滑观感。
 */
export function ForYouSlidePoster({ posterUrl, variant }: Props) {
    if (!posterUrl) {
        return <div className="foryou-slide-poster absolute inset-0 z-0 bg-black" aria-hidden />;
    }

    return (
        <div
            className={cn(
                'foryou-slide-poster absolute inset-0 z-0 bg-cover bg-center transition-[filter,transform,opacity] duration-500 ease-out',
                variant === 'neighbor' && 'foryou-slide-poster--neighbor',
                variant === 'active-loading' && 'foryou-slide-poster--blur',
                variant === 'active-ready' && 'foryou-slide-poster--sharp',
            )}
            style={{ backgroundImage: `url(${posterUrl})` }}
            aria-hidden
        />
    );
}
