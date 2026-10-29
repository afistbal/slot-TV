import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { FormattedMessage, useIntl } from 'react-intl';
import {
    Bookmark,
    Crown,
    Gift,
    Globe2,
    History,
    Home,
    Search,
    Share2,
    Smartphone,
    Sparkles,
    UserRound,
    type LucideIcon,
} from 'lucide-react';
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { useRootStore } from '@/stores/root';
import { APP_LANGUAGES } from '@/constants/appLanguages';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { FORYOU_PATH } from '@/constants/foryouRoute';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import { isIosLikeDevice } from '@/lib/isIosLikeDevice';
import { shouldShowIosAddHomeFab } from '@/lib/shouldShowIosAddHomeFab';
import {
    BRAND_DISPLAY_NAME,
    BRAND_TOPNAV_WORDMARK_HEIGHT,
    BRAND_TOPNAV_WORDMARK_SRC,
    BRAND_TOPNAV_WORDMARK_WIDTH,
} from '@/constants/brand';

function isLocaleActive(current: string | null | undefined, code: string | null | undefined): boolean {
    if (current == null || code == null) return false;
    const c = current.toLowerCase();
    const p = code.toLowerCase();
    if (c === p) return true;
    if (p === 'zh') {
        return c === 'zh-tw' || c.startsWith('zh-hant') || (c.startsWith('zh-') && !c.startsWith('zh-hans') && !c.startsWith('zh-cn'));
    }
    return c.startsWith(`${p}-`) || c.startsWith(`${p}_`);
}

function CloseIcon() {
    return (
        <svg viewBox="0 0 18 18" aria-hidden>
            <path d="M4 4l10 10M14 4L4 14" />
        </svg>
    );
}

function ChevronDown({ open }: { open: boolean }) {
    return (
        <svg className={cn('reelshort-nav-drawer__chevron', open && 'is-open')} viewBox="0 0 18 18" aria-hidden>
            <path d="m4 7 5 5 5-5" />
        </svg>
    );
}

function DrawerItem({
    to,
    icon: Icon,
    active,
    children,
    state,
    onClick,
}: {
    to: string;
    icon: LucideIcon;
    active?: boolean;
    children: ReactNode;
    state?: unknown;
    onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
    return (
        <Link
            to={to}
            state={state}
            className={cn('reelshort-nav-drawer__item', active && 'is-active')}
            onClick={onClick}
        >
            <Icon className="reelshort-nav-drawer__item-icon" aria-hidden strokeWidth={1.7} />
            <span className="reelshort-nav-drawer__item-label">{children}</span>
        </Link>
    );
}

export function ReelShortNavDrawer({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const intl = useIntl();
    const rootStore = useRootStore();
    const location = useLocation();
    const [langOpen, setLangOpen] = useState(false);
    const sourceform = `${location.pathname}${location.search}`;
    const requireAccount = useRequireAccount();
    const pathname = location.pathname;
    const closeDrawer = () => onOpenChange(false);
    const addHomePath = isIosLikeDevice() ? '/page/ios-add-home' : '/page/android-add-home';
    const showAddHomeEntry = rootStore.showInstallPrompt || shouldShowIosAddHomeFab();

    function selectLocale(code: string) {
        if (rootStore.locale === code) return;
        localStorage.setItem('locale', code);
        window.location.reload();
    }

    function handleAccountLink(event: MouseEvent<HTMLAnchorElement>) {
        if (!requireAccount()) event.preventDefault();
        closeDrawer();
    }

    return (
        <Drawer open={open} onOpenChange={onOpenChange} direction="left">
            <DrawerContent
                aria-describedby={undefined}
                handler={false}
                overlayClassName="reelshort-nav-drawer__overlay"
                className={cn(
                    'reelshort-nav-drawer',
                    'h-full max-h-none rounded-none border-0 border-r p-0 text-white shadow-xl',
                    'data-[vaul-drawer-direction=left]:border-r',
                )}
            >
                <DrawerTitle className="sr-only">
                    <FormattedMessage id="nav_menu" defaultMessage="Menu" />
                </DrawerTitle>

                <div className="reelshort-nav-drawer__inner">
                    <div className="reelshort-nav-drawer__header">
                        <Link to={FORYOU_PATH} className="reelshort-nav-drawer__logo" onClick={closeDrawer}>
                            <img
                                src={BRAND_TOPNAV_WORDMARK_SRC}
                                alt={BRAND_DISPLAY_NAME}
                                width={BRAND_TOPNAV_WORDMARK_WIDTH}
                                height={BRAND_TOPNAV_WORDMARK_HEIGHT}
                            />
                        </Link>
                        <DrawerClose
                            type="button"
                            aria-label={intl.formatMessage({ id: 'cancel' })}
                            className="reelshort-nav-drawer__close"
                        >
                            <CloseIcon />
                        </DrawerClose>
                    </div>

                    <div className="reelshort-nav-drawer__scroll">
                        <nav
                            className="reelshort-nav-drawer__content"
                            aria-label={intl.formatMessage({ id: 'nav_menu', defaultMessage: 'Menu' })}
                        >
                            <DrawerItem to="/" icon={Home} active={pathname === '/'} onClick={closeDrawer}>
                                <FormattedMessage id="home" />
                            </DrawerItem>
                            <DrawerItem
                                to={FORYOU_PATH}
                                state={VIDEO_FROM_HOME_STATE}
                                icon={Sparkles}
                                active={pathname === FORYOU_PATH || pathname.startsWith('/video/')}
                                onClick={closeDrawer}
                            >
                                <FormattedMessage id="for_you" defaultMessage="For You" />
                            </DrawerItem>
                            <DrawerItem to="/search" icon={Search} active={pathname.startsWith('/search')} onClick={closeDrawer}>
                                <FormattedMessage id="nav_search_label" defaultMessage="Search" />
                            </DrawerItem>

                            <button
                                type="button"
                                className={cn('reelshort-nav-drawer__item', langOpen && 'is-expanded')}
                                aria-expanded={langOpen}
                                onClick={() => setLangOpen((value) => !value)}
                            >
                                <Globe2 className="reelshort-nav-drawer__item-icon" aria-hidden strokeWidth={1.7} />
                                <span className="reelshort-nav-drawer__item-label"><FormattedMessage id="language" /></span>
                                <ChevronDown open={langOpen} />
                            </button>
                            <div
                                className={cn('reelshort-nav-drawer__languages', langOpen && 'is-open')}
                                aria-hidden={!langOpen}
                            >
                                {APP_LANGUAGES.map((lang) => (
                                    <button
                                        key={lang.code}
                                        type="button"
                                        className={cn(
                                            'reelshort-nav-drawer__language',
                                            isLocaleActive(rootStore.locale, lang.code) && 'is-active',
                                        )}
                                        onClick={() => selectLocale(lang.code)}
                                    >
                                        {lang.label}
                                    </button>
                                ))}
                            </div>

                            <DrawerItem to="/lucky" icon={Gift} active={pathname.startsWith('/lucky')} onClick={closeDrawer}>
                                <FormattedMessage id="nav_lucky" />
                            </DrawerItem>
                            <DrawerItem to="/creator" icon={Crown} active={pathname.startsWith('/creator')} onClick={handleAccountLink}>
                                <FormattedMessage id="nav_join_creator" />
                            </DrawerItem>
                            <DrawerItem to="/affiliate" icon={Share2} active={pathname.startsWith('/affiliate')} onClick={closeDrawer}>
                                <FormattedMessage id="nav_affiliate" />
                            </DrawerItem>
                            <DrawerItem
                                to={`/my-list/history?sourceform=${encodeURIComponent(sourceform)}`}
                                state={{ sourceform }}
                                icon={History}
                                active={pathname.startsWith('/my-list/history')}
                                onClick={closeDrawer}
                            >
                                <FormattedMessage id="nav_watch_history" />
                            </DrawerItem>
                            <DrawerItem
                                to={`/my-list?sourceform=${encodeURIComponent(sourceform)}`}
                                state={{ sourceform }}
                                icon={Bookmark}
                                active={pathname === '/my-list'}
                                onClick={closeDrawer}
                            >
                                <FormattedMessage id="my_list" />
                            </DrawerItem>
                            {showAddHomeEntry ? <DrawerItem
                                to={addHomePath}
                                icon={Smartphone}
                                active={pathname === addHomePath}
                                onClick={(event) => {
                                    const installButton = document.querySelector<HTMLButtonElement>('.pwa-install-open-btn');
                                    if (addHomePath === '/page/android-add-home' && installButton) {
                                        event.preventDefault();
                                        installButton.click();
                                    }
                                    closeDrawer();
                                }}
                            >
                                <FormattedMessage id="add_desktop_short" />
                            </DrawerItem> : null}
                            <DrawerItem to="/profile" icon={UserRound} active={pathname.startsWith('/profile')} onClick={closeDrawer}>
                                <FormattedMessage id="nav_personal_center" />
                            </DrawerItem>
                        </nav>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
