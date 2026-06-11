export type EpisodeTabRange = { start: number; end: number };

export const PC_EPISODE_TAB_PAGE_SIZE = 50;
export const H5_EPISODE_TAB_PAGE_SIZE = 30;

export function buildEpisodeTabRanges(
    maxEpisode: number,
    pageSize: number,
): EpisodeTabRange[] {
    if (maxEpisode < 1) {
        return [{ start: 1, end: 1 }];
    }
    return Array.from({ length: Math.ceil(maxEpisode / pageSize) }, (_, i) => {
        const start = i * pageSize + 1;
        const end = Math.min(start + pageSize - 1, maxEpisode);
        return { start, end };
    });
}

export function episodeTabIndexForEpisodeNo(
    episodeNo: number,
    ranges: EpisodeTabRange[],
): number {
    const i = ranges.findIndex((r) => episodeNo >= r.start && episodeNo <= r.end);
    return i >= 0 ? i : 0;
}

/** PC 侧栏分集：每页最多 50 集 */
export function buildPcEpisodeTabRanges(maxEpisode: number): EpisodeTabRange[] {
    return buildEpisodeTabRanges(maxEpisode, PC_EPISODE_TAB_PAGE_SIZE);
}

export function pcEpisodeTabIndexForEpisodeNo(
    episodeNo: number,
    ranges: EpisodeTabRange[],
): number {
    return episodeTabIndexForEpisodeNo(episodeNo, ranges);
}
