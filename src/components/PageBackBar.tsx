import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PageBackBarProps = {
    title: ReactNode;
    /** 右侧区域（如图中的「⋯」） */
    trailing?: ReactNode;
    className?: string;
    onBack?: () => void;
};

/**
 * 内页公共顶栏：返回 + 居中标题 + 可选右侧操作（与 `layouts/user` 的 `Page` 头栏一致，可复用）
 * 使用三列网格，避免长标题盖住右侧 trailing。
 */
export function PageBackBar({ title, trailing, className, onBack }: PageBackBarProps) {
    const navigate = useNavigate();

    function handleBack() {
        if (onBack) {
            onBack();
            return;
        }
        navigate(-1);
    }

    const canBack = typeof window !== 'undefined' && window.history.length > 1;
    const isLtr = typeof document !== 'undefined' && document.body.style.direction === 'ltr';

    return (
        <div
            className={cn(
                'grid min-h-[calc(44/375*var(--app-vw))] w-full grid-cols-[minmax(2.5rem,auto)_minmax(0,1fr)_minmax(2.5rem,auto)] items-center gap-1 border-b border-white/10 bg-app-canvas px-2 text-white md:px-4',
                className,
            )}
        >
            <div className="flex min-h-10 min-w-[2.5rem] items-center justify-center">
                {canBack ? (
                    <button
                        type="button"
                        onClick={handleBack}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white/90 hover:bg-white/10 active:bg-white/15"
                    >
                        {isLtr ? <ChevronLeft className="h-7 w-7" /> : <ChevronRight className="h-7 w-7" />}
                    </button>
                ) : null}
            </div>

            <div className="min-w-0 truncate text-center text-lg">{title}</div>

            <div className="flex min-h-10 min-w-[2.5rem] items-center justify-end">{trailing ?? null}</div>
        </div>
    );
}
