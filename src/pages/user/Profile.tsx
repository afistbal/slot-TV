import { CircleUser, Globe, Info, MessageCircle, User } from 'lucide-react';
import gift from '@/assets/gift.svg';
import gem from '@/assets/gem.svg';
import { Link, useNavigate } from 'react-router';
import { useEffect, useState } from 'react';
import Vip from '@/widgets/Vip';
import { FormattedMessage } from 'react-intl';
import { useUserStore } from '@/stores/user';
import { cn } from '@/lib/utils';
import Forward from '@/components/Forward';
// import { Button } from '@/components/ui/button';
// import coinIcon from '@/assets/coin.svg';
// import Coin from '@/widgets/Coin';
import { api } from '@/api';

export default function Component() {
    const userStore = useUserStore();
    const navigate = useNavigate();
    const [vip, setVip] = useState(false);
    // const [coin, setCoin] = useState(false);

    function handleToggleVip() {
        setVip(!vip);
    }

    // function handleToggleCoin() {
    //     setCoin(!coin);
    // }

    function handleGoMembership() {
        navigate('/page/membership');
    }

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

    return (
        <div className="h-full relative">
            <div
                className={cn(
                    'flex gap-2 px-4 justify-between h-16 items-center border-b border-slate-200 text-slate-600 bg-white',
                )}
            >
                <div className="text-lg font-bold text-ellipsis flex-1 whitespace-nowrap overflow-hidden">
                    <FormattedMessage id="profile" />
                </div>
                <div />
            </div>
            <div className="absolute w-full">
                <Link
                    to="/page/login"
                    className="p-4 flex gap-4 items-center bg-white m-4 rounded-md"
                >
                    <div
                        className={cn(
                            'w-16 h-16 rounded-full flex justify-center items-center overflow-hidden',
                            !userStore.isAnonymous()
                                ? 'bg-red-300 text-white'
                                : 'bg-slate-200 text-slate-500',
                        )}
                    >
                        {!userStore.isAnonymous() && userStore.info!['avatar'] ? (
                            <img src={userStore.info!['avatar'] as string} />
                        ) : (
                            <User className="w-8 h-8" />
                        )}
                    </div>
                    <div className="flex justify-between gap-4 items-center flex-1">
                        <div>
                            <div className="text-xl text-slate-700">
                                {!userStore.isAnonymous() ? (
                                    <div>{userStore.info!['name'] as string}</div>
                                ) : (
                                    <FormattedMessage id="check_login" />
                                )}
                            </div>
                            <div className="text-slate-500 text-sm">
                                <FormattedMessage
                                    id={`vip_${
                                        !userStore.isAnonymous()
                                            ? (userStore.info!['vip'] as number)
                                            : 0
                                    }`}
                                />
                            </div>
                        </div>
                        <div>
                            <Forward className="text-slate-500" />
                        </div>
                    </div>
                </Link>
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
                <div
                    className="rounded-md h-26 mx-4 shadow bg-[#d48aff] relative flex items-center p-4"
                    onClick={userStore.isVIP() ? handleGoMembership : handleToggleVip}
                >
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
                    <div className="flex gap-2 flex-col text-center">
                        <div className="rounded-full px-6 py-1 bg-gray-700">
                            <div className="font-bold text text-white">
                                <FormattedMessage id={userStore.isVIP() ? 'is_vip' : 'vip'} />
                            </div>
                        </div>
                        <div className="text-gray-100 text-xs leading-3">
                            <FormattedMessage id="enjoy" />
                        </div>
                    </div>
                </div>
                <div className="m-4 mt-4 rounded-md bg-white">
                    {userStore.isAdmin() && (
                        <Link to="/z" className="flex gap-2 justify-between items-center p-4">
                            <div className="flex gap-2 text-gray-600 items-center">
                                <CircleUser className="w-5 h-5" />
                                <div className="text-md">
                                    <FormattedMessage id="admin" />
                                </div>
                            </div>
                            <Forward className="text-slate-400" />
                        </Link>
                    )}
                    <Link
                        to="/page/feedback"
                        className="flex gap-2 justify-between items-center p-4"
                    >
                        <div className="flex gap-2 text-gray-600 items-center">
                            <MessageCircle className="w-5 h-5" />
                            <div className="text-md">
                                <FormattedMessage id="feedback_help" />
                            </div>
                        </div>
                        <Forward className="text-slate-400" />
                    </Link>
                    <Link
                        to="/page/language"
                        className="flex gap-2 justify-between items-center p-4 border-t border-muted"
                    >
                        <div className="flex gap-2 text-gray-600 items-center">
                            <Globe className="w-5 h-5" />
                            <div className="text-md">
                                <FormattedMessage id="language" />
                            </div>
                        </div>
                        <Forward className="text-slate-400" />
                    </Link>
                    <Link
                        to="/page/about"
                        className="flex gap-2 justify-between items-center p-4 border-t border-muted"
                    >
                        <div className="flex gap-2 text-gray-600 items-center">
                            <Info className="w-5 h-5" />
                            <div className="text-md">
                                <FormattedMessage id="about_us" />
                            </div>
                        </div>
                        <Forward className="text-slate-400" />
                    </Link>
                </div>
            </div>
            <Vip open={vip} from="profile" onOpenChange={handleToggleVip} />
            {/* <Coin open={coin} from="profile" onOpenChange={handleToggleCoin} /> */}
        </div>
    );
}
