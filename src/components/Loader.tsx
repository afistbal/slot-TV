import { cn } from "@/lib/utils";
import { LoaderCircle } from "lucide-react";

export default function Loader({color = 'dark'}: {color?: 'dark' | 'light'}) {
    return <div className="flex-1 w-full h-full flex justify-center items-center">
        <div className="w-16 h-16 flex justify-center items-center">
            <LoaderCircle className={cn("w-8 h-8 animate-[spin_1.5s_ease_infinite]", color === 'dark' ? 'text-slate-400' : 'text-slate-100')} />
        </div>
    </div>;
}