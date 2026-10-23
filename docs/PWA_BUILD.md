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
# 默认环境，输出到 D:/JJ-TV/movie-www
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

构建脚本会先升级补丁版本、执行 TypeScript 检查、清理旧产物，再由 Vite 输出页面和 PWA 文件。产物中必须包含：

- `manifest.json`
- `sw.js`
- `workbox-*.js`
- `pwa-force-reload.js`
- `brands/<brand>/icons/new-192.png`
- `brands/<brand>/icons/new-512.png`

`vite.config.ts` 会按 `VITE_BRAND_DISPLAY_NAME` 和 `VITE_BRAND_ASSET_BASE` 改写 manifest 名称及品牌图标。发布服务器需要以 `application/javascript` 提供 `/sw.js`，并为根路径启用 HTTPS；不要把 `/sw.js` 重定向到错误路径。

## 更新策略

页面在生产环境手动注册 `/sw.js`，前台每 30 秒检查一次更新。新 Service Worker 接管后页面会刷新；如果用户正在播放视频，则等离开播放页再刷新，避免打断观看。动态分包加载失败时也会做一次带冷却时间的自恢复刷新。
