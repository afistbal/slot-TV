import { cn } from '@/lib/utils';

/**
 * 与 ReelShort BasicsSpin 同一套 DOM/CSS（`reelshort-basics-spin.scss`）：
 * #3d3d3d 圆角方形容器 + 雪碧图三球动画（`rs-basics-spin__sprite`）。
 */
export default function Loader({ color = 'dark' }: { color?: 'dark' | 'light' }) {
    return (
        <div className="flex h-full w-full flex-1 items-center justify-center">
            <div
                className={cn(
                    'rs-basics-spin rs-basics-spin--embed',
                    color === 'light' && 'rs-basics-spin--embed-light',
                )}
                role="status"
                aria-busy="true"
                aria-label="Loading"
            >
                <div className="rs-basics-spin__spin">
                    <div className="rs-basics-spin__sprite" aria-hidden />
                </div>
            </div>
        </div>
    );
}
