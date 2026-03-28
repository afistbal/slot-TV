import { Page } from "@/layouts/user";
import { Gem, X } from "lucide-react";
import { FormattedDate, FormattedMessage, useIntl } from "react-intl";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { useEffect, useState } from "react";
import MemberTerms from "@/widgets/MemberTerms";
import { useUserStore } from "@/stores/user";
import { useConfigStore } from "@/stores/config";
import { toast } from "sonner";
import Forward from "@/components/Forward";
import { api, type TData } from "@/api";
import Loader from "@/components/Loader";

interface IData {
    amount: string,
    renewal_at: string,
}

export default function Component() {
    const userStore = useUserStore();
    const configStore = useConfigStore();
    const intl = useIntl();
    const [terms, setTerms] = useState(false);
    const [data, setData] = useState<IData>();
    const [loading, setLoading] = useState(true);

    function handleOpenTerms() {
        setTerms(!terms);
    }

    function handleCopySupport() {
        navigator.clipboard.writeText(configStore.config['support'] as string);
        toast.success(intl.formatMessage({ id: 'copied' }));
    }

    async function loadData() {
        api<TData>('user/membership', {
            loading: false,
        }).then(res => {
            setData({
                'amount': res.d['amount'] as string,
                'renewal_at': res.d['renewal_at'] as string,
            });
            setLoading(false);
        });
    }

    useEffect(() => {
        loadData();
    }, []);

    return <Page title="my_membership">
        {loading ? <Loader /> : userStore.isVIP() ? <>
            <div className="flex flex-col justify-center items-center h-48 gap-4">
                <Gem className="w-16 h-16 stroke-1 text-orange-400" />
                <div className="text-lg text-orange-400">
                    <FormattedMessage id="you_are_already_a_member" />
                </div>
            </div>
            <div className="bg-white rounded-md m-4">
                {/* <div className="flex gap-2 justify-between items-center p-4">
                    <div className="flex gap-2 text-gray-600 items-center">
                        <div className="text-md"><FormattedMessage id="billing_date" /></div>
                    </div>
                    <div className="shrink-0">{(userStore.info!['vip_expire_at'] as string).substring(0, 10)}</div>
                </div> */}
                <div className="flex gap-2 justify-between items-center p-4 border-t border-muted">
                    <div className="flex gap-2 text-gray-600 items-center">
                        <div className="text-md"><FormattedMessage id="renewal_time" /></div>
                    </div>
                    <div className="shrink-0">
                        <FormattedDate
                            year="numeric"
                            month="2-digit"
                            day="2-digit"
                            value={data!.renewal_at}
                        />
                    </div>
                </div>
                <div className="flex gap-2 justify-between items-center p-4 border-t border-muted">
                    <div className="flex gap-2 text-gray-600 items-center">
                        <div className="text-md"><FormattedMessage id="renewal_amount" /></div>
                    </div>
                    <div className="shrink-0">
                        ${data!.amount}
                    </div>
                </div>
                <div className="flex gap-2 justify-between items-center p-4 border-t border-muted" onClick={handleCopySupport}>
                    <div className="flex gap-2 text-gray-600 items-center">
                        <div className="text-md"><FormattedMessage id="contact_us" /></div>
                    </div>
                    <div className="shrink-0">{configStore.config['support'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between items-center p-4 border-t border-muted" onClick={handleOpenTerms}>
                    <div className="flex gap-2 text-gray-600 items-center">
                        <div className="text-md"><FormattedMessage id="membership_terms_of_service" /></div>
                    </div>
                    <Forward className="text-slate-400 shrink-0" />
                </div>
            </div>
            <div className="my-8 text-sm text-muted-foreground text-center">
                <FormattedMessage id="thank_you_for_your_support" />
            </div>
            <Drawer open={terms} onOpenChange={handleOpenTerms}>
                <DrawerContent aria-describedby="terms">
                    <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                        <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                            <FormattedMessage id="membership_terms_of_service" />
                        </div>
                        <div onClick={() => setTerms(false)}>
                            <X />
                        </div>
                    </DrawerTitle>
                    <div className="p-4 border-t overflow-y-auto">
                        <MemberTerms />
                    </div>
                </DrawerContent>
            </Drawer>
        </> : <div className="flex justify-center items-center w-full h-full">
            <FormattedMessage id="you_are_not_a_member" />
        </div>}
    </Page >
}