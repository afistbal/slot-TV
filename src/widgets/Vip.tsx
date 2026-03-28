import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { DialogDescription, DialogTitle } from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
// import paypal from "@/assets/paypal.svg";
import { api, type TData } from "@/api";
import Loader from "@/components/Loader";
import usePixel from "@/hooks/usePixel";
import { init } from '@airwallex/components-sdk';
import { toast } from "sonner";
// import Adjust from "@adjustcom/adjust-web-sdk";
import Payment from "./Payment";
import Countdown from "./Countdown";

interface Product {
    id: number,
    type: number,
    name: string,
    price: string,
    renewal_price: string,
}

export default function Vip({ open, from, onOpenChange }: { open: boolean, from: string, onOpenChange?: (open: boolean) => void }) {
    const pixel = usePixel();
    const intl = useIntl();
    const [current, setCurrent] = useState(1);
    const [product, setProduct] = useState<Product[]>([]);
    const [paymentOpen, setPaymentOpen] = useState(false);
    const [loading, setLoading] = useState(true);


    function handleOpenPayment() {
        if (!open) {
            return;
        }
        setPaymentOpen(!paymentOpen);
    }

    // async function handleSubmit() {
    //     let result = await api<string>('pay', {
    //         data: {
    //             payment,
    //             product_id: current,
    //             redirect: window.location.href,
    //         }
    //     });

    //     if (result.c !== 0) {
    //         return;
    //     }

    //     const p = product.find(v => v.id === current);
    //     const data = {
    //         'content_ids': [current.toString()],
    //         'currency': 'USD',
    //         'value': p?.price,
    //     };
    //     pixel.track('InitiateCheckout', data);
    //     localStorage.setItem('checkout', JSON.stringify(data));

    //     window.location.href = result.d;
    // }

    async function handleSubmit() {
        let result = await api<TData>('pay/create', {
            method: 'post',
            data: {
                payment: 1,
                product_id: current,
                redirect: window.location.href,
            }
        });

        if (result.c !== 0) {
            return;
        }

        const { payments } = await init({
            locale: 'en',
            env: result.d['env'] as ('prod' | 'demo'),
            enabledElements: ['payments'],

        });
        if (!payments) {
            toast.error(intl.formatMessage({
                id: 'failed'
            }));

            return;
        }
        const p = product.find(v => v.id === current);
        const data = {
            'content_ids': [current.toString()],
            'currency': result.d['currency'] as string,
            'value': p?.price,
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
            mode: 'recurring',
            recurringOptions: {
                next_triggered_by: 'merchant',
                merchant_trigger_reason: 'scheduled',
            },
            customer_id: result.d['customer_id'] as string,
            client_secret: result.d['client_secret'] as string,
            currency: result.d['currency'] as string,
            successUrl: result.d['success_url'] as string,
            failUrl: result.d['fail_url'] as string,
            methods: ['card', 'googlepay', 'applepay'],
            applePayRequestOptions: {
                buttonType: 'subscribe',
                countryCode: 'HK',
            },
        });
    }

    useEffect(() => {
        if (!open || product.length > 0) {
            return;
        }

        api<Product[]>('product', {
            data: {
                from,
            },
            loading: false,
        }).then(res => {
            if (res.c != 0) {
                return;
            }
            setProduct(res.d);
            setLoading(false);
        });
    }, [open]);

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-linear-to-b from-amber-100 to-transparent p-6">
            <DialogTitle className="text-2xl font-bold text-center text-slate-700">
                <FormattedMessage id="vip" />
            </DialogTitle>
            <DialogDescription className="text-md text-center text-amber-950/80"><FormattedMessage id="enjoy" /></DialogDescription>
            {loading ? <div className="h-16"><Loader /></div> : <div className="flex flex-col gap-4">
                <Countdown />
                {product.map(v => <div key={v.id} onClick={() => setCurrent(v.id)} className={cn("relative overflow-hidden border rounded-md p-4 flex justify-between gap-2 items-center", current === v.id ? 'border-amber-400 bg-amber-200/60' : 'border-amber-400/40 bg-amber-50/20')}>
                    <div>
                        <div className={cn(current === v.id ? "text-amber-800" : 'text-muted-foreground', 'text-sm')}><FormattedMessage id={`${v.name}_subscription`} /></div>
                        <div className="text-xl font-bold text-amber-950"><FormattedMessage id={`${v.name}`} /></div>
                    </div>
                    <div className="text-slate-800 text-3xl font-bold flex items-center gap-1"><span className="text-lg">$</span>{v.price}</div>
                    <div className="absolute top-0 right-0 text-xs bg-red-400 text-white px-2 py-0.5 rounded-bl-md rounded-tr-md">
                        <FormattedMessage id="limited_time_offer" values={{
                            off: (100 - Math.floor((parseFloat(v.price) / parseFloat(v.renewal_price)) * 100)) + '%'
                        }} />
                    </div>
                </div>)}
                <div className="text-center text-sm text-slate-500">
                    <FormattedMessage id="renewal_description" values={{
                        amount: '$' + product.find(v => v.id === current)?.renewal_price,
                        cycle: intl.formatMessage({ id: product.find(v => v.id === current)?.name + '_nonu' }),
                    }} />
                </div>
            </div>}
            <Button className="mt-2 bg-linear-to-r from-red-400 to-purple-400 font-bold" onClick={handleOpenPayment} disabled={loading}><FormattedMessage id="activate" /></Button>
            <Payment open={paymentOpen} onOpenChange={handleOpenPayment} onSubmit={handleSubmit} />
        </DialogContent>
    </Dialog>
}