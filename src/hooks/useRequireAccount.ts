import { useCallback } from 'react';

import { useAuthPromptStore } from '@/stores/authPrompt';
import { useUserStore } from '@/stores/user';

/**
 * 匿名会话只用于游客观看，不等同于账号登录。
 * 返回 true 时调用方可以继续执行受保护操作；否则统一打开登录弹窗。
 */
export function useRequireAccount() {
    const signed = useUserStore((state) => state.signed);
    const anonymous = useUserStore((state) => state.isAnonymous());
    const requestLogin = useAuthPromptStore((state) => state.requestLogin);

    return useCallback(() => {
        if (signed && !anonymous) return true;
        requestLogin();
        return false;
    }, [anonymous, requestLogin, signed]);
}
