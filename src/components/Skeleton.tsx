import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { VideoCoverPlaceholderShell } from '@/components/VideoCoverPlaceholder';

export function MovieItem() {
    return (
        <div>
            <VideoCoverPlaceholderShell className="relative pb-[calc(100%*1.3325)]" />
            <div className="p-1 my-1">
                <Skeleton className="h-3 w-full bg-slate-300" />
                <Skeleton className="h-3 w-8/12 bg-slate-300 mt-1" />
            </div>
        </div>
    );
}

export function MovieImage({ className }: { className?: string }) {
    return (
        <VideoCoverPlaceholderShell
            className={cn('relative pb-[calc(100%*1.3325)]', className)}
        />
    );
}
