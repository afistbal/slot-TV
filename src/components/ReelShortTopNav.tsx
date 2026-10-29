import type { RefObject } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import '@/styles/reelshort.scss';
import { cn } from '@/lib/utils';
import { api, type IPagination, type TData } from '@/api';
import { ReelShortNavDrawer } from '@/components/ReelShortNavDrawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUserStore } from '@/stores/user';
import { useRootStore } from '@/stores/root';
import { useLuckyStore } from '@/stores/lucky';
import { DesktopProfileMenu } from '@/components/DesktopProfileMenu';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { APP_LANGUAGES } from '@/constants/appLanguages';
import {
  BRAND_DISPLAY_NAME,
  BRAND_LOGO_SRC,
  BRAND_TOPNAV_WORDMARK_HEIGHT,
  BRAND_TOPNAV_WORDMARK_SRC,
  BRAND_TOPNAV_WORDMARK_WIDTH,
} from '@/constants/brand';
import iconLangGlobe from '@/assets/icons/topnav-language-globe.svg';
import iconLangChevron from '@/assets/icons/topnav-language-chevron.svg';
import iconTopnavDownload from '@/assets/icons/topnav-download.svg';
import { getUserAvatarDisplayUrl } from '@/lib/userAvatar';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import { FORYOU_PATH } from '@/constants/foryouRoute';
import { useConfigStore } from '@/stores/config';
import { logoutToAnonymousSession } from '@/lib/logoutToAnonymousSession';
import { prefetchLuckyRouteChunk, prefetchSearchRouteChunk } from '@/lib/prefetchSecondaryUserRoutes';
import { shouldShowIosAddHomeFab } from '@/lib/shouldShowIosAddHomeFab';
import usePixel from '@/hooks/usePixel';

import { Bell, ChevronLeft, ChevronRight, Coins, Gift, Search, Sparkles } from 'lucide-react';

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

function TopNavHistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 21 20"
      fill="none"
      className={cn('reelshort-topnav__history-icon', className)}
      aria-hidden
    >
      <g clipPath="url(#topnav_history_clip)">
        <path
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeMiterlimit="10"
          strokeWidth="1.5"
          d="M19.544 9.998a9.044 9.044 0 1 1-18.089 0 9.044 9.044 0 0 1 18.089 0"
        />
        <path fill="currentColor" d="M11.38 4.658a.88.88 0 0 0-1.76 0v5.679a.88.88 0 0 0 1.76 0z" />
        <path fill="currentColor" d="M12.614 12.971a.88.88 0 0 0 1.035-1.423l-2.511-1.826a.88.88 0 1 0-1.035 1.424z" />
      </g>
      <defs>
        <clipPath id="topnav_history_clip">
          <path fill="currentColor" d="M.5 0h20v20H.5z" />
        </clipPath>
      </defs>
    </svg>
  );
}

const PROFILE_AVATAR_TONES = ['amber', 'coral', 'violet', 'blue', 'teal', 'rose'] as const;

function getProfileAvatarFallback(name: string, uid: string) {
  const seed = (name || uid || BRAND_DISPLAY_NAME).trim();
  const initial = Array.from(seed)[0]?.toLocaleUpperCase() || 'Y';
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  }
  return {
    initial,
    tone: PROFILE_AVATAR_TONES[hash % PROFILE_AVATAR_TONES.length],
  };
}

function dedupeMovieRowsById(rows: TData[]): TData[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const k = String(row['id']);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function fetchSearchDropdownMovies(keyword: string): Promise<TData[]> {
  const res = await api<IPagination>('movie', {
    loading: false,
    data: {
      page: 1,
      keyword: keyword.trim(),
      tag: '',
    },
  });
  return dedupeMovieRowsById([...res.d.data]).slice(0, 10);
}

/** 顶栏搜索：H5 跳转 /search；PC（md+）为对标 ReelShort 的下拉搜索面板 */
function TopNavSearchEntry() {
  const intl = useIntl();
  const navigate = useNavigate();
  const location = useLocation();
  const isMd = useMinWidth768();
  const configStore = useConfigStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [list, setList] = useState<TData[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hotCacheRef = useRef<TData[] | null>(null);
  const debounceRef = useRef(0);
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    if (!isMd || !open) return;
    inputRef.current?.focus();
  }, [isMd, open]);

  useEffect(() => {
    if (!isMd) {
      setOpen(false);
      setQuery('');
      return;
    }
    setOpen(false);
    setQuery('');
  }, [isMd, location.pathname]);

  useEffect(() => {
    if (!isMd || !open) return;

    const run = async () => {
      const kw = query.trim();
      if (!kw) {
        if (hotCacheRef.current) {
          setList(hotCacheRef.current);
          setLoading(false);
          return;
        }
        const seq = ++fetchSeqRef.current;
        setLoading(true);
        try {
          const rows = await fetchSearchDropdownMovies('');
          if (seq !== fetchSeqRef.current) return;
          hotCacheRef.current = rows;
          setList(rows);
        } finally {
          if (seq === fetchSeqRef.current) {
            setLoading(false);
          }
        }
        return;
      }

      window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        const seq = ++fetchSeqRef.current;
        void (async () => {
          setLoading(true);
          try {
            const rows = await fetchSearchDropdownMovies(kw);
            if (seq !== fetchSeqRef.current) return;
            setList(rows);
          } finally {
            if (seq === fetchSeqRef.current) {
              setLoading(false);
            }
          }
        })();
      }, 320);
    };

    void run();
    return () => window.clearTimeout(debounceRef.current);
  }, [isMd, open, query]);

  useEffect(() => {
    if (!isMd || !open) return;
    const onDocDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el?.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isMd, open]);

  const searchPlaceholder = intl.formatMessage({ id: 'search_placeholder' });

  const mobileButton = (
    <button
      type="button"
      role="search-control"
      aria-label={intl.formatMessage({ id: 'flix_search' })}
      className={cn(
        'reelshort-topnav__search-entry',
        'relative flex cursor-pointer flex-col items-center justify-center text-white',
        'hover:text-[var(--rs-brand,#d4a853)]',
      )}
      onPointerEnter={prefetchSearchRouteChunk}
      onPointerDown={prefetchSearchRouteChunk}
      onClick={() => navigate('/search')}
    >
      <span role="img" className="reelshort-topnav__search-icon-wrap text-[min(6vw,1.5rem)] text-current">
        <TopNavSearchIcon className="h-[1em] w-[1em]" />
      </span>
      <div className="reelshort-topnav__search-label">
        <FormattedMessage id="nav_search_label" />
      </div>
    </button>
  );

  if (!isMd) {
    return mobileButton;
  }

  return (
    <div
      ref={wrapRef}
      className={cn('reelshort-topnav__search-inner', open && 'reelshort-topnav__search-inner--panel-open')}
    >
      {!open ? (
        <button
          type="button"
          role="search-control"
          aria-label={intl.formatMessage({ id: 'flix_search' })}
          aria-expanded={false}
          className={cn(
            'reelshort-topnav__search-entry',
            'relative cursor-pointer text-white',
            'hover:text-[var(--rs-brand,#d4a853)]',
          )}
          onClick={() => setOpen(true)}
        >
          <span role="img" className="reelshort-topnav__search-icon-wrap text-[min(6vw,1.5rem)] text-current">
            <TopNavSearchIcon className="h-[1em] w-[1em]" />
          </span>
          <div className="reelshort-topnav__search-label">
            <FormattedMessage id="nav_search_label" />
          </div>
        </button>
      ) : null}

      {open ? (
        <div className="reelshort-topnav__pc-search-anchor">
          <div role="search-panel" className="reelshort-topnav__pc-search-panel">
            <div role="search-bar" className="reelshort-topnav__pc-search-bar">
              <div className="reelshort-topnav__pc-search-barInner">
                <TopNavSearchIcon className="reelshort-topnav__pc-search-icon" />
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  name="topnav-search"
                  maxLength={100}
                  autoComplete="off"
                  enterKeyHint="search"
                  value={query}
                  placeholder={searchPlaceholder}
                  className="reelshort-topnav__pc-search-input"
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const q = query.trim();
                    if (q) {
                      navigate(`/search?q=${encodeURIComponent(q)}`);
                    } else {
                      navigate('/search');
                    }
                    setOpen(false);
                    setQuery('');
                  }}
                />
                <div className="reelshort-topnav__pc-search-clearWrap">
                  {query.trim().length > 0 ? (
                    <button
                      type="button"
                      className="reelshort-topnav__pc-search-clear"
                      aria-label={intl.formatMessage({ id: 'close' })}
                      onClick={() => setQuery('')}
                    >
                      <svg
                        className="reelshort-topnav__pc-search-clearSvg"
                        viewBox="64 64 896 896"
                        fill="currentColor"
                        aria-hidden
                        focusable="false"
                      >
                        <path d="M512 64c247.4 0 448 200.6 448 448S759.4 960 512 960 64 759.4 64 512 264.6 64 512 64zm127.98 274.82h-.04l-.08.06L512 466.75 384.14 338.88c-.04-.05-.06-.06-.08-.06a.12.12 0 00-.07 0c-.03 0-.05.01-.09.05l-45.02 45.02a.2.2 0 00-.05.09.12.12 0 000 .07v.02a.27.27 0 00.06.06L466.75 512 338.88 639.86c-.05.04-.06.06-.06.08a.12.12 0 000 .07c0 .03.01.05.05.09l45.02 45.02a.2.2 0 00.09.05.12.12 0 00.07 0c.02 0 .04-.01.08-.05L512 557.25l127.86 127.87c.04.04.06.05.08.05a.12.12 0 00.07 0c.03 0 .05-.01.09-.05l45.02-45.02a.2.2 0 00.05-.09.12.12 0 000-.07v-.02a.27.27 0 00-.05-.06L557.25 512l127.87-127.86c.04-.04.05-.06.05-.08a.12.12 0 000-.07c0-.03-.01-.05-.05-.09l-45.02-45.02a.2.2 0 00-.09-.05.12.12 0 00-.07 0z" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div role="popup-result" className="reelshort-topnav__pc-search-results">
            <div className="reelshort-topnav__pc-search-resultsInner">
              {!query.trim() ? (
                <h3 className="reelshort-topnav__pc-search-hotTitle">
                  <span className="reelshort-topnav__pc-search-hotIcon" aria-hidden>
                    🔥
                  </span>
                  <FormattedMessage id="search_hot_movies" />
                </h3>
              ) : null}

              {loading ? (
                <div className="reelshort-topnav__pc-search-loading">{intl.formatMessage({ id: 'loading' })}</div>
              ) : list.length === 0 ? (
                <div className="reelshort-topnav__pc-search-empty">{intl.formatMessage({ id: 'no_content' })}</div>
              ) : (
                <div className="reelshort-topnav__pc-search-list">
                  {list.map((row) => {
                    const id = String(row['id']);
                    const title = String(row['title'] ?? '');
                    const img = row['image'] ? `${configStore.config['static']}/${row['image']}` : '';
                    const showFire = !query.trim();
                    return (
                      <Link
                        key={id}
                        to={`/drama/${id}`}
                        className="reelshort-topnav__pc-search-row"
                        onClick={() => {
                          setOpen(false);
                          setQuery('');
                        }}
                      >
                        <div className="reelshort-topnav__pc-search-rowInner">
                          {showFire ? (
                            <span className="reelshort-topnav__pc-search-rowFire" aria-hidden>
                              🔥
                            </span>
                          ) : null}
                          {img ? (
                            <span
                              className="reelshort-topnav__pc-search-thumb"
                              style={{ backgroundImage: `url("${img}")` }}
                            />
                          ) : null}
                          <span className="reelshort-topnav__pc-search-rowTitle">{title}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
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

function TopNavInstallEntry() {
  const navigate = useNavigate();
  const pixel = usePixel();
  const showIosInstall = shouldShowIosAddHomeFab();
  const showAndroidInstall = useRootStore((state) => state.showInstallPrompt);
  const [isDesktop, setIsDesktop] = useState(false);
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  };
  const openPanel = () => {
    clearCloseTimer();
    setOpen(true);
  };
  const closePanelSoon = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 100);
  };

  useEffect(() => clearCloseTimer, []);

  if (!isDesktop || (!showAndroidInstall && !showIosInstall)) return null;

  return (
    <DropdownMenu open={open} modal={false} onOpenChange={(next) => !next && setOpen(false)}>
      <div className="reelshort-topnav__download" onMouseEnter={openPanel} onMouseLeave={closePanelSoon}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="reelshort-topnav__download-trigger" aria-label="Download">
            <span
              className="reelshort-topnav__download-icon"
              aria-hidden
              style={{ ['--download-icon-url' as string]: `url("${iconTopnavDownload}")` }}
            />
            <span className="reelshort-topnav__download-label">
              <FormattedMessage id="add_desktop_short" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={12}
          className="reelshort-topnav__download-popover"
          onMouseEnter={openPanel}
          onMouseLeave={closePanelSoon}
        >
          <div className="reelshort-topnav__download-copy">
            <p className="reelshort-topnav__download-title"><FormattedMessage id="add_desktop" /></p>
            <button
              type="button"
              className="reelshort-topnav__download-open-btn"
              onClick={() => {
                pixel.track('Download');
                const installButton = document.querySelector<HTMLButtonElement>('.pwa-install-open-btn');
                if (installButton) {
                  installButton.click();
                } else if (showIosInstall) {
                  setOpen(false);
                  void navigate('/page/ios-add-home');
                }
              }}
            >
              <FormattedMessage id="pwa_open" />
            </button>
          </div>
          <img src={BRAND_LOGO_SRC} alt="logo" className="reelshort-topnav__download-logo" />
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}

function TopNavHistoryEntry() {
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (!isDesktop) {
    return null;
  }

  return (
    <button
      type="button"
      className="reelshort-topnav__history"
      onClick={() => navigate('/profile?tab=history')}
      aria-label="Watch history"
    >
      <TopNavHistoryIcon />
      <span className="reelshort-topnav__history-label">
        <FormattedMessage id="nav_watch_history" />
      </span>
    </button>
  );
}

/** 顶栏头像：H5 进入个人页，PC 点击展开分组菜单。 */
function NavProfileAvatar() {
  const intl = useIntl();
  const navigate = useNavigate();
  const userStore = useUserStore();
  const isSignedUser = userStore.signed && !userStore.isAnonymous();
  const avatar =
    isSignedUser
      ? getUserAvatarDisplayUrl(userStore.info as { [key: string]: unknown } | undefined)
      : undefined;
  const hasPhoto = Boolean(avatar);
  const userName = String(
    userStore.info?.['name']
      ?? userStore.info?.['nickname']
      ?? userStore.info?.['username']
      ?? '',
  ).trim();
  const userUid = getUserUidForDisplay(userStore.info ?? undefined);
  const avatarFallback = getProfileAvatarFallback(userName, userUid);

  const isDesktop = useMinWidth768();
  const profileEntryHref = '/profile';

  const avatarNode = hasPhoto ? (
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
    <span
      className={cn(
        'reelshort-topnav__profile-avatar--placeholder',
        `reelshort-topnav__profile-avatar--tone-${avatarFallback.tone}`,
      )}
      aria-hidden
    >
      {avatarFallback.initial}
    </span>
  );

  if (!isDesktop) {
    return (
      <Link
        to={profileEntryHref}
        className="reelshort-topnav__profile-link"
        aria-label={intl.formatMessage({ id: 'profile' })}
      >
        {avatarNode}
      </Link>
    );
  }

  async function handleLogout() {
    const ok = await logoutToAnonymousSession();
    if (!ok) {
      return;
    }
    if (isDesktop) {
      navigate('/profile', { state: { openPcLogin: true }, replace: true });
    } else {
      navigate('/page/login');
    }
  }

  return <DesktopProfileMenu signed={isSignedUser} onLogout={handleLogout}>{avatarNode}</DesktopProfileMenu>;
}

const HEADER_SCROLL_SOLID_THRESHOLD = 4;

// 旧版下拉搜索/历史入口仍保留在本文件，便于独立页面按需复用；新对标顶栏使用紧凑导航入口。
void TopNavSearchEntry;
void TopNavHistoryEntry;

export type ReelShortTopNavLeftAction = 'menu' | 'back' | 'none';

export type ReelShortTopNavProps = {
  /** 实际滚动的祖先节点（如首页 `overflow-y-auto` 容器）；在顶部透明，滚动后出现画布背景 */
  scrollParentRef?: RefObject<HTMLElement | null>;
  /** 是否展示二级横向导航（默认不展示；首页传 true） */
  showPrimaryNav?: boolean;
  /** 内页标题左侧是否显示品牌 icon */
  showTitleIcon?: boolean;
  /** 左侧：汉堡菜单 / 返回 / 无（优先于 showLeftAction） */
  leftAction?: ReelShortTopNavLeftAction;
  /** @deprecated 请用 leftAction；false 等价于 leftAction="none" */
  showLeftAction?: boolean;
  /** leftAction="back" 时点击回调，默认 navigate(-1) */
  onBackClick?: () => void;
  /** 是否展示右侧操作区（搜索/下载/语言/历史/头像等） */
  showRightActions?: boolean;
  /** 是否展示搜索入口 */
  showSearch?: boolean;
  /** 是否展示右侧头像（跳转 profile）入口 */
  showProfile?: boolean;
  /** 是否展示语言切换 */
  showLanguage?: boolean;
  /** 是否展示观看历史（PC 顶栏；H5 本身不渲染） */
  showHistory?: boolean;
  /** PC 账户页：右侧仅保留 Desktop 下载入口（窄屏仍为 default 全套按钮） */
  rightActionsMode?: 'default' | 'profilePc';
};

/**
 * 顶栏单行：汉堡 → Logo + 项目名 → 搜索 → 我的（Google 登录后展示头像）
 */
export function ReelShortTopNav({
  scrollParentRef,
  showPrimaryNav = false,
  leftAction: leftActionProp,
  showLeftAction = true,
  onBackClick,
  showRightActions = true,
  showSearch = showPrimaryNav,
  showProfile = true,
  showLanguage = true,
  showHistory = true,
  rightActionsMode = 'default',
}: ReelShortTopNavProps = {}) {
  const isMd = useMinWidth768();
  const luckyBadge = useLuckyStore(store => store.badge);
  const navigate = useNavigate();
  const location = useLocation();
  const userStore = useUserStore();
  const requireAccount = useRequireAccount();
  const profilePcActions = rightActionsMode === 'profilePc' && isMd;
  const intl = useIntl();
  const [menuOpen, setMenuOpen] = useState(false);
  const [headerSolid, setHeaderSolid] = useState(false);
  const allowTransparent = showPrimaryNav;
  const leftAction: ReelShortTopNavLeftAction =
    leftActionProp ?? (showLeftAction === false ? 'none' : 'menu');
  const isLtr = typeof document !== 'undefined' && document.body.style.direction === 'ltr';
  const isTraditionalChinese = intl.locale.toLowerCase().startsWith('zh-tw') || intl.locale.toLowerCase().startsWith('zh-h');
  const isChinese = intl.locale.toLowerCase().startsWith('zh');
  const feedLabel = isChinese ? (isTraditionalChinese ? '刷劇' : '刷剧') : intl.formatMessage({ id: 'for_you', defaultMessage: 'For You' });
  const browseLabel = isChinese ? (isTraditionalChinese ? '劇庫' : '剧库') : intl.formatMessage({ id: 'nav_categories', defaultMessage: 'Browse' });
  const searchLabel = isChinese ? (isTraditionalChinese ? '尋劇' : '寻剧') : intl.formatMessage({ id: 'nav_search_label', defaultMessage: 'Search' });
  const coinBalance = userStore.signed ? (userStore.balance >= 0 ? userStore.balance : null) : 0;
  const coinBalanceLabel = coinBalance === null ? '—' : intl.formatNumber(coinBalance);
  const feedActive = location.pathname.startsWith(FORYOU_PATH) || location.pathname.startsWith('/video/');
  const browseActive = location.pathname === '/' || location.pathname.startsWith('/categories') || location.pathname.startsWith('/drama/');

  function handleBack() {
    if (onBackClick) {
      onBackClick();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  }

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

  const legacyMobileNav = !isMd ? (
    <div className="reelshort-topnav__inner">
      <div className="reelshort-topnav__row">
        <div className="reelshort-topnav__left">
          {leftAction === 'menu' ? (
            <button
              type="button"
              className="reelshort-topnav__menu-btn"
              onClick={() => setMenuOpen(true)}
              aria-label={intl.formatMessage({ id: 'nav_open_menu' })}
            >
              <ReelShortMenuIcon className="reelshort-topnav__menu-btn-icon" />
            </button>
          ) : null}
          {leftAction === 'back' ? (
            <button
              type="button"
              className="reelshort-topnav__menu-btn"
              onClick={handleBack}
              aria-label={intl.formatMessage({ id: 'back', defaultMessage: 'Back' })}
            >
              {isLtr ? <ChevronLeft className="reelshort-topnav__back-icon" aria-hidden /> : <ChevronRight className="reelshort-topnav__back-icon" aria-hidden />}
            </button>
          ) : null}
        </div>

        <div className="reelshort-topnav__brand-cluster reelshort-topnav__brand-cluster--with-primary">
          <Link to="/" className="reelshort-topnav__brand-link">
            <img
              src={BRAND_TOPNAV_WORDMARK_SRC}
              alt={BRAND_DISPLAY_NAME}
              className="reelshort-topnav__brand-wordmark"
              width={BRAND_TOPNAV_WORDMARK_WIDTH}
              height={BRAND_TOPNAV_WORDMARK_HEIGHT}
            />
          </Link>
        </div>

        <div className="reelshort-topnav__right">
          <div className="reelshort-topnav__actions">
            {showRightActions ? <Link to="/profile?tab=topup" className="reelshort-topnav__benchmark-wallet reelshort-topnav__mobile-wallet" aria-label={intl.formatMessage({ id: 'top_up' })}>
              <Coins aria-hidden /><span>{coinBalanceLabel}</span>
            </Link> : null}
            {showRightActions && showSearch ? <div className="reelshort-topnav__search"><TopNavSearchEntry /></div> : null}
            {showRightActions ? <TopNavInstallEntry /> : null}
            {showRightActions && showProfile ? <NavProfileAvatar /> : null}
          </div>
        </div>
      </div>
      {showPrimaryNav ? <div className="reelshort-topnav__h5-subnav" aria-hidden /> : null}
    </div>
  ) : null;

  return (
    <>
      <header
        className={cn(
          'reelshort-topnav',
          headerSolid ? 'reelshort-topnav--solid' : 'reelshort-topnav--transparent',
        )}
      >
        {legacyMobileNav ?? <div className="reelshort-topnav__inner reelshort-topnav__inner--benchmark">
          <div className="reelshort-topnav__benchmark-row">
            {leftAction === 'back' ? (
              <button
                type="button"
                className="reelshort-topnav__benchmark-back"
                onClick={handleBack}
                aria-label={intl.formatMessage({ id: 'back', defaultMessage: 'Back' })}
              >
                {isLtr ? <ChevronLeft aria-hidden /> : <ChevronRight aria-hidden />}
              </button>
            ) : null}
            {leftAction === 'menu' ? (
              <>
                <button
                  type="button"
                  className="reelshort-topnav__benchmark-menu-btn"
                  onClick={() => setMenuOpen(true)}
                  aria-label={intl.formatMessage({ id: 'nav_open_menu' })}
                >
                  <ReelShortMenuIcon />
                </button>
                <Link to={FORYOU_PATH} className="reelshort-topnav__benchmark-logo reelshort-topnav__benchmark-logo--mobile">
                  <img src={BRAND_TOPNAV_WORDMARK_SRC} alt={BRAND_DISPLAY_NAME} width={BRAND_TOPNAV_WORDMARK_WIDTH} height={BRAND_TOPNAV_WORDMARK_HEIGHT} />
                </Link>
                <Link to={FORYOU_PATH} className="reelshort-topnav__benchmark-logo reelshort-topnav__benchmark-logo--desktop">
                  <img src={BRAND_TOPNAV_WORDMARK_SRC} alt={BRAND_DISPLAY_NAME} width={BRAND_TOPNAV_WORDMARK_WIDTH} height={BRAND_TOPNAV_WORDMARK_HEIGHT} />
                </Link>
              </>
            ) : (
              <Link to={FORYOU_PATH} className="reelshort-topnav__benchmark-logo">
                <img src={BRAND_TOPNAV_WORDMARK_SRC} alt={BRAND_DISPLAY_NAME} width={BRAND_TOPNAV_WORDMARK_WIDTH} height={BRAND_TOPNAV_WORDMARK_HEIGHT} />
              </Link>
            )}

            <nav className="reelshort-topnav__benchmark-nav" aria-label={intl.formatMessage({ id: 'primary_navigation', defaultMessage: 'Primary' })}>
              <NavLink
                to={FORYOU_PATH}
                state={VIDEO_FROM_HOME_STATE}
                className={cn('reelshort-topnav__benchmark-nav-item', feedActive && 'is-active')}
              >
                {feedLabel}
              </NavLink>
              <NavLink
                to="/"
                className={cn('reelshort-topnav__benchmark-nav-item', browseActive && 'is-active')}
              >
                {browseLabel}
              </NavLink>
              {showSearch ? (
                <NavLink
                  to="/search"
                  onPointerEnter={prefetchSearchRouteChunk}
                  onPointerDown={prefetchSearchRouteChunk}
                  className={({ isActive }) => cn('reelshort-topnav__benchmark-nav-item reelshort-topnav__benchmark-nav-item--search', isActive && 'is-active')}
                  aria-label={searchLabel}
                  title={searchLabel}
                >
                  <Search aria-hidden />
                  <span>{searchLabel}</span>
                </NavLink>
              ) : null}
              <NavLink
                to="/lucky"
                onPointerEnter={prefetchLuckyRouteChunk}
                onPointerDown={prefetchLuckyRouteChunk}
                className={({ isActive }) => cn('reelshort-topnav__benchmark-nav-item reelshort-topnav__benchmark-nav-item--lucky', isActive && 'is-active')}
                aria-label={intl.formatMessage({ id: 'nav_lucky', defaultMessage: 'Rewards' })}
                title={intl.formatMessage({ id: 'nav_lucky', defaultMessage: 'Rewards' })}
              >
                <Gift aria-hidden />
                <span><FormattedMessage id="nav_lucky" /></span>
                {luckyBadge != null && luckyBadge > 0 ? <b className="reelshort-topnav__benchmark-badge">{luckyBadge > 9 ? '9+' : luckyBadge}</b> : null}
              </NavLink>
              <NavLink
                to="/creator"
                onClick={(event) => {
                  if (!requireAccount()) event.preventDefault();
                }}
                className={({ isActive }) => cn('reelshort-topnav__benchmark-nav-item reelshort-topnav__benchmark-nav-item--secondary', isActive && 'is-active')}
              >
                <Sparkles aria-hidden /><span><FormattedMessage id="nav_join_creator" /></span>
              </NavLink>
              <NavLink to="/affiliate" className={({ isActive }) => cn('reelshort-topnav__benchmark-nav-item reelshort-topnav__benchmark-nav-item--secondary', isActive && 'is-active')}>
                <Coins aria-hidden /><span><FormattedMessage id="nav_affiliate" /></span>
              </NavLink>
            </nav>

            <div className="reelshort-topnav__benchmark-spacer" />
            {showRightActions ? (
              <div className="reelshort-topnav__benchmark-actions">
                {showSearch ? (
                  <NavLink
                    to="/search"
                    onPointerEnter={prefetchSearchRouteChunk}
                    onPointerDown={prefetchSearchRouteChunk}
                    className="reelshort-topnav__benchmark-mobile-search"
                    aria-label={searchLabel}
                    title={searchLabel}
                  >
                    <Search aria-hidden />
                  </NavLink>
                ) : null}
                <TopNavInstallEntry />
                {showLanguage ? <div className="reelshort-topnav__benchmark-language"><TopNavLanguageSwitcher /></div> : null}
                {showHistory ? (
                  <Link to="/my-list/history" className="reelshort-topnav__benchmark-action reelshort-topnav__benchmark-action--desktop" aria-label={intl.formatMessage({ id: 'nav_watch_history' })}>
                    <Bell aria-hidden />
                  </Link>
                ) : null}
                <Link to="/profile?tab=topup" className="reelshort-topnav__benchmark-wallet" aria-label={intl.formatMessage({ id: 'top_up' })}>
                  <Coins aria-hidden />
                  <span>{coinBalanceLabel}</span>
                </Link>
                {showProfile ? <NavProfileAvatar /> : null}
              </div>
            ) : profilePcActions ? <TopNavInstallEntry /> : null}
          </div>
        </div>}
      </header>

      <ReelShortNavDrawer open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
