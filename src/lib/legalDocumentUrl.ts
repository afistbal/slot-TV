export type LegalDocTitle = "user_agreement" | "privacy_policy";

/** Vite `BASE_URL` 去掉尾部 `/`；根部署时为 `""`，子路径为 `"/tv"` 等。 */
function appBasePrefix(): string {
    const raw = import.meta.env.BASE_URL || "/";
    if (raw === "/" || raw === "") {
        return "";
    }
    return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function withAppBase(path: string): string {
    const p = path.startsWith("/") ? path : `/${path}`;
    const prefix = appBasePrefix();
    return prefix ? `${prefix}${p}` : p;
}

/** SPA 内路由路径，不含 origin（含 `BASE_URL` 前缀）。 */
export function legalDocumentPath(title: LegalDocTitle): string {
    return withAppBase(`/page/text?title=${title}`);
}

/** 含 `BASE_URL` 的绝对 URL（PC 新标签打开用）。 */
export function legalDocumentAbsoluteUrl(title: LegalDocTitle): string {
    return `${window.location.origin}${legalDocumentPath(title)}`;
}

/** `public/` 下静态条款 HTML（与 Vite base 拼接）。 */
export function reelshortPrivacyPolicyIframeSrc(): string {
    return `${window.location.origin}${withAppBase("/reelshort-privacy-policy.html")}`;
}
