import { PcLoginDialog } from '@/pages/user/Login';
import { useAuthPromptStore } from '@/stores/authPrompt';
import { useUserStore } from '@/stores/user';
import { useEffect } from 'react';
import { matchSearchFamilyPath } from '@/lib/searchRoutes';
import { useLocation, useNavigate } from 'react-router';

/** 全站受保护操作共用登录弹窗；关闭后仍停留在原页面。 */
export function AccountLoginDialog() {
    const location = useLocation();
    const navigate = useNavigate();
    const open = useAuthPromptStore((state) => state.open);
    const close = useAuthPromptStore((state) => state.close);
    const signedIn = useUserStore((state) => state.signed && !state.isAnonymous());

    useEffect(() => {
        if (signedIn && open) close();
    }, [signedIn, open, close]);

    return <PcLoginDialog open={open && !signedIn} onOpenChange={(next) => {
        if (!next) {
            close();
            if (matchSearchFamilyPath(location.pathname)) navigate('/', { replace: true });
        }
    }} onLoginSuccess={close} />;
}
