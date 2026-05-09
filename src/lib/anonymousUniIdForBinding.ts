import { useUserStore } from '@/stores/user';
import { parseCompositeUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';

/**
 * 游客升级为邮箱/Google 时带给 `login/email`、`login/uid`：传当前匿名会话的 **uid**（`info.uid`，与展示用 composite 解析一致），不再使用 `unique_id`。
 */
export function getAnonymousUniIdPayload(): { anonymous_id?: string } {
    const { signed, info } = useUserStore.getState();
    if (!signed || !info || info['anonymous'] !== 1) {
        return {};
    }
    const uidField = info['uid'];
    let s = '';
    if (typeof uidField === 'number' && Number.isFinite(uidField)) {
        s = String(uidField);
    } else if (typeof uidField === 'string') {
        const t = uidField.trim();
        if (t) {
            s = t.includes('|') ? parseCompositeUidForDisplay(t) : t;
        }
    }
    if (!s) {
        return {};
    }
    return { anonymous_id: s };
}
