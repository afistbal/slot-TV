import { apiBaseURL } from "@/api/baseURL";

/**
 * `pay/create` 的 `redirect`：与 {@link apiBaseURL} 同源 + 路径，
 * 本地跑 SPA 时避免把 `http://localhost:...` 传给测试域接口。
 */
export function payCreateRedirectFromApiOrigin(pathWithQuery: string): string {
  const path = pathWithQuery.startsWith("/")
    ? pathWithQuery
    : `/${pathWithQuery}`;
  try {
    return `${new URL(apiBaseURL).origin}${path}`;
  } catch {
    if (typeof globalThis !== "undefined" && "location" in globalThis) {
      const loc = globalThis.location as Location;
      return `${loc.origin}${path}`;
    }
    return "";
  }
}
