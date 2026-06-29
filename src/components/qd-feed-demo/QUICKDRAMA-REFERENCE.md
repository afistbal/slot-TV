# qd-feed-demo ↔ quickdrama 源码对照

> **唯一权威源码（必须先查、只能用对方代码）**  
> `C:\Users\Administrator\Downloads\www.quickdrama.cc (3)\www.quickdrama.cc\_next\static\chunks\`

---

## 强制工作流（产品规定，Agent / 人工均须遵守）

**发现任何问题、要改任何行为、要加任何逻辑时，顺序必须是：**

1. **先** 在上面的 QD 导出包中搜索关键词（如 `webkitEnterFullscreen`、`scrollTo`、`isPlay`、`ENDED`）。
2. **找到** 对应 chunk 文件 + **行号**（见下文「文件映射」或 `QUICKDRAMA-SOURCE-MAP.txt`）。
3. **照抄** QD 的实现方式移植到本仓库对应文件；代码注释里写 `QD: 9085 Lxxx`。
4. **禁止** 在未查 QD 的情况下「我觉得应该这样」自创算法、状态机、命名或分支。
5. **禁止** 用 `DouyinFeedPlayer` / `useFeedPlayerFullscreen` 等现有失败实现替代 QD 行为。
6. 若 QD 没有该行为 → 在本文档 **「Demo 有意省略」** 或 **「待 QD 确认」** 登记，**不得** 自行发明。

**追责依据**：每个功能必须能在本文档 + 源码注释中对应到 QD 的 chunk + 行号；对不上的一律视为违规改动。

**速查文件**：`QUICKDRAMA-SOURCE-MAP.txt`（功能编号 ↔ QD 行号 ↔ 本仓库文件）。

---

## 本 Demo 原则

- 行为以 QD 为准，不以 `iOS全屏-问题与目标汇总.txt` 或 `DouyinFeedPlayer` 现状为准（除非 QD 与汇总一致且已在 QD 源码证实）。
- 允许的差异仅限：**路由路径**（`/qd-feed-demo` vs `/video/`）、**Demo 假数据 URL**、**省略支付/埋点**（见「Demo 有意省略」）。
- 其余逻辑必须与 QD 一致，包括：transform 滑动、预加载窗口、isPlay 200ms、ended → scrollTo、全屏走 xgplayer 默认插件。

---

## 数据源（Demo）

- **视频列表**：与 `/foryou` 相同 — `useForDemoFeed` → `fetchForyouList` → `mapForyouToQdFeedItems`
- 映射：`url` ← `resolveFeedVideoUrl`；`pic` ← `resolveVideoPosterUrl`；`id` ← `foryouFeedItemKey`
- 不再使用 Google 公开 sample MP4（国内网络不可达会导致「没播放」）

---

| 本仓库文件 | quickdrama 模块 | chunk 文件 |
|-----------|----------------|-----------|
| `QdVerticalFeed.tsx` | `79462` | `9085-44814131bc0a1f4a.js` L484–562 |
| `isQdControlTarget.ts` | `79462` 内 `A()` | `9085` L499 |
| `QdVideoSlot.tsx` | `55299` 内 `function x` | `9085` L114–341 |
| `qdCreatePlayer.ts` | `55299` 内 `K()` | `9085` L144–226 |
| `pages/user/QdFeedDemo/index.tsx` | `/video` page `tN` + 组装 | `app/video/page-2d070b8da4226bcf.js` L1512–1526, L1865–1891 |
| xgplayer 全屏内核 | `getFullscreen` / webkit 事件 | `580-b7614ccc4b885b23.js` L1909–1912, L2445–2467, L3413, L3450 |

---

## 功能 1：上下滑（transform Feed）

**QD 源码**：`9085` L490–561（模块 `79462`）

| 行为 | QD 代码要点 | 本仓库 |
|------|------------|--------|
| 容器 | `overflow-hidden relative` | `QdVerticalFeed` 根 div |
| 位移 | `translateY(-p)`，`transition: m ? 0.4s ease-in-out : none` | 同 |
| 滑动阈值 | `g.current - t > 20` → next；`< -20` → prev | 同 |
| 边界 | `r` clamp 到 `[0, w*(len-1)]` | 同 |
| 首次 touch | `u.current ? h.current = t : h.current = p + t` | 同 |
| `scrollTo` | `v(w*e); n(e); x(true); setTimeout 400ms` | `useImperativeHandle` 同 |
| 控件区不滑 | `A(e.target)` 见 `isQdControlTarget.ts` | 同选择器列表 |

---

## 功能 2：预加载（仅当前 + 下一条 mount player）

**QD 源码**：`9085` L512–514

```javascript
let b = (e, t) => i === t || i + 1 === t ? o(e, t) : <div className="h-screen w-full" />;
```

| 行为 | 本仓库 |
|------|--------|
| `currentIndex === index \|\| currentIndex + 1 === index` 才 `renderItem` | `QdVerticalFeed.renderSlot` |
| 其余 slide 空占位 `h-screen w-full` | 同 |

---

## 功能 3：暂停 / 播放

**QD 源码**：`9085` L268–279（`isPlay`）、L333–337（点击容器）

| 行为 | QD | 本仓库 |
|------|-----|--------|
| 激活条播放 | `isPlay===true` → `setTimeout 200ms` → `play()`，且 `!F` 时 | `QdVideoSlot` `useEffect([isPlay, ready])` |
| 失活暂停 | `isPlay===false` → `pause()` | 同 |
| 点击视频区 | `F ? pause : play`，更新 `G(F)` | `locallyPlaying` + `onClick` |
| popstate 暂停 | L258–267 | 同（路径改为 `/qd-feed-demo`） |
| body 播放态 class | L219–224 `url-video-play` | 同 class，路径 `/qd-feed-demo` |

---

## 功能 4：xgplayer 创建（含全屏按钮）

**QD 源码**：`9085` L157–190（`K()` 内 `new n.A({...})`）

| 配置项 | QD 值 | 本仓库 |
|--------|-------|--------|
| `controls` | `true` | `true` |
| `loop` | `false` | `false` |
| `id` | `"video-" + k` | 同 |
| `height` | `window.innerHeight` | 同 |
| `width` | `window.innerWidth` | 同 |
| `plugins` | `[c.$, u.A]`（mp4 + texttrack 插件） | `[Mp4Plugin]`；texttrack 用 Player `texttrack` 配置（QD L167–189） |
| `poster` | `S` | `pic` |
| `fit` | `"fix"` | `"fix"` |
| `texttrack` | 完整对象 L167–189 | 结构同；Demo 无字幕时 `list: []` |

**全屏（xgplayer 内置，非业务层）**：`580` L3413 — `useCssFullscreen: false` → iOS 走 `webkitEnterFullscreen`（L2463）。

**READY 后控件 touch 隔离**：`9085` L200–216 — progress / playbackrate / texttrack 的 `stopPropagation`。

**ENDED**：`9085` L217–218 → `onVideoEnd()`。

**销毁重建**：`9085` L236–240 — `videoId` 变 → `destroy` → `K()`。

---

## 功能 5：播放完毕自动下一条（含全屏内 ended）

**QD 源码**：`page-2d070b8da4226bcf.js`

| 步骤 | QD | 本仓库 |
|------|-----|--------|
| ENDED 回调 | L1885 `onVideoEnd: () => tN(t)` | `onVideoEnd={() => handleVideoEnd(index)}` |
| 切下一集 | L1512–1525 `tN`：`scrollTo(e+1)` + 更新 index | `feedRef.scrollTo(index+1)` + `setCurrentIndex` |
| 无额外 exitFullscreen | QD 业务层 **没有** ended 后强退全屏 | **不添加** |

---

## Demo 有意省略（非播放核心，QD 有但我们不测）

| QD 功能 | 位置 | 原因 |
|---------|------|------|
| 锁定集 / VIP 蒙层 | `9085` L285–329 | 需支付 API |
| loadmore 合并列表 | `page` L1513–1518 | Demo 固定列表 |
| `history.replaceState` | `page` L1522–1525 | Demo 不改 URL |
| 侧栏 VIP/收藏 | `page` L1948+ | 非 xgplayer 核心 |
| upUserLog 埋点 | `9085` L194–199 | 非播放行为 |
| `handleVideoLog` | `9085` L241–255 | 日志 |

---

## 改 bug / 加功能时的检查清单

- [ ] 已在 `www.quickdrama.cc (3)` 导出包中 grep 过相关关键词
- [ ] 已记录 QD chunk 文件名 + 行号（更新 `QUICKDRAMA-SOURCE-MAP.txt` 如为新功能）
- [ ] 代码注释含 `QD: <chunk> L<line>`
- [ ] 未引入 `DouyinFeedPlayer` / 自研全屏 hook / scroll-snap 等与 QD 不一致的实现
- [ ] 若与 QD 不一致，已在本文档说明原因并获产品确认（默认不允许）

---

## 测试路由

- URL：`/qd-feed-demo`
- iOS Safari 实机：上下滑、预加载（看 Network 仅 current+next 请求）、暂停/播放、全屏、全屏 ended 自动下一条
