import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useIntl } from 'react-intl';
import type { IPlayerData } from '@/types/videoPlayer';
import { buildVideoShareEmbedCode, resolveVideoSharePageUrl } from './videoPlayerShareUrl';
import type { ShareAction } from './videoPlayerConstants';

const DESKTOP_SHARE_QUERY = '(min-width: 1040px)';

function isDesktopShareSurface(): boolean {
    return typeof window !== 'undefined' && window.matchMedia(DESKTOP_SHARE_QUERY).matches;
}

function buildFacebookShareUrl(pageUrl: string, desktop: boolean): string {
    const fbUrl = new URL(
        desktop
            ? 'https://www.facebook.com/sharer/sharer.php'
            : 'https://mbasic.facebook.com/sharer.php',
    );
    fbUrl.searchParams.set('u', pageUrl);
    return fbUrl.toString();
}

/** 分享链接/嵌入码；弹窗预览图由 `VideoPlayer` 传入剧封 `info.image`（拼接 static） */
export function useVideoPlayerShare(data: IPlayerData, _staticBase: string, currentEpisode?: number) {
    const intl = useIntl();
    const [shareOpen, setShareOpen] = useState(false);
    const [shareEmbedCode, setShareEmbedCode] = useState('');
    const [shareShowControls, setShareShowControls] = useState(true);

    const getCurrentShareUrl = useCallback(
        () => resolveVideoSharePageUrl(data.info.id, currentEpisode),
        [currentEpisode, data.info.id],
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
                const desktop = isDesktopShareSurface();
                const fbShareUrl = buildFacebookShareUrl(url, desktop);
                if (!desktop) {
                    window.location.href = fbShareUrl;
                    return;
                }
                window.open(
                    fbShareUrl,
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
        handleShareAction,
        handleCopyEmbedCode,
    };
}
