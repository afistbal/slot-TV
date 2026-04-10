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
import { Link } from "react-router";

interface IData {
    amount: string;
    renewal_at: string;
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
        navigator.clipboard.writeText(configStore.config["support"] as string);
        toast.success(intl.formatMessage({ id: "copied" }));
    }

    async function loadData() {
        api<TData>("user/membership", {
            loading: false,
        }).then((res) => {
            setData({
                amount: res.d["amount"] as string,
                renewal_at: res.d["renewal_at"] as string,
            });
            setLoading(false);
        });
    }

    useEffect(() => {
        loadData();
    }, []);

    return (
        <Page title="my_membership">
            <div className="rs-membership">
                {loading ? (
                    <div className="rs-membership__loading">
                        <Loader color="light" />
                    </div>
                ) : userStore.isVIP() ? (
                    <>
                        <div className="rs-membership__hero">
                            <div className="rs-membership__iconWrap" aria-hidden>
                                <Gem className="rs-membership__icon" strokeWidth={1.75} />
                            </div>
                            <div className="rs-membership__title">
                                <FormattedMessage id="you_are_already_a_member" />
                            </div>
                        </div>

                        <div className="rs-membership__card">
                            <div className="rs-membership__row">
                                <div className="rs-membership__label">
                                    <FormattedMessage id="renewal_time" />
                                </div>
                                <div className="rs-membership__value">
                                    <FormattedDate
                                        year="numeric"
                                        month="2-digit"
                                        day="2-digit"
                                        value={data!.renewal_at}
                                    />
                                </div>
                            </div>
                            <div className="rs-membership__row">
                                <div className="rs-membership__label">
                                    <FormattedMessage id="renewal_amount" />
                                </div>
                                <div className="rs-membership__value rs-membership__value--accent">
                                    ${data!.amount}
                                </div>
                            </div>
                            <button
                                type="button"
                                className="rs-membership__row rs-membership__row--action w-full border-0 bg-transparent text-left"
                                onClick={handleCopySupport}
                            >
                                <div className="rs-membership__label">
                                    <FormattedMessage id="contact_us" />
                                </div>
                                <div className="rs-membership__value">
                                    {configStore.config["support"] as string}
                                </div>
                            </button>
                            <button
                                type="button"
                                className="rs-membership__row rs-membership__row--action w-full border-0 bg-transparent text-left"
                                onClick={handleOpenTerms}
                            >
                                <div className="rs-membership__label">
                                    <FormattedMessage id="membership_terms_of_service" />
                                </div>
                                <Forward className="rs-membership__chevron" />
                            </button>
                        </div>

                        <div className="rs-membership__foot">
                            <FormattedMessage id="thank_you_for_your_support" />
                        </div>

                        <Drawer open={terms} onOpenChange={handleOpenTerms}>
                            <DrawerContent
                                className="rs-membership__drawer"
                                aria-describedby="terms"
                            >
                                <DrawerTitle className="rs-membership__drawerTitle flex items-center gap-4 px-4 pt-4 mb-4">
                                    <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                                        <FormattedMessage id="membership_terms_of_service" />
                                    </div>
                                    <button
                                        type="button"
                                        className="rounded-md p-1 text-white/70 hover:bg-white/10"
                                        onClick={() => setTerms(false)}
                                    >
                                        <X className="size-6" />
                                    </button>
                                </DrawerTitle>
                                <div className="rs-membership__drawerBody border-t p-4">
                                    <MemberTerms />
                                </div>
                            </DrawerContent>
                        </Drawer>
                    </>
                ) : (
                    <div className="rs-membership__empty">
                        <p className="rs-membership__emptyTitle">
                            <FormattedMessage id="you_are_not_a_member" />
                        </p>
                        <p className="rs-membership__emptyHint">
                            <FormattedMessage id="shopping_vip_unlock_all" />
                        </p>
                        <Link to="/shopping" className="rs-membership__cta">
                            <FormattedMessage id="vip" />
                        </Link>
                    </div>
                )}
            </div>
        </Page>
    );
}
