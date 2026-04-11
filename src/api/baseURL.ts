/**
 * 与 lot-h5 `src/api/baseURL.js` 相同思路：`axios.js` 里 `import { baseURL } from './baseURL'` 后写死根地址。
 * 生产地址请按后端实际上线修改。
 */
const flag = import.meta.env.MODE;
const customFlag = import.meta.env.VITE_APP_FLAG;

let baseURL = "";
if (flag === "production" || customFlag === "prod") {
  baseURL = "https://test.yogoshort.com/api";
} else {
  baseURL = "https://test.yogoshort.com/api";
}

/** ky 的 prefixUrl 建议以 `/` 结尾 */
export const apiBaseURL = baseURL.endsWith("/") ? baseURL : `${baseURL}/`;
