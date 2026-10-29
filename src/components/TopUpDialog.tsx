import { useCallback, useEffect, useId, useState } from 'react';
import { Ban, Crown, ShieldCheck, X, ChevronLeft } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/components/ui/drawer';
import { api } from '@/api';
import { useTopUpStore } from '@/stores/topUp';
import { useUserStore } from '@/stores/user';
import { useRootStore } from '@/stores/root';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { actualMembershipPeriod, displayTopUpProducts, membershipDisplayRows, type MembershipBillingPeriod, type TopUpDisplayProduct, type TopUpProduct } from '@/lib/topUpProducts';
import { getShoppingProductCache, setShoppingProductCache } from '@/lib/shoppingProductCache';
import { refreshSessionFromStoredToken } from '@/lib/refreshSessionFromStoredToken';
import { resolveSubscriptionPeriod } from '@/lib/subscriptionPlanRenewText';
import type { IPlayerEpisode } from '@/types/videoPlayer';
import RadixRcShoppingPaySection from '@/pages/user/RadixRcShoppingPaySection';
import { toast } from 'sonner';
import '@/styles/shopping-reelshort.scss';
import '@/styles/checkout-reelshort.scss';
import '@/styles/top-up-dialog.scss';

function CoinIcon({ size = 16 }: { size?: number }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="9" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>;
}

type TopUpPanelProps = {
    onClose?: () => void;
    embedded?: boolean;
    initialTab?: 'coins' | 'vip';
    productFrom?: 'shopping' | 'video';
    episodeRowId?: number;
    onPaySuccessEpisodeDetail?: (episode: IPlayerEpisode) => void;
};

export function TopUpPanel({ onClose, embedded = false, initialTab = 'coins', productFrom = 'shopping', episodeRowId, onPaySuccessEpisodeDetail }: TopUpPanelProps) {
    const intl = useIntl();
    const zh = intl.locale.toLowerCase().startsWith('zh');
    const label = (cn: string, en: string) => zh ? cn : en;
    const panelId = useId();
    const [balanceFailed, setBalanceFailed] = useState(false);
    const balance = useUserStore(state => state.balance);
    const signed = useUserStore(state => state.signed);
    const userId = useUserStore(state => state.info?.id);
    const ready = useRootStore(state => state.sessionBootstrapReady);
    const requireAccount = useRequireAccount();
    const [tab, setTab] = useState<'coins' | 'vip'>(initialTab);
    const [period, setPeriod] = useState<MembershipBillingPeriod>('monthly');
    const [products, setProducts] = useState<TopUpProduct[]>(() => getShoppingProductCache(productFrom) ?? []);
    const [selected, setSelected] = useState<TopUpDisplayProduct | null>(null);
    const [payState, setPayState] = useState<'idle' | 'processing' | 'checking' | 'success' | 'failed'>('idle');
    const [paySeed, setPaySeed] = useState(0);

    useEffect(() => {
        if (!ready || !signed) return;
        let active = true;
        const sessionToken = localStorage.getItem('token');
        void api<TopUpProduct[]>('product', {
            data: { from: productFrom, type: 10 }, loading: false, toastOnError: false,
        }).then(result => {
            if (!active || sessionToken !== localStorage.getItem('token') || result.c !== 0 || !Array.isArray(result.d)) return;
            setProducts(result.d);
            setShoppingProductCache(productFrom, result.d);
        });
        return () => { active = false; };
    }, [ready, signed, userId, productFrom]);

    useEffect(() => {
        if (!ready || !signed) return;
        let active = true;
        const sessionToken = localStorage.getItem('token');
        setBalanceFailed(false);
        void api<number>('user/balance', { loading: false, toastOnError: false }).then(result => {
            if (!active || sessionToken !== localStorage.getItem('token')) return;
            const valid = result.c === 0 && result.d != null && String(result.d).trim() !== '' && Number.isFinite(Number(result.d));
            if (valid) useUserStore.getState().setBalance(result.d);
            setBalanceFailed(!valid);
        });
        return () => { active = false; };
    }, [ready, signed, userId]);

    useEffect(() => {
        if (payState !== 'success') return;
        let active = true;
        const timer = window.setTimeout(() => {
            void (async () => {
                await refreshSessionFromStoredToken();
                if (!active) return;
                if (productFrom === 'video' && episodeRowId && episodeRowId > 0) {
                    const result = await api<IPlayerEpisode>('movie/episode', {
                        data: { id: episodeRowId, auto_unlock: useUserStore.getState().isVIP() ? 0 : 1 }, loading: false,
                    });
                    if (!active) return;
                    if (result.c === 0) onPaySuccessEpisodeDetail?.(result.d);
                }
                setSelected(null);
                onClose?.();
            })();
        }, 2000);
        return () => { active = false; window.clearTimeout(timer); };
    }, [payState, onClose, productFrom, episodeRowId, onPaySuccessEpisodeDetail]);

    function selectProduct(product: TopUpDisplayProduct) {
        if (product.preview || product.id <= 0) {
            toast.info(label('暂无可购买套餐', 'No packages available yet'));
            return;
        }
        if (!requireAccount()) { onClose?.(); return; }
        setPayState('idle');
        setSelected(product);
        setPaySeed(seed => seed + 1);
    }

    const referenceMemberships = tab === 'vip';
    const referenceCoins = tab === 'coins';
    const periods: MembershipBillingPeriod[] = ['monthly', 'annual'];
    const activePeriod = periods.includes(period) ? period : periods[0];
    const rows: TopUpDisplayProduct[] = referenceMemberships ? membershipDisplayRows(products, activePeriod)
        : displayTopUpProducts(products, tab === 'coins' ? 2 : 1, period).filter(product => !product.preview);
    const periodLabel = (value: MembershipBillingPeriod) => value === 'weekly' ? label('周付', 'Weekly') : value === 'monthly' ? label('月付', 'Monthly') : value === 'annual' ? label('年付', 'Annual') : value === 'daily' ? label('日付', 'Daily') : label('其他', 'Other');
    const periodSuffix = (product: TopUpProduct) => {
        const value = actualMembershipPeriod(product);
        return value === 'weekly' ? label('/周', '/week') : value === 'monthly' ? label('/月', '/month') : value === 'annual' ? label('/年', '/year') : value === 'daily' ? label('/日', '/day') : '';
    };
    const number = (value: number | undefined) => intl.formatNumber(Number.isFinite(value) ? value! : 0);
    const annualSavings = Math.max(0, ...membershipDisplayRows(products, 'monthly').filter(product => !product.preview).map(monthly => {
        const annual = membershipDisplayRows(products, 'annual').find(product => !product.preview && product.name === `${monthly.name}_annual`);
        const monthlyPrice = Number(monthly.price) * 12;
        return annual && monthlyPrice > 0 ? Math.max(0, Math.round((1 - Number(annual.price) / monthlyPrice) * 100)) : 0;
    }));
    const title = label('充值中心', 'Top Up');
    const membershipName = (product: TopUpDisplayProduct) => {
        if (referenceMemberships && /^(basic|standard|premium)(_annual)?$/.test(product.name)) {
            const tier = product.name.replace(/_annual$/, '');
            const name = tier === 'basic' ? label('基础', 'Basic') : tier === 'standard' ? label('标准', 'Standard') : label('尊享', 'Premium');
            return `${name}${actualMembershipPeriod(product) === 'annual' ? label('年卡', ' annual') : label('月卡', ' monthly')}`;
        }
        if (product.preview) return label(
            product.name === 'basic' ? '基础会员' : product.name === 'standard' ? '标准会员' : '高级会员',
            product.name === 'basic' ? 'Basic' : product.name === 'standard' ? 'Standard' : 'Premium',
        );
        const subscription = resolveSubscriptionPeriod(product.name);
        return intl.formatMessage({ id: `${subscription ?? product.name}_subscription`, defaultMessage: product.name });
    };

    return <section className={`top-up-dialog${embedded ? ' top-up-dialog--embedded' : ''}`} aria-labelledby={`${panelId}-title`}>
            <div className="top-up-dialog__head">
                <div>
                    <h2 id={`${panelId}-title`} className="top-up-dialog__title">
                        {selected ? label('选择支付方式', 'Payment method') : title}
                    </h2>
                    <p className="top-up-dialog__balance" role="status">
                        <CoinIcon size={13} />
                        {label('余额 ', 'Balance ')}{signed && balance >= 0 ? <>{number(balance)}{label(' 金币', ' coins')}</> : balanceFailed ? label('获取失败', 'Unavailable') : !ready || signed ? label('加载中…', 'Loading…') : label('登录后查看', 'Sign in to view')}
                    </p>
                </div>
                {onClose ? <button type="button" className="top-up-dialog__close" aria-label={label('关闭', 'Close')} onClick={onClose}><X size={18} /></button> : null}
            </div>
            {selected ? <>
                <button type="button" className="top-up-dialog__back" onClick={() => setSelected(null)}><ChevronLeft size={16} />{label('返回套餐', 'Back to packages')}</button>
                <div className="top-up-dialog__summary">{selected.type === 2 ? `${number(selected.coin)} ${label('金币', 'coins')}` : membershipName(selected)} · ${selected.price}</div>
                {payState === 'idle' || payState === 'processing' || payState === 'checking' ? <div className="rs-shopping top-up-dialog__checkout">
                    <RadixRcShoppingPaySection key={paySeed} walletProductId={selected.id} checkoutTargetProductId={selected.id}
                        checkoutFrom={productFrom} checkoutProductMeta={selected} paySessionSeed={paySeed} onPayStateChange={setPayState} />
                    {payState !== 'idle' ? <p role="status">{label('正在确认支付结果…', 'Confirming payment…')}</p> : null}
                </div> : <div className="top-up-dialog__status" role="status">
                    {payState === 'success' ? <><ShieldCheck size={36} /><p>{label('支付成功', 'Payment successful')}</p></> : <>
                        <p>{label('支付未完成，请重试', 'Payment incomplete. Please retry.')}</p>
                        <button type="button" onClick={() => { setPaySeed(seed => seed + 1); setPayState('idle'); }}>{label('重试', 'Retry')}</button>
                    </>}
                </div>}
            </> : <>
                <div className="top-up-dialog__tabs" role="tablist" aria-label={title}>
                    <button type="button" role="tab" id={`${panelId}-coins-tab`} aria-selected={tab === 'coins'} aria-controls={`${panelId}-products`} onClick={() => setTab('coins')}>{label('金币充值', 'Coins')}</button>
                    <button type="button" role="tab" id={`${panelId}-vip-tab`} aria-selected={tab === 'vip'} aria-controls={`${panelId}-products`} onClick={() => setTab('vip')}>{label('开通会员', 'Membership')}</button>
                </div>
                <div id={`${panelId}-products`} className="top-up-dialog__list" role="tabpanel" aria-labelledby={`${panelId}-${tab}-tab`}>
                    {referenceCoins ? <div className="top-up-dialog__banner">{label('首充双倍 · 仅首单一次 · 基础金币 ×2（限 $', 'First top-up double · First order only · Base coins ×2 (up to $')}{number(0)}{label(' 及以下档位）', ' packs)')}</div> : null}
                    {tab === 'vip' ? <>
                        <div className="top-up-dialog__banner">{referenceMemberships ? label('会员每月到账金币 · 解锁会员专享剧 · 评论区专属身份', 'Monthly member coins · Member-only dramas · Exclusive comment identity') : label('会员专享权益', 'Member benefits')}</div>
                        <div className="top-up-dialog__tabs top-up-dialog__period" aria-label={label('会员周期', 'Membership period')}>
                            {periods.map(value => <button key={value} type="button" aria-pressed={activePeriod === value} onClick={() => setPeriod(value)}>{periodLabel(value)}{value === 'annual' ? <small className="top-up-dialog__saving">{label('省', 'Save ')}{number(annualSavings)}%</small> : null}</button>)}
                        </div>
                    </> : null}
                    {rows.length === 0 ? <p className="top-up-dialog__empty">{!ready ? label('正在连接，请稍候…', 'Connecting, please wait…') : label('暂无可购买套餐', 'No packages available yet')}</p> : null}
                    {rows.map((product, index) => {
                        const baseCoins = Number(product.coin) || 0;
                        const bonus = Math.max(0, Math.round(baseCoins * (Number.parseFloat(product.bouns ?? '0') || 0)));
                        const featured = referenceCoins ? index === 2 : product.name === 'standard' || product.name === 'standard_annual';
                        return <button type="button" key={product.id} disabled={referenceMemberships && product.preview} className={`top-up-dialog__product${referenceCoins ? ' top-up-dialog__product--coins' : ''}${referenceMemberships ? ' top-up-dialog__product--membership' : ''}${featured && !referenceCoins ? ' top-up-dialog__product--featured' : ''}`} onClick={() => selectProduct(product)}>
                            {referenceMemberships && product.preview ? <span className="top-up-dialog__badge top-up-dialog__badge--unavailable"><Ban size={11} />{label('暂无', 'Unavailable')}</span> : null}
                            {featured ? <span className={`top-up-dialog__badge${referenceCoins ? ' top-up-dialog__badge--coins' : ''}${referenceMemberships && product.preview ? ' top-up-dialog__badge--afterUnavailable' : ''}`}>{referenceMemberships || referenceCoins ? label('最受欢迎', 'Most popular') : label('推荐', 'Recommended')}</span> : null}
                            <span className="top-up-dialog__productRow">
                                <span className="top-up-dialog__coinDescription"><span className="top-up-dialog__amount">{tab === 'coins' ? <CoinIcon /> : <Crown size={16} />}
                                    {tab === 'coins' ? `${number(baseCoins + bonus)} ${label('金币', 'coins')}` : membershipName(product)}
                                    {referenceMemberships && product.days !== undefined && activePeriod === 'monthly' ? <small>{number(product.days)}{label(' 天有效', ' days valid')}</small> : null}
                                    {referenceCoins ? <small className="top-up-dialog__bonus">{label('含送', 'Includes bonus ')}{number(bonus)}</small> : bonus > 0 ? <small>+{number(bonus)} {label('赠送', 'bonus')}</small> : null}
                                </span>{referenceCoins && (index === 1 || index === 2) ? <span className="top-up-dialog__note top-up-dialog__note--coins">{label('仅金币，不含会员', 'Coins only, membership not included')}</span> : null}</span>
                                <span className="top-up-dialog__price"><strong>${product.price}{referenceMemberships ? <small>{periodSuffix(product)}</small> : null}</strong><span className={`top-up-dialog__tag${referenceCoins ? ' top-up-dialog__tag--coins' : ''}${tab === 'vip' ? ' top-up-dialog__tag--vip' : ''}`}>{tab === 'coins' ? referenceCoins ? label('购买金币', 'Buy coins') : label('金币', 'Coins') : referenceMemberships ? label('开通会员', 'Join membership') : 'VIP'}</span></span>
                            </span>
                            {tab === 'vip' ? <>
                                {referenceMemberships && /^(basic|standard|premium)(_annual)?$/.test(product.name) ? <>
                                    <span className="top-up-dialog__perk top-up-dialog__perk--membership">{label('每月到账 ', 'Monthly: ')}{number(product.coin)}{label(' 金币', ' coins')}{activePeriod === 'annual' ? label('，共12期', ', for 12 months') : ''}</span>
                                    <span className="top-up-dialog__note">{label('会员特权剧每部多看 ', 'Extra episodes per member drama: ')}{number(product.freeExtra)}{label(' 集 · 可看会员专享剧', ' · Access member-only dramas')}</span>
                                </> : product.coin !== undefined ? <span className="top-up-dialog__perk">{label('赠送 ', 'Included: ')}{number(product.coin)}{label(' 金币', ' coins')}</span> : null}
                            </> : null}
                        </button>;
                    })}
                </div>
                <p className="top-up-dialog__footer">{label('支付宝 / 微信支付 / 银行卡 · 安全支付', 'Alipay / WeChat Pay / Bank card · Secure payment')}</p>
            </>}
    </section>;
}

export function TopUpModal({ open, onOpenChange, initialTab = 'coins', ...panelProps }: Omit<TopUpPanelProps, 'onClose' | 'embedded'> & { open: boolean; onOpenChange: (open: boolean) => void }) {
    const intl = useIntl();
    const isPc = useMinWidth768();
    const close = useCallback(() => onOpenChange(false), [onOpenChange]);
    const title = intl.locale.startsWith('zh') ? '充值中心' : 'Top Up';
    if (!isPc) return <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" disablePreventScroll>
        <DrawerContent handler className="top-up-drawer-shell" overlayClassName="top-up-dialog__overlay">
            <DrawerTitle className="sr-only">{title}</DrawerTitle>
            <DrawerDescription className="sr-only">{intl.locale.startsWith('zh') ? '选择金币或会员套餐' : 'Choose a coin or membership package'}</DrawerDescription>
            <TopUpPanel key={initialTab} {...panelProps} onClose={close} initialTab={initialTab} />
        </DrawerContent>
    </Drawer>;
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent contentPreset="plain" hideCloseButton className="top-up-dialog-shell" overlayClassName="top-up-dialog__overlay">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">{intl.locale.startsWith('zh') ? '选择金币或会员套餐' : 'Choose a coin or membership package'}</DialogDescription>
            <TopUpPanel key={initialTab} {...panelProps} onClose={close} initialTab={initialTab} />
        </DialogContent>
    </Dialog>;
}

export default function TopUpDialog() {
    const open = useTopUpStore(state => state.open);
    const close = useTopUpStore(state => state.close);
    const initialTab = useTopUpStore(state => state.initialTab);
    return <TopUpModal open={open} onOpenChange={next => { if (!next) close(); }} initialTab={initialTab} />;
}
