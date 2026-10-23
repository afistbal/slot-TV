import type { CSSProperties } from 'react';

const PROGRAM_ICON_PATHS = {
    check: '/icons/creator/check.svg',
    checkCircle: '/icons/creator/check-circle.svg',
    chevronDown: '/icons/creator/chevron-down.svg',
    chevronUp: '/icons/creator/chevron-up.svg',
    clock: '/icons/creator/clock.svg',
    coin: '/icons/creator/coin.svg',
    coins: '/icons/creator/coins.svg',
    crown: '/icons/creator/crown.svg',
    eye: '/icons/creator/eye.svg',
    flame: '/icons/creator/flame.svg',
    infinity: '/icons/creator/infinity.svg',
    lock: '/icons/creator/lock.svg',
    play: '/icons/creator/play.svg',
    send: '/icons/creator/send.svg',
    sparkle: '/icons/creator/sparkle.svg',
    telegram: '/icons/creator/telegram.svg',
    trending: '/icons/creator/trending.svg',
    unlock: '/icons/creator/unlock.svg',
    x: '/icons/creator/x.svg',
} as const;

export type ProgramIconName = keyof typeof PROGRAM_ICON_PATHS;

export function ProgramIcon({ name, className = '' }: { name: ProgramIconName; className?: string }) {
    const url = `url("${PROGRAM_ICON_PATHS[name]}")`;
    const style: CSSProperties = { WebkitMaskImage: url, maskImage: url };
    return <span aria-hidden="true" className={`program-local-icon ${className}`.trim()} style={style} />;
}
