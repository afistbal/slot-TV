import { CircleUser } from 'lucide-react';
import {
    RsPcHelpMenuIcon,
    RsPcHistoryMenuIcon,
    RsPcMyListMenuIcon,
    RsPcWalletMenuIcon,
} from '@/components/icons/reelshortDashboardPcMenuIcons';
import { WalletTransactionHistory } from '@/pages/user/WalletTransactionHistory';
import gift from '@/assets/gift.svg';
import gem from '@/assets/gem.svg';
import iconHead from '@/assets/images/icon_head.739421aa.png';
import iconFeedback from '@/assets/images/59f06ad0-876c-11ee-aed2-cfe3d80f70eb.png';
import iconHistory from '@/assets/images/history.png';
import iconWallet from '@/assets/04030ab0-876c-11ee-aed2-cfe3d80f70eb.png';
import iconChevron from '@/assets/images/bbd6ac50-876c-11ee-aed2-cfe3d80f70eb.png';
import coinIcon from '@/assets/coin.svg';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import Vip from '@/widgets/Vip';
import { FormattedMessage, useIntl } from 'react-intl';
import { useUserStore } from '@/stores/user';
import { useRootStore } from '@/stores/root';
import { cn } from '@/lib/utils';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { api, type TData } from '@/api';
import { trackAnonymousCompleteRegistration } from '@/hooks/usePixel';
import { getUserAvatarDisplayUrl } from '@/lib/userAvatar';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { useLoadingStore } from '@/stores/loading';
import { auth } from '@/firebase';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import RadixRc from '@/pages/user/RadixRc';
import FeedbackPanel from '@/pages/user/Feedback';
import UserDetailPanel from '@/pages/user/UserDetail';
import { ProfilePcMyListPane, type ProfileMyListSubTab } from '@/pages/user/ProfilePcMyListPane';
import { PcLoginDialog } from '@/pages/user/Login';
type ProfilePcTab = 'topup' | 'wallet' | 'profile' | 'mylist' | 'feedback';

export default function Component() {
    const intl = useIntl();
    const userStore = useUserStore();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
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
    function setProfileTabQuery(
        tab: 'topup' | 'wallet' | 'profile' | 'mylist' | 'history' | 'feedback',
    ) {
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

    /** H5：观看记录在 `/my-list/history`、钱包在 `/wallet`；对应 `?tab=` 仅 PC 解析 */
    useEffect(() => {
        if (isPc) {
            return;
        }
        const tab = searchParams.get('tab')?.toLowerCase();
        if (tab === 'history') {
            const next = new URLSearchParams(searchParams);
            next.delete('tab');
            const q = next.toString();
            navigate(`/my-list/history${q ? `?${q}` : ''}`, { replace: true, state: location.state });
            return;
        }
        if (tab === 'wallet') {
            const next = new URLSearchParams(searchParams);
            next.delete('tab');
            const q = next.toString();
            navigate(`/wallet${q ? `?${q}` : ''}`, { replace: true, state: location.state });
        }
    }, [isPc, searchParams, navigate, location.state]);

    /** PC：URL → 侧栏与主栏状态 */
    useEffect(() => {
        if (!isPc) {
            return;
        }
        const tab = searchParams.get('tab')?.toLowerCase();
        if (!tab || tab === 'topup') {
            setPcTab('topup');
            return;
        }
        if (tab === 'wallet') {
            setPcTab('wallet');
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
        if (!sessionBootstrapReady) {
            return;
        }
        api<number>('user/balance', {
            loading: false,
        }).then((res) => {
            useUserStore.getState().setBalance(res.d);
        });
    }, [sessionBootstrapReady]);

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

            const result = await api<{ token: string; info: { [key: string]: unknown } }>(
                'login/anonymous',
                {
                    loading: false,
                },
            );

            if (result.c !== 0) {
                return;
            }

            localStorage.setItem('token', result.d['token'] as string);
            userStore.signin(result.d['info'] as { [key: string]: unknown });
            trackAnonymousCompleteRegistration();
        } finally {
            loadingStore.hide();
        }
    }

    const uniqueId = getUserUidForDisplay(userStore.info ?? undefined);
    const profileUidRow = (
        <div className="rs-profile__vip">
            {uniqueId ? (
                <>
                    <span className="rs-profile__uidLabel">UID:</span>
                    <span className="rs-profile__uidValue">{uniqueId}</span>
                </>
            ) : null}
        </div>
    );
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
                    {profileUidRow}
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
                    {profileUidRow}
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
                    <Link to="/shopping?show_plans=1" className="rs-profile__menuItem">
                        <div className="rs-profile__menuLeft">
                            <CircleUser className="w-5 h-5" />
                            <div className="rs-profile__menuText">产品列表</div>
                        </div>
                        <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
                    </Link>
                </>
            )}
            <Link to="/wallet" className="rs-profile__menuItem">
                <div className="rs-profile__menuLeft">
                    <img src={iconWallet} alt="" className="rs-profile__menuIcon" />
                    <div className="rs-profile__menuText">
                        <FormattedMessage id="profile_wallet" />
                    </div>
                </div>
                <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
            </Link>
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
        cn(
            'dashboard_pc_menu_item__GBkNY',
            pcTab === tab && 'dashboard_pc_menu_item_active__H7KVg',
        );

    const pcWalletSidebarLiClass = cn(
        'dashboard_pc_menu_item__GBkNY',
        pcTab === 'wallet' && 'dashboard_pc_menu_item_active__H7KVg',
    );

    const pcMyListSidebarLiClass = cn(
        'dashboard_pc_menu_item__GBkNY',
        pcTab === 'mylist' &&
            profileMyListSubTab === 'favorite' &&
            'dashboard_pc_menu_item_active__H7KVg',
    );

    const pcHistorySidebarLiClass = cn(
        'dashboard_pc_menu_item__GBkNY',
        pcTab === 'mylist' &&
            profileMyListSubTab === 'history' &&
            'dashboard_pc_menu_item_active__H7KVg',
    );

    const isSignedProfile = Boolean(userStore.signed && !userStore.isAnonymous());
    const pcDisplayName = isSignedProfile ? String(userStore.info?.['name'] ?? '') : null;

    const pcWalletDisplay = useMemo(() => {
        if (!userStore.signed || userStore.balance < 0) {
            return { total: 0, pending: userStore.signed && userStore.balance === -1 };
        }
        return { total: userStore.balance, pending: false };
    }, [userStore.signed, userStore.balance]);

    function formatPcWalletStat(n: number, pending: boolean) {
        if (pending) return '···';
        return intl.formatNumber(n);
    }

    /** H5 非 VIP：ReelShort DashboardPage_amount（金幣 + 儲值） */
    const h5AccountBalanceCard = (
        <div className="rs-profile__h5Amount">
            <div className="rs-profile__h5AmountTitle">
                <FormattedMessage id="shopping_bar_account_balance" />
            </div>
            <div className="rs-profile__h5AmountRow">
                <div className="rs-profile__h5AmountCol">
                    <div className="rs-profile__h5AmountValueRow">
                        <img src={coinIcon} alt="" aria-hidden />
                        <span className="tabular-nums">
                            {formatPcWalletStat(pcWalletDisplay.total, pcWalletDisplay.pending)}
                        </span>
                    </div>
                    <div className="rs-profile__h5AmountLabel">
                        <FormattedMessage id="shopping_bar_coins" />
                    </div>
                </div>
            </div>
            <button
                type="button"
                className="rs-profile__h5AmountTopUp"
                onClick={handleVipCardClick}
            >
                <FormattedMessage id="top_up" />
            </button>
        </div>
    );

    /** 与 ReelShort `dashboard_pc_*` DOM + `9cb3e9a284588d0e.css` 一致（见 `reelshort-dashboard-pc-mirror.scss`） */
    const pcUserInfo = (
        <div className="rs-profile__pc-reelshortMirror">
            <div className="dashboard_pc_dashboard_pc__EjjRI">
                <div className="dashboard_pc_dashboard_control__6d3Zj">
                    <div className="dashboard_pc_user_info__NRQYu">
                        <div className="rs-profile__pc-userAvatar relative flex h-full w-full flex-shrink-0 items-center justify-center">
                            <div className="relative h-10 w-10">
                                {isSignedProfile && avatarUrl ? (
                                    <img
                                        alt=""
                                        aria-hidden
                                        className="block h-10 w-10 max-w-full rounded-[50%] object-cover"
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
                                        className="block h-10 w-10 max-w-full rounded-[50%] object-cover"
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
                                    <span>UID {uniqueId || '--'}</span>
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

    /** PC 侧栏：头像区下方、菜单上方 — 深色卡内含餘額、金幣與儲值（跳转 tab=topup） */
    const pcAccountBalance = (
        <div className="rs-profile__pc-accountBalance">
            <div className="rs-profile__pc-accountBalance__panel">
                <div className="rs-profile__pc-accountBalance__title">
                    <FormattedMessage id="shopping_bar_account_balance" />
                </div>
                <div className="rs-profile__pc-accountBalance__row">
                    <div className="rs-profile__pc-accountBalance__col">
                        <div className="rs-profile__pc-accountBalance__valueRow">
                            <img src={coinIcon} alt="" aria-hidden />
                            <span className="tabular-nums">
                                {formatPcWalletStat(pcWalletDisplay.total, pcWalletDisplay.pending)}
                            </span>
                        </div>
                        <div className="rs-profile__pc-accountBalance__label">
                            <FormattedMessage id="shopping_bar_coins" />
                        </div>
                    </div>
                </div>
                <Link to="/profile?tab=topup" className="rs-profile__pc-accountBalance__topUp">
                    <FormattedMessage id="top_up" />
                </Link>
            </div>
        </div>
    );

    return (
        <div className={cn('rs-profile', isPc && 'rs-profile--pc')}>
            <div
                ref={scrollRef}
                className={cn('rs-profile__scroll', isPc && 'rs-profile__scroll--pc')}
            >
                <ReelShortTopNav
                    scrollParentRef={scrollRef}
                    /* PC：与首页同结构，避免 brand-cluster 居中 ↔ 左对齐切换晃眼；H5 不展示首頁/類別 subnav */
                    showPrimaryNav={isPc}
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
                                {pcAccountBalance}
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
                                                <Link
                                                    to="/shopping?show_plans=1"
                                                    className="rs-profile__pc-menuHit"
                                                >
                                                    <i>
                                                        <RsPcMyListMenuIcon />
                                                    </i>
                                                    <span>产品列表</span>
                                                </Link>
                                            </li>
                                        </>
                                    ) : null}
                                    {!userStore.isAnonymous() ? (
                                        <li className={pcDashboardMenuLiClass('profile')}>
                                            <button
                                                type="button"
                                                className="rs-profile__pc-menuHit"
                                                onClick={() => setProfileTabQuery('profile')}
                                            >
                                                <i>
                                                    <CircleUser
                                                        className="h-6 w-6 shrink-0"
                                                        strokeWidth={1.75}
                                                    />
                                                </i>
                                                <span>
                                                    <FormattedMessage id="user_detail" />
                                                </span>
                                            </button>
                                        </li>
                                    ) : null}
                                    <li className={pcWalletSidebarLiClass}>
                                        <button
                                            type="button"
                                            className="rs-profile__pc-menuHit"
                                            onClick={() => setProfileTabQuery('wallet')}
                                        >
                                            <i>
                                                <RsPcWalletMenuIcon />
                                            </i>
                                            <span>
                                                <FormattedMessage id="profile_wallet" />
                                            </span>
                                        </button>
                                    </li>
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
                                    {pcTab === 'wallet' ? (
                                        <div className="rs-profile__pc-wallet">
                                            <WalletTransactionHistory variant="pc" />
                                        </div>
                                    ) : null}
                                    {pcTab === 'mylist' ? (
                                        <ProfilePcMyListPane
                                            subTab={profileMyListSubTab}
                                            onSubTabChange={(v) =>
                                                setProfileTabQuery(
                                                    v === 'history' ? 'history' : 'mylist',
                                                )
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
                        {userStore.signed && !userStore.isAnonymous()
                            ? loginCardSigned
                            : loginCardGuest}
                        {userStore.isVIP() ? vipCard : h5AccountBalanceCard}
                        {h5Menu}
                        {userStore.isAnonymous() ? (
                            <Link to="/page/login" className="rs-profile__btnLogin">
                                <FormattedMessage id="login" />
                            </Link>
                        ) : (
                            <button
                                type="button"
                                className="rs-profile__btnLogin"
                                onClick={handleLogout}
                            >
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
