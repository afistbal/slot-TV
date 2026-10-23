import { useUserStore } from '@/stores/user';
import { parseCompositeUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';

/** 当前匿名会话的 uid，供邮箱登录/注册和第三方账号合并匿名资产。 */
function getAnonymousUid(): string | undefined {
    const store = useUserStore.getState();
    if (!store.signed || !store.info || !store.isAnonymous()) {
        return undefined;
    }
    const info = store.info;
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
        return undefined;
    }
    return s;
}

/** 已有账号 uid 时，游客 uid 放在独立字段中，避免覆盖账号。 */
export function getAnonymousUniIdPayload(): { anonymous_id?: string } {
    const uid = getAnonymousUid();
    return uid ? { anonymous_id: uid } : {};
}
