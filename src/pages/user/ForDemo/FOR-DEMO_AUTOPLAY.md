# for-demo 冷启动自动播放与「Click to unmute」蒙层

## 目的

浏览器冷进页通常只允许 **静音自动播放**。首条视频静音起播后，用全屏蒙层引导用户 **点按开声**。

## 何时展示蒙层

同时满足：

1. **冷进 `/for-demo`**（本次文档加载）
   - F5 / 刷新落在 `/for-demo`
   - 广告 / 外链 **新窗口直开** `/for-demo`（无站内 history）
2. **首条 feed**（`activeIndex === 0`）
3. 用户 **尚未** 点蒙层，且 **未** 滑离首条

## 何时不展示

| 场景 | 行为 |
|------|------|
| 从 `/home` 等站内点击进入 | 有声自动播，**无蒙层** |
| 用户点击蒙层开声 | 蒙层消失，本页不再出现 |
| 不点蒙层直接滑到下一条 | 首条蒙层不再跟到下一条；后续条目 **无蒙层** |
| 同页内滑切 / 切条 | **无蒙层**（非冷启动首条） |

## 再次出现蒙层

仅当再次 **冷进页**：

- F5 刷新 `/for-demo`
- 新窗口 / 新标签从广告直链打开 `/for-demo`

## 状态存储

`stores/forDemoColdUnmute.ts`（Zustand）：

- `feedColdAutoplay` — 是否仍处于冷启动首条阶段
- `coldUnmuteOverlay` — 是否允许展示蒙层
- `overlayDismissed` — 用户已 dismiss

首 mount 由 `forDemoAutoplayPolicy.ts` + `index.tsx` 初始化；播放器静音偏好由 `forDemoApplyMountMutePolicy.ts` 写入 `douyin_feed_player_is_mute`。

## UI

壳层组件 `ForDemoColdUnmuteOverlay.tsx`，DOM / 样式对齐 `ForYouPlayer` H5 蒙层（`z-[25]`、`video_tap_to_unmute` 文案）。
