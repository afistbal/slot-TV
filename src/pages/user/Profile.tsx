import { CircleUser } from 'lucide-react';
import gift from '@/assets/gift.svg';
import gem from '@/assets/gem.svg';
import iconHead from '@/assets/images/icon_head.739421aa.png';
// import iconMyList from '@/assets/images/04905690-876c-11ee-aed2-cfe3d80f70eb.png';
import iconFeedback from '@/assets/images/59f06ad0-876c-11ee-aed2-cfe3d80f70eb.png';
import iconHistory from '@/assets/images/history.png';
import iconChevron from '@/assets/images/bbd6ac50-876c-11ee-aed2-cfe3d80f70eb.png';
import { Link, useNavigate } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import Vip from '@/widgets/Vip';
import { FormattedMessage } from 'react-intl';
import { useUserStore } from '@/stores/user';
import { cn } from '@/lib/utils';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { ReelShortFooter } from '@/components/ReelShortFooter';
// import { Button } from '@/components/ui/button';
// import coinIcon from '@/assets/coin.svg';
// import Coin from '@/widgets/Coin';
import { api, type TData } from '@/api';
import { getUserAvatarDisplayUrl } from '@/lib/userAvatar';
import { useLoadingStore } from '@/stores/loading';
import { auth } from '@/firebase';

export default function Component() {
    const userStore = useUserStore();
    const navigate = useNavigate();
    const loadingStore = useLoadingStore();
    const [vip, setVip] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    // const [coin, setCoin] = useState(false);

    function handleToggleVip() {
        setVip(!vip);
    }

    function handleVipCardClick() {
        if (!userStore.isVIP()) {
            navigate('/shopping');
            return;
        }
        navigate('/page/membership');
    }

    // function handleToggleCoin() {
    //     setCoin(!coin);
    // }

    // function handleGoMyBalance() {
    //     navigate('/page/my-balance');
    // }

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
            navigate('/page/login');
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

    return (
        <div className="rs-profile">
            <div ref={scrollRef} className="rs-profile__scroll">
                <ReelShortTopNav
                    scrollParentRef={scrollRef}
                    showPrimaryNav={false}
                    showSearch={true}
                    showProfile={false}
                    showLeftAction
                />
                <div className="rs-profile__content">
                {userStore.signed && !userStore.isAnonymous() ? (
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
                ) : (
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
                )}
                {/* <div className="rounded-md p-4 m-4 flex flex-col gap-2 bg-[#ff7575] text-white">
                    <div className="flex gap-1 text-red-100" onClick={handleGoMyBalance}>
                        <div>
                            <FormattedMessage id="my_balance" />
                        </div>
                        <Forward />
                    </div>
                    <div className="flex justify-between">
                        <div className="flex items-center gap-1">
                            <img src={coinIcon} width={28} height={28} className="mt-1" />
                            <div className="text-2xl">
                                {userStore.balance === -1 ? '···' : userStore.balance}
                            </div>
                        </div>
                        <div>
                            <Button
                                onClick={handleToggleCoin}
                                className="h-10 shadow bg-white text-red-400 font-bold text-md"
                            >
                                <FormattedMessage id="top_up" />
                            </Button>
                        </div>
                    </div>
                </div> */}
                <div className="rs-profile__vipCard" onClick={handleVipCardClick} role="button" tabIndex={0} onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleVipCardClick();
                    }
                }}>
                    <img
                        src={gift}
                        className={cn(
                            'w-20 h-20 absolute top-3',
                            document.body.style.direction === 'ltr' ? 'right-2' : 'left-2',
                        )}
                    />
                    <img
                        src={gem}
                        className={cn(
                            'w-16 h-16 absolute bottom-2 -rotate-45',
                            document.body.style.direction === 'ltr' ? 'right-10' : 'left-10',
                        )}
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
                <div className="rs-profile__menu">
                    {userStore.isAdmin() && (
                        <Link to="/z" className="rs-profile__menuItem">
                            <div className="rs-profile__menuLeft">
                                <CircleUser className="w-5 h-5" />
                                <div className="rs-profile__menuText">
                                    <FormattedMessage id="admin" />
                                </div>
                            </div>
                            <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
                        </Link>
                    )}
                    {/* <Link to="/my-list" className="rs-profile__menuItem">
                        <div className="rs-profile__menuLeft">
                            <img src={iconMyList} alt="" className="rs-profile__menuIcon" />
                            <div className="rs-profile__menuText">
                                <FormattedMessage id="my_list" />
                            </div>
                        </div>
                        <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
                    </Link> */}
                    <Link to="/my-list/history" className="rs-profile__menuItem">
                        <div className="rs-profile__menuLeft">
                            <img src={iconHistory} alt="" className="rs-profile__menuIcon" />
                            <div className="rs-profile__menuText">
                                <FormattedMessage id="history" />
                            </div>
                        </div>
                        <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
                    </Link>
                    <Link
                        to="/page/feedback"
                        className="rs-profile__menuItem"
                    >
                        <div className="rs-profile__menuLeft">
                            <img src={iconFeedback} alt="" className="rs-profile__menuIcon" />
                            <div className="rs-profile__menuText">
                                <FormattedMessage id="feedback_help" />
                            </div>
                        </div>
                        <img src={iconChevron} alt="" className="rs-profile__menuChevronIcon" />
                    </Link>
                </div>

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
                <Vip open={vip} from="profile" onOpenChange={handleToggleVip} />
                {/* <Coin open={coin} from="profile" onOpenChange={handleToggleCoin} /> */}
            </div>
        </div>
    );
}
