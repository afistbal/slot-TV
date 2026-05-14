# slot_old 剧集播放器 vs douyin 参考实现：差异与对齐清单

对照仓库 **`douyin`**（`src/components/slide/BaseVideo.vue`、`SlideVerticalInfinite.vue`、`src/pages/home/slide/LongVideo.vue` 等）与 **`slot_old`**（`src/pages/user/VideoPage/VideoPlayer.tsx`、`VideoVerticalSwiper.tsx` 等）。  
用途：按条向 douyin 靠拢时，在此更新 **状态** 与 **备注**。

**状态图例**：`[x]` 已对齐 · `[~]` 部分对齐 · `[ ]` 未做 · `[-]` 刻意不做 / 产品取舍

---

## 0. 故障排查（与 douyin 无关但影响体验）

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 一直转圈 + `00:00/00:00` | ① `waiting` 在**未真正播放**（`paused`）时仍置 `true`；② `<video crossOrigin="anonymous">` 与 CDN **无 CORS** 导致解码/缓冲异常；③ `error` 未处理 | 已在播放器侧：**仅非 `paused` 时响应 `waiting`**；**去掉默认 `crossOrigin`**（避免阻断首播）；**监听 `error` 关转圈**。若仍异常，在 Network 看 mp4 是否 403/跨域/Mixed Content。 |

---

## 一、性能与架构

| # | 维度 | douyin | slot_old | 状态 | 说明 / 对齐建议 |
|---|------|--------|----------|------|----------------|
| 1.1 | 列表 DOM 规模 | `SlideVerticalInfinite`：`virtualTotal` 默认 **5**，少量 `SlideItem` 复用 | `VideoVerticalSwiper`：`episodes.map` **全量滑页**，当前 + 邻居多实例 `VideoPlayer` | `[ ]` | 带宽与内存压力更大；长期可对齐「虚拟条数 / 仅当前挂源」。 |
| 1.2 | 预加载策略 | `BaseVideo`：`preload="true"` | 当前集 `metadata`、邻居 `none` + `fetchPriority` | `[-]` | 省流与 douyin 相反；按需再调。 |
| 1.3 | 多 CDN 地址 | `play_addr.url_list` → 多 `<source>` | `video_urls` / 单 `video` → 多 `<source>` | `[x]` | 接口见下文「后端约定」。 |
| 1.4 | 首包与 Range | 浏览器原生 Range；无前端自建 MSE | 同左 | `[x]` | 与 douyin 一致，无 HLS.js 层。 |

---

## 二、缓冲、加载态与错误

| # | 维度 | douyin | slot_old | 状态 | 说明 / 对齐建议 |
|---|------|--------|----------|------|----------------|
| 2.1 | 小 Loading 默认 | `state.loading` 初始 **false** | `waiting` 初始 false | `[x]` | 大页 Loader 已去；小圈跟 `waiting`。 |
| 2.2 | `waiting` 与暂停 | `waiting` 时：`!paused && !ignoreWaiting` 才 `loading=true` | 已改为 **`!paused` 才 `setWaiting(true)`** | `[x]` | 避免未起播/自动播失败仍转圈。 |
| 2.3 | 进度拖拽与 `waiting` | `ignoreWaiting` + 300ms 窗口（切集/切停） | 未实现 | `[ ]` | 对齐 `BaseVideo` `ITEM_STOP`/`ITEM_PLAY` 与 `touchend` 里逻辑。 |
| 2.4 | `playing` 关 Loading | `playing` → `loading=false` | `playing` / `canplay` → `setWaiting(false)` | `[x]` | |
| 2.5 | 媒体 `error` | 注释里有 `error` 探测，UI 未细做 | **`error` 监听关转圈** | `[~]` | 可再加 Toast / 重试 / 切下一 `source`。 |

---

## 三、时间与进度条 UI

| # | 维度 | douyin | slot_old | 状态 | 说明 / 对齐建议 |
|---|------|--------|----------|------|----------------|
| 3.1 | 时长展示 | `loadedmetadata` 取 `duration`；`_duration()` 格式化 | `loadedmetadata` + `timeupdate` + `formatVideoClock` | `[x]` | 已修「无监听导致 00:00」类问题。 |
| 3.2 | 短进度条隐藏 | `duration > 15` 或拖动或非播放才画进度条 | 长剧始终展示底栏 | `[-]` | 可按需缩短极短视频 UI。 |
| 3.3 | 拖动时时间浮层 | `isMove` 时显示 `current / duration` | 底栏常驻时间 | `[ ]` | 体验向 douyin 靠拢可做「仅拖动显示大号时间」。 |
| 3.4 | 横滑进度 | 触摸 `touchstart/move/end` 算 `currentTime` | 鼠标 + 触摸 + 底栏 | `[~]` | 逻辑类似；可再对齐松手 `play()` 时机。 |

---

## 四、封面与首帧

| # | 维度 | douyin | slot_old | 状态 | 说明 / 对齐建议 |
|---|------|--------|----------|------|----------------|
| 4.1 | poster 数据源 | `poster` / `cover.url_list[0]`（`_checkImgUrl`） | **视频首帧 canvas**（不用 `info.image`） | `[-]` | 与 douyin 数据源不同；跨域无 CORS 时截帧为 null，poster 可能空。 |
| 4.2 | `crossOrigin` | 未在 `BaseVideo` 上设 | **默认不设**（避免 CDN 无 CORS 时整片无法播） | `[x]` | 若要坚持截跨域帧，需 CDN 配 CORS 后再按需打开。 |

---

## 五、自动播放、静音与全屏

| # | 维度 | douyin | slot_old | 状态 | 说明 / 对齐建议 |
|---|------|--------|----------|------|----------------|
| 5.1 | 首条自动播 | `autoplay` + `isPlay` | PC/H5 策略 + `tap to unmute` | `[~]` | 策略更复杂，按业务保留。 |
| 5.2 | 全屏 | 容器 + X5 属性配合 | `toggleFullscreen` + PC 侧栏 | `[~]` | douyin 偏 H5 壳；PC 侧栏为业务增量。 |
| 5.3 | 信息流 `loop` | `loop` | 剧集不 loop | `[-]` | |

---

## 六、交互与布局（页面级）

| # | 维度 | douyin | slot_old | 状态 | 说明 / 对齐建议 |
|---|------|--------|----------|------|----------------|
| 6.1 | 右侧互动栏 | 点赞/评论/分享工具条 | VIP / 收藏 / 清单 / 分享 | `[~]` | 信息架构不同，按需抄交互密度。 |
| 6.2 | 单击显隐 | bus `SINGLE_CLICK` 切换 UI | 点击显隐控制器 | `[~]` | |
| 6.3 | 长视频列表进屏播放 | `LongVideo`：`IntersectionObserver` threshold 0.5 | 竖滑切集 + `playbackPolicy` | `[~]` | douyin 偏列表；我方偏 Reels。 |

---

## 七、内联播放与 WebView（douyin 有、我方待评估）

| # | 维度 | douyin | slot_old | 状态 |
|---|------|--------|----------|------|
| 7.1 | X5 / webkit 内联 | `x5-video-player-type`、`playsinline` 等 | 主要 `playsInline` | `[ ]` |
| 7.2 | 微信内全屏行为 | X5 相关 false | 未细调 | `[ ]` |

---

## 八、后端接口约定（多源）

- `movie/episode`：保留 `video: string`；可选 **`video_urls: string[]`**，与 douyin `url_list` 同语义，**靠前优先**。

---

## 九、代码索引（slot_old）

| 路径 | 作用 |
|------|------|
| `src/pages/user/VideoPage/VideoPlayer.tsx` | 主播放器、`<source>`、`waiting`/`error`、时间 UI |
| `src/pages/user/VideoPage/videoPlayerLoadEpisode.ts` | 拉集、`playbackSources`、`load()` |
| `src/pages/user/VideoPage/videoPlayerPlaybackUrls.ts` | URL 列表 |
| `src/pages/user/VideoPage/videoPlayerTimeFormat.ts` | `mm:ss` |
| `src/pages/user/VideoPage/videoFramePoster.ts` | 首帧 data URL（同域或可画时） |
| `src/pages/user/VideoPage/VideoVerticalSwiper.tsx` | 竖滑、邻居 `playbackPolicy` |

---

## 十、维护约定

改完一项请在 **第二节起表格** 内把对应行状态改为 `[x]`，并在「说明」补一句提交要点或 PR 链接；本节「已对齐」汇总可定期折叠进 Git 提交说明，避免与表格重复维护。
