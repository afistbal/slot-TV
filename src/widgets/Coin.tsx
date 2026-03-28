import { Dialog, DialogContent, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DialogTitle } from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { api, type TData } from '@/api';
import Loader from '@/components/Loader';
import usePixel from '@/hooks/usePixel';
import { init } from '@airwallex/components-sdk';
import { toast } from 'sonner';
import coinIcon from '@/assets/coin.svg';
import Payment from './Payment';
import Countdown from './Countdown';
// import Adjust from "@adjustcom/adjust-web-sdk";

interface Product {
    id: number;
    type: number;
    name: string;
    price: string;
    coin: number;
    bouns: string;
}

export default function Coin({
    open,
    from,
    onOpenChange,
}: {
    open: boolean;
    from: string;
    onOpenChange?: (open: boolean) => void;
}) {
    const pixel = usePixel();
    const intl = useIntl();
    const [current, setCurrent] = useState(5);
    const [product, setProduct] = useState<Product[]>([]);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [loading, setLoading] = useState(true);

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
        // await Adjust.trackEvent({
        //     eventToken: '46xgdh',
        //     revenue: parseFloat(data['value']!),
        //     currency: data['currency'],
        // });
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

    function handleSelectProduct(id: number) {
        setCurrent(id);
        setPaymentOpen(true);
    }

    function handlePaymentOpenChange(open: boolean) {
        setPaymentOpen(open);
    }

    useEffect(() => {
        if (!open || product.length > 0) {
            return;
        }
        api<Product[]>('product', {
            data: {
                from,
                type: 2,
            },
            loading: false,
        }).then((res) => {
            if (res.c != 0) {
                return;
            }
            setProduct(res.d.sort((a, b) => (a.name.indexOf('off') !== -1 ? -1 : a.id - b.id)));
            setLoading(false);
        });
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-linear-to-b from-amber-100 to-orange-50 p-6">
                <DialogTitle className="text-2xl font-bold text-center text-slate-700">
                    <FormattedMessage id="top_up" />
                </DialogTitle>
                <DialogDescription className="text-md text-center text-amber-950/80">
                    <FormattedMessage id="top_up_desc" />
                </DialogDescription>
                {loading ? (
                    <div className="h-16">
                        <Loader />
                    </div>
                ) : (
                    <>
                        <Countdown />
                        <div className="grid grid-cols-2 gap-4">

                            {product.map((v) => (
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
                                        <img src={coinIcon} width={24} height={24} className="mb-1" />
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
                                    <div className="text-sm text-slate-400 px-1">${v.price}</div>
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
                    </>
                )}
            </DialogContent>
            <Payment
                open={paymentOpen}
                onOpenChange={handlePaymentOpenChange}
                onSubmit={handlePaymentSubmit}
            />
        </Dialog>
    );
}
