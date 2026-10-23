import { LegalDocumentLink } from "@/components/LegalDocumentLink";
import { Page } from "@/layouts/user";
import { FormattedMessage } from "react-intl";
import Forward from "@/components/Forward";
import { toast } from "sonner";
import { BRAND_DOMAIN_DISPLAY, BRAND_LOGO_SRC } from "@/constants/brand";
import "@/styles/about-reelshort.scss";

export default function Component() {
    function handleVersion() {
        toast(navigator.userAgent);
    }

    return <Page title="about_us" bodyClassName="rs-about__body">
        <div className="rs-about">
            <div className="rs-about__brand">
                <img src={BRAND_LOGO_SRC} className="rs-about__logo" alt="" />
                <div className="rs-about__domain">{BRAND_DOMAIN_DISPLAY}</div>
            </div>
            <div className="rs-about__menu">
                <LegalDocumentLink
                    key="terms_of_service"
                    title="terms_of_service"
                    className="rs-about__row"
                >
                    <span><FormattedMessage id="terms_of_service" /></span>
                    <Forward className="rs-about__chevron" />
                </LegalDocumentLink>
                <LegalDocumentLink
                    key="privacy_policy"
                    title="privacy_policy"
                    className="rs-about__row"
                >
                    <span><FormattedMessage id="privacy_policy" /></span>
                    <Forward className="rs-about__chevron" />
                </LegalDocumentLink>
                <button key="version" type="button" className="rs-about__row" onClick={handleVersion}>
                    <span><FormattedMessage id="version" /></span>
                    <span className="rs-about__version">{__APP_VERSION__}</span>
                </button>
            </div>
        </div>
    </Page>
}
