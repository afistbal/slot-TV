import { api, type TData } from "@/api";
import Loader from "@/components/Loader";
import { Page } from "@/layouts/admin";
import { useEffect, useState } from "react";
import { FormattedDate, FormattedMessage, FormattedTime } from "react-intl";
import { Link, useParams } from "react-router";


export default function Component() {
    const params = useParams();
    const [info, setInfo] = useState<TData>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api('admin/order/info', {
            data: {
                id: params['id'],
            },
            loading: false,
        }).then(res => {
            if (res.c !== 0) {
                return;
            }
            setLoading(false);
            setInfo(res.d);
        });
    }, [])

    return <Page title="order_details">
        {loading ? <div className="h-full w-full flex justify-center items-center">
            <Loader />
        </div> : <>
            <div className="m-4 flex flex-col">
                <div className="text-slate-500 mb-2">
                    <FormattedMessage id="basic_information" />
                </div>
                <div className="flex gap-2 justify-between border-b border-gray-100 p-4 bg-white rounded-t-md">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="id" />
                    </div>
                    <div>{info!['id'] as number}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="user_id" />
                    </div>
                    <Link className="wrap-anywhere text-wrap text-right text-indigo-400" to={`/z/page/user/${info!['user_id']}`}>{info!['user_id'] as string}</Link>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="payment_status" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">
                        {info!['status'] === 0 && <FormattedMessage id="unpaid" />}
                        {info!['status'] === 1 && <FormattedMessage id="paid" />}
                        {info!['status'] === 2 && <FormattedMessage id="refunded" />}
                    </div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="payment_platform" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{info!['platform'] === 1 || info!['platform'] === 2 ? 'Airwallex' : 'Unknown'}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="amount" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{info!['amount'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="refund_amount" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{info!['refund_amount'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="order_number" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{info!['sn'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="order_number" />(PT)
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{info!['platform_sn'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="subscription_renewal" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{info!['type'] === 2 ? 'Yes' : 'No'}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="created_at" />
                    </div>
                    <div>
                        <FormattedDate value={info!['created_at'] as string} />&nbsp;<FormattedTime value={info!['created_at'] as string} />
                    </div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 rounded-b-md">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="updated_at" />
                    </div>
                    <div>
                        <FormattedDate value={info!['updated_at'] as string} />&nbsp;<FormattedTime value={info!['updated_at'] as string} />
                    </div>
                </div>
                {info!['billing_status'] !== null && <>
                    <div className="text-slate-500 mb-2 mt-4">
                        <FormattedMessage id="subscription_information" />
                    </div>
                    <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 rounded-t-md">
                        <div className="text-muted-foreground">
                            <FormattedMessage id="renewal_status" />
                        </div>
                        <div>{info!['billing_status'] === 1 ? <FormattedMessage id="enable"/> : <FormattedMessage id="calcenlled"/>}</div>
                    </div>
                    <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100">
                        <div className="text-muted-foreground">
                            <FormattedMessage id="renewal_amount" />
                        </div>
                        <div>${info!['billing_amount'] as string}</div>
                    </div>
                    <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100">
                        <div className="text-muted-foreground">
                            <FormattedMessage id="renewal_time" />
                        </div>
                        <div>
                            <FormattedDate value={info!['billing_at'] as string} />
                        </div>
                    </div>
                </>}
            </div>
        </>}
    </Page>
}