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
            className={cn('reelshort-topnav__menu-icon', className)}
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
            <span className="reelshort-topnav__brand-text">
                {BRAND_DISPLAY_NAME}
            </span>
        );
    }
    return (
        <img
            src={BRAND_WORDMARK_SRC}
            alt=""
            className="reelshort-topnav__brand-wordmark"
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
            className="reelshort-topnav__profile-link"
            aria-label={intl.formatMessage({ id: 'profile' })}
        >
            {hasPhoto ? (
                <img
                    src={avatar}
                    alt=""
                    className="reelshort-topnav__profile-avatar"
                    referrerPolicy="no-referrer"
                />
            ) : (
                <div className="reelshort-topnav__profile-avatar--placeholder" />
            )}
        </Link>
    );
}

const subNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn('reelshort-topnav__primary-link', isActive && 'is-active');

const HEADER_SCROLL_SOLID_THRESHOLD = 4;

export type ReelShortTopNavProps = {
    /** 实际滚动的祖先节点（如首页 `overflow-y-auto` 容器）；在顶部透明，滚动后出现画布背景 */
    scrollParentRef?: RefObject<HTMLElement | null>;
    /** 是否展示二级横向导航（默认不展示；首页传 true） */
    showPrimaryNav?: boolean;
};

/**
 * 顶栏单行：汉堡 → Logo + 项目名 → 搜索 → 我的（Google 登录后展示头像）
 */
export function ReelShortTopNav({ scrollParentRef, showPrimaryNav = false }: ReelShortTopNavProps = {}) {
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
                    'reelshort-topnav',
                    headerSolid ? 'reelshort-topnav--solid' : 'reelshort-topnav--transparent',
                )}
            >
                <div className="reelshort-topnav__row">
                    <div className="reelshort-topnav__left">
                        <button
                            type="button"
                            className="reelshort-topnav__menu-btn"
                            onClick={() => setMenuOpen(true)}
                            aria-label={intl.formatMessage({ id: 'nav_open_menu' })}
                        >
                            <ReelShortMenuIcon className="reelshort-topnav__menu-btn-icon" />
                        </button>
                    </div>

                    <Link to="/" className="reelshort-topnav__brand-link">
                        <img src={BRAND_LOGO_SRC} alt="" className="reelshort-topnav__brand-logo" />
                        <BrandWordmark />
                    </Link>

                    <div className="reelshort-topnav__right">
                        <div className="reelshort-topnav__actions">
                            <div className="reelshort-topnav__search">
                                <ReelShortNavSearch />
                            </div>
                            <NavProfileAvatar />
                        </div>
                    </div>
                </div>

                {showPrimaryNav ? (
                    <nav
                        className="reelshort-topnav__primary-nav"
                        style={{ scrollbarWidth: 'none' }}
                        aria-label="Primary"
                    >
                        <NavLink to="/" end className={subNavLinkClass}>
                            <FormattedMessage id="home" />
                        </NavLink>
                        <NavLink to="/search" className={subNavLinkClass}>
                            <FormattedMessage id="nav_categories" />
                        </NavLink>
                        <button
                            type="button"
                            onClick={() => setBrandVideoOpen(true)}
                            className="reelshort-topnav__primary-brand-btn"
                        >
                            <FormattedMessage id="nav_brand" />
                        </button>
                    </nav>
                ) : null}
            </header>

            <ReelShortNavDrawer open={menuOpen} onOpenChange={setMenuOpen} />
            <ReelShortDramaWorldDialog open={brandVideoOpen} onOpenChange={setBrandVideoOpen} />
        </>
    );
}
