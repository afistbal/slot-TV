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

/** `login/email` 直接使用 uid 字段。 */
export function getAnonymousUidPayload(): { uid?: string } {
    const uid = getAnonymousUid();
    return uid ? { uid } : {};
}

/** `login/uid` 已有第三方 uid，游客 uid 继续放在独立字段中，避免覆盖第三方账号。 */
export function getAnonymousUniIdPayload(): { anonymous_id?: string } {
    const uid = getAnonymousUid();
    return uid ? { anonymous_id: uid } : {};
}
