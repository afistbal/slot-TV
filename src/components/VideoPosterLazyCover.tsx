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
                        const image = e.currentTarget;
                        const cover = image.closest<HTMLElement>('.BookItem_cover__W2qbR');

                        if (cover) {
                            // 首页封面统一横向铺满，纵向居中适度裁剪，避免出现明显的左右空区。
                            image.dataset.homeCoverFit = 'cover';
                            cover.style.removeProperty('--home-cover-contained-scale');
                            cover.style.removeProperty('--home-cover-backdrop-image');
                        }

                        image.style.opacity = '1';
                    }}
                    onError={(e) => {
                        e.currentTarget.style.opacity = '0';
                    }}
                    className={cn('video-poster-lazy-cover__image', imageClassName)}
                />
            ) : null}
        </>
    );
}
