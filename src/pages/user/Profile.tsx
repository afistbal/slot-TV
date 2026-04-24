import { CircleUser } from 'lucide-react';
import {
    RsPcHelpMenuIcon,
    RsPcHistoryMenuIcon,
    RsPcMyListMenuIcon,
    RsPcWalletMenuIcon,
} from '@/components/icons/reelshortDashboardPcMenuIcons';
import gift from '@/assets/gift.svg';
import gem from '@/assets/gem.svg';
import iconHead from '@/assets/images/icon_head.739421aa.png';
import iconFeedback from '@/assets/images/59f06ad0-876c-11ee-aed2-cfe3d80f70eb.png';
import iconHistory from '@/assets/images/history.png';
import iconChevron from '@/assets/images/bbd6ac50-876c-11ee-aed2-cfe3d80f70eb.png';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import Vip from '@/widgets/Vip';
import { FormattedMessage } from 'react-intl';
import { useUserStore } from '@/stores/user';
import { cn } from '@/lib/utils';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { api, type TData } from '@/api';
import { getUserAvatarDisplayUrl } from '@/lib/userAvatar';
import { useLoadingStore } from '@/stores/loading';
import { auth } from '@/firebase';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import RadixRc from '@/pages/user/RadixRc';
import FeedbackPanel from '@/pages/user/Feedback';
import UserDetailPanel from '@/pages/user/UserDetail';
import { ProfilePcMyListPane, type ProfileMyListSubTab } from '@/pages/user/ProfilePcMyListPane';
import { PcLoginDialog } from '@/pages/user/Login';

type ProfilePcTab = 'topup' | 'profile' | 'mylist' | 'feedback';

export default function Component() {
    const userStore = useUserStore();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const sourceform = `${location.pathname}${location.search}`;
    const loadingStore = useLoadingStore();
    const [vip, setVip] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isPc = useMinWidth768();
    const [pcLoginOpen, setPcLoginOpen] = useState(false);
    const [pcTab, setPcTab] = useState<ProfilePcTab>('topup');
    const [profileMyListSubTab, setProfileMyListSubTab] = useState<ProfileMyListSubTab>('favorite');

    /** PC：与 ReelShort `?tab=mylist` / `history` 类似，用查询串驱动侧栏（可分享、可外链）。 */
    function setProfileTabQuery(tab: 'topup' | 'profile' | 'mylist' | 'history' | 'feedback') {
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.set('tab', tab);
                return next;
            },
            { replace: true },
        );
    }

    function handleToggleVip() {
        setVip(!vip);
    }

    function handleVipCardClick() {
        if (isPc) {
            setProfileTabQuery('topup');
        } else {
            navigate('/shopping');
        }
    }

    /** H5：带 `tab` 进 /profile 时转到与全页路由等价的页面（PC 留在双栏 profile）。 */
    useEffect(() => {
        if (isPc) {
            return;
        }
        const tab = searchParams.get('tab')?.toLowerCase();
        if (!tab) {
            return;
        }
        const dest: Record<string, string> = {
            topup: '/shopping',
            wallet: '/shopping',
            mylist: '/my-list',
            favorite: '/my-list',
            history: '/my-list/history',
            feedback: '/page/feedback',
            help: '/page/feedback',
        };
        const path = dest[tab];
        if (path) {
            const back = searchParams.get('sourceform');
            const qs = back
                ? `${path.includes('?') ? '&' : '?'}sourceform=${encodeURIComponent(back)}`
                : '';
            navigate(`${path}${qs}`, { replace: true });
        }
    }, [isPc, location.search, navigate]);

    /** PC：URL → 侧栏与主栏状态 */
    useEffect(() => {
        if (!isPc) {
            return;
        }
        const tab = searchParams.get('tab')?.toLowerCase();
        if (!tab || tab === 'topup' || tab === 'wallet') {
            setPcTab('topup');
            return;
        }
        if (tab === 'profile') {
            if (userStore.isAnonymous()) {
                setPcTab('topup');
                return;
            }
            setPcTab('profile');
            return;
        }
        if (tab === 'mylist' || tab === 'favorite') {
            setPcTab('mylist');
            setProfileMyListSubTab('favorite');
            return;
        }
        if (tab === 'history') {
            setPcTab('mylist');
            setProfileMyListSubTab('history');
            return;
        }
        if (tab === 'feedback' || tab === 'help') {
            setPcTab('feedback');
            return;
        }
        setPcTab('topup');
    }, [isPc, location.search, userStore]);

    /** PC 登录：由 `navigate('/profile', { state: { openPcLogin: true } })` 打开，不写 URL 查询串。 */
    useEffect(() => {
        const st = location.state as { openPcLogin?: boolean } | null | undefined;
        if (!st?.openPcLogin) {
            return;
        }
        setPcLoginOpen(true);
        navigate(
            { pathname: location.pathname, search: location.search, hash: location.hash },
            { replace: true, state: {} },
        );
    }, [location.state, location.pathname, location.search, location.hash, navigate]);

    /** 兼容旧链 `/profile?login=1`：去掉查询串并仅拉起弹窗。 */
    useEffect(() => {
        if (!isPc) {
            return;
        }
        if (searchParams.get('login') !== '1') {
            return;
        }
        setPcLoginOpen(true);
        setSearchParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                next.delete('login');
                return next;
            },
            { replace: true },
        );
    }, [isPc, searchParams, setSearchParams]);

    useEffect(() => {
        api<number>('user/balance', {
            loading: false,
        }).then((res) => {
            userStore.setBalance(res.d);
        });
    }, []);

    async function handleLogout() {
        try {
            loadingStore.show();
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

    const uniqueId = (userStore.info?.['unique_id'] as string | undefined) ?? '';
    const avatarUrl =
        userStore.signed && !userStore.isAnonymous()
            ? getUserAvatarDisplayUrl(userStore.info as TData | undefined)
            : undefined;

    const loginCardSigned = userStore.signed && !userStore.isAnonymous() && (
        <Link to="/user/detail" className="rs-profile__loginCard">
            <div className="rs-profile__avatarWrap">
                {avatarUrl ? (
                    <img
                        className="rs-profile__avatarImg"
                        src={avatarUrl}
                        referrerPolicy="no-referrer"
                        onError={() => {
                            localStorage.removeItem('user-avatar');
                            userStore.update({ avatar: '' });
                        }}
                        alt=""
                    />
                ) : (
                    <img src={iconHead} alt="" className="rs-profile__avatarGuestImg" />
                )}
            </div>
            <div className="rs-profile__loginCardMain">
                <div>
                    <div className="rs-profile__name">
                        <div>{userStore.info!['name'] as string}</div>
                    </div>
                    <div className="rs-profile__vip">
                        {uniqueId ? (
                            <>
                                <span className="rs-profile__uidLabel">UID:</span>
                                <span className="rs-profile__uidValue">{uniqueId}</span>
                            </>
                        ) : null}
                    </div>
                </div>
                <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
            </div>
        </Link>
    );

    const loginCardGuest = (
        <div className="rs-profile__loginCard">
            <div className="rs-profile__avatarWrap">
                <img src={iconHead} alt="" className="rs-profile__avatarGuestImg" />
            </div>
            <div className="rs-profile__loginCardMain">
                <div>
                    <div className="rs-profile__name">
                        <FormattedMessage id="guest" />
                    </div>
                    <div className="rs-profile__vip">
                        <FormattedMessage id="vip_0" />
                    </div>
                </div>
            </div>
        </div>
    );

    const vipCard = (
        <div
            className="rs-profile__vipCard"
            onClick={handleVipCardClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleVipCardClick();
                }
            }}
        >
            <img
                src={gift}
                className={cn(
                    'w-20 h-20 absolute top-3',
                    document.body.style.direction === 'ltr' ? 'right-2' : 'left-2',
                )}
                alt=""
            />
            <img
                src={gem}
                className={cn(
                    'w-16 h-16 absolute bottom-2 -rotate-45',
                    document.body.style.direction === 'ltr' ? 'right-10' : 'left-10',
                )}
                alt=""
            />
            <div className="rs-profile__vipCardText">
                <div className="rs-profile__vipPill">
                    <FormattedMessage id={userStore.isVIP() ? 'is_vip' : 'vip'} />
                </div>
                <div className="rs-profile__vipHint">
                    <FormattedMessage id="enjoy" />
                </div>
            </div>
        </div>
    );

    const h5Menu = (
        <div className="rs-profile__menu">
            {userStore.isAdmin() && (
                <>
                    <Link to="/z" className="rs-profile__menuItem">
                        <div className="rs-profile__menuLeft">
                            <CircleUser className="w-5 h-5" />
                            <div className="rs-profile__menuText">
                                <FormattedMessage id="admin" />
                            </div>
                        </div>
                        <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
                    </Link>
                    <Link to="/shopping" className="rs-profile__menuItem">
                        <div className="rs-profile__menuLeft">
                            <CircleUser className="w-5 h-5" />
                            <div className="rs-profile__menuText">产品列表</div>
                        </div>
                        <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
                    </Link>
                </>
            )}
            <Link
                to={`/my-list/history?sourceform=${encodeURIComponent(sourceform)}`}
                state={{ sourceform }}
                className="rs-profile__menuItem"
            >
                <div className="rs-profile__menuLeft">
                    <img src={iconHistory} alt="" className="rs-profile__menuIcon" />
                    <div className="rs-profile__menuText">
                        <FormattedMessage id="history" />
                    </div>
                </div>
                <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
            </Link>
            <Link to="/page/feedback" className="rs-profile__menuItem">
                <div className="rs-profile__menuLeft">
                    <img src={iconFeedback} alt="" className="rs-profile__menuIcon" />
                    <div className="rs-profile__menuText">
                        <FormattedMessage id="feedback_help" />
                    </div>
                </div>
                <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
            </Link>
        </div>
    );

    const pcDashboardMenuLiClass = (tab: ProfilePcTab) =>
        cn('dashboard_pc_menu_item__GBkNY', pcTab === tab && 'dashboard_pc_menu_item_active__H7KVg');

    const pcMyListSidebarLiClass = cn(
        'dashboard_pc_menu_item__GBkNY',
        pcTab === 'mylist' && profileMyListSubTab === 'favorite' && 'dashboard_pc_menu_item_active__H7KVg',
    );

    const pcHistorySidebarLiClass = cn(
        'dashboard_pc_menu_item__GBkNY',
        pcTab === 'mylist' && profileMyListSubTab === 'history' && 'dashboard_pc_menu_item_active__H7KVg',
    );

    const isSignedProfile = Boolean(userStore.signed && !userStore.isAnonymous());
    const pcDisplayName = isSignedProfile
        ? String(userStore.info?.['name'] ?? '')
        : null;

    /** 与 ReelShort `dashboard_pc_*` DOM + `9cb3e9a284588d0e.css` 一致（见 `reelshort-dashboard-pc-mirror.scss`） */
    const pcUserInfo = (
        <div className="rs-profile__pc-reelshortMirror">
            <div className="dashboard_pc_dashboard_pc__EjjRI">
                <div className="dashboard_pc_dashboard_control__6d3Zj">
                    <div className="dashboard_pc_user_info__NRQYu">
                        <div
                            className="relative flex h-full w-full flex-shrink-0 items-center justify-center"
                            style={{ width: 62, height: 62 }}
                        >
                            <div className="relative" style={{ width: 50, height: 50 }}>
                                {isSignedProfile && avatarUrl ? (
                                    <img
                                        alt=""
                                        aria-hidden
                                        className="block h-[50px] w-[50px] max-w-full rounded-[50%] object-cover"
                                        src={avatarUrl}
                                        referrerPolicy="no-referrer"
                                        onError={() => {
                                            localStorage.removeItem('user-avatar');
                                            userStore.update({ avatar: '' });
                                        }}
                                    />
                                ) : (
                                    <img
                                        alt="Guest"
                                        className="block h-[50px] w-[50px] max-w-full rounded-[50%] object-cover"
                                        src={iconHead}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="dashboard_pc_info__fonB9">
                            <div>
                                <div className="dashboard_pc_name__KWvOf">
                                    <span>
                                        {isSignedProfile && pcDisplayName ? (
                                            pcDisplayName
                                        ) : (
                                            <>
                                                {' '}
                                                <FormattedMessage id="guest" />
                                            </>
                                        )}
                                    </span>
                                </div>
                                <div className="dashboard_pc_uid__2riI1">
                                    <span>
                                        UID {uniqueId || '--'}
                                    </span>
                                </div>
                            </div>
                            {userStore.isAnonymous() ? (
                                <button
                                    type="button"
                                    className="dashboard_pc_sign_in__CCBeS"
                                    onClick={() => setPcLoginOpen(true)}
                                >
                                    <FormattedMessage id="login" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="dashboard_pc_sign_in__CCBeS"
                                    onClick={() => void handleLogout()}
                                >
                                    <FormattedMessage id="logout" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className={cn('rs-profile', isPc && 'rs-profile--pc')}>
            <div ref={scrollRef} className={cn('rs-profile__scroll', isPc && 'rs-profile__scroll--pc')}>
                <ReelShortTopNav
                    scrollParentRef={scrollRef}
                    showPrimaryNav={false}
                    showSearch={true}
                    showProfile={false}
                    showLeftAction
                    rightActionsMode={isPc ? 'profilePc' : 'default'}
                />
                {isPc ? (
                    <>
                        <div className="rs-profile__pc-dashboard">
                            <aside className="rs-profile__pc-aside">
                                {pcUserInfo}
                                <ul className={cn('dashboard_pc_menu__5uzfK', 'rs-profile__menu')}>
                                    {userStore.isAdmin() ? (
                                        <>
                                            <li className="dashboard_pc_menu_item__GBkNY">
                                                <Link to="/z" className="rs-profile__pc-menuHit">
                                                    <i>
                                                        <CircleUser
                                                            className="h-6 w-6 shrink-0"
                                                            strokeWidth={1.75}
                                                        />
                                                    </i>
                                                    <span>
                                                        <FormattedMessage id="admin" />
                                                    </span>
                                                </Link>
                                            </li>
                                            <li className="dashboard_pc_menu_item__GBkNY">
                                                <Link to="/shopping" className="rs-profile__pc-menuHit">
                                                    <i>
                                                        <RsPcMyListMenuIcon />
                                                    </i>
                                                    <span>产品列表</span>
                                                </Link>
                                            </li>
                                        </>
                                    ) : null}
                                    <li className={pcDashboardMenuLiClass('topup')}>
                                        <button
                                            type="button"
                                            className="rs-profile__pc-menuHit"
                                            onClick={() => setProfileTabQuery('topup')}
                                        >
                                            <i>
                                                <RsPcWalletMenuIcon />
                                            </i>
                                            <span>
                                                <FormattedMessage id="top_up" />
                                            </span>
                                        </button>
                                    </li>
                                    {!userStore.isAnonymous() ? (
                                        <li className={pcDashboardMenuLiClass('profile')}>
                                            <button
                                                type="button"
                                                className="rs-profile__pc-menuHit"
                                                onClick={() => setProfileTabQuery('profile')}
                                            >
                                                <i>
                                                    <CircleUser className="h-6 w-6 shrink-0" strokeWidth={1.75} />
                                                </i>
                                                <span>
                                                    <FormattedMessage id="user_detail" />
                                                </span>
                                            </button>
                                        </li>
                                    ) : null}
                                    <li className={pcMyListSidebarLiClass}>
                                        <button
                                            type="button"
                                            className="rs-profile__pc-menuHit"
                                            onClick={() => setProfileTabQuery('mylist')}
                                        >
                                            <i>
                                                <RsPcMyListMenuIcon />
                                            </i>
                                            <span>
                                                <FormattedMessage id="my_list" />
                                            </span>
                                        </button>
                                    </li>
                                    <li className={pcHistorySidebarLiClass}>
                                        <button
                                            type="button"
                                            className="rs-profile__pc-menuHit"
                                            onClick={() => setProfileTabQuery('history')}
                                        >
                                            <i>
                                                <RsPcHistoryMenuIcon />
                                            </i>
                                            <span>
                                                <FormattedMessage id="nav_watch_history" />
                                            </span>
                                        </button>
                                    </li>
                                    <li className={pcDashboardMenuLiClass('feedback')}>
                                        <button
                                            type="button"
                                            className="rs-profile__pc-menuHit"
                                            onClick={() => setProfileTabQuery('feedback')}
                                        >
                                            <i>
                                                <RsPcHelpMenuIcon />
                                            </i>
                                            <span>
                                                <FormattedMessage id="feedback_help" />
                                            </span>
                                        </button>
                                    </li>
                                </ul>
                            </aside>
                            <div className="rs-profile__pc-main">
                                <div
                                    className={cn(
                                        'rs-profile__pc-main-scroll',
                                        pcTab === 'mylist' && 'rs-profile__pc-main-scroll--mylist',
                                    )}
                                >
                                    {pcTab === 'topup' ? (
                                        <RadixRc
                                            layout="embed"
                                            embedPresentation="plain"
                                            productFrom="shopping"
                                            checkoutFrom="shopping"
                                        />
                                    ) : null}
                                    {pcTab === 'mylist' ? (
                                        <ProfilePcMyListPane
                                            subTab={profileMyListSubTab}
                                            onSubTabChange={(v) =>
                                                setProfileTabQuery(v === 'history' ? 'history' : 'mylist')
                                            }
                                            hideSubTabs
                                        />
                                    ) : null}
                                    {pcTab === 'profile' ? <UserDetailPanel embedded /> : null}
                                    {pcTab === 'feedback' ? <FeedbackPanel embedded /> : null}
                                </div>
                            </div>
                        </div>
                        <div className="rs-profile__pc-footer-wrap">
                            <ReelShortFooter />
                        </div>
                    </>
                ) : (
                    <div className="rs-profile__content">
                        {userStore.signed && !userStore.isAnonymous() ? loginCardSigned : loginCardGuest}
                        {vipCard}
                        {h5Menu}
                        {userStore.isAnonymous() ? (
                            <Link to="/page/login" className="rs-profile__btnLogin">
                                <FormattedMessage id="login" />
                            </Link>
                        ) : (
                            <button type="button" className="rs-profile__btnLogin" onClick={handleLogout}>
                                <FormattedMessage id="logout" />
                            </button>
                        )}
                        <ReelShortFooter />
                    </div>
                )}
                <Vip open={vip} from="profile" onOpenChange={handleToggleVip} />
                {isPc ? <PcLoginDialog open={pcLoginOpen} onOpenChange={setPcLoginOpen} /> : null}
            </div>
        </div>
    );
}
