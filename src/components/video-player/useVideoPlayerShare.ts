import { useCallback, useState, type SetStateAction } from 'react';
import type { IPlayerData } from '@/types/videoPlayer';
import { useConfigStore } from '@/stores/config';
import { openSharePoster } from '@/stores/sharePoster';
import { useUserStore } from '@/stores/user';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { resolveVideoPosterUrl, resolveVideoSharePageUrl } from './videoPlayerShareUrl';
import type { ShareAction } from './videoPlayerConstants';
import { useRequireAccount } from '@/hooks/useRequireAccount';

export function useVideoPlayerShare(data: IPlayerData) {
    const requireAccount = useRequireAccount();
    const staticBase = useConfigStore(store => String(store.config.static ?? ''));
    const referralCode = useUserStore(store => getUserUidForDisplay(store.info));
    const [shareEmbedCode, setShareEmbedCode] = useState('');
    const [shareShowControls, setShareShowControls] = useState(true);
    const open = useCallback(() => {
        if (!requireAccount()) return;
        openSharePoster({
            url: resolveVideoSharePageUrl(data.info.id, referralCode), title: String(data.info.title ?? ''),
            coverUrl: resolveVideoPosterUrl(staticBase, data.info, data.info.id), reward: true,
        });
    }, [data.info, referralCode, requireAccount, staticBase]);
    const setShareOpen = useCallback((value: SetStateAction<boolean>) => { if (typeof value === 'function' ? value(false) : value) open(); }, [open]);
    const handleShareAction = useCallback(async (_action: ShareAction) => { void _action; open(); }, [open]);
    return { shareOpen: false, setShareOpen, shareEmbedCode, setShareEmbedCode, shareShowControls, setShareShowControls, handleShareAction, handleCopyEmbedCode: async () => {} };
}
