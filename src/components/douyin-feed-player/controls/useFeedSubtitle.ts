import { useCallback, useEffect, useRef, useState } from 'react';

import type Player from 'xgplayer';

import { loadFeedSubtitleCues, type FeedSubtitleLoadResult } from '../media/loadFeedSubtitleCues';

export type FeedSubtitleState = {
    text: string;
    /** 无 subtitle 路径 */
    idle: boolean;
    loading: boolean;
    /** fetch + parse 成功 */
    ready: boolean;
    error: string | null;
    cueCount: number;
};

function cueIndexAtTime(cues: VTTCue[], time: number): number {
    for (let i = 0; i < cues.length; i++) {
        const c = cues[i];
        if (time >= c.startTime && time <= c.endTime && c.text.trim() !== '') {
            return i;
        }
    }
    return -1;
}

function cueTextAtIndex(cues: VTTCue[], index: number): string {
    if (index < 0 || index >= cues.length) {
        return '';
    }
    return cues[index].text.replace(/<[^>]*>?/gm, '');
}

const INITIAL: FeedSubtitleState = {
    text: '',
    idle: true,
    loading: false,
    ready: false,
    error: null,
    cueCount: 0,
};

export function useFeedSubtitle(player: Player | null, subtitleUrl?: string): FeedSubtitleState {
    const [state, setState] = useState<FeedSubtitleState>(INITIAL);
    const cuesRef = useRef<VTTCue[]>([]);
    const loadGenRef = useRef(0);

    const syncFromVideo = useCallback(() => {
        const video = player?.video as HTMLVideoElement | undefined;
        if (!video || cuesRef.current.length === 0) {
            setState((prev) => (prev.text === '' ? prev : { ...prev, text: '' }));
            return;
        }
        const idx = cueIndexAtTime(cuesRef.current, video.currentTime);
        const text = cueTextAtIndex(cuesRef.current, idx);
        setState((prev) => (prev.text === text ? prev : { ...prev, text }));
    }, [player]);

    useEffect(() => {
        const url = subtitleUrl?.trim();
        const gen = ++loadGenRef.current;
        cuesRef.current = [];

        if (!url) {
            setState(INITIAL);
            return;
        }

        setState({
            text: '',
            idle: false,
            loading: true,
            ready: false,
            error: null,
            cueCount: 0,
        });

        void loadFeedSubtitleCues(url).then((result: FeedSubtitleLoadResult) => {
            if (gen !== loadGenRef.current) {
                return;
            }
            if (!result.ok) {
                setState({
                    text: '',
                    idle: false,
                    loading: false,
                    ready: false,
                    error: result.error,
                    cueCount: 0,
                });
                return;
            }
            cuesRef.current = result.cues;
            setState({
                text: '',
                idle: false,
                loading: false,
                ready: true,
                error: null,
                cueCount: result.cues.length,
            });
            syncFromVideo();
        });
    }, [subtitleUrl, syncFromVideo]);

    useEffect(() => {
        if (!player || !subtitleUrl?.trim()) {
            return;
        }

        const events = ['timeupdate', 'seeked', 'playing'] as const;
        player.on('timeupdate', syncFromVideo);

        const video = player.video as HTMLVideoElement | undefined;
        for (const ev of events) {
            video?.addEventListener(ev, syncFromVideo);
        }

        syncFromVideo();

        return () => {
            player.off('timeupdate', syncFromVideo);
            for (const ev of events) {
                video?.removeEventListener(ev, syncFromVideo);
            }
        };
    }, [player, subtitleUrl, syncFromVideo]);

    return state;
}
