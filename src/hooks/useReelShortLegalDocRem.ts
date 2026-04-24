import { useEffect } from "react";

/** 与 ReelShort 静态条款页一致：根字号 = clamp(320..600 视口宽) / 7.5（rem 基准）。 */
export function useReelShortLegalDocRem(active: boolean) {
    useEffect(() => {
        if (!active || typeof document === "undefined") {
            return;
        }
        const prev = document.documentElement.style.fontSize;

        function resize() {
            let w = document.documentElement.clientWidth || window.innerWidth;
            if (w >= 600) {
                w = 600;
            }
            if (w <= 320) {
                w = 320;
            }
            document.documentElement.style.fontSize = `${w / 7.5}px`;
        }

        resize();
        window.addEventListener("resize", resize);
        return () => {
            document.documentElement.style.fontSize = prev;
            window.removeEventListener("resize", resize);
        };
    }, [active]);
}
