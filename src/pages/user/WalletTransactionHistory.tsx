import { api } from '@/api';
import Loader from '@/components/Loader';
import NoMore from '@/components/NoMore';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { FormattedDate, FormattedMessage } from 'react-intl';
import coinIcon from '@/assets/coin.svg';
import emptyImg from '@/assets/images/empty.webp';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import iconChevron from '@/assets/images/bbd6ac50-876c-11ee-aed2-cfe3d80f70eb.png';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

export interface IBalanceHistoryRow {
    type: number;
    change: number;
    amount: number;
    target: number;
    created_at: string;
    movie_id?: number | null;
    episode_index?: number | null;
}

type WalletTransactionHistoryProps = {
    variant?: 'pc' | 'h5';
    className?: string;
};

function EpisodeNavigateLink({
    movieId,
    episodeIndex,
}: {
    movieId: number;
    episodeIndex?: number | null;
}) {
    return (
        <Link
            to={`/video/${movieId}/${episodeIndex ?? 0}`}
            state={VIDEO_FROM_HOME_STATE}
            className="rs-wallet-tx__episodeLink"
        >
            <span className="sr-only">
                <FormattedMessage id="view" />
            </span>
            <ChevronRight className="rs-wallet-tx__episodeLinkIcon" aria-hidden />
        </Link>
    );
}

/** H5：整行可点跳转；无剧集（如充值）仅展示不可点 */
function HistoryRow({ row }: { row: IBalanceHistoryRow }) {
    const body = (
        <>
            <div className="rs-wallet-history__main">
                <div className="rs-wallet-history__typeRow">
                    <span className="rs-wallet-history__type">
                        <FormattedMessage id={row.type === 1 ? 'top_up' : 'unlock_episodes'} />
                    </span>
                    {row.movie_id != null ? (
                        <img
                            src={iconChevron}
                            alt=""
                            className="rs-wallet-history__typeChev"
                            aria-hidden
                        />
                    ) : null}
                </div>
                <time className="rs-wallet-history__time" dateTime={row.created_at}>
                    <FormattedDate
                        year="numeric"
                        month="2-digit"
                        day="2-digit"
                        hour="2-digit"
                        minute="2-digit"
                        second="2-digit"
                        value={row.created_at}
                    />
                </time>
            </div>
            <div className="rs-wallet-history__amountCol">
                <div className="rs-wallet-history__amountStack">
                    <div
                        className={cn(
                            'rs-wallet-history__change',
                            row.change > 0
                                ? 'rs-wallet-history__change--plus'
                                : 'rs-wallet-history__change--minus',
                        )}
                    >
                        {row.change > 0 ? '+' : ''}
                        {row.change}
                    </div>
                    <div className="rs-wallet-history__balance">
                        <img src={coinIcon} width={16} height={16} alt="" aria-hidden />
                        <span className="tabular-nums">{row.amount}</span>
                    </div>
                </div>
            </div>
        </>
    );

    if (row.movie_id != null) {
        return (
            <li className="rs-wallet-history__li">
                <Link
                    to={`/video/${row.movie_id}/${row.episode_index ?? 0}`}
                    state={VIDEO_FROM_HOME_STATE}
                    className="rs-wallet-history__item rs-wallet-history__item--link"
                >
                    {body}
                </Link>
            </li>
        );
    }

    return <li className="rs-wallet-history__item">{body}</li>;
}

/** PC：ReelShort 表格；H5：卡片列表（左文案右金额） */
export function WalletTransactionHistory({
    variant = 'h5',
    className,
}: WalletTransactionHistoryProps) {
    const [rows, setRows] = useState<IBalanceHistoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const isPc = variant === 'pc';

    useEffect(() => {
        api<IBalanceHistoryRow[]>('user/balance/history', {
            loading: false,
        }).then((res) => {
            setLoading(false);
            const list = res.c === 0 && Array.isArray(res.d) ? res.d : [];
            setRows(list);
        });
    }, []);

    return (
        <div className={cn('rs-wallet-tx', isPc && 'rs-wallet-tx--pc', className)}>
            <div className="rs-wallet-tx__tabs" role="tablist" aria-label="wallet tabs">
                <div
                    className="rs-wallet-tx__tab rs-wallet-tx__tab--active"
                    role="tab"
                    aria-selected
                >
                    <FormattedMessage id="shopping_bar_history" />
                </div>
            </div>

            <div className="rs-wallet-tx__panel">
                {loading ? (
                    <div className="rs-wallet-tx__loading">
                        <Loader />
                    </div>
                ) : rows.length === 0 ? (
                    <div className="rs-wallet-tx__empty">
                        <img src={emptyImg} alt="" className="rs-wallet-tx__emptyImg" />
                        <p className="rs-wallet-tx__emptyText">
                            <FormattedMessage id="wallet_nothing_inside" />
                        </p>
                    </div>
                ) : isPc ? (
                    <div className="rs-wallet-tx__tableWrap">
                        <div className="rs-wallet-tx__head" aria-hidden>
                            <span>
                                <FormattedMessage id="wallet_col_quantity" />
                            </span>
                            <span>
                                <FormattedMessage id="wallet_col_coins" />
                            </span>
                            <span>
                                <FormattedMessage id="wallet_col_transaction" />
                            </span>
                            <span>
                                <FormattedMessage id="wallet_col_time" />
                            </span>
                        </div>
                        <ul className="rs-wallet-tx__body">
                            {rows.map((row, index) => (
                                <li
                                    key={`${row.created_at}-${row.target}-${index}`}
                                    className="rs-wallet-tx__row"
                                >
                                    <span
                                        className={cn(
                                            'rs-wallet-tx__cell rs-wallet-tx__cell--qty tabular-nums',
                                            row.change > 0
                                                ? 'rs-wallet-tx__change--plus'
                                                : 'rs-wallet-tx__change--minus',
                                        )}
                                    >
                                        {row.change > 0 ? '+' : ''}
                                        {row.change}
                                    </span>
                                    <span className="rs-wallet-tx__cell rs-wallet-tx__cell--coins">
                                        <img src={coinIcon} width={16} height={16} alt="" aria-hidden />
                                        <span className="tabular-nums">{row.amount}</span>
                                    </span>
                                    <span className="rs-wallet-tx__cell rs-wallet-tx__cell--type">
                                        <FormattedMessage
                                            id={row.type === 1 ? 'top_up' : 'unlock_episodes'}
                                        />
                                        {row.movie_id != null ? (
                                            <EpisodeNavigateLink
                                                movieId={row.movie_id}
                                                episodeIndex={row.episode_index}
                                            />
                                        ) : null}
                                    </span>
                                    <time
                                        className="rs-wallet-tx__cell rs-wallet-tx__cell--time"
                                        dateTime={row.created_at}
                                    >
                                        <FormattedDate
                                            year="numeric"
                                            month="2-digit"
                                            day="2-digit"
                                            hour="2-digit"
                                            minute="2-digit"
                                            second="2-digit"
                                            value={row.created_at}
                                        />
                                    </time>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : (
                    <div className="rs-wallet-tx__listWrap">
                        <ul className="rs-wallet-history">
                            {rows.map((row, index) => (
                                <HistoryRow
                                    key={`${row.created_at}-${row.target}-${index}`}
                                    row={row}
                                />
                            ))}
                        </ul>
                        <NoMore className="rs-wallet-history__noMore" />
                    </div>
                )}
            </div>
        </div>
    );
}
