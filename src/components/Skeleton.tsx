import { FormattedMessage } from "react-intl";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

export function MovieItem() {
    return <div>
        <Skeleton className='pb-[calc(100%*1.3325)] bg-slate-300 relative'>
            <div className='absolute w-full h-full flex justify-center items-center font-bold text-xl text-slate-400'>
                <FormattedMessage id="site_name" />
            </div>
        </Skeleton>
        <div className='p-1 my-1'>
            <Skeleton className="h-3 w-full bg-slate-300" />
            <Skeleton className="h-3 w-8/12 bg-slate-300 mt-1" />
        </div>
    </div>;
}

export function MovieImage({ className }: { className?: string }) {
    return <Skeleton className={cn('pb-[calc(100%*1.3325)] bg-slate-200 relative animate-none', className)}>
        <div className='absolute w-full h-full flex justify-center items-center font-bold text-xl text-slate-300'>
            <FormattedMessage id="site_name" />
        </div>
    </Skeleton>;
}