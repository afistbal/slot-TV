import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

export function VideoPlayerRatingDialog({
    open,
    title,
    score = 0,
    variant = 'pc',
    submitting = false,
    onOpenChange,
    onSubmit,
}: {
    open: boolean;
    title: string;
    score?: number;
    variant?: 'h5' | 'pc';
    submitting?: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (score: number) => void;
}) {
    const [previewScore, setPreviewScore] = useState(0);
    useEffect(() => {
        if (!open) setPreviewScore(0);
    }, [open]);
    const visibleScore = previewScore || score;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                contentPreset="plain"
                overlayClassName="bg-black/55 backdrop-blur-[2px]"
                className={cn(
                    'w-[calc(100%-24px)] max-w-[370px] overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(160deg,#22252b_0%,#15171b_64%,#101114_100%)] px-5 pb-6 pt-5 text-white shadow-[0_24px_80px_rgba(0,0,0,.65)]',
                    variant === 'h5' && 'top-auto bottom-[max(16px,env(safe-area-inset-bottom))] translate-y-0',
                )}
            >
                <DialogHeader className="items-center gap-1 text-center sm:text-center">
                    <span className="mb-1 grid h-10 w-10 place-items-center rounded-full bg-[#ffd54a]/10 text-[#ffd54a]">
                        <Sparkles className="h-5 w-5" aria-hidden />
                    </span>
                    <DialogTitle className="max-w-[290px] text-[16px] font-semibold leading-6">为《{title}》打分</DialogTitle>
                    <DialogDescription className="text-xs text-white/50">选择星级后立即提交</DialogDescription>
                </DialogHeader>
                <div className="flex items-center justify-center gap-1 py-5" onMouseLeave={() => setPreviewScore(0)}>
                    {[1, 2, 3, 4, 5].map((value) => (
                        <button
                            key={value}
                            type="button"
                            className="group rounded-full border-0 bg-transparent p-1.5 text-[#ffd54a] outline-none transition-transform duration-150 hover:scale-110 active:scale-90 disabled:pointer-events-none disabled:opacity-55"
                            aria-label={`${value} 星`}
                            disabled={submitting || score > 0}
                            onMouseEnter={() => setPreviewScore(value)}
                            onFocus={() => setPreviewScore(value)}
                            onClick={() => onSubmit(value)}
                        >
                            <Star
                                className={cn('h-9 w-9 stroke-[1.8] transition-all duration-150', visibleScore >= value ? 'fill-current drop-shadow-[0_0_6px_rgba(255,213,74,.25)]' : 'fill-transparent text-white/35')}
                            />
                        </button>
                    ))}
                </div>
                <div className="h-5 text-center text-xs text-white/45">
                    {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />正在提交</span> : visibleScore > 0 ? `${visibleScore} 星` : '轻触星星完成评分'}
                </div>
            </DialogContent>
        </Dialog>
    );
}
