import { LazyLoadImage } from 'react-lazy-load-image-component';
import {
    VideoCoverPlaceholderShell,
} from '@/components/VideoCoverPlaceholder';
import { cn } from '@/lib/utils';

type VideoPosterLazyCoverProps = {
    src: string;
    alt?: string;
    skeletonClassName?: string;
    placeholderInnerClassName?: string;
    imageClassName?: string;
    /** 首屏/轮播首帧：不等待进视口才拉封面 */
    priority?: boolean;
};

/** 封面：先展示 logo 占位图，远程海报加载后淡入覆盖 */
export function VideoPosterLazyCover({
    src,
    alt = '',
    skeletonClassName,
    placeholderInnerClassName,
    imageClassName,
    priority = false,
}: VideoPosterLazyCoverProps) {
    const hasSrc = Boolean(src?.trim());

    return (
        <>
            <VideoCoverPlaceholderShell
                className={cn(skeletonClassName ?? 'rs-bi-coverSkeleton')}
                innerClassName={placeholderInnerClassName ?? 'rs-bi-coverSkeletonInner'}
            />
            {hasSrc ? (
                <LazyLoadImage
                    alt={alt}
                    src={src}
                    visibleByDefault={priority}
                    onLoad={(e) => {
                        e.currentTarget.style.opacity = '1';
                    }}
                    onError={(e) => {
                        e.currentTarget.style.opacity = '0';
                    }}
                    className={cn(
                        'absolute inset-0 z-[1] h-full w-full object-cover opacity-0 transition-opacity duration-300',
                        imageClassName,
                    )}
                />
            ) : null}
        </>
    );
}
