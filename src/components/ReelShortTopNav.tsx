import type { RefObject } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLayoutEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { ReelShortNavDrawer } from '@/components/ReelShortNavDrawer';
import { ReelShortDramaWorldDialog } from '@/components/ReelShortDramaWorldDialog';
import { useUserStore } from '@/stores/user';
import { useRootStore } from '@/stores/root';
import { APP_LANGUAGES } from '@/constants/appLanguages';
import { BRAND_DISPLAY_NAME, BRAND_LOGO_SRC } from '@/constants/brand';
import iconHead from '@/assets/images/icon_head.739421aa.png';
import iconLangGlobe from '@/assets/icons/topnav-language-globe.svg';
import iconLangChevron from '@/assets/icons/topnav-language-chevron.svg';
import { getUserAvatarDisplayUrl } from '@/lib/userAvatar';

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

function TopNavSearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="currentColor"
      className={cn('shrink-0 text-current', className)}
      aria-hidden
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M6.5 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M1 6.5a5.5 5.5 0 1 1 9.727 3.52l3.127 3.126-.708.708-3.126-3.127A5.5 5.5 0 0 1 1 6.5"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** 顶栏「进入搜索页」入口（与 /search 页内大搜索框分离，不共用 ReelShortNavSearch 组件） */
function TopNavSearchEntry() {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <button
      type="button"
      role="search-control"
      aria-label={intl.formatMessage({ id: 'flix_search' })}
      className={cn(
        'reelshort-topnav__search-entry',
        'relative flex cursor-pointer flex-col items-center justify-center text-white',
        'hover:text-[var(--rs-brand,#d4a853)]',
      )}
      onClick={() => navigate('/search')}
    >
      <span role="img" className="reelshort-topnav__search-icon-wrap text-[min(6vw,1.5rem)] text-current md:text-2xl">
        <TopNavSearchIcon className="h-[1em] w-[1em]" />
      </span>
      <div className="hidden text-base lg:block">
        <FormattedMessage id="nav_search_label" />
      </div>
    </button>
  );
}

function BrandWordmark() {
  return (
    <span className="reelshort-topnav__brand-text">
      {BRAND_DISPLAY_NAME}
    </span>
  );
}

function TopNavLanguageSwitcher() {
  const rootStore = useRootStore();
  const current = APP_LANGUAGES.find((v) => v.code === rootStore.locale) ?? APP_LANGUAGES[0];

  return (
    <div className="reelshort-topnav__lang group">
      <button
        type="button"
        className="reelshort-topnav__lang-trigger"
        aria-haspopup="menu"
        aria-expanded={undefined}
        aria-label="Language"
      >
        <span
          className="reelshort-topnav__lang-globe"
          aria-hidden
          style={{ ['--lang-icon-url' as string]: `url("${iconLangGlobe}")` }}
        />
        <span className="reelshort-topnav__lang-text">{current.label}</span>
        <span
          className="reelshort-topnav__lang-chevron"
          aria-hidden
          style={{ ['--lang-chevron-url' as string]: `url("${iconLangChevron}")` }}
        />
      </button>
      <div className="reelshort-topnav__lang-menu" role="menu" aria-label="Language options">
        {APP_LANGUAGES.map((lang) => {
          const active = lang.code === rootStore.locale;
          return (
            <button
              key={lang.code}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              className={cn('reelshort-topnav__lang-item', active && 'is-active')}
              onClick={() => {
                if (rootStore.locale === lang.code) return;
                localStorage.setItem('locale', lang.code);
                window.location.reload();
              }}
            >
              {lang.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 顶栏「我的」：已登录且非匿名时展示后端 / Google（含 localStorage user-avatar）头像，否则占位 */
function NavProfileAvatar() {
  const intl = useIntl();
  const userStore = useUserStore();
  const avatar =
    userStore.signed && !userStore.isAnonymous()
      ? getUserAvatarDisplayUrl(userStore.info as { [key: string]: unknown } | undefined)
      : undefined;
  const hasPhoto = Boolean(avatar);

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
          onError={() => {
            try {
              localStorage.removeItem('user-avatar');
            } catch {
              /* ignore */
            }
            userStore.update({ avatar: '' });
          }}
        />
      ) : (
        <img
          src={iconHead}
          alt=""
          className="reelshort-topnav__profile-avatar--placeholder"
        />
      )}
    </Link>
  );
}

const HEADER_SCROLL_SOLID_THRESHOLD = 4;

export type ReelShortTopNavProps = {
  /** 实际滚动的祖先节点（如首页 `overflow-y-auto` 容器）；在顶部透明，滚动后出现画布背景 */
  scrollParentRef?: RefObject<HTMLElement | null>;
  /** 是否展示二级横向导航（默认不展示；首页传 true） */
  showPrimaryNav?: boolean;
  /** 内页标题左侧是否显示品牌 icon */
  showTitleIcon?: boolean;
  /** 是否展示左侧菜单/返回按钮 */
  showLeftAction?: boolean;
  /** 是否展示搜索入口 */
  showSearch?: boolean;
  /** 是否展示右侧头像（跳转 profile）入口 */
  showProfile?: boolean;
};

/**
 * 顶栏单行：汉堡 → Logo + 项目名 → 搜索 → 我的（Google 登录后展示头像）
 */
export function ReelShortTopNav({
  scrollParentRef,
  showPrimaryNav = false,
  showLeftAction = true,
  showSearch = showPrimaryNav,
  showProfile = true,
}: ReelShortTopNavProps = {}) {
  const intl = useIntl();
  const [menuOpen, setMenuOpen] = useState(false);
  const [brandVideoOpen, setBrandVideoOpen] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);
  const allowTransparent = showPrimaryNav;

  useLayoutEffect(() => {
    // 只有首页（展示 primary nav）才允许顶部透明覆盖 Banner。
    // 内页顶部统一黑底，避免“透明/实色”切换带来的视觉闪动。
    if (!allowTransparent) {
      setHeaderSolid(true);
      return;
    }
    if (!scrollParentRef) {
      return;
    }

    let cancelled = false;
    let raf = 0;
    let detach: (() => void) | undefined;
    let attachAttempts = 0;
    const maxAttachAttempts = 24;

    const attach = (el: HTMLElement) => {
      const sync = () => {
        if (raf) return;
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          const next = el.scrollTop > HEADER_SCROLL_SOLID_THRESHOLD;
          setHeaderSolid((prev) => (prev === next ? prev : next));
        });
      };

      const initial = el.scrollTop > HEADER_SCROLL_SOLID_THRESHOLD;
      setHeaderSolid((prev) => (prev === initial ? prev : initial));

      el.addEventListener('scroll', sync, { passive: true });
      return () => {
        if (raf) {
          window.cancelAnimationFrame(raf);
          raf = 0;
        }
        el.removeEventListener('scroll', sync);
      };
    };

    const tryAttach = () => {
      if (cancelled) return;
      const el = scrollParentRef.current;
      if (el) {
        detach = attach(el);
        return;
      }
      attachAttempts += 1;
      if (attachAttempts >= maxAttachAttempts) {
        return;
      }
      window.requestAnimationFrame(tryAttach);
    };

    tryAttach();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, [allowTransparent, scrollParentRef]);

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
            {showLeftAction ? (
              <button
                type="button"
                className="reelshort-topnav__menu-btn"
                onClick={() => setMenuOpen(true)}
                aria-label={intl.formatMessage({ id: 'nav_open_menu' })}
              >
                <ReelShortMenuIcon className="reelshort-topnav__menu-btn-icon" />
              </button>
            ) : null}
          </div>

          <Link to="/" className="reelshort-topnav__brand-link">
              <img src={BRAND_LOGO_SRC} alt="" className="reelshort-topnav__brand-logo" />
              <BrandWordmark />
            </Link>

          <div className="reelshort-topnav__right">
            <div className="reelshort-topnav__actions">
              {showSearch ? (
                <div className="reelshort-topnav__search">
                  <TopNavSearchEntry />
                </div>
              ) : null}
              <TopNavLanguageSwitcher />
              {showProfile ? <NavProfileAvatar /> : null}
            </div>
          </div>
        </div>

        {/* {showPrimaryNav ? (
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
        ) : null} */}
      </header>

      <ReelShortNavDrawer open={menuOpen} onOpenChange={setMenuOpen} />
      <ReelShortDramaWorldDialog open={brandVideoOpen} onOpenChange={setBrandVideoOpen} />
    </>
  );
}
