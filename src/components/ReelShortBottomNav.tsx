import { Fragment, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage } from 'react-intl';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { cn } from '@/lib/utils';
import { bottomTabAddDesktopIcon, bottomTabIcons } from '@/constants/bottomTabAssets';
import { shouldShowIosAddHomeFab } from '@/lib/shouldShowIosAddHomeFab';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useRootStore } from '@/stores/root';
import usePixel from '@/hooks/usePixel';
import { showBottomTabBar } from '@/env';
import {
    prefetchMyListRouteChunk,
    prefetchProfileRouteChunk,
} from '@/lib/prefetchSecondaryUserRoutes';

export type ReelShortBottomNavProps = {
    /** 收银台、全屏播放等页隐藏底部 Tab 与「添加桌面」胶囊 */
    hidden?: boolean;
};

function setBottomNavDocumentFlags(showTabs: boolean) {
    const root = document.documentElement;
    if (!showTabs) {
        root.classList.remove('has-rs-bottom-nav');
        return;
    }
    root.classList.add('has-rs-bottom-nav');
}

function BottomNavAddDesktopH5({
    variant,
    onAndroidInstall,
}: {
    variant: 'ios' | 'android';
    onAndroidInstall: () => void;
}) {
    const pixel = usePixel();
    const navigate = useNavigate();

    function handleClick() {
        pixel.track('Download');
        if (variant === 'ios') {
            void navigate('/page/ios-add-home');
            return;
        }
        onAndroidInstall();
    }

    return (
        <button type="button" className="reelshort-bottom-nav__add" onClick={handleClick}>
            <img
                className="reelshort-bottom-nav__add-icon"
                src={bottomTabAddDesktopIcon}
                alt=""
                loading="lazy"
            />
            <span className="reelshort-bottom-nav__add-text">
                <FormattedMessage id="add_desktop_short" />
            </span>
        </button>
    );
}

/**
 * H5 底部：黑色 Tab 栏（fixed 贴底）+ 独立悬浮「添加桌面」胶囊（在 Tab 上方，无黑底）。
 * PC 添加桌面仍走顶栏 `TopNavInstallEntry`。
 */
export function ReelShortBottomNav({ hidden = false }: ReelShortBottomNavProps) {
    const isDesktop = useMinWidth768();
    const location = useLocation();
    const showInstallPrompt = useRootStore((s) => s.showInstallPrompt);
    const showIosAddHome = shouldShowIosAddHomeFab();
    const sourceform = `${location.pathname}${location.search}`;

    const showTabs = showBottomTabBar && !isDesktop && !hidden;
    const isForYouPage =
        location.pathname === '/for-you' || location.pathname.startsWith('/for-you/');
    const addVariant: 'ios' | 'android' | null = showIosAddHome ? 'ios' : showInstallPrompt ? 'android' : null;
    const showAddDesktop = addVariant !== null && !isForYouPage;

    useEffect(() => {
        setBottomNavDocumentFlags(showTabs);
        return () => setBottomNavDocumentFlags(false);
    }, [showTabs]);

    if (!showTabs) {
        return null;
    }

    function triggerAndroidInstall() {
        document.querySelector<HTMLButtonElement>('.pwa-install-open-btn')?.click();
    }

    return createPortal(
        <Fragment>
            {showAddDesktop ? (
                <div className="reelshort-bottom-nav-add">
                    <BottomNavAddDesktopH5
                        variant={addVariant}
                        onAndroidInstall={triggerAndroidInstall}
                    />
                </div>
            ) : null}
            <nav className="reelshort-bottom-nav" aria-label="Tab bar">
                <div className="reelshort-bottom-nav__tabs" role="tablist">
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            cn('reelshort-bottom-nav__tab', isActive && 'reelshort-bottom-nav__tab--active')
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <img
                                    className="reelshort-bottom-nav__tab-icon"
                                    src={isActive ? bottomTabIcons.home.active : bottomTabIcons.home.nor}
                                    alt=""
                                />
                                <span className="reelshort-bottom-nav__tab-label">
                                    <FormattedMessage id="home" />
                                </span>
                            </>
                        )}
                    </NavLink>
                    <NavLink
                        to="/for-you"
                        className={({ isActive }) =>
                            cn('reelshort-bottom-nav__tab', isActive && 'reelshort-bottom-nav__tab--active')
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <img
                                    className="reelshort-bottom-nav__tab-icon"
                                    src={isActive ? bottomTabIcons.forYou.active : bottomTabIcons.forYou.nor}
                                    alt=""
                                />
                                <span className="reelshort-bottom-nav__tab-label">
                                    <FormattedMessage id="for_you" />
                                </span>
                            </>
                        )}
                    </NavLink>
                    <NavLink
                        to={`/my-list?sourceform=${encodeURIComponent(sourceform)}`}
                        state={{ sourceform }}
                        onPointerEnter={prefetchMyListRouteChunk}
                        onPointerDown={prefetchMyListRouteChunk}
                        className={({ isActive }) =>
                            cn(
                                'reelshort-bottom-nav__tab',
                                (isActive || location.pathname.startsWith('/my-list')) &&
                                    'reelshort-bottom-nav__tab--active',
                            )
                        }
                    >
                        {({ isActive }) => {
                            const active = isActive || location.pathname.startsWith('/my-list');
                            return (
                                <>
                                    <img
                                        className="reelshort-bottom-nav__tab-icon"
                                        src={active ? bottomTabIcons.myList.active : bottomTabIcons.myList.nor}
                                        alt=""
                                    />
                                    <span className="reelshort-bottom-nav__tab-label">
                                        <FormattedMessage id="my_list" />
                                    </span>
                                </>
                            );
                        }}
                    </NavLink>
                    <NavLink
                        to="/profile"
                        onPointerEnter={prefetchProfileRouteChunk}
                        onPointerDown={prefetchProfileRouteChunk}
                        className={({ isActive }) =>
                            cn(
                                'reelshort-bottom-nav__tab',
                                (isActive || location.pathname.startsWith('/profile')) &&
                                    'reelshort-bottom-nav__tab--active',
                            )
                        }
                    >
                        {({ isActive }) => {
                            const active = isActive || location.pathname.startsWith('/profile');
                            return (
                                <>
                                    <img
                                        className="reelshort-bottom-nav__tab-icon"
                                        src={active ? bottomTabIcons.profile.active : bottomTabIcons.profile.nor}
                                        alt=""
                                    />
                                    <span className="reelshort-bottom-nav__tab-label">
                                        <FormattedMessage id="profile" />
                                    </span>
                                </>
                            );
                        }}
                    </NavLink>
                </div>
            </nav>
        </Fragment>,
        document.body,
    );
}
