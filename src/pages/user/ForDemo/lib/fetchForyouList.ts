import { api } from '@/api';
import { skipRemoteApi } from '@/env';
import type { IForYouFeedItem, IForYouFeedTag, IForYouListPayload } from '@/types/foryouFeed';
import { normalizePlayerTags } from '@/lib/normalizePlayerTags';
import { resolveVideoFavorite } from '@/stores/videoFavorite';

import { FORYOU_DEFAULT_PER_PAGE } from './foryouConstants';

/** 文档：`GET {{HOST}}/api/foryou` */
export const FORYOU_LIST_API_PATH = 'foryou';

export type ForyouFetchMode = 'initial' | 'refresh' | 'more';

export type FetchForyouListOptions = {
    mode?: ForyouFetchMode;
    page?: number;
    /** 加载更多：当前列表最后一条 ep_id */
    lastEpId?: number;
};

export type FetchForyouListResult =
    | { ok: true; payload: IForYouListPayload }
    | { ok: false; code: number; message: string };

const EMPTY_FORYOU_PAYLOAD: IForYouListPayload = {
    data: [],
    count: 0,
    has_more: false,
};

function normalizeFeedTags(raw: unknown): IForYouFeedTag[] {
    return normalizePlayerTags(raw);
}

function normalizeFeedRow(raw: Record<string, unknown>): IForYouFeedItem {
    const id = Number(raw['id']);
    const epRaw = raw['episode'] ?? raw['ep'];
    const totalRaw =
        raw['total_episodes'] ?? raw['episodes'] ?? raw['total_episode'] ?? raw['episode_count'];
    const isFavor = raw['is_favor'] ?? raw['is_favorite'];
    const resolvedFavorite = resolveVideoFavorite(
        id,
        isFavor === true || isFavor === 1 || isFavor === '1',
    );
    const introRaw = raw['introduction'];
    return {
        id,
        slot: Array.isArray(raw['slot']) ? (raw['slot'] as string[]) : undefined,
        title: String(raw['title'] ?? ''),
        image: String(raw['image'] ?? ''),
        is_rename: raw['is_rename'] as number | string | undefined,
        introduction:
            introRaw != null && String(introRaw).trim()
                ? String(introRaw).replace(/\s+/g, ' ').trim()
                : undefined,
        ep_id: Number(raw['ep_id']),
        episode: epRaw != null && epRaw !== '' ? Number(epRaw) : undefined,
        episodes: totalRaw != null && totalRaw !== '' ? Number(totalRaw) : undefined,
        video: String(raw['video'] ?? ''),
        subtitle: String(raw['subtitle'] ?? ''),
        tags: normalizeFeedTags(raw['tags']),
        is_favor: resolvedFavorite,
        is_favorite: resolvedFavorite ? 1 : 0,
        favor: Number(raw['favor'] ?? raw['favorite'] ?? 0),
    };
}

function normalizePayload(d: unknown): IForYouListPayload {
    if (d == null || typeof d !== 'object') {
        return { ...EMPTY_FORYOU_PAYLOAD };
    }
    const bag = d as Record<string, unknown>;
    const rows = Array.isArray(bag['data']) ? bag['data'] : [];
    const count = Number(bag['count'] ?? rows.length);
    const perPage = Number(bag['per_page'] ?? 0);
    const currentPage = Number(bag['current_page'] ?? 1);
    const hasMoreRaw = bag['has_more'];
    const batchSize = perPage || count || FORYOU_DEFAULT_PER_PAGE;
    /** 满页（如 count=10 且返回 10 条）仍应允许续拉，再请求 /api/foryou 做拼接 */
    const hasMore =
        hasMoreRaw === true ||
        hasMoreRaw === 1 ||
        hasMoreRaw === '1' ||
        (hasMoreRaw !== false &&
            hasMoreRaw !== 0 &&
            hasMoreRaw !== '0' &&
            rows.length > 0 &&
            batchSize > 0 &&
            rows.length >= batchSize);

    return {
        count,
        current_page: currentPage,
        per_page: perPage || undefined,
        has_more: Boolean(hasMore),
        data: rows.map((row) => normalizeFeedRow(row as Record<string, unknown>)),
    };
}

function buildQuery(options?: FetchForyouListOptions): Record<string, unknown> {
    const mode = options?.mode ?? 'initial';
    const query: Record<string, unknown> = {};

    if (mode === 'refresh') {
        query['refresh'] = 1;
        query['page'] = 1;
        return query;
    }

    if (mode === 'more') {
        query['page'] = options?.page ?? 2;
        if (options?.lastEpId != null) {
            query['last_ep_id'] = options.lastEpId;
        }
        return query;
    }

    if (options?.page != null && options.page > 1) {
        query['page'] = options.page;
    }
    return query;
}

export async function fetchForyouList(options?: FetchForyouListOptions): Promise<FetchForyouListResult> {
    if (skipRemoteApi) {
        return { ok: true, payload: { ...EMPTY_FORYOU_PAYLOAD } };
    }

    const query = buildQuery(options);
    const result = await api<IForYouListPayload>(FORYOU_LIST_API_PATH, {
        loading: false,
        data: Object.keys(query).length ? query : undefined,
    });

    if (result.c !== 0) {
        return { ok: false, code: result.c, message: result.m || 'unknown error' };
    }

    return { ok: true, payload: normalizePayload(result.d) };
}
