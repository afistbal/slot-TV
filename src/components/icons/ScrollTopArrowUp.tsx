import scrollTopArrowUpSvg from '@/assets/icons/scroll-top-arrow-up.svg?raw';
import { cn } from '@/lib/utils';

type Props = {
    className?: string;
};

/** 与 Reel Short / Ant Design Icons `arrow-up` 同款 path，资源见 `assets/icons/scroll-top-arrow-up.svg` */
export function ScrollTopArrowUp({ className }: Props) {
    return (
        <span
            role="img"
            aria-hidden
            className={cn(
                'flex size-[18px] shrink-0 items-center justify-center text-current leading-none',
                className,
            )}
            // 单文件维护 SVG，避免与 assets 双份 path
            dangerouslySetInnerHTML={{ __html: scrollTopArrowUpSvg.trim() }}
        />
    );
}
