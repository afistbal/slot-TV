import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useIntl } from 'react-intl';
import type { IPlayerData } from '@/types/videoPlayer';
import { buildVideoShareEmbedCode, resolveVideoPosterUrl, resolveVideoSharePageUrl } from './videoPlayerShareUrl';
import type { ShareAction } from './videoPlayerConstants';

/** 分享卡片与 `<video poster>` 使用剧封面 `info.image`，不用视频时帧截图 */
export function useVideoPlayerShare(data: IPlayerData, staticBase: string) {
    const intl = useIntl();
    const [shareOpen, setShareOpen] = useState(false);
    const [shareEmbedCode, setShareEmbedCode] = useState('');
    const [shareShowControls, setShareShowControls] = useState(true);

    const getCurrentShareUrl = useCallback(() => resolveVideoSharePageUrl(), []);

    const getCurrentPosterUrl = useCallback(
        () => resolveVideoPosterUrl(staticBase, data?.info?.image).trim(),
        [staticBase, data?.info?.image],
    );

    const buildEmbedCode = useCallback(() => {
        return buildVideoShareEmbedCode(getCurrentShareUrl(), shareShowControls);
    }, [getCurrentShareUrl, shareShowControls]);

    useEffect(() => {
        if (!shareOpen) {
            setShareEmbedCode('');
            setShareShowControls(true);
        }
    }, [shareOpen]);

    useEffect(() => {
        if (shareEmbedCode) {
            setShareEmbedCode(buildEmbedCode());
        }
    }, [shareEmbedCode, buildEmbedCode]);

    const handleShareAction = useCallback(
        async (action: ShareAction) => {
            const url = getCurrentShareUrl();
            if (!url) {
                return;
            }
            if (action === 'facebook') {
                window.open(
                    'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url),
                    '_blank',
                    'noopener,noreferrer',
                );
                return;
            }
            if (action === 'twitter') {
                const text = data?.info?.title != null ? String(data.info.title) : '';
                const tw = new URL('https://twitter.com/intent/tweet');
                tw.searchParams.set('url', url);
                if (text) {
                    tw.searchParams.set('text', text);
                }
                window.open(tw.toString(), '_blank', 'noopener,noreferrer');
                return;
            }
            if (action === 'link') {
                await navigator.clipboard
                    .writeText(url)
                    .then(() => toast.success(intl.formatMessage({ id: 'copied' })))
                    .catch(() => toast.error(intl.formatMessage({ id: 'copy_failed' })));
                return;
            }
            if (action === 'embed') {
                setShareEmbedCode(buildEmbedCode());
            }
        },
        [buildEmbedCode, data, getCurrentShareUrl, intl],
    );

    const handleCopyEmbedCode = useCallback(async () => {
        if (!shareEmbedCode) {
            return;
        }
        await navigator.clipboard
            .writeText(shareEmbedCode)
            .then(() => toast.success(intl.formatMessage({ id: 'copied' })))
            .catch(() => toast.error(intl.formatMessage({ id: 'copy_failed' })));
    }, [intl, shareEmbedCode]);

    return {
        shareOpen,
        setShareOpen,
        shareEmbedCode,
        setShareEmbedCode,
        shareShowControls,
        setShareShowControls,
        getCurrentPosterUrl,
        handleShareAction,
        handleCopyEmbedCode,
    };
}
