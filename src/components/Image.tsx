import { FormattedMessage } from "react-intl";
import { Skeleton } from "./ui/skeleton";
import { LazyLoadImage } from "react-lazy-load-image-component";
import { cn } from "@/lib/utils";

export default function Image({ height, width, src, alt, className, children }: { height: number, src: string, alt: string, className?: string, width?: string, children?: React.ReactNode }) {
    return <div className={cn("relative overflow-hidden rounded-md", className)} style={{ paddingBottom: `calc(100%*${height})`, width: width ? width : 'auto' }}>
        <Skeleton className='bg-slate-300 absolute w-full top-0 left-0 h-full rounded-md'>
            <div className='absolute w-full h-full flex justify-center items-center font-bold text-md text-slate-400'>
                <FormattedMessage id="site_name" />
            </div>
        </Skeleton>
        <LazyLoadImage alt={alt} src={src} onLoad={e => e.currentTarget.style.opacity = '1'} className='top-0 left-0 absolute w-full rounded-md transition-all duration-1000 opacity-0' />
        {children}
    </div>;
}