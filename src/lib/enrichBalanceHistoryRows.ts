import { api } from '@/api';
import type { IBalanceHistoryRow } from '@/pages/user/WalletTransactionHistory';
import type { IPlayerData } from '@/types/videoPlayer';

type CoinProduct = {
    id: number;
    type: number;
    price: string;
    coin?: number;
    bouns?: string;
};

function totalCoinsForCoinProduct(p: Pick<CoinProduct, 'coin' | 'bouns'>): number {
    const baseCoin = p.coin ?? 0;
    const bonusRate = Number.parseFloat(p.bouns ?? '0');
    const bonusCoins =
        baseCoin > 0 && Number.isFinite(bonusRate) ? Math.round(baseCoin * bonusRate) : 0;
    return baseCoin + bonusCoins;
}

function findCoinProductByTotal(products: CoinProduct[], totalCoins: number): CoinProduct | undefined {
    return products.find((p) => p.type === 2 && totalCoinsForCoinProduct(p) === totalCoins);
}

function bonusCoinsFromProduct(p: CoinProduct): number {
    const base = p.coin ?? 0;
    return Math.max(0, totalCoinsForCoinProduct(p) - base);
}

async function fetchMovieTitles(movieIds: number[]): Promise<Map<number, string>> {
    const titleByMovieId = new Map<number, string>();
    if (movieIds.length === 0) {
        return titleByMovieId;
    }

    await Promise.all(
        movieIds.map(async (id) => {
            const res = await api<IPlayerData>('movie/info', {
                data: { id },
                loading: false,
                toastOnError: false,
            });
            const title = res.c === 0 ? res.d?.info?.title?.trim() : '';
            if (title) {
                titleByMovieId.set(id, title);
            }
        }),
    );

    return titleByMovieId;
}

async function fetchShoppingCoinProducts(): Promise<CoinProduct[]> {
    const res = await api<CoinProduct[]>('product', {
        data: { from: 'shopping', type: 10 },
        loading: false,
        toastOnError: false,
    });
    if (res.c !== 0 || !Array.isArray(res.d)) {
        return [];
    }
    return res.d.filter((p) => p.type === 2);
}

/** 补全 `user/balance/history` 缺失的剧名、充值金额与赠币（接口常只返回 change / movie_id） */
export async function enrichBalanceHistoryRows(
    rows: IBalanceHistoryRow[],
): Promise<IBalanceHistoryRow[]> {
    if (rows.length === 0) {
        return rows;
    }

    const movieIds = [
        ...new Set(
            rows
                .map((r) => r.movie_id)
                .filter((id): id is number => id != null && id > 0),
        ),
    ];

    const needsProductMatch = rows.some((r) => r.type === 1 && r.price == null);

    const [titleByMovieId, coinProducts] = await Promise.all([
        fetchMovieTitles(movieIds),
        needsProductMatch ? fetchShoppingCoinProducts() : Promise.resolve([] as CoinProduct[]),
    ]);

    return rows.map((row) => {
        let next: IBalanceHistoryRow = { ...row };

        if (row.movie_id != null && row.movie_id > 0) {
            const title = titleByMovieId.get(row.movie_id);
            if (title && !next.movie_title?.trim() && !next.movie_name?.trim()) {
                next = { ...next, movie_title: title };
            }
        }

        if (row.type !== 1) {
            return next;
        }

        const totalCoins = Math.abs(row.change);
        const matched = findCoinProductByTotal(coinProducts, totalCoins);

        if (next.price == null && matched?.price) {
            next = { ...next, price: matched.price };
        }

        if ((next.coin == null || next.coin <= 0) && matched?.coin) {
            next = {
                ...next,
                coin: matched.coin,
                bonus: next.bonus ?? bonusCoinsFromProduct(matched),
            };
        }

        return next;
    });
}
