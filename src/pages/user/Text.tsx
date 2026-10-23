import { Page } from "@/layouts/user";
import { useIntl } from "react-intl";
import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router";
import userAgreementZhCn from "@/content/user-agreement.zh-CN.txt?raw";
import MemberTerms from "@/widgets/MemberTerms";
import { ShoppingPaidServiceAgreementContent } from "@/pages/user/ShoppingPaidServiceAgreementContent";
import { RefundPolicyContent } from "@/pages/user/RefundPolicyContent";
import { BRAND_DISPLAY_NAME, BRAND_LEGAL_SITE_URL } from "@/constants/brand";
import { cn } from "@/lib/utils";
import "@/styles/legal-doc-reelshort.scss";
import "@/styles/legal-doc-reelshort-pc.scss";

function linkifyLine(text: string): ReactNode {
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
    return /^[一二三四五六七八九十百]+、/.test(t);
}

function isSubsectionHeading(s: string): boolean {
    return /^\d+\.\d+\s*/.test(s.trim());
}

function isAllCapsNotice(s: string): boolean {
    const t = s.trim();
    return t.length > 40 && t === t.toUpperCase() && /^[A-Z0-9]/.test(t);
}

function applyBrandLegalCopy(text: string): string {
    return text
        .replace(/https:\/\/(?:www\.)?yogoshort\.com/gi, BRAND_LEGAL_SITE_URL)
        .replace(/\bYogoShort\b/g, BRAND_DISPLAY_NAME);
}

function useUserAgreementBlocks() {
    return useMemo(() => {
        return userAgreementZhCn
            .replace(/\r\n/g, "\n")
            .split(/\n\n+/)
            .map((s) => applyBrandLegalCopy(s.trim()))
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

function PrivacyPolicyBody() {
    return (
        <>
            <p>
                本隐私政策说明本平台运营方（以下简称“我们”）在您使用 {BRAND_DISPLAY_NAME}
                网站、应用程序及相关服务（以下统称“服务”）时，如何收集、使用、存储、共享和保护您的信息。
                请在使用服务前仔细阅读本政策。
            </p>
            <h2 className="rs-legal-doc__h2">1. 我们收集的信息</h2>
            <h3 className="rs-legal-doc__h3">1.1 您主动提供的信息</h3>
            <p>
                <span className="rs-legal-doc__emph">账户信息：</span>
                当您注册或登录时，我们可能收集昵称、电子邮箱、登录凭证及账号标识，用于识别身份和提供账户服务。
            </p>
            <p>
                <span className="rs-legal-doc__emph">交易与客服信息：</span>
                当您购买金币、会员或其他数字内容，或联系客户服务时，我们可能收集订单号、支付渠道、购买记录、
                联系方式以及您提交的反馈。完整支付卡资料通常由支付服务商处理，我们不会直接保存。
            </p>
            <h3 className="rs-legal-doc__h3">1.2 自动收集的信息</h3>
            <p>
                <span className="rs-legal-doc__emph">设备与网络信息：</span>
                包括设备类型、操作系统、浏览器、语言、IP 地址、网络类型、设备标识符及应用版本，用于保障服务兼容性、
                安全性和稳定性。
            </p>
            <p>
                <span className="rs-legal-doc__emph">使用信息：</span>
                包括访问页面、点击、搜索、播放进度、观看历史、收藏、点赞、评论、错误日志和功能使用情况。
            </p>
            <h2 className="rs-legal-doc__h2">2. 我们如何使用信息</h2>
            <p>
                我们使用信息以提供和维护服务、管理账户和订单、记录播放进度、处理付款和退款、提供客户支持、
                发送必要通知、防范欺诈和滥用、排查故障、改进产品，以及履行法律义务。
            </p>
            <p>
                在取得同意或具有其他合法依据时，我们也可能根据您的使用情况提供个性化内容、推荐或营销信息。
                您可以通过账户设置、设备权限或信息中的退订方式关闭相应功能。
            </p>
            <h2 className="rs-legal-doc__h2">3. 信息共享与披露</h2>
            <p>
                我们不会出售您的个人信息。为提供服务，我们可能向云存储、内容分发、数据分析、支付、客户支持、
                安全风控和广告服务商提供实现相关功能所必需的信息，并要求其按照合同和适用法律保护信息。
            </p>
            <p>
                在法律法规、司法或行政机关依法要求，或者为保护用户、公众及我们的合法权益所必需时，我们可能披露相关信息。
                如发生合并、收购、资产转让或重组，信息可能随业务一并转移，我们将要求接收方继续遵守本政策。
            </p>
            <h2 className="rs-legal-doc__h2">4. 信息存储与安全</h2>
            <p>
                我们采取访问控制、加密、日志审计和安全监测等合理措施保护信息。我们仅在实现本政策目的、履行法律义务、
                解决争议和执行协议所需期间保存信息。互联网传输和电子存储无法保证绝对安全，如发生安全事件，
                我们将依法采取补救措施并在必要时通知您。
            </p>
            <h2 className="rs-legal-doc__h2">5. 您的权利</h2>
            <p>
                在适用法律规定的范围内，您可以访问、更正、复制或删除个人信息，撤回同意，反对或限制特定处理，
                以及注销账户。部分请求可能需要核验身份；法律要求保留的信息可能无法立即删除。
            </p>
            <p>
                您可以在账户设置中管理相关信息和通知权限，也可以通过下方联系方式提交请求。
            </p>
            <h2 className="rs-legal-doc__h2">6. 未成年人保护</h2>
            <p>
                服务不面向未达到所在地区法定最低年龄的儿童。我们不会在明知的情况下未经监护人有效同意收集儿童个人信息。
                如您认为我们错误收集了儿童信息，请联系我们，我们将核实并依法处理。
            </p>
            <h2 className="rs-legal-doc__h2">7. 跨境传输</h2>
            <p>
                由于我们在多个国家或地区提供服务，信息可能被传输至您所在国家或地区以外并在那里处理。
                我们会依据适用法律采取合同、技术或其他保障措施，确保跨境传输获得适当保护。
            </p>
            <h2 className="rs-legal-doc__h2">8. 政策更新</h2>
            <p>
                我们可能不时更新本政策。发生重大变更时，我们会通过页面公告、应用内通知或其他合理方式提示您。
                更新后的政策自公布或载明的生效日期起生效。
            </p>
            <h2 className="rs-legal-doc__h2">9. 联系我们</h2>
            <p>
                如对本政策或个人信息处理有任何问题、意见或请求，请通过客户服务渠道联系我们。
            </p>
            <p>{BRAND_LEGAL_SITE_URL}</p>
        </>
    );
}

type LegalPageKey =
    | "terms_of_service"
    | "privacy_policy"
    | "membership_agreement"
    | "payment_agreement"
    | "pay_service"
    | "refund_policy";

function parseLegalPageKey(titleParam: string | null): LegalPageKey {
    switch (titleParam) {
        case "privacy_policy":
            return "privacy_policy";
        case "membership_agreement":
            return "membership_agreement";
        case "payment_agreement":
            return "payment_agreement";
        case "pay_service":
            return "pay_service";
        case "refund_policy":
            return "refund_policy";
        case "terms_of_service":
        case "user_agreement":
            return "terms_of_service";
        default:
            return "terms_of_service";
    }
}

const LEGAL_PAGE_TITLE_IDS: Record<LegalPageKey, string> = {
    terms_of_service: "terms_of_service",
    privacy_policy: "privacy_policy",
    membership_agreement: "shopping_tips_link_membership",
    payment_agreement: "shopping_tips_link_payment",
    pay_service: "shopping_paid_service_agreement_title",
    refund_policy: "shopping_tips_link_refund",
};

function LegalPageBody({ pageKey }: { pageKey: LegalPageKey }) {
    if (pageKey === "privacy_policy") {
        return <PrivacyPolicyBody />;
    }
    if (pageKey === "membership_agreement") {
        return <MemberTerms />;
    }
    if (pageKey === "refund_policy") {
        return <RefundPolicyContent />;
    }
    if (pageKey === "payment_agreement" || pageKey === "pay_service") {
        return <ShoppingPaidServiceAgreementContent />;
    }
    return <UserAgreementBody />;
}

export default function Component() {
    const intl = useIntl();
    const location = useLocation();
    const titleParam = new URLSearchParams(location.search).get("title");
    const pageKey = parseLegalPageKey(titleParam);
    const pageTitleId = LEGAL_PAGE_TITLE_IDS[pageKey];

    useEffect(() => {
        const prev = document.title;
        document.title = `${intl.formatMessage({ id: pageTitleId })} - ${BRAND_DISPLAY_NAME}`;
        return () => {
            document.title = prev;
        };
    }, [pageTitleId, intl]);

    return (
        <Page title={pageTitleId} bodyClassName="bg-app-canvas" showBack={false}>
            <article
                className={cn(
                    "rs-legal-doc",
                    pageKey === "membership_agreement" && "rs-legal-doc--memberTerms",
                    (pageKey === "payment_agreement" || pageKey === "pay_service") && "rs-legal-doc--payment",
                )}
            >
                <LegalPageBody pageKey={pageKey} />
            </article>
        </Page>
    );
}
