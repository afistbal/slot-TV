import type { IPlayerData, IPlayerEpisode } from '@/types/videoPlayer';

export function buildShellEpisodeFromListRow(
    row: IPlayerData['episodes'][number] | undefined,
): IPlayerEpisode | undefined {
    if (!row) {
        return undefined;
    }
    return {
        id: row.id,
        episode: row.episode,
        video: '',
        subtitle: '',
        lock: row.locked === 1,
        unlock_coins: 0,
        can_unlock: false,
    };
}
