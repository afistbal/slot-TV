const baseURL = import.meta.env.VITE_API_BASE_URL?.trim() || "https://i.yogoshort.com/api";

/** ky 的 prefixUrl 建议以 `/` 结尾 */
export const apiBaseURL = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
