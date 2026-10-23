import type { CSSProperties } from 'react';
import type { LuckyIconName } from '@/api/lucky';

// Original SVG paths extracted from the supplied chunlou.tv (2) Icon component.
// All icons are bundled locally; no remote icon requests or icon-font dependency.
export function LuckyIcon({ name, size = 18, filled = false }: { name: LuckyIconName; size?: number; filled?: boolean }) {
    const file = filled && name === 'star' ? 'star-filled' : name;
    const url = `url("/icons/lucky/${file}.svg")`;
    const style: CSSProperties = { width: size, height: size, maskImage: url, WebkitMaskImage: url };
    return <span aria-hidden="true" className={`lucky-local-icon${filled ? ' is-filled' : ''}`} style={style} />;
}
