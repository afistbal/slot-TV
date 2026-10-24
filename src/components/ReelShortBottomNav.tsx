import { Fragment, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FormattedMessage } from 'react-intl';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { Gift, HandCoins } from 'lucide-react';
import '@/styles/reelshort-bottom-nav.scss';
import { cn } from '@/lib/utils';
import { bottomTabIcons } from '@/constants/bottomTabAssets';
import { FORYOU_PATH, isForYouPathname } from '@/constants/foryouRoute';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import { shouldShowIosAddHomeFab } from '@/lib/shouldShowIosAddHomeFab';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useRootStore } from '@/stores/root';
import usePixel from '@/hooks/usePixel';
import { showBottomTabBar } from '@/env';
import {
    prefetchAffiliateRouteChunk,
    prefetchLuckyRouteChunk,
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
            <svg className="reelshort-bottom-nav__add-icon" viewBox="0 0 24 24" aria-hidden>
                <rect x="5.5" y="2.5" width="13" height="19" rx="3" />
                <path d="M12 7v7M8.5 10.5h7" />
                <path d="M10.25 18h3.5" />
            </svg>
            <span className="reelshort-bottom-nav__add-text">
                <FormattedMessage id="add_desktop_short" />
            </span>
        </button>
    );
}

/** H5 底部四栏导航。 */
export function ReelShortBottomNav({ hidden = false }: ReelShortBottomNavProps) {
    const isDesktop = useMinWidth768();
    const location = useLocation();
    const showInstallPrompt = useRootStore((state) => state.showInstallPrompt);
    const showIosAddHome = shouldShowIosAddHomeFab();

    const isForYouPage = isForYouPathname(location.pathname);
    const showTabs = showBottomTabBar && !isDesktop && !hidden && !isForYouPage;
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
                    <BottomNavAddDesktopH5 variant={addVariant} onAndroidInstall={triggerAndroidInstall} />
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
                        to={FORYOU_PATH}
                        state={VIDEO_FROM_HOME_STATE}
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
                        to="/lucky"
                        onPointerEnter={prefetchLuckyRouteChunk}
                        onPointerDown={prefetchLuckyRouteChunk}
                        className={({ isActive }) =>
                            cn(
                                'reelshort-bottom-nav__tab',
                                (isActive || location.pathname.startsWith('/lucky')) &&
                                    'reelshort-bottom-nav__tab--active',
                            )
                        }
                    >
                        <Gift className="reelshort-bottom-nav__tab-icon reelshort-bottom-nav__tab-icon--vector" aria-hidden />
                        <span className="reelshort-bottom-nav__tab-label">
                            <FormattedMessage id="nav_lucky" />
                        </span>
                    </NavLink>
                    <NavLink
                        to="/affiliate"
                        onPointerEnter={prefetchAffiliateRouteChunk}
                        onPointerDown={prefetchAffiliateRouteChunk}
                        className={({ isActive }) =>
                            cn(
                                'reelshort-bottom-nav__tab',
                                (isActive || location.pathname.startsWith('/affiliate')) &&
                                    'reelshort-bottom-nav__tab--active',
                            )
                        }
                    >
                        <HandCoins className="reelshort-bottom-nav__tab-icon reelshort-bottom-nav__tab-icon--vector" aria-hidden />
                        <span className="reelshort-bottom-nav__tab-label">
                            <FormattedMessage id="nav_commission_short" />
                        </span>
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
