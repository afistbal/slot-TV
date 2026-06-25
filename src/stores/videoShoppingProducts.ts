import { useEffect } from 'react';
import { create } from 'zustand';
import { api } from '@/api';
import type { VideoPaywallProduct } from '@/components/video-paywall/videoPaywallPromoTypes';
import { useRootStore } from '@/stores/root';

type VideoShoppingProductsState = {
    products: VideoPaywallProduct[];
    /** 是否已发起并完成首次请求（成功或失败只请求一次） */
    ready: boolean;
    loading: boolean;
    fetchOnce: () => Promise<VideoPaywallProduct[]>;
};

let inflight: Promise<VideoPaywallProduct[]> | null = null;

function runProductFetch(): Promise<VideoPaywallProduct[]> {
    if (inflight) {
        return inflight;
    }
    if (!localStorage.getItem('token')?.trim()) {
        useVideoShoppingProductsStore.setState({ products: [], ready: true, loading: false });
        return Promise.resolve([]);
    }

    useVideoShoppingProductsStore.setState({ loading: true });
    inflight = api<VideoPaywallProduct[]>('product', {
        data: { from: 'video', type: 10 },
        loading: false,
        toastOnError: false,
    })
        .then((res) => {
            const products = res.c === 0 && Array.isArray(res.d) ? res.d : [];
            useVideoShoppingProductsStore.setState({ products, ready: true, loading: false });
            return products;
        })
        .catch(() => {
            useVideoShoppingProductsStore.setState({ ready: true, loading: false });
            return useVideoShoppingProductsStore.getState().products;
        })
        .finally(() => {
            inflight = null;
        });

    return inflight;
}

export const useVideoShoppingProductsStore = create<VideoShoppingProductsState>((set, get) => ({
    products: [],
    ready: false,
    loading: false,
    fetchOnce: async () => {
        const state = get();
        if (state.ready) {
            return state.products;
        }
        return runProductFetch();
    },
}));

/** 登出 / 换会话后：清空并重新拉 video 商品（仅拉一次） */
export function refreshVideoShoppingProductsAfterSessionChange(): void {
    inflight = null;
    useVideoShoppingProductsStore.setState({ products: [], ready: false, loading: false });
    if (localStorage.getItem('token')?.trim()) {
        void useVideoShoppingProductsStore.getState().fetchOnce();
    }
}

/** 登出失败等：仅清空，等待下次预拉 */
export function resetVideoShoppingProducts(): void {
    inflight = null;
    useVideoShoppingProductsStore.setState({ products: [], ready: false, loading: false });
}

/** foryou / video 页进入后预拉商品，弹窗展开时直接读 store */
export function usePrefetchVideoShoppingProducts(): void {
    const sessionBootstrapReady = useRootStore((s) => s.sessionBootstrapReady);
    const ready = useVideoShoppingProductsStore((s) => s.ready);
    const loading = useVideoShoppingProductsStore((s) => s.loading);

    useEffect(() => {
        if (!sessionBootstrapReady || ready || loading) {
            return;
        }
        void useVideoShoppingProductsStore.getState().fetchOnce();
    }, [sessionBootstrapReady, ready, loading]);
}

export function getVideoShoppingProductsFromStore(): VideoPaywallProduct[] {
    return useVideoShoppingProductsStore.getState().products;
}

export function isVideoShoppingProductsReady(): boolean {
    return useVideoShoppingProductsStore.getState().ready;
}
