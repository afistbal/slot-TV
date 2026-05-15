/**
 * 对标 douyin `main.ts` 里 `window.isMuted`：用户在本标签页内主动开声后记住，
 * 便于站内路由再进播放页时少打静音蒙层，但仍保留底部音量图标入口。
 */
const RS_VIDEO_SESSION_USER_UNMUTED = 'rs_video_session_user_unmuted';

export function hasVideoSessionUserUnmuted(): boolean {
    try {
        return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(RS_VIDEO_SESSION_USER_UNMUTED) === '1';
    } catch {
        return false;
    }
}

export function markVideoSessionUserUnmuted(): void {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(RS_VIDEO_SESSION_USER_UNMUTED, '1');
        }
    } catch {
        // ignore
    }
}

/** H5：站内换集（滑动 / 点下一集等）后置位，避免同一会话内反复出全屏「点按取消静音」蒙层 */
const RS_VIDEO_H5_SUPPRESS_UNMUTE_OVERLAY = 'rs_video_h5_suppress_unmute_overlay';

export function hasH5UnmuteOverlaySuppressed(): boolean {
    try {
        return (
            typeof sessionStorage !== 'undefined' &&
            sessionStorage.getItem(RS_VIDEO_H5_SUPPRESS_UNMUTE_OVERLAY) === '1'
        );
    } catch {
        return false;
    }
}

export function markH5UnmuteOverlaySuppressed(): void {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(RS_VIDEO_H5_SUPPRESS_UNMUTE_OVERLAY, '1');
        }
    } catch {
        // ignore
    }
}

export function clearH5UnmuteOverlaySuppressed(): void {
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem(RS_VIDEO_H5_SUPPRESS_UNMUTE_OVERLAY);
        }
    } catch {
        // ignore
    }
}
