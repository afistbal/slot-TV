import { api } from "@/api";
import Loader from "@/components/Loader";
import { Button } from "@/components/ui/button";
import usePixel from "@/hooks/usePixel";
import { Page } from "@/layouts/user";
import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FormattedMessage } from "react-intl";
import Adjust from "@adjustcom/adjust-web-sdk";

export default function Component() {
    const pixel = usePixel();
    const [loading, setLoading] = useState(true);
    const [result, setResult] = useState(0);
    const query = new URLSearchParams(window.location.search);

    function handleBack() {
        /** @ts-ignore */
        if (window.flutter_inappwebview) {
            /** @ts-ignore */
            window.flutter_inappwebview.callHandler('back', result === 1);
        } else {
            const redirect = query.get('redirect');
            if (redirect) {
                window.location.replace(redirect);
            } else {
                window.location.replace('/');
            }
        }

    }

    useEffect(() => {
        const action = query.get('action');
        if (action === 'return') {
            switch (query.get('platform')) {
                case 'paypal':
                    api('paypal/complete', {
                        method: 'post',
                        data: {
                            id: query.get('paymentId'),
                            token: query.get('token'),
                            payer_id: query.get('PayerID'),
                        },
                        loading: false,
                    }).then(res => {
                        setResult(res.c === 0 ? 1 : 2);
                        if (res.c === 0) {
                            if (localStorage.getItem("paid_url") === location.href) {
                                return;
                            }
                            localStorage.setItem('paid_url', location.href);
                            const checkout = localStorage.getItem('checkout');
                            if (checkout) {
                                pixel.track('Subscribe', JSON.parse(checkout));
                            }
                        }
                    }).finally(() => {
                        setLoading(false);
                    });
                    break;
                case 'airwallex':
                    api('pay/complete', {
                        method: 'post',
                        data: {
                            sn: query.get('sn'),
                        },
                        loading: false,
                    }).then(res => {
                        setResult(res.c === 0 ? 1 : 2);
                        if (res.c === 0) {
                            if (localStorage.getItem("paid_url") === location.href) {
                                return;
                            }
                            localStorage.setItem('paid_url', location.href);
                            const checkout = localStorage.getItem('checkout');
                            if (checkout) {
                                pixel.track('Subscribe', JSON.parse(checkout));
                            }
                        }
                    }).finally(() => {
                        setLoading(false);
                    });
            }
        } else if (action === 'success') {
            setResult(1);
            setLoading(false);
            if (localStorage.getItem("paid_url") === location.href) {
                return;
            }
            localStorage.setItem('paid_url', location.href);
            const checkout = localStorage.getItem('checkout');
            const sn = query.get('sn');
            if (checkout && sn) {
                const parsed = JSON.parse(checkout);
                pixel.track('Subscribe', JSON.parse(checkout));
                Adjust.trackEvent({
                    deduplicationId: sn,
                    eventToken: 'ux3ud3',
                    revenue: parseFloat(parsed['value']),
                    currency: parsed['currency'],
                });
            }
        } else {
            setResult(2);
            setLoading(false);
        }

    }, []);

    return <Page title="payment_result">
        {loading ? <Loader /> : <div className="flex flex-col gap-16 justify-center items-center h-full">
            {result === 0 ? <div className="flex flex-col justify-center items-center gap-2">
                <div className="w-24 h-24 bg-amber-100 rounded-full flex justify-center items-center">
                    <X className="w-12 h-12 text-amber-400" />
                </div>
                <div className="text-slate-500">
                    <FormattedMessage id="payment_canceled" />
                </div>
            </div> : result === 1 ? <div className="flex flex-col justify-center items-center gap-2">
                <div className="w-24 h-24 bg-indigo-100 rounded-full flex justify-center items-center">
                    <Check className="w-12 h-12 text-indigo-400" />
                </div>
                <div className="text-slate-500">
                    <FormattedMessage id="payment_successful" />
                </div>
            </div> : <div className="flex flex-col justify-center items-center gap-2">
                <div className="w-24 h-24 bg-red-100 rounded-full flex justify-center items-center">
                    <X className="w-12 h-12 text-red-400" />
                </div>
                <div className="text-slate-500">
                    <FormattedMessage id="payment_failed" />
                </div>
            </div>}
            <Button className="w-min px-8 bg-slate-500" onClick={handleBack}>
                <FormattedMessage id="back" />
            </Button>
        </div>}
    </Page>
}