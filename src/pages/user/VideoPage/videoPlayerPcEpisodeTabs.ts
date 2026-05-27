/** PC 侧栏分集：每页最多 50 集 */
export function buildPcEpisodeTabRanges(maxEpisode: number): { start: number; end: number }[] {
    if (maxEpisode < 1) {
        return [{ start: 1, end: 1 }];
    }
    return Array.from({ length: Math.ceil(maxEpisode / 50) }, (_, i) => {
        const start = i * 50 + 1;
        const end = Math.min(start + 49, maxEpisode);
        return { start, end };
    });
}

export function pcEpisodeTabIndexForEpisodeNo(
    episodeNo: number,
    ranges: { start: number; end: number }[],
): number {
    const i = ranges.findIndex((r) => episodeNo >= r.start && episodeNo <= r.end);
    return i >= 0 ? i : 0;
}
