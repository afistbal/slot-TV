import { LazyLoadImage } from 'react-lazy-load-image-component';
import { cn } from '@/lib/utils';
import { VideoCoverPlaceholderShell } from '@/components/VideoCoverPlaceholder';

export default function Image({
    height,
    width,
    src,
    alt,
    className,
    children,
}: {
    height: number;
    src: string;
    alt: string;
    className?: string;
    width?: string;
    children?: React.ReactNode;
}) {
    const hasSrc = Boolean(src?.trim());

    return (
        <div
            className={cn('relative overflow-hidden rounded-md', className)}
            style={{ paddingBottom: `calc(100%*${height})`, width: width ? width : 'auto' }}
        >
            <VideoCoverPlaceholderShell className="absolute inset-0 rounded-md" />
            {hasSrc ? (
                <LazyLoadImage
                    alt={alt}
                    src={src}
                    onLoad={(e) => {
                        e.currentTarget.style.opacity = '1';
                    }}
                    onError={(e) => {
                        e.currentTarget.style.opacity = '0';
                    }}
                    className="absolute top-0 left-0 z-[1] h-full w-full rounded-md object-cover opacity-0 transition-opacity duration-300"
                />
            ) : null}
            {children}
        </div>
    );
}
