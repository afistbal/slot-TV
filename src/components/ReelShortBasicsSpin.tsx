import { cn } from "@/lib/utils";

type ReelShortBasicsSpinProps = {
    /** 为 false 时不渲染（方便父级条件渲染） */
    visible?: boolean;
    /** 是否显示半透明遮罩 */
    withOverlay?: boolean;
    /** 遮罩额外 class */
    overlayClassName?: string;
    /** modal：fixed 视口居中 + scale(0.6)；inline：在父级内居中 */
    variant?: "modal" | "inline";
    /** 根节点额外 class（例如调整 z-index） */
    className?: string;
    /** 读屏文案 */
    label?: string;
};

/**
 * ReelShort BasicsSpin 对标：#3d3d3d 方形容器 + 雪碧图三球帧动画（`rs-basics-spin__sprite`）
 * 样式：`src/styles/reelshort-basics-spin.scss`
 */
export function ReelShortBasicsSpin({
    visible = true,
    withOverlay = true,
    overlayClassName,
    variant = "modal",
    className,
    label = "Loading",
}: ReelShortBasicsSpinProps) {
    if (!visible) {
        return null;
    }

    const showShade = withOverlay && variant === "modal";

    return (
        <>
            {showShade ? (
                <div
                    className={cn("rs-basics-spin__shade", overlayClassName)}
                    aria-hidden
                />
            ) : null}
            <div
                className={cn(
                    "rs-basics-spin",
                    variant === "modal"
                        ? "rs-basics-spin--modal"
                        : "rs-basics-spin--inline",
                    className,
                )}
                role="status"
                aria-busy="true"
                aria-live="polite"
                aria-label={label}
            >
                <div className="rs-basics-spin__spin">
                    <div className="rs-basics-spin__sprite" aria-hidden />
                </div>
            </div>
        </>
    );
}
