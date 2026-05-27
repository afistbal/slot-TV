/**
 * 剧表封面：`is_rename === 1` 时用 `movie_images/{id}.webp`，否则用 `image`。
 *
 * 适用接口：
 * - `GET home` → `d.top` / `d.recommend[n]` / `d.rank[n]`
 * - `GET movie` → `d.data[n]`
 * - `GET movie/info` → `d.info`
 * - `GET movie/my-list` / `movie/history` → `d.data[n]`（`movie_id` 作剧目 id）
 * - `GET movie/listnew` → `d.data[n]`
 */
export type MovieCoverSource = {
    id?: number | string;
    image?: string | null;
    is_rename?: number | string | boolean;
};

export function readMovieIsRename(record: Record<string, unknown> | undefined): boolean {
    if (!record) {
        return false;
    }
    const v = record.is_rename;
    return v === 1 || v === '1' || v === true;
}

export function normalizeMovieCoverSource(
    record: Record<string, unknown> | MovieCoverSource | null | undefined,
    fallbackId?: number,
): MovieCoverSource | null {
    if (record == null || typeof record !== 'object') {
        return null;
    }
    const r = record as Record<string, unknown>;
    const idRaw = r.id ?? r.movie_id ?? fallbackId;
    const id = Number(idRaw);
    const resolvedId = Number.isFinite(id) && id > 0 ? id : fallbackId;
    if (resolvedId == null || !Number.isFinite(resolvedId) || resolvedId <= 0) {
        return null;
    }
    return {
        id: resolvedId,
        image: r.image != null ? String(r.image) : '',
        is_rename: r.is_rename as MovieCoverSource['is_rename'],
    };
}

export function movieCoverImagePath(
    source: Record<string, unknown> | MovieCoverSource | null | undefined,
    options?: { fallbackId?: number },
): string {
    const row = normalizeMovieCoverSource(source, options?.fallbackId);
    if (!row) {
        return '';
    }
    if (readMovieIsRename(row as Record<string, unknown>)) {
        const id = Number(row.id);
        if (Number.isFinite(id) && id > 0) {
            return `movie_images/${id}.webp`;
        }
    }
    return String(row.image ?? '').trim();
}

export function movieCoverUrl(
    source: Record<string, unknown> | MovieCoverSource | null | undefined,
    staticBase?: string | null,
    options?: { fallbackId?: number },
): string | null {
    const path = movieCoverImagePath(source, options);
    if (!path) {
        return null;
    }
    return joinStaticAssetUrl(path, staticBase);
}

/** `GET movie/info`：封面在 `d.info` */
export function movieCoverUrlFromInfo(
    staticBase: string | null | undefined,
    info: Record<string, unknown> | null | undefined,
    fallbackMovieId?: number,
): string | null {
    return movieCoverUrl(info, staticBase, { fallbackId: fallbackMovieId });
}

function joinStaticAssetUrl(path: string, staticBase?: string | null): string | null {
    const img = String(path ?? '').trim();
    if (!img) {
        return null;
    }
    if (/^https?:\/\//i.test(img)) {
        return img;
    }
    if (img.startsWith('//')) {
        return `https:${img}`;
    }
    const base = String(staticBase ?? '').trim().replace(/\/+$/, '');
    if (!base) {
        return null;
    }
    const normalizedBase = base.startsWith('//') ? `https:${base}` : base;
    return `${normalizedBase}/${img.replace(/^\//, '')}`;
}
