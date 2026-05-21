import { api } from '@/api';
import Loader from '@/components/Loader';
import NoMore from '@/components/NoMore';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { FormattedDate, FormattedMessage, useIntl } from 'react-intl';
import coinIcon from '@/assets/profile/icon_coin@2x.png';
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
    movie_name?: string | null;
    movie_title?: string | null;
    price?: string | number | null;
    bonus?: number | null;
    coin?: number | null;
}

type WalletTab = 'recharge' | 'consumption';

type WalletTransactionHistoryProps = {
    variant?: 'pc' | 'h5';
    className?: string;
};

function formatHistoryTime(intl: ReturnType<typeof useIntl>, iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return intl.formatDate(d, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function formatPriceLabel(price: IBalanceHistoryRow['price']) {
    if (price == null || price === '') return null;
    if (typeof price === 'number') {
        return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
    }
    const s = String(price).trim();
    if (!s) return null;
    return s.startsWith('$') ? s : `$${s}`;
}

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

function RechargeCardRow({ row }: { row: IBalanceHistoryRow }) {
    const intl = useIntl();
    const baseCoin = row.coin ?? Math.abs(row.change);
    const bonus = row.bonus ?? 0;
    const priceLabel = formatPriceLabel(row.price);

    return (
        <li className="rs-wallet-card rs-wallet-card--recharge">
            <div className="rs-wallet-card__main">
                <div className="rs-wallet-card__coinsLine">
                    <img className="rs-wallet-card__coinIcon" src={coinIcon} alt="" aria-hidden />
                    <span className="rs-wallet-card__coinAmount tabular-nums">
                        {intl.formatNumber(baseCoin)}
                    </span>
                    {bonus > 0 ? (
                        <span className="rs-wallet-card__coinBonus tabular-nums">
                            +{intl.formatNumber(bonus)}
                        </span>
                    ) : null}
                </div>
                <time className="rs-wallet-card__time" dateTime={row.created_at}>
                    {formatHistoryTime(intl, row.created_at)}
                </time>
            </div>
            {priceLabel ? (
                <div className="rs-wallet-card__price tabular-nums">{priceLabel}</div>
            ) : null}
        </li>
    );
}

function ConsumptionCardRow({ row }: { row: IBalanceHistoryRow }) {
    const intl = useIntl();
    const title =
        row.movie_name?.trim() ||
        row.movie_title?.trim() ||
        intl.formatMessage({ id: 'unlock_episodes' });
    const episodeNo =
        row.episode_index != null && row.episode_index > 0
            ? row.episode_index
            : null;
    const cost = Math.abs(row.change);

    const body = (
        <>
            <div className="rs-wallet-card__main">
                <p className="rs-wallet-card__title">{title}</p>
                {episodeNo != null ? (
                    <p className="rs-wallet-card__episode">
                        <FormattedMessage id="wallet_episode_short" values={{ n: episodeNo }} />
                        <img
                            src={iconChevron}
                            alt=""
                            className="rs-wallet-card__episodeChev"
                            aria-hidden
                        />
                    </p>
                ) : null}
                <time className="rs-wallet-card__time" dateTime={row.created_at}>
                    {formatHistoryTime(intl, row.created_at)}
                </time>
            </div>
            <div className="rs-wallet-card__cost">
                <span className="rs-wallet-card__costValue tabular-nums">-{intl.formatNumber(cost)}</span>
                <img className="rs-wallet-card__coinIcon" src={coinIcon} alt="" aria-hidden />
            </div>
        </>
    );

    if (row.movie_id != null) {
        return (
            <li className="rs-wallet-card rs-wallet-card--consumption">
                <Link
                    to={`/video/${row.movie_id}/${row.episode_index ?? 0}`}
                    state={VIDEO_FROM_HOME_STATE}
                    className="rs-wallet-card__link"
                >
                    {body}
                </Link>
            </li>
        );
    }

    return <li className="rs-wallet-card rs-wallet-card--consumption">{body}</li>;
}

/** PC：ReelShort 表格；H5：充值 / 消费 Tab + 设计稿卡片 */
export function WalletTransactionHistory({
    variant = 'h5',
    className,
}: WalletTransactionHistoryProps) {
    const intl = useIntl();
    const [rows, setRows] = useState<IBalanceHistoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<WalletTab>('recharge');
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

    const rechargeRows = useMemo(() => rows.filter((r) => r.type === 1), [rows]);
    const consumptionRows = useMemo(() => rows.filter((r) => r.type !== 1), [rows]);
    const visibleRows = activeTab === 'recharge' ? rechargeRows : consumptionRows;

    return (
        <div className={cn('rs-wallet-tx', isPc && 'rs-wallet-tx--pc', className)}>
            <div
                className="rs-wallet-tx__tabs"
                role="tablist"
                aria-label={intl.formatMessage({ id: 'wallet_page_title' })}
            >
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'recharge'}
                    className={cn(
                        'rs-wallet-tx__tab',
                        activeTab === 'recharge' && 'rs-wallet-tx__tab--active',
                    )}
                    onClick={() => setActiveTab('recharge')}
                >
                    <FormattedMessage id="wallet_tab_recharge" />
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'consumption'}
                    className={cn(
                        'rs-wallet-tx__tab',
                        activeTab === 'consumption' && 'rs-wallet-tx__tab--active',
                    )}
                    onClick={() => setActiveTab('consumption')}
                >
                    <FormattedMessage id="wallet_tab_consumption" />
                </button>
            </div>

            <div className="rs-wallet-tx__panel" role="tabpanel">
                {loading ? (
                    <div className="rs-wallet-tx__loading">
                        <Loader />
                    </div>
                ) : visibleRows.length === 0 ? (
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
                            {visibleRows.map((row, index) => (
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
                        <ul className="rs-wallet-cardList">
                            {visibleRows.map((row, index) =>
                                activeTab === 'recharge' ? (
                                    <RechargeCardRow
                                        key={`${row.created_at}-${row.target}-${index}`}
                                        row={row}
                                    />
                                ) : (
                                    <ConsumptionCardRow
                                        key={`${row.created_at}-${row.target}-${index}`}
                                        row={row}
                                    />
                                ),
                            )}
                        </ul>
                        <NoMore className="rs-wallet-cardList__noMore" />
                    </div>
                )}
            </div>
        </div>
    );
}
