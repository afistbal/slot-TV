import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { X } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';
import coinIcon from '@/assets/coin.svg';
import gift from '@/assets/gift.svg';
import gem from '@/assets/gem.svg';
import { useEffect, useState } from 'react';
import { api, type TData } from '@/api';
import Loader from '@/components/Loader';
import { cn } from '@/lib/utils';
import { useUserStore } from '@/stores/user';
import Vip from './Vip';
import Payment from './Payment';
import { init } from '@airwallex/components-sdk';
import { toast } from 'sonner';
import usePixel from '@/hooks/usePixel';
import Countdown from './Countdown';

interface IProduct {
    id: number;
    type: number;
    name: string;
    price: string;
    coin: number;
    bouns: string;
    renewal_price: string,
}

export default function UnlockEpisode({
    coins,
    open,
    onOpenChange,
}: {
    coins: number;
    open: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const intl = useIntl();
    const userStore = useUserStore();
    const pixel = usePixel();
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [product, setProduct] = useState<IProduct[]>([]);
    const [current, setCurrent] = useState(0);
    const [vip, setVip] = useState(false);
    const [paymentOpen, setPaymentOpen] = useState(false);

    async function loadData() {
        const b = await api<number>('user/balance', {
            loading: false,
        });

        setBalance(b.d);

        const p = await api<IProduct[]>('product', {
            data: {
                from: 'unlock',
                type: '10',
            },
            loading: false,
        });

        setProduct(
            p.d
                .sort((a, b) => a.type - b.type)
                .sort((a, b) => (a.name.indexOf('off') !== -1 ? -1 : a.id - b.id)),
        );
        setLoading(false);
    }

    function handleToggleVip() {
        setVip(!vip);
    }

    function handleSelectProduct(id: number) {
        setCurrent(id);
        setPaymentOpen(true);
    }

    function handlePaymentOpenChange(open: boolean) {
        setPaymentOpen(open);
    }

    async function handlePaymentSubmit(payment: number) {
        let result = await api<TData>('pay/create', {
            method: 'post',
            data: {
                payment,
                product_id: current,
                redirect: window.location.href,
            },
        });

        if (result.c !== 0) {
            return;
        }

        const { payments } = await init({
            locale: 'en',
            env: result.d['env'] as 'prod' | 'demo',
            enabledElements: ['payments'],
        });
        if (!payments) {
            toast.error(
                intl.formatMessage({
                    id: 'failed',
                }),
            );

            return;
        }
        const p = product.find((v) => v.id === current);
        const data = {
            content_ids: [current.toString()],
            currency: result.d['currency'] as string,
            value: p?.price,
        };
        pixel.track('InitiateCheckout', data);
        localStorage.setItem('checkout', JSON.stringify(data));

        payments.redirectToCheckout({
            intent_id: result.d['pi'] as string,
            customer_id: result.d['customer_id'] as string,
            client_secret: result.d['client_secret'] as string,
            currency: result.d['currency'] as string,
            successUrl: result.d['success_url'] as string,
            failUrl: result.d['fail_url'] as string,
            methods: ['card', 'googlepay', 'applepay'],
            applePayRequestOptions: {
                buttonType: 'buy',
                countryCode: 'HK',
            },
        });
    }

    useEffect(() => {
        if (!open) {
            return;
        }
        loadData();
    }, [open]);

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="min-h-2/5 bg-linear-to-b from-orange-50 to-red-50">
                <DrawerTitle className="flex justify-between p-4 items-start">
                    {!loading && (
                        <div className="font-normal text-slate-500">
                            <div className="flex">
                                <FormattedMessage id="balance" />
                                <img src={coinIcon} width={18} height={18} className="ml-1" />
                                <div className="text-orange-400 font-bold">{balance}</div>
                            </div>
                            <div className="flex">
                                <FormattedMessage id="current_episode" />
                                <img src={coinIcon} width={18} height={18} className="ml-1" />
                                <div className="text-orange-400 font-bold">{coins}</div>
                            </div>
                        </div>
                    )}
                    <div onClick={() => onOpenChange && onOpenChange(false)}>
                        <X />
                    </div>
                </DrawerTitle>
                {loading ? (
                    <Loader />
                ) : (
                    <div className="overflow-auto border-t">
                        <div className='pt-4'>
                            <Countdown/>
                        </div>
                        {!userStore.isVIP() && (
                            <div className="p-4 pb-0">
                                <div
                                    className="rounded-md h-26 shadow-lg bg-linear-to-r from-amber-300 to-red-400 relative flex items-center p-4"
                                    onClick={handleToggleVip}
                                >
                                    <img
                                        src={gift}
                                        className={cn(
                                            'w-20 h-20 absolute top-3',
                                            document.body.style.direction === 'ltr'
                                                ? 'right-2'
                                                : 'left-2',
                                        )}
                                    />
                                    <img
                                        src={gem}
                                        className={cn(
                                            'w-16 h-16 absolute bottom-2 -rotate-45',
                                            document.body.style.direction === 'ltr'
                                                ? 'right-10'
                                                : 'left-10',
                                        )}
                                    />
                                    {product.filter(v => v.id === 1).map(v => <div className="flex gap-2 flex-col items-start">
                                        <div className="flex gap-2 items-center">
                                            <div className="text-3xl font-bold">
                                                ${v.price}
                                            </div>
                                            <div className="text-rose-500 text-bold text-sm bg-white px-2.5 py-1 leading-4 rounded-full">
                                                <FormattedMessage id="limited_time_offer" values={{
                                                    off: (100 - Math.floor((parseFloat(v.price) / parseFloat(v.renewal_price)) * 100)) + '%'
                                                }}/>
                                            </div>
                                        </div>
                                        <div className="rounded-full px-4 py-1 bg-purple-500">
                                            <div className="text text-white text-shadow-lg">
                                                <FormattedMessage id="enjoy" />
                                            </div>
                                        </div>
                                    </div>)}
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 p-4">
                            {product
                                .filter((v) => v.type === 2)
                                .map((v) => (
                                    <div
                                        key={v.id}
                                        onClick={() => handleSelectProduct(v.id)}
                                        className={cn(
                                            'relative overflow-hidden rounded-md p-4 flex flex-col bg-white shadow-md',
                                            v.name.indexOf('off') !== -1 &&
                                                'col-span-2 bg-linear-90 from-cyan-100 to-purple-100',
                                        )}
                                    >
                                        <div className="flex font-bold gap-1 text-lg items-center">
                                            <img
                                                src={coinIcon}
                                                width={24}
                                                height={24}
                                                className="mb-1"
                                            />
                                            <div
                                                className={cn(
                                                    v.name.indexOf('off') !== -1 && 'text-red-400',
                                                )}
                                            >
                                                {v.coin}
                                            </div>
                                            <div className="text-orange-400 text-sm">
                                                +{v.coin * Number.parseFloat(v.bouns)}
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-400 px-1">
                                            ${v.price}
                                        </div>
                                        {v.bouns > '0.0' && (
                                            <div className="absolute top-0 right-0 text-xs bg-red-400 text-white px-2 py-0.5 rounded-bl-md rounded-tr-md">
                                                {v.name.indexOf('off') !== -1 && (
                                                    <FormattedMessage id="limited_time" />
                                                )}
                                                +{Number.parseFloat(v.bouns) * 100}%
                                            </div>
                                        )}
                                        {v.name.indexOf('off') !== -1 && (
                                            <div className="absolute opacity-10 text-4xl text-red-400 bottom-4 right-4">
                                                SALE
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </div>
                )}
            </DrawerContent>
            <Vip open={vip} from="unlock" onOpenChange={handleToggleVip} />
            <Payment
                open={paymentOpen}
                onOpenChange={handlePaymentOpenChange}
                onSubmit={handlePaymentSubmit}
            />
        </Drawer>
    );
}
