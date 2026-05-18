export function stopPropagation(e: Event): void {
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
}

export function formatDuration(v: number): string {
    if (!v) {
        return '00:00';
    }
    const m = Math.floor(v / 60);
    const s = Math.round(v % 60);
    let str = '';
    if (m === 0) {
        str = '00';
    } else if (m > 0 && m < 10) {
        str = `0${m}`;
    } else {
        str = String(m);
    }
    str += ':';
    if (s === 0) {
        str += '00';
    } else if (s > 0 && s < 10) {
        str += `0${s}`;
    } else {
        str += String(s);
    }
    return str;
}

type SlideTouchPoint = { clientX: number; clientY: number; pageX: number; pageY: number };

export type PointerWithTouches = PointerEvent & { touches: SlideTouchPoint[] };

/** douyin `slide.ts` pointer → touches */
export function normalizePointerTouch(e: PointerEvent): e is PointerWithTouches {
    const pe = e as PointerWithTouches;
    pe.touches = [
        {
            clientX: e.clientX,
            clientY: e.clientY,
            pageX: e.pageX,
            pageY: e.pageY,
        },
    ];
    return true;
}
