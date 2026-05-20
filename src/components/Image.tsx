import { Skeleton } from "./ui/skeleton";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cn } from "@/lib/utils";
import { VideoCoverPlaceholder } from "@/components/VideoCoverPlaceholder";

export default function Image({ height, width, src, alt, className, children }: { height: number, src: string, alt: string, className?: string, width?: string, children?: React.ReactNode }) {
    return <div className={cn('relative overflow-hidden rounded-md', className)} style={{ paddingBottom: `calc(100%*${height})`, width: width ? width : 'auto' }}>
        <Skeleton className='absolute top-0 left-0 h-full w-full rounded-md bg-[#212121]'>
            <VideoCoverPlaceholder className='absolute inset-0' />
        </Skeleton>
        <LazyLoadImage
            alt={alt}
            src={src}
            onLoad={(e) => { e.currentTarget.style.opacity = '1'; }}
            onError={(e) => { e.currentTarget.style.opacity = '0'; }}
            className='top-0 left-0 absolute w-full h-full rounded-md object-cover transition-all duration-1000 opacity-0'
        />
        {children}
    </div>;
}
