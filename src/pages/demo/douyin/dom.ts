/** douyin `utils/dom.ts` → `_css` 直译 */
const pxReg = /^-?\d+.?\d*(px|pt|em|rem|vw|vh|%|rpx|ms)$/i;

export function css(el: HTMLElement, key: string, value?: string | number): number | string | undefined {
    if (value === undefined) {
        const val = window.getComputedStyle(el, null)[key as keyof CSSStyleDeclaration] as string;
        return pxReg.test(val) ? parseFloat(val) : val;
    }
    let v: string | number = value;
    if (
        ['top', 'left', 'bottom', 'right', 'width', 'height', 'font-size', 'margin', 'padding'].includes(key) &&
        typeof v === 'number'
    ) {
        v = `${v}px`;
    } else if (
        typeof v === 'string' &&
        ['top', 'left', 'bottom', 'right', 'width', 'height', 'font-size', 'margin', 'padding'].includes(key) &&
        !pxReg.test(v) &&
        !v.includes('calc')
    ) {
        v = `${v}px`;
    }
    if (key === 'transform') {
        const st = el.style as CSSStyleDeclaration & Record<string, string>;
        st.webkitTransform = st.MsTransform = st.msTransform = st.MozTransform = st.OTransform = st.transform =
            String(v);
    } else {
        el.style.setProperty(key, String(v));
    }
    return undefined;
}
