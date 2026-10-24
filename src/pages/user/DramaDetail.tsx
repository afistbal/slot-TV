import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
    Bookmark,
    Check,
    ChevronRight,
    Clock3,
    Eye,
    Loader2,
    LockKeyhole,
    Play,
    Share2,
    Star,
    ThumbsUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { api, type IPagination, type TData } from '@/api';
import { submitLuckyRating, toggleDramaLike } from '@/api/lucky';
import { ReelShortFooter } from '@/components/ReelShortFooter';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import { VideoPlayerRatingDialog } from '@/components/video-player';
import { buildVDemoPath } from '@/constants/vDemoRoute';
import { skipRemoteApi } from '@/env';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { movieCoverUrl } from '@/lib/movieCoverUrl';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { openSharePoster } from '@/stores/sharePoster';
import { isOpaqueTagId } from '@/lib/isOpaqueTagId';
import { buildDramaShareUrl } from '@/lib/shareUrls';
import { resolveMovieTagLocalLabel } from '@/lib/movieTagLabels';
import { cn } from '@/lib/utils';
import { fetchVDemoMovieInfo, type VDemoPlayerData } from '@/pages/user/VDemo/fetchVDemoMovieInfo';
import { useConfigStore } from '@/stores/config';
import { useForyouFeedStore } from '@/stores/foryouFeed';
import { useRootStore } from '@/stores/root';
import { useUserStore } from '@/stores/user';
import {
    resolveVideoFavorite,
    setVideoFavoriteOverride,
} from '@/stores/videoFavorite';

import '@/styles/drama-detail.scss';

type UnknownRecord = Record<string, unknown>;

type RelatedDrama = {
    id: number;
    title: string;
    image: string;
    is_rename?: number | string;
};

function toRecord(value: unknown): UnknownRecord {
    return value != null && typeof value === 'object' && !Array.isArray(value)
        ? value as UnknownRecord
        : {};
}

function readCount(record: UnknownRecord, keys: string[]): number {
    for (const key of keys) {
        const value = Number(record[key]);
        if (Number.isFinite(value) && value >= 0) return value;
    }
    return 0;
}

function readBoolean(record: UnknownRecord, keys: string[]): boolean {
    for (const key of keys) {
        const value = record[key];
        if (value === true || value === 1 || value === '1') return true;
        if (value === false || value === 0 || value === '0') return false;
    }
    return false;
}

function compactCount(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}K`;
    return String(Math.max(0, value));
}

function relatedDrama(row: TData): RelatedDrama | null {
    const id = Number(row.id ?? row.movie_id);
    if (!Number.isFinite(id) || id <= 0) return null;
    return {
        id,
        title: String(row.title ?? row.book_title ?? row.name ?? ''),
        image: String(row.image ?? row.cover ?? row.poster ?? ''),
        is_rename: row.is_rename as number | string | undefined,
    };
}

export default function DramaDetail() {
    const params = useParams();
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);
    const sessionBootstrapReady = useRootStore((state) => state.sessionBootstrapReady);
    const staticBase = useConfigStore((state) => String(state.config.static ?? ''));
    const isDesktop = useMinWidth768();
    const requireAccount = useRequireAccount();
    const referralCode = useUserStore((state) => getUserUidForDisplay(state.info));
    const movieId = Number(params.id);

    const [data, setData] = useState<VDemoPlayerData | null>(null);
    const [related, setRelated] = useState<RelatedDrama[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [favorite, setFavorite] = useState(false);
    const [favoriteCount, setFavoriteCount] = useState(0);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [likePending, setLikePending] = useState(false);
    const [ratingOpen, setRatingOpen] = useState(false);
    const [ratingScore, setRatingScore] = useState(0);
    const [ratingSubmitting, setRatingSubmitting] = useState(false);

    useEffect(() => {
        useRootStore.getState().setTheme('dark');
        return () => useRootStore.getState().setTheme('light');
    }, []);

    useEffect(() => {
        if (!sessionBootstrapReady) return;
        if (!Number.isFinite(movieId) || movieId <= 0) {
            setLoading(false);
            setError('剧集不存在');
            return;
        }
        let cancelled = false;
        setLoading(true);
        setError('');
        setData(null);
        setRelated([]);
        void fetchVDemoMovieInfo(movieId)
            .then((result) => {
                if (cancelled) return;
                if (!result.ok) {
                    setError(result.message || '详情加载失败');
                    return;
                }
                const next = result.data;
                const rawInfo = toRecord(next.info);
                setData(next);
                setFavorite(resolveVideoFavorite(next.info.id, next.info.is_favorite === 1));
                setFavoriteCount(Math.max(0, Number(next.info.favorite ?? 0)));
                setLiked(readBoolean(rawInfo, ['is_like', 'liked', 'isLike']));
                setLikeCount(readCount(rawInfo, ['like', 'likes', 'like_count', 'likeCount']));
                setRatingScore(readCount(rawInfo, ['my_rating', 'myRating']));
            })
            .catch((reason: unknown) => {
                if (!cancelled) setError(reason instanceof Error ? reason.message : '详情加载失败');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        if (!skipRemoteApi) {
            void api<IPagination>('movie', { loading: false, data: { page: 1 } })
                .then((result) => {
                    if (cancelled) return;
                    setRelated((result.d?.data ?? [])
                        .map((row) => relatedDrama(row as TData))
                        .filter((row): row is RelatedDrama => row != null && row.id !== movieId)
                        .slice(0, 8));
                })
                .catch(() => undefined);
        }
        return () => {
            cancelled = true;
        };
    }, [movieId, sessionBootstrapReady]);

    const rawInfo = useMemo(() => toRecord(data?.info), [data?.info]);
    const coverUrl = useMemo(
        () => data ? movieCoverUrl(data.info, staticBase, { fallbackId: data.info.id }) ?? '' : '',
        [data, staticBase],
    );
    const tags = useMemo(
        () => [...new Set((data?.tags ?? []).map((tag) => resolveMovieTagLocalLabel(tag) ?? tag.local_label ?? tag.name).filter((tag): tag is string => Boolean(tag?.trim()) && !isOpaqueTagId(String(tag))))],
        [data?.tags],
    );
    const firstEpisode = data?.episodes[0]?.episode ?? 1;
    const resumeEpisode = Math.max(1, Number(data?.info.play ?? firstEpisode));
    const views = readCount(rawInfo, ['views', 'play_count', 'view_count', 'plays']);
    const durationMinutes = readCount(rawInfo, ['duration_minutes', 'durationMinutes', 'minutes']);
    const freeEpisodes = data?.episodes.filter((episode) => Number(episode.locked) !== 1 && Number(episode.vip) !== 1).length ?? 0;

    const handleToggleFavorite = useCallback(async () => {
        if (!requireAccount()) return;
        if (!data) return;
        const previous = favorite;
        const next = !previous;
        setFavorite(next);
        setFavoriteCount((count) => Math.max(0, count + (next ? 1 : -1)));
        setVideoFavoriteOverride(data.info.id, next);
        useForyouFeedStore.getState().patchFavorite(data.info.id, next);
        if (skipRemoteApi) return;
        try {
            const result = await api('movie/favorite', {
                method: 'post',
                data: { id: data.info.id },
                loading: false,
            });
            if (result.c !== 0) throw new Error(result.m || '收藏失败');
            toast.success(next ? '已收藏' : '已取消收藏');
        } catch (reason) {
            setFavorite(previous);
            setFavoriteCount((count) => Math.max(0, count + (next ? -1 : 1)));
            setVideoFavoriteOverride(data.info.id, previous);
            useForyouFeedStore.getState().patchFavorite(data.info.id, previous);
            toast.error(reason instanceof Error ? reason.message : '收藏失败');
        }
    }, [data, favorite, requireAccount]);

    const handleToggleLike = useCallback(async () => {
        if (!requireAccount()) return;
        if (!data || likePending) return;
        const previous = { liked, count: likeCount };
        const optimistic = {
            liked: !liked,
            count: Math.max(0, likeCount + (liked ? -1 : 1)),
        };
        setLikePending(true);
        setLiked(optimistic.liked);
        setLikeCount(optimistic.count);
        try {
            const result = await toggleDramaLike(data.info.id);
            setLiked(result.liked ?? optimistic.liked);
            setLikeCount(result.count ?? optimistic.count);
        } catch (reason) {
            setLiked(previous.liked);
            setLikeCount(previous.count);
            toast.error(reason instanceof Error ? reason.message : '点赞失败');
        } finally {
            setLikePending(false);
        }
    }, [data, likeCount, likePending, liked, requireAccount]);

    const handleSubmitRating = useCallback(async (score: number) => {
        if (!requireAccount()) return;
        if (!data || ratingSubmitting || ratingScore > 0) return;
        setRatingSubmitting(true);
        try {
            const coins = await submitLuckyRating(String(data.info.id), score);
            setRatingScore(score);
            setRatingOpen(false);
            toast.success(coins ? `评分成功，获得 ${coins} 金币` : '评分成功');
        } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : '评分失败');
        } finally {
            setRatingSubmitting(false);
        }
    }, [data, ratingScore, ratingSubmitting, requireAccount]);

    const handleShare = useCallback(() => {
        if (!requireAccount()) return;
        openSharePoster({ url: buildDramaShareUrl(movieId, referralCode), title: data?.info.title ?? '', coverUrl, reward: true });
    }, [movieId, data?.info.title, coverUrl, referralCode, requireAccount]);

    if (loading) {
        return (
            <div className="drama-detail drama-detail--state">
                <Loader2 className="drama-detail__loader" aria-hidden />
                <span>正在加载详情</span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="drama-detail drama-detail--state">
                <p>{error || '剧集不存在'}</p>
                <button type="button" className="drama-detail__ghost-btn" onClick={() => navigate(-1)}>返回</button>
            </div>
        );
    }

    return (
        <div className="drama-detail">
            <div className="drama-detail__scroll" ref={scrollRef}>
                <ReelShortTopNav scrollParentRef={scrollRef} showPrimaryNav />
                <main className="drama-detail__main">
                    <section className="drama-detail__hero">
                        {coverUrl ? <div className="drama-detail__hero-bg" style={{ backgroundImage: `url(${coverUrl})` }} aria-hidden /> : null}
                        <div className="drama-detail__hero-shade" aria-hidden />
                        <div className="drama-detail__hero-content">
                            <div className="drama-detail__poster-wrap">
                                {coverUrl ? <img className="drama-detail__poster" src={coverUrl} alt={data.info.title} /> : <div className="drama-detail__poster drama-detail__poster--empty" />}
                            </div>
                            <div className="drama-detail__info">
                                <h1>{data.info.title}</h1>
                                {tags.length ? (
                                    <div className="drama-detail__tags">
                                        {tags.map((tag) => <span key={tag}>#{tag}</span>)}
                                    </div>
                                ) : null}
                                <div className="drama-detail__stats">
                                    {views > 0 ? <span><Eye aria-hidden />{compactCount(views)}</span> : null}
                                    <span><ThumbsUp aria-hidden />{compactCount(likeCount)}</span>
                                    <span><Bookmark aria-hidden />{compactCount(favoriteCount)}</span>
                                    <span><Clock3 aria-hidden />{durationMinutes > 0 ? `${durationMinutes} 分钟` : `${data.episodes.length} 集`}</span>
                                    {ratingScore > 0 ? <span className="is-gold"><Star aria-hidden fill="currentColor" />{ratingScore}.0</span> : null}
                                </div>
                                <p className="drama-detail__intro">{data.info.introduction || '暂无简介'}</p>
                                <div className="drama-detail__chips">
                                    {freeEpisodes > 0 ? <span className="is-free">前 {freeEpisodes} 集免费</span> : null}
                                </div>
                                <div className="drama-detail__actions">
                                    <Link className="drama-detail__play-btn" to={buildVDemoPath(data.info.id, resumeEpisode)}>
                                        <Play aria-hidden fill="currentColor" />
                                        {resumeEpisode > firstEpisode ? `继续观看 第 ${resumeEpisode} 集` : '立即播放'}
                                    </Link>
                                    <button type="button" className={cn('drama-detail__action-btn', liked && 'is-liked')} disabled={likePending} onClick={() => void handleToggleLike()}>
                                        <ThumbsUp aria-hidden fill={liked ? 'currentColor' : 'none'} />
                                        {liked ? '已点赞' : '点赞'}
                                    </button>
                                    <button type="button" className={cn('drama-detail__action-btn', favorite && 'is-favorite')} onClick={() => void handleToggleFavorite()}>
                                        <Bookmark aria-hidden fill={favorite ? 'currentColor' : 'none'} />
                                        {favorite ? '已收藏' : '收藏'}
                                    </button>
                                    <button type="button" className={cn('drama-detail__action-btn', ratingScore > 0 && 'is-rated')} onClick={() => {
                                        if (requireAccount()) setRatingOpen(true);
                                    }}>
                                        <Star aria-hidden fill={ratingScore > 0 ? 'currentColor' : 'none'} />
                                        {ratingScore > 0 ? `${ratingScore} 分` : '打分'}
                                    </button>
                                    <button type="button" className="drama-detail__action-btn" onClick={() => void handleShare()}>
                                        <Share2 aria-hidden />分享
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="drama-detail__section">
                        <div className="drama-detail__section-head">
                            <div>
                                <h2>选集</h2>
                                <p>共 {data.episodes.length} 集</p>
                            </div>
                        </div>
                        <div className="drama-detail__episodes">
                            {data.episodes.map((episode) => {
                                const locked = Number(episode.locked) === 1;
                                const vip = Number(episode.vip) === 1;
                                return (
                                    <Link
                                        key={episode.id}
                                        className={cn('drama-detail__episode', !locked && 'is-open')}
                                        to={buildVDemoPath(data.info.id, episode.episode)}
                                        aria-label={`第 ${episode.episode} 集`}
                                    >
                                        <strong>{episode.episode}</strong>
                                        {locked ? <LockKeyhole aria-hidden /> : vip ? <span className="drama-detail__vip">VIP</span> : <Check aria-hidden />}
                                    </Link>
                                );
                            })}
                        </div>
                    </section>

                    {related.length ? (
                        <section className="drama-detail__section drama-detail__related-section">
                            <div className="drama-detail__section-head"><h2>你可能也喜欢</h2></div>
                            <div className="drama-detail__related">
                                {related.map((item) => {
                                    const image = movieCoverUrl(item, staticBase) ?? '';
                                    return (
                                        <Link key={item.id} className="drama-detail__related-card" to={`/drama/${item.id}`}>
                                            <div className="drama-detail__related-cover">
                                                {image ? <img src={image} alt="" loading="lazy" /> : null}
                                                <span><Play aria-hidden fill="currentColor" /></span>
                                            </div>
                                            <div><strong>{item.title}</strong><ChevronRight aria-hidden /></div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </section>
                    ) : null}
                </main>
                <ReelShortFooter />
            </div>
            <VideoPlayerRatingDialog
                open={ratingOpen}
                title={data.info.title}
                score={ratingScore}
                variant={isDesktop ? 'pc' : 'h5'}
                submitting={ratingSubmitting}
                onOpenChange={setRatingOpen}
                onSubmit={(score) => void handleSubmitRating(score)}
            />
        </div>
    );
}
