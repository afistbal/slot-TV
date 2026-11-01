import { api } from '@/api';
import Loader from '@/components/Loader';
import NoMore from '@/components/NoMore';
import { enrichBalanceHistoryRows } from '@/lib/enrichBalanceHistoryRows';
import { formatChinaDateTime } from '@/lib/chinaDateTime';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import emptyImg from '@/assets/images/empty.webp';
import { VIDEO_FROM_HOME_STATE } from '@/constants/videoRoute';
import iconChevron from '@/assets/images/bbd6ac50-876c-11ee-aed2-cfe3d80f70eb.png';
import { ChevronLeft, ChevronRight, Coins, LockKeyholeOpen, Plus } from 'lucide-react';
import { Link } from 'react-router';
import '@/styles/wallet-reelshort.scss';

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
    /** 部分接口字段拼写为 bouns */
    bouns?: number | string | null;
    coin?: number | null;
}

type WalletTab = 'recharge' | 'consumption';

type WalletTransactionHistoryProps = {
    variant?: 'pc' | 'h5';
    className?: string;
};

const PC_PAGE_SIZE = 10;

function formatPriceLabel(price: IBalanceHistoryRow['price']) {
    if (price == null || price === '') return null;
    if (typeof price === 'number') {
        return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
    }
    const s = String(price).trim();
    if (!s) return null;
    return s.startsWith('$') ? s : `$${s}`;
}

function rechargeBaseAndBonus(row: IBalanceHistoryRow) {
    const totalCoins = Math.abs(row.change);
    const baseCoin =
        row.coin != null && row.coin > 0 ? row.coin : totalCoins;
    let bonus = row.bonus ?? 0;
    if (bonus <= 0 && row.coin != null && row.coin > 0 && row.coin < totalCoins) {
        bonus = totalCoins - row.coin;
    }
    return { baseCoin, bonus };
}

function RechargeCardRow({ row }: { row: IBalanceHistoryRow }) {
    const intl = useIntl();
    const { bonus } = rechargeBaseAndBonus(row);
    const priceLabel = formatPriceLabel(row.price);

    return (
        <li className="rs-wallet-card rs-wallet-card--recharge">
            <span className="rs-wallet-card__icon rs-wallet-card__icon--income" aria-hidden>
                <Plus size={14} strokeWidth={2.2} />
            </span>
            <div className="rs-wallet-card__main">
                <p className="rs-wallet-card__title">
                    <FormattedMessage id={priceLabel ? 'wallet_recharge_title' : 'wallet_income_title'} />
                    {priceLabel ? <span className="rs-wallet-card__detail"> · {priceLabel}</span> : null}
                </p>
                <div className="rs-wallet-card__meta">
                    <time className="rs-wallet-card__time" dateTime={row.created_at}>
                        {formatChinaDateTime(row.created_at)}
                    </time>
                    {bonus > 0 ? (
                        <span className="rs-wallet-card__detail">
                            <FormattedMessage id="wallet_bonus_included" values={{ n: intl.formatNumber(bonus) }} />
                        </span>
                    ) : null}
                </div>
            </div>
            <strong className="rs-wallet-card__amount rs-wallet-card__amount--income tabular-nums">
                +{intl.formatNumber(Math.abs(row.change))}
            </strong>
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
            <span className="rs-wallet-card__icon" aria-hidden>
                <LockKeyholeOpen size={14} strokeWidth={2.2} />
            </span>
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
                    {formatChinaDateTime(row.created_at)}
                </time>
            </div>
            <strong className="rs-wallet-card__amount tabular-nums">−{intl.formatNumber(cost)}</strong>
        </>
    );

    if (row.movie_id != null) {
        return (
            <li className="rs-wallet-card rs-wallet-card--consumption rs-wallet-card--linked">
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

function PcRechargeRow({ row }: { row: IBalanceHistoryRow }) {
    const intl = useIntl();
    const { baseCoin, bonus } = rechargeBaseAndBonus(row);
    const priceLabel = formatPriceLabel(row.price);

    return (
        <li className="rs-wallet-pcRow rs-wallet-pcRow--recharge">
            <span className="rs-wallet-pcRow__amount tabular-nums">{priceLabel ?? '—'}</span>
            <span className="rs-wallet-pcRow__coins">
                <span className="rs-wallet-pcRow__coinBase tabular-nums">
                    {intl.formatNumber(baseCoin)}
                </span>
                {bonus > 0 ? (
                    <span className="rs-wallet-pcRow__coinBonus tabular-nums">
                        <FormattedMessage
                            id="wallet_pc_bonus_coins"
                            values={{ n: intl.formatNumber(bonus) }}
                        />
                    </span>
                ) : null}
            </span>
            <time className="rs-wallet-pcRow__time tabular-nums" dateTime={row.created_at}>
                {formatChinaDateTime(row.created_at)}
            </time>
        </li>
    );
}

function PcConsumptionRow({ row }: { row: IBalanceHistoryRow }) {
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

    const content = (
        <>
            <span className="rs-wallet-pcRow__episodeName">{title}</span>
            <span className="rs-wallet-pcRow__episodeNo">
                {episodeNo != null ? (
                    <>
                        <FormattedMessage id="wallet_episode_short" values={{ n: episodeNo }} />
                        <ChevronRight className="rs-wallet-pcRow__episodeChev" aria-hidden />
                    </>
                ) : (
                    '—'
                )}
            </span>
            <time className="rs-wallet-pcRow__time tabular-nums" dateTime={row.created_at}>
                {formatChinaDateTime(row.created_at)}
            </time>
            <span className="rs-wallet-pcRow__deduct tabular-nums">
                <FormattedMessage
                    id="wallet_pc_deduct_coins"
                    values={{ n: intl.formatNumber(cost) }}
                />
            </span>
        </>
    );

    return (
        <li className="rs-wallet-pcRow rs-wallet-pcRow--consumption">
            {row.movie_id != null ? (
                <Link
                    to={`/video/${row.movie_id}/${row.episode_index ?? 0}`}
                    state={VIDEO_FROM_HOME_STATE}
                    className="rs-wallet-pcRow__grid rs-wallet-pcRow__link"
                >
                    {content}
                </Link>
            ) : (
                <div className="rs-wallet-pcRow__grid">{content}</div>
            )}
        </li>
    );
}

function WalletPcPagination({
    page,
    totalPages,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    onPageChange: (next: number) => void;
}) {
    const intl = useIntl();
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
        <nav
            className="rs-wallet-pcPagination"
            aria-label={intl.formatMessage({ id: 'pagination' })}
        >
            <button
                type="button"
                className="rs-wallet-pcPagination__btn rs-wallet-pcPagination__btn--nav"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                aria-label={intl.formatMessage({ id: 'previous_page' })}
            >
                <ChevronLeft size={18} aria-hidden />
            </button>
            <div className="rs-wallet-pcPagination__pages">
                {pages.map((p) => (
                    <button
                        key={p}
                        type="button"
                        className={cn(
                            'rs-wallet-pcPagination__num',
                            p === page && 'rs-wallet-pcPagination__num--active',
                        )}
                        onClick={() => onPageChange(p)}
                        aria-current={p === page ? 'page' : undefined}
                    >
                        {p}
                    </button>
                ))}
            </div>
            <button
                type="button"
                className="rs-wallet-pcPagination__btn rs-wallet-pcPagination__btn--nav"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                aria-label={intl.formatMessage({ id: 'next_page' })}
            >
                <ChevronRight size={18} aria-hidden />
            </button>
        </nav>
    );
}

/** PC 保持交易表格；独立钱包页使用个人中心风格的明细列表。 */
export function WalletTransactionHistory({
    variant = 'h5',
    className,
}: WalletTransactionHistoryProps) {
    const intl = useIntl();
    const [rows, setRows] = useState<IBalanceHistoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<WalletTab>('recharge');
    const [page, setPage] = useState(1);
    const isPc = variant === 'pc';

    useEffect(() => {
        let alive = true;
        api<IBalanceHistoryRow[]>('user/balance/history', {
            loading: false,
        })
            .then(async (res) => {
                const list = res.c === 0 && Array.isArray(res.d) ? res.d : [];
                const enriched = await enrichBalanceHistoryRows(list);
                if (!alive) return;
                setRows(enriched);
            })
            .finally(() => {
                if (alive) {
                    setLoading(false);
                }
            });
        return () => {
            alive = false;
        };
    }, []);

    useEffect(() => {
        setPage(1);
    }, [activeTab]);

    const rechargeRows = useMemo(() => rows.filter((r) => r.type === 1), [rows]);
    const consumptionRows = useMemo(() => rows.filter((r) => r.type === 2), [rows]);
    const visibleRows = activeTab === 'recharge' ? rechargeRows : consumptionRows;

    const totalPages = Math.max(1, Math.ceil(visibleRows.length / PC_PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paginatedRows = isPc
        ? visibleRows.slice((safePage - 1) * PC_PAGE_SIZE, safePage * PC_PAGE_SIZE)
        : visibleRows;

    return (
        <div className={cn('rs-wallet-tx', isPc && 'rs-wallet-tx--pc', className)}>
            {!isPc ? (
                <div className="rs-wallet-tx__heading">
                    <h2><Coins size={16} aria-hidden /><FormattedMessage id="wallet_history_title" /></h2>
                    {!loading ? <span><FormattedMessage id="wallet_record_count" values={{ n: visibleRows.length }} /></span> : null}
                </div>
            ) : null}
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
                    <FormattedMessage
                        id={isPc ? 'wallet_pc_tab_recharge' : 'wallet_tab_recharge'}
                    />
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
                    <FormattedMessage
                        id={isPc ? 'wallet_pc_tab_consumption' : 'wallet_tab_consumption'}
                    />
                </button>
            </div>

            <div className="rs-wallet-tx__panel" role="tabpanel">
                {loading ? (
                    <div className="rs-wallet-tx__loading">
                        <Loader />
                    </div>
                ) : visibleRows.length === 0 ? (
                    <div className="rs-wallet-tx__empty">
                        {isPc ? <img src={emptyImg} alt="" className="rs-wallet-tx__emptyImg" /> : (
                            <span className="rs-wallet-tx__emptyIcon" aria-hidden>
                                {activeTab === 'recharge' ? <Coins size={24} /> : <LockKeyholeOpen size={24} />}
                            </span>
                        )}
                        <p className="rs-wallet-tx__emptyText">
                            <FormattedMessage id={isPc ? 'wallet_nothing_inside' : activeTab === 'recharge' ? 'wallet_empty_income' : 'wallet_empty_consumption'} />
                        </p>
                        {!isPc ? <p className="rs-wallet-tx__emptyHint"><FormattedMessage id={activeTab === 'recharge' ? 'wallet_empty_income_hint' : 'wallet_empty_consumption_hint'} /></p> : null}
                    </div>
                ) : isPc ? (
                    <div
                        className={cn(
                            'rs-wallet-pcTable',
                            activeTab === 'recharge' && 'rs-wallet-pcTable--recharge',
                            activeTab === 'consumption' && 'rs-wallet-pcTable--consumption',
                        )}
                    >
                        <div
                            className={cn(
                                'rs-wallet-pcTable__head',
                                activeTab === 'consumption' && 'rs-wallet-pcTable__head--consumption',
                                activeTab === 'recharge' && 'rs-wallet-pcTable__head--recharge',
                            )}
                            aria-hidden
                        >
                            {activeTab === 'recharge' ? (
                                <>
                                    <span>
                                        <FormattedMessage id="wallet_pc_col_amount" />
                                    </span>
                                    <span>
                                        <FormattedMessage id="wallet_col_coins" />
                                    </span>
                                    <span>
                                        <FormattedMessage id="wallet_pc_col_trading_hours" />
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span>
                                        <FormattedMessage id="wallet_pc_col_episode_name" />
                                    </span>
                                    <span>
                                        <FormattedMessage id="wallet_pc_col_episode" />
                                    </span>
                                    <span>
                                        <FormattedMessage id="wallet_pc_col_unlock_time" />
                                    </span>
                                    <span>
                                        <FormattedMessage id="wallet_col_coins" />
                                    </span>
                                </>
                            )}
                        </div>
                        <ul className="rs-wallet-pcTable__body">
                            {paginatedRows.map((row, index) =>
                                activeTab === 'recharge' ? (
                                    <PcRechargeRow
                                        key={`${row.created_at}-${row.target}-${index}`}
                                        row={row}
                                    />
                                ) : (
                                    <PcConsumptionRow
                                        key={`${row.created_at}-${row.target}-${index}`}
                                        row={row}
                                    />
                                ),
                            )}
                        </ul>
                        <WalletPcPagination
                            page={safePage}
                            totalPages={totalPages}
                            onPageChange={setPage}
                        />
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
