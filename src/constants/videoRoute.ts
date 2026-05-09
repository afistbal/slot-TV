/**
 * React Router `location.state.fromHomeVideoPlayback`：
 * 任意站内「用户点击进入」播放页（首页 / 书单 / 历史 / 搜索 / Shelf / 顶栏等），与直链冷启动区分以利有声自动播策略。
 */
export const VIDEO_FROM_HOME_STATE = { fromHomeVideoPlayback: true } as const;
