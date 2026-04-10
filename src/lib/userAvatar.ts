import type { TData } from '@/api';

/** 后端可能用的头像字段（与 login/uid、login/token 返回对齐） */
const INFO_AVATAR_KEYS = [
  'avatar',
  'photo',
  'photo_url',
  'photoURL',
  'headimg',
  'head_img',
] as const;

/**
 * 顶栏/个人页展示用头像 URL：优先用户信息字段，其次 OAuth 写入的 localStorage（与 Login 里 user-avatar 一致）。
 * 邮箱登录一般无 Google 图，依赖后端 `avatar` 等字段；无则走占位图。
 */
export function getUserAvatarDisplayUrl(info: TData | undefined): string | undefined {
  if (info) {
    for (const k of INFO_AVATAR_KEYS) {
      const v = info[k];
      if (typeof v === 'string' && v.trim().length > 0) {
        return v.trim();
      }
    }
  }
  try {
    const ls = localStorage.getItem('user-avatar');
    if (ls?.trim()) {
      return ls.trim();
    }
  } catch {
    /* 隐私模式等 */
  }
  return undefined;
}
