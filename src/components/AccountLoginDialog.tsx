import { PcLoginDialog } from '@/pages/user/Login';
import { useAuthPromptStore } from '@/stores/authPrompt';
import { matchSearchFamilyPath } from '@/lib/searchRoutes';
import { useLocation, useNavigate } from 'react-router';

/** 全站受保护操作共用登录弹窗；关闭后仍停留在原页面。 */
export function AccountLoginDialog() {
    const location = useLocation();
    const navigate = useNavigate();
    const open = useAuthPromptStore((state) => state.open);
    const close = useAuthPromptStore((state) => state.close);

    return <PcLoginDialog open={open} onOpenChange={(next) => {
        if (!next) {
            close();
            if (matchSearchFamilyPath(location.pathname)) navigate('/', { replace: true });
        }
    }} onLoginSuccess={close} />;
}
