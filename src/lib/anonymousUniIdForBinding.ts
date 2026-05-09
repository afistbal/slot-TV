import { useUserStore } from '@/stores/user';

/**
 * 游客 `login/anonymous` 返回的 `info.unique_id`。
 * 升级为邮箱/Google 账号时带给 `login/email`、`login/uid`，便于后端合并匿名资产。
 */
export function getAnonymousUniIdPayload(): { anonymous_uni_id?: string } {
    const { signed, info } = useUserStore.getState();
    if (!signed || !info || info['anonymous'] !== 1) {
        return {};
    }
    const raw = info['unique_id'];
    let s = '';
    if (typeof raw === 'string') {
        s = raw.trim();
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
        s = String(raw);
    }
    if (!s) {
        return {};
    }
    return { anonymous_uni_id: s };
}
