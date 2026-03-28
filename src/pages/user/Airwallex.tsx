import { api, type TData } from "@/api";
import Loader from "@/components/Loader";
import { init } from "@airwallex/components-sdk";
import { useEffect } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router";
import { toast } from "sonner";

export default function Component() {
    const intl = useIntl();
    const params = useParams();

    async function handleCreate() {
        let result = await api<TData>('pay/create', {
            method: 'post',
            loading: false,
            data: {
                payment: 1,
                product_id: parseInt(params['id'] ?? '0', 10),
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
        handleCreate();
    }, []);

    return <Loader />
}