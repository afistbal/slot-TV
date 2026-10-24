import { useEffect, useRef } from 'react';

import { getFeedPlayerById } from '@/components/douyin-feed-player';

const MAX_ATTACH_ATTEMPTS = 300;

type CaptureStreamVideo = HTMLVideoElement & {
    captureStream?: () => MediaStream;
    webkitCaptureStream?: () => MediaStream;
};

export type VideoPlayerAmbientLayerProps = {
    active: boolean;
    playerItemId: string | number;
};

/**
 * Audio-reactive atmosphere overlay. Browsers that cannot expose a media stream
 * keep the same visual treatment with a gentle timed pulse, without touching
 * the player's audio routing.
 */
export function VideoPlayerAmbientLayer({
    active,
    playerItemId,
}: VideoPlayerAmbientLayerProps) {
    const glowRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!active || !playerItemId) {
            return;
        }

        const glow = glowRef.current;
        if (!glow) {
            return;
        }

        let disposed = false;
        let drawFrame = 0;
        let attachFrame = 0;
        let attachAttempts = 0;
        let audioContext: AudioContext | null = null;
        let analyser: AnalyserNode | null = null;
        let mediaSource: MediaStreamAudioSourceNode | null = null;
        let frequencyData: Uint8Array<ArrayBuffer> | null = null;
        let attachedVideo: HTMLVideoElement | null = null;
        let reducedMotion = false;

        const draw = (time: number) => {
            if (disposed) {
                return;
            }

            let bass = 0;
            let energy = 0;
            if (analyser && frequencyData) {
                analyser.getByteFrequencyData(frequencyData);
                const bassBins = Math.min(8, frequencyData.length);
                for (let index = 0; index < bassBins; index += 1) {
                    bass += frequencyData[index] ?? 0;
                }
                bass /= Math.max(1, bassBins * 255);
                for (let index = 0; index < frequencyData.length; index += 1) {
                    energy += frequencyData[index] ?? 0;
                }
                energy /= Math.max(1, frequencyData.length * 255);
            } else {
                bass = 0.28 + Math.sin(time * 0.0018) * 0.1;
                energy = 0.22 + Math.sin(time * 0.0012 + 0.8) * 0.08;
            }

            const strength = reducedMotion ? 0.22 : Math.min(1, 0.2 + bass * 0.9 + energy * 0.45);
            glow.style.opacity = String(Math.min(0.72, 0.18 + strength * 0.44));
            glow.style.transform = `scale(${1 + (reducedMotion ? 0 : bass * 0.035)})`;
            drawFrame = requestAnimationFrame(draw);
        };

        const startAnalysis = async (video: HTMLVideoElement) => {
            if (disposed || analyser || attachedVideo !== video) {
                return;
            }
            const captureVideo = video as CaptureStreamVideo;
            const capture = captureVideo.captureStream ?? captureVideo.webkitCaptureStream;
            if (!capture) {
                return;
            }
            try {
                const stream = capture.call(video);
                if (stream.getAudioTracks().length === 0) {
                    return;
                }
                const AudioContextCtor = window.AudioContext;
                audioContext = new AudioContextCtor();
                mediaSource = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.82;
                mediaSource.connect(analyser);
                frequencyData = new Uint8Array(analyser.frequencyBinCount);
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
            } catch {
                analyser = null;
                mediaSource = null;
                frequencyData = null;
                if (audioContext) {
                    void audioContext.close().catch(() => undefined);
                    audioContext = null;
                }
            }
        };

        const attachVideo = (video: HTMLVideoElement) => {
            attachedVideo = video;
            const tryStart = () => void startAnalysis(video);
            video.addEventListener('playing', tryStart);
            video.addEventListener('loadedmetadata', tryStart);
            tryStart();
            return () => {
                video.removeEventListener('playing', tryStart);
                video.removeEventListener('loadedmetadata', tryStart);
            };
        };

        let detachVideo: () => void = () => undefined;
        const tryAttach = () => {
            if (disposed) {
                return;
            }
            const player = getFeedPlayerById(playerItemId);
            const video = player?.video;
            if (video instanceof HTMLVideoElement) {
                detachVideo = attachVideo(video);
                return;
            }
            if (attachAttempts < MAX_ATTACH_ATTEMPTS) {
                attachAttempts += 1;
                attachFrame = requestAnimationFrame(tryAttach);
            }
        };

        reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
        tryAttach();
        drawFrame = requestAnimationFrame(draw);

        return () => {
            disposed = true;
            cancelAnimationFrame(drawFrame);
            cancelAnimationFrame(attachFrame);
            detachVideo();
            mediaSource?.disconnect();
            analyser?.disconnect();
            if (audioContext) {
                void audioContext.close().catch(() => undefined);
            }
        };
    }, [active, playerItemId]);

    if (!active) {
        return null;
    }

    return (
        <div
            className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
            aria-hidden="true"
        >
            <div
                ref={glowRef}
                className="absolute -inset-[6%] origin-center transition-opacity duration-200"
                style={{
                    background:
                        'radial-gradient(circle at 50% 48%, transparent 24%, rgba(232,194,104,0.08) 55%, rgba(232,194,104,0.48) 100%)',
                    boxShadow: 'inset 0 0 54px rgba(232, 194, 104, 0.35)',
                    mixBlendMode: 'screen',
                    opacity: 0.25,
                }}
            />
        </div>
    );
}
