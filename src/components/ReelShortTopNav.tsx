import type { RefObject } from 'react';
import { Link, NavLink } from 'react-router';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { ReelShortNavSearch } from '@/components/ReelShortNavSearch';
import { ReelShortNavDrawer } from '@/components/ReelShortNavDrawer';
import { ReelShortDramaWorldDialog } from '@/components/ReelShortDramaWorldDialog';
import { useUserStore } from '@/stores/user';
import { BRAND_DISPLAY_NAME, BRAND_LOGO_SRC, BRAND_WORDMARK_SRC } from '@/constants/brand';

/** ReelShort 首页同款汉堡图标（与镜像 HTML 内联 SVG 一致） */
export function ReelShortMenuIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            className={cn('text-white', className)}
            aria-hidden
        >
            <rect width="16" height="2" x="20" y="19" fill="currentColor" rx="1" transform="rotate(-180 20 19)" />
            <rect width="12" height="2" x="16" y="13" fill="currentColor" rx="1" transform="rotate(-180 16 13)" />
            <rect width="16" height="2" x="20" y="7" fill="currentColor" rx="1" transform="rotate(-180 20 7)" />
        </svg>
    );
}

function BrandWordmark() {
    const [useText, setUseText] = useState(false);
    if (useText) {
        return (
            <span className="min-w-0 truncate text-base font-bold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] sm:text-lg">
                {BRAND_DISPLAY_NAME}
            </span>
        );
    }
    return (
        <img
            src={BRAND_WORDMARK_SRC}
            alt=""
            className="h-6 max-w-[min(42vw,200px)] object-contain object-left sm:h-7"
            onError={() => setUseText(true)}
        />
    );
}

/** 顶栏「我的」：已登录且非匿名时展示后端/Google 头像，否则占位（与对标一致链到个人页） */
function NavProfileAvatar() {
    const intl = useIntl();
    const userStore = useUserStore();
    const avatar =
        userStore.signed && !userStore.isAnonymous()
            ? (userStore.info?.['avatar'] as string | undefined)
            : undefined;
    const hasPhoto = Boolean(avatar && String(avatar).trim().length > 0);

    return (
        <Link
            to="/profile"
            className="ml-0.5 shrink-0 md:ml-1"
            aria-label={intl.formatMessage({ id: 'profile' })}
        >
            {hasPhoto ? (
                <img
                    src={avatar}
                    alt=""
                    className="h-8 w-8 rounded-full border border-white/30 object-cover"
                    referrerPolicy="no-referrer"
                />
            ) : (
                <div className="h-8 w-8 rounded-full border border-white/30 bg-white/10" />
            )}
        </Link>
    );
}

const subNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
        'whitespace-nowrap border-b-2 px-0.5 pb-1 text-sm font-medium transition-colors',
        isActive
            ? 'border-white text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
            : 'border-transparent text-white/70 hover:text-white',
    );

const HEADER_SCROLL_SOLID_THRESHOLD = 4;

export type ReelShortTopNavProps = {
    /** 实际滚动的祖先节点（如首页 `overflow-y-auto` 容器）；在顶部透明，滚动后出现画布背景 */
    scrollParentRef?: RefObject<HTMLElement | null>;
};

/**
 * 顶栏单行：汉堡 → Logo + 项目名 → 搜索 → 我的（Google 登录后展示头像）
 */
export function ReelShortTopNav({ scrollParentRef }: ReelShortTopNavProps = {}) {
    const intl = useIntl();
    const [menuOpen, setMenuOpen] = useState(false);
    const [brandVideoOpen, setBrandVideoOpen] = useState(false);
    const [headerSolid, setHeaderSolid] = useState(false);

    useEffect(() => {
        const el = scrollParentRef?.current;
        if (!el) {
            return;
        }
        const sync = () => {
            setHeaderSolid(el.scrollTop > HEADER_SCROLL_SOLID_THRESHOLD);
        };
        sync();
        el.addEventListener('scroll', sync, { passive: true });
        return () => el.removeEventListener('scroll', sync);
    }, [scrollParentRef]);

    return (
        <>
            <header
                className={cn(
                    'sticky top-0 z-30 w-full transition-[background-color] duration-200',
                    headerSolid ? 'bg-app-canvas' : 'bg-transparent',
                )}
            >
                <div className="pointer-events-auto flex w-full items-center gap-2 px-3 pb-1 pt-2 md:gap-3 md:px-6">
                    <button
                        type="button"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white"
                        onClick={() => setMenuOpen(true)}
                        aria-label={intl.formatMessage({ id: 'nav_open_menu' })}
                    >
                        <ReelShortMenuIcon className="h-6 w-6" />
                    </button>

                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5 justify-center">
                        <img src={BRAND_LOGO_SRC} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                        <BrandWordmark />
                    </div>

                    <div className="flex shrink-0 items-center gap-1 md:gap-2">
                        <div className="ant-space-item">
                            <ReelShortNavSearch />
                        </div>
                        <NavProfileAvatar />
                    </div>
                </div>

                <nav
                    className="flex justify-center gap-4 overflow-x-auto px-3 pb-2 pt-1 md:gap-10 md:px-6 [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: 'none' }}
                    aria-label="Primary"
                >
                    <NavLink to="/" end className={subNavLinkClass}>
                        <FormattedMessage id="home" />
                    </NavLink>
                    <NavLink to="/page/search" className={subNavLinkClass}>
                        <FormattedMessage id="nav_categories" />
                    </NavLink>
                    <button
                        type="button"
                        onClick={() => setBrandVideoOpen(true)}
                        className={cn(
                            'whitespace-nowrap border-b-2 border-transparent px-0.5 pb-1 text-sm font-medium text-white/70 transition-colors hover:text-white',
                        )}
                    >
                        <FormattedMessage id="nav_brand" />
                    </button>
                </nav>
            </header>

            <ReelShortNavDrawer open={menuOpen} onOpenChange={setMenuOpen} />
            <ReelShortDramaWorldDialog open={brandVideoOpen} onOpenChange={setBrandVideoOpen} />
        </>
    );
}
