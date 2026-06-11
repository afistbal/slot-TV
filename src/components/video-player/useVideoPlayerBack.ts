import { useCallback } from 'react';
import { useNavigate } from 'react-router';

import { canNavigateBack } from '@/pages/user/VideoPage/videoPlayerUtils';

/** /video 同款返回：有 history 则 back，否则回首页 */
export function useVideoPlayerBack() {
    const navigate = useNavigate();

    return useCallback(() => {
        if (canNavigateBack()) {
            navigate(-1);
            return;
        }
        navigate('/');
    }, [navigate]);
}
