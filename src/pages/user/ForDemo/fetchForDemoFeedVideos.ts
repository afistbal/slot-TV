/**
 * for-demo 实验页：仅此文件负责请求后端 `POST /api/foryou`（路径 key: `foryou`）。
 *
 * 与 slot_old 的 /for-you 页面、ForYouPage 目录、旧播放器逻辑 **无任何依赖关系**。
 * 实验壳子只把返回的 mp4 地址交给 douyin-feed-player。
 */
import { api } from '@/api';
import type { DouyinFeedVideoItem } from '@/components/douyin-feed-player';

import { ensureForDemoBootstrap } from './forDemoBootstrap';

const FOR_DEMO_FORYOU_API = 'foryou';

export async function fetchForDemoFeedVideos(): Promise<
    | { ok: true; items: DouyinFeedVideoItem[] }
    | { ok: false; message: string }
> {
    try {
        await ensureForDemoBootstrap();
    } catch (e) {
        const message = e instanceof Error ? e.message : 'bootstrap failed';
        return { ok: false, message };
    }

    const result = await api<{ data?: unknown[] }>(FOR_DEMO_FORYOU_API, {
        loading: false,
    });

    if (result.c !== 0) {
        return { ok: false, message: result.m || 'unknown error' };
    }

    const rows = Array.isArray(result.d?.data) ? result.d.data : [];
    const items: DouyinFeedVideoItem[] = [];

    for (const row of rows) {
        if (row == null || typeof row !== 'object') continue;
        const bag = row as Record<string, unknown>;
        const url = String(bag['video'] ?? '').trim();
        if (!url) continue;
        const id = bag['ep_id'] ?? bag['id'] ?? items.length;
        items.push({ id: id as string | number, url });
    }

    return { ok: true, items };
}
