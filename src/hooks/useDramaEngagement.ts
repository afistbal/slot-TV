import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { submitLuckyRating, toggleDramaLike } from '@/api/lucky';
import { useRequireAccount } from '@/hooks/useRequireAccount';

export function useDramaEngagement({
    dramaId,
    initialLiked = false,
    initialLikeCount = 0,
    initialRatingScore = 0,
}: {
    dramaId: number;
    initialLiked?: boolean;
    initialLikeCount?: number;
    initialRatingScore?: number;
}) {
    const requireAccount = useRequireAccount();
    const [likes, setLikes] = useState<Record<number, { liked: boolean; count: number }>>({});
    const [ratings, setRatings] = useState<Record<number, number>>({});
    const [ratingOpen, setRatingOpen] = useState(false);
    const [ratingSubmitting, setRatingSubmitting] = useState(false);
    const likePendingRef = useRef(new Set<number>());
    const fallbackLiked = initialLiked === true;
    const fallbackLikeCount = Math.max(0, Number(initialLikeCount) || 0);
    const likeState = likes[dramaId] ?? { liked: fallbackLiked, count: fallbackLikeCount };
    const ratingScore = ratings[dramaId] ?? Math.max(0, Number(initialRatingScore) || 0);

    const handleToggleLike = useCallback(async () => {
        if (!requireAccount()) return;
        if (likePendingRef.current.has(dramaId)) return;
        likePendingRef.current.add(dramaId);
        const previous = likes[dramaId] ?? { liked: fallbackLiked, count: fallbackLikeCount };
        const optimistic = {
            liked: !previous.liked,
            count: Math.max(0, previous.count + (previous.liked ? -1 : 1)),
        };
        setLikes((state) => ({ ...state, [dramaId]: optimistic }));
        try {
            const result = await toggleDramaLike(dramaId);
            setLikes((state) => ({
                ...state,
                [dramaId]: {
                    liked: result.liked ?? optimistic.liked,
                    count: result.count ?? optimistic.count,
                },
            }));
        } catch (reason) {
            setLikes((state) => ({ ...state, [dramaId]: previous }));
            toast.error(reason instanceof Error ? reason.message : '点赞失败');
        } finally {
            likePendingRef.current.delete(dramaId);
        }
    }, [dramaId, fallbackLikeCount, fallbackLiked, likes, requireAccount]);

    const handleSubmitRating = useCallback(async (score: number) => {
        if (!requireAccount()) return;
        if (ratingSubmitting || ratingScore > 0) return;
        setRatingSubmitting(true);
        try {
            const coins = await submitLuckyRating(String(dramaId), score);
            setRatings((state) => ({ ...state, [dramaId]: score }));
            setRatingOpen(false);
            toast.success(coins ? `评分成功，获得 ${coins} 金币` : '评分成功');
        } catch (reason) {
            toast.error(reason instanceof Error ? reason.message : '评分失败');
        } finally {
            setRatingSubmitting(false);
        }
    }, [dramaId, ratingScore, ratingSubmitting, requireAccount]);

    const setProtectedRatingOpen = useCallback((next: boolean) => {
        if (next && !requireAccount()) return;
        setRatingOpen(next);
    }, [requireAccount]);

    return {
        ...likeState,
        ratingScore,
        ratingOpen,
        setRatingOpen: setProtectedRatingOpen,
        ratingSubmitting,
        handleToggleLike,
        handleSubmitRating,
    };
}
