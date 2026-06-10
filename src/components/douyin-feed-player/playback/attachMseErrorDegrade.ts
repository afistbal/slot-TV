/**
 * MSE 网络/CORS 失败时立即降级 native，对标 player-9 _startDegradedPlayback
 */
import type Player from 'xgplayer';

export function attachMseErrorDegrade(
    player: Player,
    onDegradeToNative: (currentTime: number) => void,
): () => void {
    const onError = () => {
        const video = player.video as HTMLVideoElement | undefined;
        onDegradeToNative(video?.currentTime ?? 0);
    };

    player.on('error', onError);

    return () => {
        player.off('error', onError);
    };
}
