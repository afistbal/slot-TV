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

/** For You iOS 条内静音态（与 `<video>.muted` 同步，供滑切有声策略） */
let foryouPlayerMuted = true;

export function getForyouPlayerMuted(): boolean {
    return foryouPlayerMuted;
}

export function setForyouPlayerMuted(muted: boolean): void {
    foryouPlayerMuted = muted;
}
