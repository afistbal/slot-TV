import { Page } from "@/layouts/user";
import { FormattedMessage, useIntl } from "react-intl";
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import userAgreementEn from "@/content/user-agreement.en.txt?raw";
import { useMinWidth768 } from "@/hooks/useMinWidth768";
import { useReelShortLegalDocRem } from "@/hooks/useReelShortLegalDocRem";
import { reelshortPrivacyPolicyIframeSrc } from "@/lib/legalDocumentUrl";
import { BRAND_DISPLAY_NAME } from "@/constants/brand";

function linkifyLine(text: string): React.ReactNode {
    const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
    return (
        <>
            {parts.map((part, i) => {
                const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
                if (m) {
                    return (
                        <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer">
                            {m[1]}
                        </a>
                    );
                }
                return part;
            })}
        </>
    );
}

function isMajorSectionHeading(s: string): boolean {
    const t = s.trim();
    if (t === "Acceptable Use Policy") {
        return true;
    }
    return /^[A-Z]\.\s+[A-Z]/.test(t);
}

function isSubsectionHeading(s: string): boolean {
    return /^\d+\.\d+\s/.test(s.trim());
}

function isAllCapsNotice(s: string): boolean {
    const t = s.trim();
    return t.length > 40 && t === t.toUpperCase() && /^[A-Z0-9]/.test(t);
}

function useUserAgreementBlocks() {
    return useMemo(() => {
        return userAgreementEn
            .replace(/\r\n/g, "\n")
            .split(/\n\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
    }, []);
}

function UserAgreementBody() {
    const blocks = useUserAgreementBlocks();
    const kicker = blocks[0];
    const title = blocks[1];
    const meta = blocks[2];
    const body = blocks.slice(3);

    return (
        <>
            {kicker && kicker !== title ? (
                <p className="rs-legal-doc__kicker">{linkifyLine(kicker)}</p>
            ) : null}
            <h1 className="rs-legal-doc__title">{linkifyLine(title ?? kicker ?? "")}</h1>
            {meta && meta !== title ? <p className="rs-legal-doc__meta">{linkifyLine(meta)}</p> : null}
            {body.map((block, idx) => {
                const t = block.trim();
                if (!t) {
                    return null;
                }
                if (isMajorSectionHeading(t)) {
                    return (
                        <h2 key={idx} className="rs-legal-doc__h2">
                            {linkifyLine(t)}
                        </h2>
                    );
                }
                if (isSubsectionHeading(t)) {
                    return (
                        <h3 key={idx} className="rs-legal-doc__h3">
                            {linkifyLine(t)}
                        </h3>
                    );
                }
                const cls = isAllCapsNotice(t) ? "rs-legal-doc__emph" : undefined;
                return (
                    <p key={idx} className={cls}>
                        {linkifyLine(t)}
                    </p>
                );
            })}
        </>
    );
}

/** PC：版式对齐 ReelShort 静态页（主标题用 strong，rem 由根字号驱动）。 */
function UserAgreementReelshortPcBody() {
    const blocks = useUserAgreementBlocks();
    const kicker = blocks[0];
    const title = blocks[1];
    const meta = blocks[2];
    const body = blocks.slice(3);

    return (
        <>
            {kicker && kicker !== title ? <p className="fn-rs-legal-pc__kicker">{linkifyLine(kicker)}</p> : null}
            <p>
                <strong>{linkifyLine(title ?? kicker ?? "")}</strong>
            </p>
            {meta && meta !== title ? <p>{linkifyLine(meta)}</p> : null}
            {body.map((block, idx) => {
                const t = block.trim();
                if (!t) {
                    return null;
                }
                if (isMajorSectionHeading(t)) {
                    return <h2 key={idx}>{linkifyLine(t)}</h2>;
                }
                if (isSubsectionHeading(t)) {
                    return <h3 key={idx}>{linkifyLine(t)}</h3>;
                }
                if (isAllCapsNotice(t)) {
                    return (
                        <p key={idx} className="fn-rs-legal-pc__caps">
                            {linkifyLine(t)}
                        </p>
                    );
                }
                return <p key={idx}>{linkifyLine(t)}</p>;
            })}
        </>
    );
}

function PrivacyPolicyBody() {
    const intl = useIntl();
    const domain = intl.formatMessage({ id: "domain" });

    return (
        <>
            <h1 className="rs-legal-doc__title">
                <FormattedMessage id="privacy_policy" />
            </h1>
            <p className="rs-legal-doc__meta">Last updated: [2025-01-01]</p>
            <p>
                This Privacy Policy describes how [{domain}] (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
                collects, uses, stores, and discloses information when you use our software application
                (&quot;the Software&quot;). By using the Software, you consent to the practices described in this
                Privacy Policy.
            </p>
            <h2 className="rs-legal-doc__h2">1. Information We Collect</h2>
            <h3 className="rs-legal-doc__h3">1.1 Personal Information</h3>
            <p>
                <span className="rs-legal-doc__emph">Account Information: </span>
                When you create an account with the Software, we may collect your name, email address, and password to
                identify you and provide personalized services.
            </p>
            <p>
                <span className="rs-legal-doc__emph">Contact Information: </span>
                If you choose to use certain features like customer support, we may collect additional contact details
                such as phone number to communicate with you effectively.
            </p>
            <h3 className="rs-legal-doc__h3">1.2 Non-Personal Information</h3>
            <p>
                <span className="rs-legal-doc__emph">Device Information: </span>
                We automatically collect information about the device you use to access the Software, including the
                device type, operating system version, unique device identifiers, and mobile network information. This
                helps us optimize the Software&apos;s performance for different devices.
            </p>
            <p>
                <span className="rs-legal-doc__emph">Usage Information: </span>
                We track how you interact with the Software, such as the pages you visit, features you use, and actions
                you take. This data is used to improve the user experience, diagnose technical issues, and analyze usage
                trends.
            </p>
            <h2 className="rs-legal-doc__h2">2. How We Use Your Information</h2>
            <p>
                <span className="rs-legal-doc__emph">Provide and Maintain the Software: </span>
                We use your information to operate, maintain, and improve the Software, ensuring it functions properly
                and meets your needs.
            </p>
            <p>
                <span className="rs-legal-doc__emph">Personalize Your Experience: </span>
                Based on the information we collect, we may customize the Software&apos;s content, features, and
                advertisements to make them more relevant to you.
            </p>
            <p>
                <span className="rs-legal-doc__emph">Send You Communications: </span>
                We may send you important notices regarding the Software, including updates to our terms, policies, and
                security alerts. Additionally, with your consent, we may send you promotional emails about our products
                and services.
            </p>
            <p>
                <span className="rs-legal-doc__emph">Analyze and Improve: </span>
                We analyze the collected data to understand user behavior, preferences, and pain points, which helps us
                develop new features and improve existing ones.
            </p>
            <h2 className="rs-legal-doc__h2">3. Information Sharing and Disclosure</h2>
            <h3 className="rs-legal-doc__h3">3.1 Service Providers</h3>
            <p>
                We may share your information with third-party service providers who assist us in operating the Software,
                such as cloud hosting providers, analytics companies, and customer support services. These service
                providers are obligated to use your information only for the purposes for which we engage them and to
                maintain its confidentiality.
            </p>
            <h3 className="rs-legal-doc__h3">3.2 Legal Requirements</h3>
            <p>
                We may disclose your information if required to do so by law, regulation, or legal process, such as in
                response to a court order, subpoena, or government investigation. We may also disclose your information
                to protect our rights, property, or safety, and the rights, property, or safety of others.
            </p>
            <h3 className="rs-legal-doc__h3">3.3 Business Transfers</h3>
            <p>
                In the event of a merger, acquisition, sale of all or substantially all of our assets, or similar
                corporate transaction, your information may be transferred as part of that transaction. We will notify you
                via email or prominent notice on the Software of any such change in ownership or uses of your information,
                along with any choices you may have regarding your information.
            </p>
            <h2 className="rs-legal-doc__h2">4. Data Security</h2>
            <p>
                We implement reasonable technical and organizational measures to protect your information from
                unauthorized access, disclosure, alteration, and destruction. However, no method of transmission over the
                internet or electronic storage is 100% secure, and we cannot guarantee the absolute security of your
                information.
            </p>
            <h2 className="rs-legal-doc__h2">5. Your Rights</h2>
            <p>
                <span className="rs-legal-doc__emph">Access and Update: </span>
                You have the right to access and update the personal information we hold about you. You can usually do
                this through your account settings within the Software.
            </p>
            <p>
                <span className="rs-legal-doc__emph">Delete: </span>
                In some cases, you may be able to delete your personal information from our systems. Please contact our
                support team for assistance.
            </p>
            <p>
                <span className="rs-legal-doc__emph">Opt-Out: </span>
                You can unsubscribe from promotional emails at any time by clicking on the &quot;unsubscribe&quot; link in
                the email or by adjusting your notification settings within the Software.
            </p>
            <h2 className="rs-legal-doc__h2">6. Children&apos;s Privacy</h2>
            <p>
                The Software is not intended for use by children under the age of [X]. We do not knowingly collect
                personal information from children. If we become aware that we have collected personal information from a
                child without verification of parental consent, we will delete that information as soon as possible.
            </p>
            <h2 className="rs-legal-doc__h2">7. International Transfers</h2>
            <p>
                Your information may be transferred to and stored on servers located outside of your country. These
                countries may have data protection laws that are different from those in your country. By using the
                Software, you consent to the international transfer of your information.
            </p>
            <h2 className="rs-legal-doc__h2">8. Changes to this Privacy Policy</h2>
            <p>
                We may update this Privacy Policy from time to time. When we do, we will post the updated version on this
                page and indicate at the top of the page the date it was last updated. We encourage you to review this
                Privacy Policy periodically to stay informed about how we are protecting your information.
            </p>
            <h2 className="rs-legal-doc__h2">9. Contact Us</h2>
            <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices,
                please contact us at [Contact Email Address].
            </p>
            <p>{domain}</p>
        </>
    );
}

export default function Component() {
    const intl = useIntl();
    const location = useLocation();
    const mdUp = useMinWidth768();
    const titleParam = new URLSearchParams(location.search).get("title");
    const pageKey = titleParam === "privacy_policy" ? "privacy_policy" : "user_agreement";
    const isLegalPc = mdUp && (pageKey === "privacy_policy" || pageKey === "user_agreement");

    useReelShortLegalDocRem(isLegalPc && pageKey === "user_agreement");

    /** 浏览器标签标题：全视口生效：`<文案> – YogoShort>`；图标见项目根目录 `index.html`（`/favorite.png`、`/logo.png`）。 */
    useEffect(() => {
        const prev = document.title;
        const pageTitle =
            pageKey === "privacy_policy"
                ? intl.formatMessage({ id: "privacy_policy" })
                : intl.formatMessage({ id: "user_agreement" });
        document.title = `${pageTitle} – ${BRAND_DISPLAY_NAME}`;
        return () => {
            document.title = prev;
        };
    }, [pageKey, intl]);

    if (isLegalPc && pageKey === "privacy_policy") {
        return (
            <iframe
                title="Privacy Policy"
                src={reelshortPrivacyPolicyIframeSrc()}
                className="block h-[100dvh] w-full max-w-none border-0 bg-app-canvas"
            />
        );
    }

    if (isLegalPc && pageKey === "user_agreement") {
        return (
            <div className="fn-rs-legal-pc-host">
                <article className="fn-rs-legal-pc">
                    <UserAgreementReelshortPcBody />
                </article>
            </div>
        );
    }

    return (
        <Page title={pageKey} bodyClassName="bg-app-canvas">
            <article className="rs-legal-doc">
                {pageKey === "privacy_policy" ? <PrivacyPolicyBody /> : <UserAgreementBody />}
            </article>
        </Page>
    );
}
