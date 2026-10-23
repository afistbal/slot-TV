# PWA 打包与发布

## 本地验证

开发服务器不会注册 Service Worker，避免开发缓存干扰：

```powershell
npm run dev
```

要验证安装、离线缓存和自动更新，必须使用生产打包后预览：

```powershell
npm run build
npm run preview
```

浏览器打开 `http://localhost:5188`，在开发者工具的 Application 面板检查：

- Manifest 可以正常读取，名称和 192/512 图标正确。
- Service Workers 中已注册 `/sw.js`。
- Cache Storage 中存在 Workbox 预缓存。
- 桌面 Chromium 出现“添加桌面”入口；iPhone/iPad Safari 显示手动添加引导。

## 构建命令

```powershell
# 保持 Vite 默认 production 模式，输出到 D:/JJ-TV/movie-www-prod
npm run build

# dev 配置，输出到 D:/JJ-TV/movie-www
npm run build:dev

# prod 配置，输出到 D:/JJ-TV/movie-www-prod
npm run build:prod

# 交互式选择模式
npm run build:mode
```

如需在仓库内做一次不覆盖部署目录的构建检查，可临时指定输出目录：

```powershell
$env:VITE_OUT_DIR = ".tmp/pwa-build"
npx vite build
Remove-Item Env:VITE_OUT_DIR
```

构建脚本会先执行 TypeScript 检查，计算但暂不写入下一补丁版本，再在全新的临时目录完成 Vite 构建和引用校验。校验成功后才更新源码版本；如果发布失败，会安全恢复版本文件。发布阶段先让即将下线版本的完整资源树进入 7 天保留期并清理更早的历史资源，再复制新资源及其他依赖、原子替换 `index.html`，最后发布 `sw.js`。

产物中必须包含：

- `manifest.json`
- `sw.js`
- `workbox-*.js`
- `pwa-force-reload.js`
- `brands/<brand>/icons/new-192.png`
- `brands/<brand>/icons/new-512.png`

`vite.config.ts` 会按 `VITE_BRAND_DISPLAY_NAME` 和 `VITE_BRAND_ASSET_BASE` 改写 manifest 名称及品牌图标。发布服务器需要以 `application/javascript` 提供 `/sw.js`，并为根路径启用 HTTPS；不要把 `/sw.js` 重定向到错误路径。

## 更新策略

页面在生产环境手动注册 `/sw.js`，注册时使用 `updateViaCache: 'none'`。应用启动、重新联网、窗口回到前台时会检查更新，持续前台使用期间再以 3–5 分钟随机间隔检查，避免所有客户端同时请求。

新 Service Worker 会尽快激活，但不会强行接管仍在运行旧代码的页面。普通页面收到更新后安全刷新；视频、支付、购物及表单类页面会等用户离开后再刷新。旧客户端没有响应更新消息时，Service Worker 只会对安全页面使用导航兜底。

入口或动态分包加载失败时，页面会尝试一次带缓存穿透参数的自动恢复；如果仍失败，会显示可操作的重试/修复界面，而不是黑屏或无限刷新。
