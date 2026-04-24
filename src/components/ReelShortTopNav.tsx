import type { RefObject } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { cn } from '@/lib/utils';
import { api, type IPagination, type TData } from '@/api';
import { auth } from '@/firebase';
import { ReelShortNavDrawer } from '@/components/ReelShortNavDrawer';
import { ReelShortDramaWorldDialog } from '@/components/ReelShortDramaWorldDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUserStore } from '@/stores/user';
import { useLoadingStore } from '@/stores/loading';
import { useRootStore } from '@/stores/root';
import { APP_LANGUAGES } from '@/constants/appLanguages';
import { BRAND_DISPLAY_NAME, BRAND_LOGO_SRC } from '@/constants/brand';
import iconHead from '@/assets/images/icon_head.739421aa.png';
import iconLangGlobe from '@/assets/icons/topnav-language-globe.svg';
import iconLangChevron from '@/assets/icons/topnav-language-chevron.svg';
import iconTopnavDownload from '@/assets/icons/topnav-download.svg';
import { getUserAvatarDisplayUrl } from '@/lib/userAvatar';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useConfigStore } from '@/stores/config';

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
      width="21"
      height="20"
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
      onClick={() => navigate('/search')}
    >
      <span role="img" className="reelshort-topnav__search-icon-wrap text-[min(6vw,1.5rem)] text-current md:text-2xl">
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
            'relative flex cursor-pointer flex-col items-center justify-center text-white',
            'hover:text-[var(--rs-brand,#d4a853)]',
          )}
          onClick={() => setOpen(true)}
        >
          <span role="img" className="reelshort-topnav__search-icon-wrap text-[min(6vw,1.5rem)] text-current md:text-2xl">
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
                        to={`/video/${id}`}
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

function TopNavInstallEntry() {
  const rootStore = useRootStore();
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
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  };

  const openPanel = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const closePanelSoon = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 100);
  };

  useEffect(() => clearCloseTimer, []);

  if (!rootStore.showInstallPrompt || !isDesktop) {
    return null;
  }

  return (
    <DropdownMenu
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) {
          setOpen(false);
        }
      }}
    >
      <div
        className="reelshort-topnav__download"
        onMouseEnter={openPanel}
        onMouseLeave={closePanelSoon}
      >
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
            <p className="reelshort-topnav__download-title">
              <FormattedMessage id="add_desktop" />
            </p>
            <button
              type="button"
              className="reelshort-topnav__download-open-btn"
              onClick={() => {
                const installBtn = document.querySelector<HTMLButtonElement>('.pwa-install-open-btn');
                installBtn?.click();
              }}
            >
              <FormattedMessage id="pwa_open" />
            </button>
          </div>
          <img src="/logo.png" alt="logo" className="reelshort-topnav__download-logo" />
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

/** 顶栏「我的」：H5 点击进 /profile；PC 悬停展开卡片，头像点击仍进 /profile（下拉打开仅由 hover 控制） */
function NavProfileAvatar() {
  const intl = useIntl();
  const navigate = useNavigate();
  const userStore = useUserStore();
  const loadingStore = useLoadingStore();
  const isSignedUser = userStore.signed && !userStore.isAnonymous();
  const avatar =
    isSignedUser
      ? getUserAvatarDisplayUrl(userStore.info as { [key: string]: unknown } | undefined)
      : undefined;
  const hasPhoto = Boolean(avatar);

  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const closeTimerRef = useRef<number | undefined>(undefined);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  };

  const openMenu = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const closeMenuSoon = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
    }, 100);
  };

  useEffect(() => clearCloseTimer, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

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
    <img
      src={iconHead}
      alt=""
      className="reelshort-topnav__profile-avatar--placeholder"
    />
  );

  if (!isDesktop) {
    return (
      <Link
        to="/profile?tab=topup"
        className="reelshort-topnav__profile-link"
        aria-label={intl.formatMessage({ id: 'profile' })}
      >
        {avatarNode}
      </Link>
    );
  }

  async function handleLogout() {
    try {
      loadingStore.show();
      if (isDesktop) {
        navigate('/profile', { state: { openPcLogin: true }, replace: true });
      } else {
        navigate('/page/login');
      }
      localStorage.removeItem('token');
      localStorage.removeItem('login-method');
      localStorage.removeItem('user-avatar');

      // @ts-expect-error - injected by Flutter InAppWebView
      if (window.flutter_inappwebview) {
        // @ts-expect-error - injected by Flutter InAppWebView
        await window.flutter_inappwebview.callHandler('logout');
      } else {
        await auth.signOut();
      }

      const result = await api<{ token: string; info: { [key: string]: unknown } }>('login/anonymous', {
        loading: false,
      });

      if (result.c !== 0) {
        return;
      }

      localStorage.setItem('token', result.d['token'] as string);
      userStore.signin(result.d['info'] as { [key: string]: unknown });
    } finally {
      loadingStore.hide();
    }
  }

  const userName = String(userStore.info?.['name'] ?? '');
  const userUid = String(userStore.info?.['unique_id'] ?? '');
  const signOutIconUrl = 'https://v-mps.crazymaplestudios.com/images/3c2c9f20-2f21-11f1-9a5e-8b72f42f4895.png';

  return (
    <DropdownMenu
      open={open}
      modal={false}
      onOpenChange={(next) => {
        /* 打开仅由 hover 负责，避免点击头像时 Radix 与 Link 抢焦点；允许 false 以支持 Esc / 点外部关闭 */
        if (!next) {
          setOpen(false);
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Link
          to="/profile?tab=topup"
          className="reelshort-topnav__profile-link reelshort-topnav__profile-trigger"
          aria-label={intl.formatMessage({ id: 'profile' })}
          onMouseEnter={openMenu}
          onMouseLeave={closeMenuSoon}
        >
          {avatarNode}
        </Link>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="reelshort-topnav__profile-menu reelshort-topnav__profile-menu--card"
        onMouseEnter={openMenu}
        onMouseLeave={closeMenuSoon}
      >
        <div className="reelshort-topnav__profile-card">
          <div className="reelshort-topnav__profile-card-head">
            <Link to="/profile?tab=topup" className="reelshort-topnav__profile-card-avatar-link">
              {avatarNode}
            </Link>
            <div className="reelshort-topnav__profile-card-user">
              <p className="reelshort-topnav__profile-card-name">{userName || '遊客'}</p>
              <p className="reelshort-topnav__profile-card-uid">
                <span>UID {userUid || '--'}</span>
              </p>
            </div>
            {isSignedUser ? (
              <button
                type="button"
                className="reelshort-topnav__profile-card-logout"
                onClick={() => {
                  void handleLogout();
                }}
              >
                <img src={signOutIconUrl} alt="" className="reelshort-topnav__profile-card-logout-icon" />
                <FormattedMessage id="logout" />
              </button>
            ) : (
              <button
                type="button"
                className="reelshort-topnav__profile-card-login"
                onClick={() => {
                  if (isDesktop) {
                    navigate('/profile', { state: { openPcLogin: true } });
                    return;
                  }
                  navigate('/page/login');
                }}
              >
                <FormattedMessage id="login" />
              </button>
            )}
          </div>
          <div className="reelshort-topnav__profile-card-divider" />
          <button
            type="button"
            className="reelshort-topnav__profile-card-topup"
            onClick={() => navigate('/profile?tab=topup')}
          >
            <FormattedMessage id="top_up" />
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
  /** PC 账户页：右侧仅保留 Desktop 下载入口（窄屏仍为 default 全套按钮） */
  rightActionsMode?: 'default' | 'profilePc';
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
  rightActionsMode = 'default',
}: ReelShortTopNavProps = {}) {
  const isMd = useMinWidth768();
  const profilePcActions = rightActionsMode === 'profilePc' && isMd;
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
        <div className="reelshort-topnav__inner">
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
                {profilePcActions ? (
                  <TopNavInstallEntry />
                ) : (
                  <>
                    {showSearch ? (
                      <div className="reelshort-topnav__search">
                        <TopNavSearchEntry />
                      </div>
                    ) : null}
                    <TopNavInstallEntry />
                    <TopNavHistoryEntry />
                    <TopNavLanguageSwitcher />
                    {showProfile ? <NavProfileAvatar /> : null}
                  </>
                )}
              </div>
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
