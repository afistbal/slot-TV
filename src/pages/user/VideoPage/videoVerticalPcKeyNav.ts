/** PC 竖滑页：↑/↓（及 PageUp/PageDown）切上一条/下一集；输入框与弹层内不响应 */
export type VerticalPcKeyNavAction = 'prev' | 'next';

export function shouldBypassVerticalPcKeyNav(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(
        target.closest(
            'input, textarea, select, [contenteditable="true"], [role="textbox"], [data-radix-dialog-content]',
        ),
    );
}

export function readVerticalPcKeyNavAction(e: KeyboardEvent): VerticalPcKeyNavAction | null {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) {
        return null;
    }
    if (shouldBypassVerticalPcKeyNav(e.target)) {
        return null;
    }
    switch (e.key) {
        case 'ArrowDown':
        case 'PageDown':
            return 'next';
        case 'ArrowUp':
        case 'PageUp':
            return 'prev';
        default:
            return null;
    }
}
