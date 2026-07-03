# PWA 外部风险记录：Cloudflare 裸域重定向

Date: 2026-07-03

这是一条外部基础设施风险记录，当前不放进应用代码里处理。

## 现象

- `https://yogoshort.com/sw.js` redirects to `https://www.yogoshort.comsw.js/`
- `https://yogoshort.com/profile?tab=topup` redirects to `https://www.yogoshort.comprofile/?tab=topup`

## 正确结果

- `https://yogoshort.com/sw.js` -> `https://www.yogoshort.com/sw.js`
- `https://yogoshort.com/profile?tab=topup` -> `https://www.yogoshort.com/profile?tab=topup`

## 为什么会影响 PWA

Service Worker 更新依赖浏览器从当前 origin 正常拉取 `/sw.js`。如果裸域跳转规则把 `/sw.js` 拼坏，浏览器可能拿不到新的 SW 文件，旧 Service Worker 就会继续存活，并继续返回旧缓存里的 app shell。

这类问题不一定是本次旧版本滞留的唯一原因，但会放大 PWA 更新异常，尤其是用户曾经从裸域进入或安装过 PWA 的场景。

## 后续修复方向

- 优先使用 Cloudflare Redirect Rules，目标地址建议用动态拼接：
  `concat("https://www.yogoshort.com", http.request.uri)`
- 如果使用 Page Rules，目标地址必须保留 host 后面的 `/`：
  `https://www.yogoshort.com/$1`
- 保留 query string。

## 验证命令

```powershell
curl.exe -I https://yogoshort.com/sw.js
curl.exe -I "https://yogoshort.com/profile?tab=topup"
```

`Location` 响应头里，域名后面必须有 `/`，不能出现 `www.yogoshort.comsw.js` 或 `www.yogoshort.comprofile`。
