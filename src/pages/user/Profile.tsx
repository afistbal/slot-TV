import { CircleUser } from 'lucide-react';
import { WalletTransactionHistory } from '@/pages/user/WalletTransactionHistory';
import iconHead from '@/assets/images/icon_head.739421aa.png';
import coinIcon from '@/assets/profile/icon_coin@2x.png';
import { profileH5Assets, profilePcMenuAssets } from '@/constants/profileAssets';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Vip from '@/widgets/Vip';
import { FormattedMessage, useIntl } from 'react-intl';
import { useUserStore } from '@/stores/user';
import { useRootStore } from '@/stores/root';
import { cn } from '@/lib/utils';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { api, type TData } from '@/api';
import { logoutToAnonymousSession } from '@/lib/logoutToAnonymousSession';
import {
    clearProfileMembershipRenewalAt,
    getProfileMembershipRenewalAt,
    setProfileMembershipRenewalAt,
} from '@/lib/profileMembershipCache';
import { getUserAvatarDisplayUrl } from '@/lib/userAvatar';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import RadixRc from '@/pages/user/RadixRc';
import FeedbackPanel from '@/pages/user/Feedback';
import UserDetailPanel from '@/pages/user/UserDetail';
import { ProfilePcMyListPane, type ProfileMyListSubTab } from '@/pages/user/ProfilePcMyListPane';
import { PcLoginDialog } from '@/pages/user/Login';
type ProfilePcTab = 'topup' | 'wallet' | 'profile' | 'mylist' | 'feedback';

/** PC 侧栏 webp 图标：mask + currentColor，active/hover 时与菜单文字同色 */
function PcMenuIcon({ src }: { src: string }) {
    return (
        <span
            className="rs-profile__pc-menuImg"
            style={{ '--rs-pc-menu-icon': `url(${src})` } as CSSProperties}
            aria-hidden
        />
    );
}

export default function Component() {
    const intl = useIntl();
    const userStore = useUserStore();
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const location = useLocation();
    const sourceform = `${location.pathname}${location.search}`;
    const [vip, setVip] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isPc = useMinWidth768();
    const [pcLoginOpen, setPcLoginOpen] = useState(false);
    const [pcTab, setPcTab] = useState<ProfilePcTab>('topup');
    const [profileMyListSubTab, setProfileMyListSubTab] = useState<ProfileMyListSubTab>('favorite');
    const [membershipRenewalAt, setMembershipRenewalAt] = useState<string | null>(
        () => getProfileMembershipRenewalAt(),
    );
    const isVipProfile = userStore.isVIP();

    /** PC?? ReelShort `?tab=mylist` / `history` ????????????????????? */
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

    /** H5?????? `/my-list/history`???? `/wallet`??? `?tab=` ? PC ?? */
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
            return;
        }
        if (tab === 'topup') {
            const next = new URLSearchParams(searchParams);
            next.delete('tab');
            const q = next.toString();
            navigate(`/profile${q ? `?${q}` : ''}`, { replace: true, state: location.state });
        }
    }, [isPc, searchParams, navigate, location.state]);

    /** PC?URL ? ??????? */
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

    /** PC ???? `navigate('/profile', { state: { openPcLogin: true } })` ????? URL ???? */
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

    /** ???? `/profile?login=1`????????????? */
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
        if (!sessionBootstrapReady || !localStorage.getItem('token')) {
            return;
        }
        api<number>('user/balance', {
            loading: false,
            toastOnError: false,
        }).then((res) => {
            if (res.c === 0) {
                useUserStore.getState().setBalance(res.d);
            }
        });
    }, [sessionBootstrapReady]);

    /** H5 /profile??VIP ??? renewal_at?????????????????? */
    useEffect(() => {
        if (isPc || !isVipProfile || !sessionBootstrapReady) {
            if (!isVipProfile) {
                setMembershipRenewalAt(null);
                clearProfileMembershipRenewalAt();
            }
            return;
        }

        const cached = getProfileMembershipRenewalAt();
        if (cached) {
            setMembershipRenewalAt(cached);
            return;
        }

        let cancelled = false;
        api<TData>('user/membership', { loading: false, toastOnError: false })
            .then((res) => {
                if (cancelled || res.c !== 0) {
                    return;
                }
                const raw = res.d['renewal_at'];
                if (typeof raw === 'string' && raw.trim()) {
                    const value = raw.trim();
                    setProfileMembershipRenewalAt(value);
                    setMembershipRenewalAt(value);
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isPc, isVipProfile, sessionBootstrapReady]);

    async function handleLogout() {
        const ok = await logoutToAnonymousSession();
        if (!ok) {
            return;
        }
        clearProfileMembershipRenewalAt();
        setMembershipRenewalAt(null);
        if (isPc) {
            setPcLoginOpen(true);
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

    const h5HeaderLoginBtn = (
        <Link to="/page/login" className="rs-profile__h5HeaderAuth">
            <FormattedMessage id="login" />
        </Link>
    );

    const h5HeaderLogoutBtn = (
        <button type="button" className="rs-profile__h5HeaderAuth" onClick={() => void handleLogout()}>
            <FormattedMessage id="logout" />
        </button>
    );

    const loginCardSigned = userStore.signed && !userStore.isAnonymous() && (
        <div className="rs-profile__loginCard">
            <Link to="/user/detail" className="rs-profile__loginCardUserLink">
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
            <div className="rs-profile__loginCardMain rs-profile__loginCardMain--link">
                <div>
                    <div className="rs-profile__name">
                        <div>{userStore.info!['name'] as string}</div>
                    </div>
                    {profileUidRow}
                </div>
            </div>
            </Link>
            {h5HeaderLogoutBtn}
        </div>
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
                {h5HeaderLoginBtn}
            </div>
        </div>
    );

    const h5VipRenewalDateLabel = useMemo(() => {
        if (!membershipRenewalAt) {
            return null;
        }
        const datePart = membershipRenewalAt.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
            return datePart;
        }
        const parsed = new Date(membershipRenewalAt.replace(' ', 'T'));
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return intl.formatDate(parsed, { year: 'numeric', month: '2-digit', day: '2-digit' });
    }, [membershipRenewalAt, intl]);

    const h5VipSubscribedCard = (
        <div
            className="rs-profile__h5Vip rs-profile__h5Vip--active"
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
            <div className="rs-profile__h5VipActiveBody">
                <div className="rs-profile__h5VipActiveLeft">
                    <div className="rs-profile__h5VipActiveMain">
                        <img
                            src={profileH5Assets.vipCardDecor}
                            alt=""
                            className="rs-profile__h5VipActiveIcon"
                            aria-hidden
                        />
                        <div className="rs-profile__h5VipActiveTitle">
                            <FormattedMessage id="vip" />
                        </div>
                    </div>
                    <div className="rs-profile__h5VipActiveValid">
                        <FormattedMessage
                            id="profile_h5_vip_valid_until"
                            values={{ date: h5VipRenewalDateLabel ?? '--' }}
                        />
                    </div>
                </div>
                <span className="rs-profile__h5VipActiveBadge">
                    <FormattedMessage id="profile_h5_subscribed" />
                </span>
            </div>
        </div>
    );


    const h5Menu = (
        <div className="rs-profile__menu rs-profile__menu--h5">
            {userStore.isAdmin() && (
                <>
                    <Link to="/z" className="rs-profile__menuItem">
                        <div className="rs-profile__menuLeft">
                            <CircleUser className="w-5 h-5" />
                            <div className="rs-profile__menuText">
                                <FormattedMessage id="admin" />
                            </div>
                        </div>
                        <img src={profileH5Assets.chevron} alt="" className="rs-profile__menuChevronIcon" />
                    </Link>
                    <Link to="/shopping?show_plans=1" className="rs-profile__menuItem">
                        <div className="rs-profile__menuLeft">
                            <CircleUser className="w-5 h-5" />
                            <div className="rs-profile__menuText">
                                <FormattedMessage id="profile_admin_product_list" />
                            </div>
                        </div>
                        <img src={profileH5Assets.chevron} alt="" className="rs-profile__menuChevronIcon" />
                    </Link>
                </>
            )}
            <Link
                to={`/my-list/history?sourceform=${encodeURIComponent(sourceform)}`}
                state={{ sourceform }}
                className="rs-profile__menuItem"
            >
                <div className="rs-profile__menuLeft">
                    <img src={profileH5Assets.menuHistory} alt="" className="rs-profile__menuIcon" />
                    <div className="rs-profile__menuText">
                        <FormattedMessage id="history" />
                    </div>
                </div>
                <img src={profileH5Assets.chevron} alt="" className="rs-profile__menuChevronIcon" />
            </Link>
            <Link to="/page/language" className="rs-profile__menuItem">
                <div className="rs-profile__menuLeft">
                    <img src={profileH5Assets.menuLanguage} alt="" className="rs-profile__menuIcon" />
                    <div className="rs-profile__menuText">
                        <FormattedMessage id="language" />
                    </div>
                </div>
                <img src={profileH5Assets.chevron} alt="" className="rs-profile__menuChevronIcon" />
            </Link>
            <Link to="/page/feedback" className="rs-profile__menuItem">
                <div className="rs-profile__menuLeft">
                    <img src={profileH5Assets.menuHelp} alt="" className="rs-profile__menuIcon" />
                    <div className="rs-profile__menuText">
                        <FormattedMessage id="feedback_help" />
                    </div>
                </div>
                <img src={profileH5Assets.chevron} alt="" className="rs-profile__menuChevronIcon" />
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
        if (pending) return '\u00b7\u00b7\u00b7';
        return intl.formatNumber(n);
    }

    /** H5 ? VIP?ReelShort DashboardPage_amount??? + ??? */
    const h5VipUpgradeCard = (
        <div
            className="rs-profile__h5Vip"
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
            <p className="rs-profile__h5VipTitle">
                <FormattedMessage id="profile_h5_upgrade_vip" />
            </p>
            <div className="rs-profile__h5VipBenefits">
                <div className="rs-profile__h5VipBenefit">
                    <img src={profileH5Assets.benefitShort} alt="" className="rs-profile__h5VipBenefitIcon" />
                    <span>
                        <FormattedMessage id="shopping_benefit_unlimited_viewing" />
                    </span>
                </div>
                <div className="rs-profile__h5VipBenefit">
                    <img src={profileH5Assets.benefitHd} alt="" className="rs-profile__h5VipBenefitIcon" />
                    <span>
                        <FormattedMessage id="shopping_benefit_hd" />
                    </span>
                </div>
                <div className="rs-profile__h5VipBenefit">
                    <img src={profileH5Assets.benefitMore} alt="" className="rs-profile__h5VipBenefitIcon" />
                    <span>
                        <FormattedMessage id="shopping_benefit_more" />
                    </span>
                </div>
            </div>
            <button
                type="button"
                className="rs-profile__h5VipSubscribe"
                onClick={(e) => {
                    e.stopPropagation();
                    handleVipCardClick();
                }}
            >
                <FormattedMessage id="profile_subscribe" />
            </button>
        </div>
    );

    const h5MyAccountCard = (
        <div className="rs-profile__h5Account">
            <div className="rs-profile__h5AccountHead">
                <span className="rs-profile__h5AccountTitle">
                    <FormattedMessage id="profile_h5_my_account" />
                </span>
                <Link to="/wallet" className="rs-profile__h5AccountDetails">
                    <FormattedMessage id="profile_h5_details" />
                    <img src={profileH5Assets.chevron} alt="" aria-hidden />
                </Link>
            </div>
            <div className="rs-profile__h5AccountDivider" aria-hidden />
            <div className="rs-profile__h5AccountBody">
                <div className="rs-profile__h5AccountCoins">
                    <span className="rs-profile__h5AccountCoinsLabel">
                        <FormattedMessage id="shopping_bar_coins" />
                    </span>
                    <div className="rs-profile__h5AccountCoinsValue">
                        <img src={profileH5Assets.coin} alt="" aria-hidden />
                        <span className="tabular-nums">
                            {formatPcWalletStat(pcWalletDisplay.total, pcWalletDisplay.pending)}
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    className="rs-profile__h5AccountTopUp"
                    onClick={handleVipCardClick}
                >
                    <FormattedMessage id="top_up" />
                </button>
            </div>
        </div>
    );



        /** ? ReelShort `dashboard_pc_*` DOM + `9cb3e9a284588d0e.css` ???? `reelshort-dashboard-pc-mirror.scss`? */
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

    /** PC ????????????? ? ???????????????? tab=topup? */
    const pcAccountBalance = (
        <div className="rs-profile__pc-accountBalance">
            <div className="rs-profile__pc-accountBalance__panel">
                <div className="rs-profile__pc-accountBalance__title">
                    <FormattedMessage id="profile_h5_my_account" />
                </div>
                <div className="rs-profile__pc-accountBalance__divider" aria-hidden />
                <div className="rs-profile__pc-accountBalance__body">
                    <div className="rs-profile__pc-accountBalance__coins">
                        <span className="rs-profile__pc-accountBalance__label">
                            <FormattedMessage id="shopping_bar_coins" />
                        </span>
                        <div className="rs-profile__pc-accountBalance__valueRow">
                            <img src={coinIcon} alt="" aria-hidden />
                            <span className="tabular-nums">
                                {formatPcWalletStat(pcWalletDisplay.total, pcWalletDisplay.pending)}
                            </span>
                        </div>
                    </div>
                    <Link to="/profile?tab=topup" className="rs-profile__pc-accountBalance__topUp">
                        <FormattedMessage id="top_up" />
                    </Link>
                </div>
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
                    /* PC?????????? brand-cluster ?? ? ????????H5 ?????/?? subnav */
                    showPrimaryNav={isPc}
                    showSearch={isPc}
                    showProfile={false}
                    leftAction={isPc ? 'menu' : 'none'}
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
                                                        <PcMenuIcon src={profilePcMenuAssets.myList} />
                                                    </i>
                                                    <span>
                                                        <FormattedMessage id="profile_admin_product_list" />
                                                    </span>
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
                                                <PcMenuIcon src={profilePcMenuAssets.wallet} />
                                            </i>
                                            <span>
                                                <FormattedMessage id="shopping_bar_history" />
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
                                                <PcMenuIcon src={profilePcMenuAssets.myList} />
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
                                                <PcMenuIcon src={profilePcMenuAssets.watchHistory} />
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
                                                <PcMenuIcon src={profilePcMenuAssets.help} />
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
                            <ReelShortFooter hideSupportCenter />
                        </div>
                    </>
                ) : (
                    <div className="rs-profile__content">
                        {userStore.signed && !userStore.isAnonymous()
                            ? loginCardSigned
                            : loginCardGuest}
                        {isVipProfile ? h5VipSubscribedCard : h5VipUpgradeCard}
                        {h5MyAccountCard}
                        {h5Menu}
                        <ReelShortFooter dockAboveBottomTab hideSupportCenter />
                    </div>
                )}
                <Vip open={vip} from="profile" onOpenChange={handleToggleVip} />
                {isPc ? <PcLoginDialog open={pcLoginOpen} onOpenChange={setPcLoginOpen} /> : null}
            </div>
        </div>
    );
}
