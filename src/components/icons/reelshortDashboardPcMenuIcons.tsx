import { cn } from '@/lib/utils';

type PcMenuIconProps = {
    className?: string;
};

/** ReelShort `dashboard_pc_menu` 同源矢量，内联以继承 `currentColor`（与静态文件 `assets/icons/profile-pc/*.svg` 一致） */
export function RsPcWalletMenuIcon({ className }: PcMenuIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
            className={cn('rs-profile__pc-menuSvg', className)}
        >
            <defs>
                <style>
                    {`.rs-pc-w-a,.rs-pc-w-b{fill:none}.rs-pc-w-a{stroke:currentColor;stroke-width:2px}.rs-pc-w-c{stroke:none}`}
                </style>
            </defs>
            <g transform="translate(57 27)">
                <g className="rs-pc-w-a" transform="translate(-57 -27)">
                    <rect width="20" height="20" className="rs-pc-w-c" rx="4" />
                    <rect width="18" height="18" x="1" y="1" className="rs-pc-w-b" rx="3" />
                </g>
                <g className="rs-pc-w-a" transform="translate(-47 -21)">
                    <rect width="10" height="8" className="rs-pc-w-c" rx="3" />
                    <rect width="8" height="6" x="1" y="1" className="rs-pc-w-b" rx="2" />
                </g>
                <rect width="3" height="2" rx="1" transform="translate(-53 -23)" />
            </g>
        </svg>
    );
}

export function RsPcMyListMenuIcon({ className }: PcMenuIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 19.999 20"
            fill="currentColor"
            aria-hidden
            className={cn('rs-profile__pc-menuSvg', className)}
        >
            <path d="M16.003 20.002h-12a4 4 0 0 1-4-4v-12a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v1h-2a2.982 2.982 0 0 0-.88-2.121 2.978 2.978 0 0 0-2.12-.879h-10a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3h2v1a4 4 0 0 1-4 4" />
            <path d="M18.642 9.152a1 1 0 0 1 0 1.7l-5.113 3.2a1 1 0 0 1-1.53-.852V6.8a1 1 0 0 1 1.53-.844Z" />
        </svg>
    );
}

export function RsPcHistoryMenuIcon({ className }: PcMenuIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
            className={cn('rs-profile__pc-menuSvg', className)}
        >
            <g transform="translate(46 17)" opacity={0.92}>
                <g transform="translate(-46 -17)" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="10" cy="10" r="10" stroke="none" />
                    <circle cx="10" cy="10" r="9" />
                </g>
                <rect width="2" height="8.701" rx="1" transform="translate(-37.272 -14.429)" />
                <rect width="2" height="8.701" rx="1" transform="rotate(90 -10.422 -18.149)" />
            </g>
        </svg>
    );
}

/** 与 `assets/icons/profile-pc/help.svg` 一致；内联以继承菜单 `currentColor` */
export function RsPcHelpMenuIcon({ className }: PcMenuIconProps) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 22 22"
            fill="none"
            aria-hidden
            className={cn('rs-profile__pc-menuSvg', className)}
        >
            <path
                d="M11 21C13.7614 21 16.2614 19.8807 18.0711 18.0711C19.8807 16.2614 21 13.7614 21 11C21 8.2386 19.8807 5.7386 18.0711 3.92893C16.2614 2.11929 13.7614 1 11 1C8.2386 1 5.7386 2.11929 3.92893 3.92893C2.11929 5.7386 1 8.2386 1 11C1 13.7614 2.11929 16.2614 3.92893 18.0711C5.7386 19.8807 8.2386 21 11 21Z"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinejoin="round"
            />
            <path
                d="M11 13.3125V11.3125C12.6568 11.3125 14 9.96935 14 8.3125C14 6.65565 12.6568 5.3125 11 5.3125C9.34315 5.3125 8 6.65565 8 8.3125"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M11 17.8125C11.6903 17.8125 12.25 17.2528 12.25 16.5625C12.25 15.8722 11.6903 15.3125 11 15.3125C10.3097 15.3125 9.75 15.8722 9.75 16.5625C9.75 17.2528 10.3097 17.8125 11 17.8125Z"
                fill="currentColor"
            />
        </svg>
    );
}
