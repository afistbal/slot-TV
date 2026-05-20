import { LazyLoadImage } from 'react-lazy-load-image-component';
import { Skeleton } from '@/components/ui/skeleton';
import { VideoCoverPlaceholder } from '@/components/VideoCoverPlaceholder';
import { cn } from '@/lib/utils';

type VideoPosterLazyCoverProps = {
    src: string;
    alt?: string;
    skeletonClassName?: string;
    placeholderInnerClassName?: string;
    imageClassName?: string;
};

/** 封面骨架 + logo 占位 + LazyLoad 实图（加载前/失败时显示占位） */
export function VideoPosterLazyCover({
    src,
    alt = '',
    skeletonClassName,
    placeholderInnerClassName,
    imageClassName,
}: VideoPosterLazyCoverProps) {
    return (
        <>
            <Skeleton
                className={cn(
                    'rounded-[inherit] bg-[#212121]',
                    skeletonClassName ?? 'rs-bi-coverSkeleton',
                )}
            >
                <VideoCoverPlaceholder
                    className={cn(
                        placeholderInnerClassName ?? 'rs-bi-coverSkeletonInner',
                    )}
                />
            </Skeleton>
            <LazyLoadImage
                alt={alt}
                src={src}
                onLoad={(e) => {
                    e.currentTarget.style.opacity = '1';
                }}
                onError={(e) => {
                    e.currentTarget.style.opacity = '0';
                }}
                className={cn(
                    'absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-1000',
                    imageClassName,
                )}
            />
        </>
    );
}
