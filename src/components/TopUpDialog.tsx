import { useEffect, useId, useState } from 'react';
import { Coins, Crown, ShieldCheck, X, ChevronLeft } from 'lucide-react';
import { useIntl } from 'react-intl';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/api';
import { useTopUpStore } from '@/stores/topUp';
import { useUserStore } from '@/stores/user';
import { useRootStore } from '@/stores/root';
import { useRequireAccount } from '@/hooks/useRequireAccount';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { displayTopUpProducts, referenceMembershipProducts, type TopUpDisplayProduct, type TopUpProduct } from '@/lib/topUpProducts';
import { getShoppingProductCache, setShoppingProductCache } from '@/lib/shoppingProductCache';
import { refreshSessionFromStoredToken } from '@/lib/refreshSessionFromStoredToken';
import { resolveSubscriptionPeriod } from '@/lib/subscriptionPlanRenewText';
import RadixRcShoppingPaySection from '@/pages/user/RadixRcShoppingPaySection';
import { toast } from 'sonner';
import '@/styles/shopping-reelshort.scss';
import '@/styles/checkout-reelshort.scss';
import '@/styles/top-up-dialog.scss';

export function TopUpPanel({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
    const intl = useIntl();
    const isPc = useMinWidth768();
    const zh = intl.locale.toLowerCase().startsWith('zh');
    const label = (cn: string, en: string) => zh ? cn : en;
    const panelId = useId();
    const [balanceFailed, setBalanceFailed] = useState(false);
    const balance = useUserStore(state => state.balance);
    const signed = useUserStore(state => state.signed);
    const userId = useUserStore(state => state.info?.id);
    const ready = useRootStore(state => state.sessionBootstrapReady);
    const requireAccount = useRequireAccount();
    const [tab, setTab] = useState<'coins' | 'vip'>('coins');
    const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [products, setProducts] = useState<TopUpProduct[]>(() => getShoppingProductCache('shopping') ?? []);
    const [selected, setSelected] = useState<TopUpDisplayProduct | null>(null);
    const [payState, setPayState] = useState<'idle' | 'processing' | 'checking' | 'success' | 'failed'>('idle');
    const [paySeed, setPaySeed] = useState(0);

    useEffect(() => {
        if (!ready || !signed) return;
        let active = true;
        const sessionToken = localStorage.getItem('token');
        void api<TopUpProduct[]>('product', {
            data: { from: 'shopping', type: 10 }, loading: false, toastOnError: false,
        }).then(result => {
            if (!active || sessionToken !== localStorage.getItem('token') || result.c !== 0 || !Array.isArray(result.d)) return;
            setProducts(result.d);
            setShoppingProductCache('shopping', result.d);
        });
        return () => { active = false; };
    }, [ready, signed, userId]);

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
        void refreshSessionFromStoredToken();
        const timer = window.setTimeout(() => { setSelected(null); onClose?.(); }, 2000);
        return () => window.clearTimeout(timer);
    }, [payState, onClose]);

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

    const referenceMemberships = isPc && tab === 'vip';
    const rows = referenceMemberships ? referenceMembershipProducts(products, period)
        : displayTopUpProducts(products, tab === 'coins' ? 2 : 1, period).filter(product => !isPc || !product.preview);
    const monthlyPlans = referenceMembershipProducts(products, 'monthly');
    const annualPlans = referenceMembershipProducts(products, 'annual');
    const savings = annualPlans.map((annual, index) => {
        const monthly = monthlyPlans[index];
        const annualCost = Number(annual.price);
        const monthlyCost = Number(monthly.price) * 12;
        return !annual.preview && !monthly.preview && monthlyCost > 0 ? Math.max(0, Math.round((1 - annualCost / monthlyCost) * 100)) : 0;
    });
    const annualSavings = Math.max(0, ...savings);
    const number = (value: number | undefined) => intl.formatNumber(Number.isFinite(value) ? value! : 0);
    const title = label('充值中心', 'Top Up');
    const membershipName = (product: TopUpDisplayProduct) => {
        if (referenceMemberships) {
            const tier = product.name.replace(/_annual$/, '');
            const name = tier === 'basic' ? label('基础', 'Basic') : tier === 'standard' ? label('标准', 'Standard') : label('尊享', 'Premium');
            return `${name}${period === 'annual' ? label('年卡', ' annual') : label('月卡', ' monthly')}`;
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
                        <Coins size={13} strokeWidth={2} aria-hidden />
                        {label('余额 ', 'Balance ')}{signed && balance >= 0 ? <>{number(balance)}{label(' 金币', ' coins')}</> : balanceFailed ? label('获取失败', 'Unavailable') : !ready || signed ? label('加载中…', 'Loading…') : label('登录后查看', 'Sign in to view')}
                    </p>
                </div>
                {onClose ? <button type="button" className="top-up-dialog__close" aria-label={label('关闭', 'Close')} onClick={onClose}><X size={18} /></button> : null}
            </div>
            {selected ? <>
                <button type="button" className="top-up-dialog__back" onClick={() => setSelected(null)}><ChevronLeft size={16} />{label('返回套餐', 'Back to packages')}</button>
                <div className="top-up-dialog__summary">{selected.type === 2 ? `${number(selected.coin)} ${label('金币', 'coins')}` : membershipName(selected)} · ¥{selected.price}</div>
                {payState === 'idle' || payState === 'processing' || payState === 'checking' ? <div className="rs-shopping top-up-dialog__checkout">
                    <RadixRcShoppingPaySection key={paySeed} walletProductId={selected.id} checkoutTargetProductId={selected.id}
                        checkoutFrom="shopping" checkoutProductMeta={selected} paySessionSeed={paySeed} expectedCurrency="CNY" onPayStateChange={setPayState} />
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
                    {tab === 'vip' ? <>
                        <div className="top-up-dialog__banner">{referenceMemberships ? label('会员每月到账金币 · 解锁会员专享剧 · 评论区专属身份', 'Monthly member coins · Member-only dramas · Exclusive comment identity') : label('会员专享权益', 'Member benefits')}</div>
                        <div className="top-up-dialog__tabs top-up-dialog__period" aria-label={label('会员周期', 'Membership period')}>
                            <button type="button" aria-pressed={period === 'monthly'} onClick={() => setPeriod('monthly')}>{referenceMemberships ? label('月付', 'Monthly') : label('月付会员', 'Monthly')}</button>
                            <button type="button" aria-pressed={period === 'annual'} onClick={() => setPeriod('annual')}>{referenceMemberships ? <>{label('年付', 'Annual')} <small className="top-up-dialog__saving">{label('省', 'Save ')}{number(annualSavings)}%</small></> : label('年付会员', 'Annual')}</button>
                        </div>
                    </> : null}
                    {rows.length === 0 ? <p className="top-up-dialog__empty">{label('暂无可购买套餐', 'No packages available yet')}</p> : null}
                    {rows.map(product => {
                        const baseCoins = Number(product.coin) || 0;
                        const bonus = Math.max(0, Math.round(baseCoins * (Number.parseFloat(product.bouns ?? '0') || 0)));
                        const featured = product.name === 'standard' || product.name === 'standard_annual';
                        return <button type="button" key={product.id} disabled={referenceMemberships && product.preview} className={`top-up-dialog__product${referenceMemberships ? ' top-up-dialog__product--membership' : ''}${featured ? ' top-up-dialog__product--featured' : ''}`} onClick={() => selectProduct(product)}>
                            {featured ? <span className="top-up-dialog__badge">{referenceMemberships ? label('最受欢迎', 'Most popular') : label('推荐', 'Recommended')}</span> : null}
                            <span className="top-up-dialog__productRow">
                                <span className="top-up-dialog__amount">{tab === 'coins' ? <Coins size={16} strokeWidth={2} /> : <Crown size={16} />}
                                    {tab === 'coins' ? `${number(baseCoins + bonus)} ${label('金币', 'coins')}` : membershipName(product)}
                                    {referenceMemberships && period === 'monthly' ? <small>{number(product.days)}{label(' 天有效', ' days valid')}</small> : null}
                                    {bonus > 0 ? <small>+{number(bonus)} {label('赠送', 'bonus')}</small> : null}
                                </span>
                                <span className="top-up-dialog__price"><strong>¥{product.price}{referenceMemberships ? <small>{period === 'annual' ? label('/年', '/year') : label('/月', '/month')}</small> : null}</strong><span className={`top-up-dialog__tag${tab === 'vip' ? ' top-up-dialog__tag--vip' : ''}`}>{tab === 'coins' ? label('金币', 'Coins') : referenceMemberships ? label('开通会员', 'Join membership') : 'VIP'}</span></span>
                            </span>
                            {tab === 'vip' ? <>
                                {referenceMemberships ? <>
                                    <span className="top-up-dialog__perk top-up-dialog__perk--membership">{label('每月到账 ', 'Monthly: ')}{number(product.coin)}{label(' 金币', ' coins')}{period === 'annual' ? label('，共12期', ', for 12 months') : ''}</span>
                                    <span className="top-up-dialog__note">{label('会员特权剧每部多看 ', 'Extra episodes per member drama: ')}{number(product.freeExtra)}{label(' 集 · 可看会员专享剧', ' · Access member-only dramas')}</span>
                                </> : <span className="top-up-dialog__perk">{label('赠送 ', 'Included: ')}{number(product.coin)}{label(' 金币', ' coins')}</span>}
                                {!isPc && (product.preview || product.freeExtra !== undefined) ? <span className="top-up-dialog__note">{label('每日额外免费 ', 'Extra free episodes daily: ')}{number(product.freeExtra)}{label(' 集', '')}</span> : null}
                            </> : null}
                        </button>;
                    })}
                </div>
                <p className="top-up-dialog__footer">{referenceMemberships ? label('支付宝 / 微信支付 / 银行卡 · 安全支付', 'Alipay / WeChat Pay / Bank card · Secure payment') : <><ShieldCheck size={12} aria-hidden />{label('安全支付 · 支持银行卡 / Apple Pay / Google Pay', 'Secure payment · Card / Apple Pay / Google Pay')}</>}</p>
            </>}
    </section>;
}

export default function TopUpDialog() {
    const intl = useIntl();
    const open = useTopUpStore(state => state.open);
    const close = useTopUpStore(state => state.close);
    const title = intl.locale.startsWith('zh') ? '充值中心' : 'Top Up';
    return <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
        <DialogContent contentPreset="plain" hideCloseButton className="top-up-dialog-shell" overlayClassName="top-up-dialog__overlay">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <DialogDescription className="sr-only">{intl.locale.startsWith('zh') ? '选择金币或会员套餐' : 'Choose a coin or membership package'}</DialogDescription>
            <TopUpPanel onClose={close} />
        </DialogContent>
    </Dialog>;
}
