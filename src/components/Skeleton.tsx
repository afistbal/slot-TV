import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
import { VideoCoverPlaceholder } from "@/components/VideoCoverPlaceholder";

export function MovieItem() {
    return <div>
        <Skeleton className='relative bg-[#212121] pb-[calc(100%*1.3325)]'>
            <VideoCoverPlaceholder className='absolute inset-0' />
        </Skeleton>
        <div className='p-1 my-1'>
            <Skeleton className="h-3 w-full bg-slate-300" />
            <Skeleton className="h-3 w-8/12 bg-slate-300 mt-1" />
        </div>
    </div>;
}

export function MovieImage({ className }: { className?: string }) {
    return <Skeleton className={cn('relative animate-none bg-[#212121] pb-[calc(100%*1.3325)]', className)}>
        <VideoCoverPlaceholder className='absolute inset-0' />
    </Skeleton>;
}
