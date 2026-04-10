import { Page } from "@/layouts/user";
import { Link } from "react-router";
import { FormattedMessage } from "react-intl";
import Forward from "@/components/Forward";
import { toast } from "sonner";
import { BRAND_LOGO_SRC } from "@/constants/brand";

export default function Component() {
    function handleVersion() {
        toast(navigator.userAgent);
    }

    return <Page title="about_us">
        <div className="flex flex-col gap-4 h-full w-full py-8">
            <div className="flex justify-center items-center flex-col gap-2">
                <img src={BRAND_LOGO_SRC} className="text-white w-12 h-12 rounded-md" alt="" />
                <div><FormattedMessage id="domain" /></div>
            </div>
            <div className="m-4 rounded-md bg-white">
                <Link key="user_agreement" to="/page/text?title=user_agreement" className="flex gap-2 justify-between items-center p-4">
                    <div className="flex gap-1 text-gray-600">
                        <div className="text-md"><FormattedMessage id="user_agreement" /></div>
                    </div>
                    <Forward className="text-slate-400" />
                </Link>
                <Link key="privacy_policy" to="/page/text?title=privacy_policy" className="flex gap-2 justify-between items-center p-4 border-t border-muted">
                    <div className="flex gap-1 text-gray-600">
                        <div className="text-md"><FormattedMessage id="privacy_policy" /></div>
                    </div>
                    <Forward className="text-slate-400" />
                </Link>
                <div key="version" className="flex gap-2 justify-between items-center p-4 border-t border-muted" onClick={handleVersion}>
                    <div className="flex gap-1 text-gray-600">
                        <div className="text-md"><FormattedMessage id="version" /></div>
                    </div>
                    <div className="text-slate-400">1.0.2</div>
                </div>
            </div>
        </div>
    </Page>
}