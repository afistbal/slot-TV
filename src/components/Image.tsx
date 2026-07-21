import { LazyLoadImage } from 'react-lazy-load-image-component';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { VideoCoverPlaceholderShell } from '@/components/VideoCoverPlaceholder';

export default function Image({
    height,
    width,
    src,
    alt,
    className,
    imageClassName,
    children,
}: {
    height: number;
    src: string;
    alt: string;
    className?: string;
    imageClassName?: string;
    width?: string;
    children?: React.ReactNode;
}) {
    const hasSrc = Boolean(src?.trim());
    const [loaded, setLoaded] = useState(false);

    return (
        <div
            className={cn('relative overflow-hidden rounded-md', loaded && 'is-image-loaded', className)}
            style={{ paddingBottom: `calc(100%*${height})`, width: width ? width : 'auto' }}
        >
            <VideoCoverPlaceholderShell className="absolute inset-0 rounded-md image-placeholder" />
            {hasSrc ? (
                <LazyLoadImage
                    alt={alt}
                    src={src}
                    decoding="async"
                    onLoad={(e) => {
                        setLoaded(true);
                        e.currentTarget.style.opacity = '1';
                    }}
                    onError={(e) => {
                        setLoaded(false);
                        e.currentTarget.style.opacity = '0';
                    }}
                    className={cn(
                        'absolute top-0 left-0 z-[1] h-full w-full rounded-md object-cover opacity-0 transition-opacity duration-300',
                        imageClassName,
                    )}
                />
            ) : null}
            {children}
        </div>
    );
}
