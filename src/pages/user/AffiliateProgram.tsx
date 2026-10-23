import { openSharePoster } from '@/stores/sharePoster';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { useSearchParams } from 'react-router';
import { ProgramFlowPreview } from '@/components/ProgramFlowPreview';
import { AffiliateDashboard } from '@/components/AffiliateDashboard';
import { ProgramIcon, type ProgramIconName } from '@/components/ProgramIcon';
import { ReelShortTopNav } from '@/components/ReelShortTopNav';
import {
    affiliateErrorMessage,
    getAffiliateEligibility,
} from '@/api/affiliate';
import { useRootStore } from '@/stores/root';
import { useUserStore } from '@/stores/user';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { buildAffiliateShareUrl } from '@/lib/shareUrls';
import '@/styles/creator-program.scss';

type AffiliateState = 'in_progress' | 'active';
type AffiliateEligibility = {
    state: AffiliateState;
    payers: number;
    gatePayers: number;
    invitedCount: number;
    invitedCents: number;
    gateNetUsdCents: number;
    referralCode: string;
    referralUrl: string;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valueFrom(source: UnknownRecord, ...keys: string[]): unknown {
    for (const key of keys) {
        if (source[key] !== undefined && source[key] !== null) return source[key];
    }
    return undefined;
}

function numberFrom(source: UnknownRecord, ...keys: string[]): number {
    const value = Number(valueFrom(source, ...keys));
    return Number.isFinite(value) ? value : 0;
}

function normalizeAffiliate(data: unknown, uid: string): AffiliateEligibility | null {
    if (!isRecord(data)) return null;
    const nested = valueFrom(data, 'affiliate', 'eligibility', 'data');
    const source = isRecord(nested) ? nested : data;
    const rawState = String(valueFrom(source, 'state', 'status', 'applicationStatus', 'application_status') ?? 'in_progress');
    const state: AffiliateState = rawState === 'active' ? 'active' : 'in_progress';
    const referralCode = uid;

    return {
        state,
        payers: numberFrom(source, 'payers', 'payer_count'),
        gatePayers: numberFrom(source, 'gatePayers', 'gate_payers'),
        invitedCount: numberFrom(source, 'invitedCount', 'invited_count'),
        invitedCents: numberFrom(source, 'invitedCents', 'invited_cents'),
        gateNetUsdCents: numberFrom(source, 'gateNetUsdCents', 'gate_net_usd_cents'),
        referralCode,
        referralUrl: buildAffiliateShareUrl(uid),
    };
}

function AffiliateStateCard({ icon, title, description, action, tone = 'green' }: { icon: ProgramIconName; title: string; description: string; action?: ReactNode; tone?: 'green' | 'gold' }) {
    return (
        <section className={`affiliate-reference__state affiliate-reference__state--${tone}`}>
            <span><ProgramIcon name={icon} /></span>
            <h2>{title}</h2>
            <p>{description}</p>
            {action}
        </section>
    );
}

function AffiliateExplainer() {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });
    const highlights = [
        { icon: 'coins' as const, tone: 'gold', title: t('affiliate_highlight_cash'), desc: t('affiliate_highlight_cash_desc') },
        { icon: 'infinity' as const, tone: 'green', title: t('affiliate_highlight_lifetime'), desc: t('affiliate_highlight_lifetime_desc') },
        { icon: 'trending' as const, tone: 'green', title: t('affiliate_highlight_growth'), desc: t('affiliate_highlight_growth_desc') },
    ];
    const steps = [
        { title: t('affiliate_step_share'), desc: t('affiliate_step_share_desc') },
        { title: t('affiliate_step_register'), desc: t('affiliate_step_register_desc') },
        { title: t('affiliate_step_commission'), desc: t('affiliate_step_commission_desc') },
        { title: t('affiliate_step_withdraw'), desc: t('affiliate_step_withdraw_desc') },
    ];
    const rules = [
        { title: t('affiliate_rule_real'), desc: t('affiliate_rule_real_desc') },
        { title: t('affiliate_rule_binding'), desc: t('affiliate_rule_binding_desc') },
        { title: t('affiliate_rule_settlement'), desc: t('affiliate_rule_settlement_desc') },
    ];

    return (
        <div className="affiliate-reference__explainer">
            <section className="affiliate-program__highlights">
                {highlights.map((item) => <article key={item.title}><span className={`is-${item.tone}`}><ProgramIcon name={item.icon} /></span><h3>{item.title}</h3><p>{item.desc}</p></article>)}
            </section>
            <section className="affiliate-reference__how">
                <h3>{t('affiliate_how_title')}</h3>
                <div className="affiliate-program__steps">
                    {steps.map((step, index) => <div key={step.title}><b>{index + 1}</b><p><strong>{step.title}</strong> {step.desc}</p></div>)}
                </div>
            </section>
            <section className="affiliate-reference__rules"><h3>{t('affiliate_rules_title')}</h3>{rules.map((rule) => <p key={rule.title}><strong>{rule.title}</strong> {rule.desc}</p>)}</section>
        </div>
    );
}

function AffiliateProgress({ eligibility }: { eligibility: AffiliateEligibility }) {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });
    const referralUrl = eligibility.referralUrl;
    const rows = [
        { label: t('affiliate_gate_revenue'), current: eligibility.invitedCents, target: eligibility.gateNetUsdCents, money: true },
        { label: t('affiliate_gate_payers'), current: eligibility.payers, target: eligibility.gatePayers, money: false },
    ];

    function copyLink() {
        if (referralUrl) openSharePoster({ url: referralUrl, title: '邀请好友，一起看精彩短剧', inviteCode: new URL(referralUrl).searchParams.get('ref') || undefined });
    }

    return (
        <div className="affiliate-reference__progress">
            <section className="affiliate-reference__progress-card">
                <h2>{t('affiliate_progress_title')}</h2>
                <p>{t('affiliate_progress_desc')}</p>
                <div className="affiliate-progress__rows">
                    {rows.map((row) => {
                        const percent = row.target <= 0 ? 100 : Math.min(100, Math.round((row.current / row.target) * 100));
                        const value = (amount: number) => row.money ? `¥${(amount / 100).toFixed(2)}` : amount.toLocaleString();
                        return <div key={row.label}><span><b>{row.label}</b><strong>{value(row.current)} / {value(row.target)}</strong></span><i><em style={{ width: `${percent}%` }} /></i></div>;
                    })}
                </div>
                <small>{intl.formatMessage({ id: 'affiliate_invited_so_far' }, { count: eligibility.invitedCount })}</small>
            </section>
            <section className="affiliate-reference__coin-mode">
                <h3>{t('affiliate_coin_mode_title')}</h3>
                <p>{t('affiliate_coin_mode_desc')}</p>
                <div><input value={referralUrl} readOnly /><button type="button" className="creator-program__button" disabled={!referralUrl} onClick={() => void copyLink()}>分享海报</button></div>
            </section>
        </div>
    );
}

export default function AffiliateProgram() {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });
    const sessionBootstrapReady = useRootStore((store) => store.sessionBootstrapReady);
    const uid = useUserStore((store) => getUserUidForDisplay(store.info));
    const scrollRef = useRef<HTMLDivElement>(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const [eligibility, setEligibility] = useState<AffiliateEligibility | null>(null);
    const [requestState, setRequestState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [requestError, setRequestError] = useState('');
    const preview = searchParams.get('preview');
    const previewState = preview === 'active' || preview === 'in_progress' ? preview : null;
    const state: AffiliateState = previewState ?? eligibility?.state ?? 'in_progress';
    const displayedEligibility = eligibility ?? (previewState ? {
        state: previewState,
        payers: 0,
        gatePayers: 5,
        invitedCount: 0,
        invitedCents: 0,
        gateNetUsdCents: 20000,
        referralCode: uid,
        referralUrl: buildAffiliateShareUrl(uid),
    } : null);
    const previewSteps = [
        { id: 'in_progress', label: t('affiliate_preview_progress') },
        { id: 'active', label: t('affiliate_preview_active') },
    ];

    function selectPreview(nextPreview: string) {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('preview', nextPreview);
        setSearchParams(nextParams, { replace: true });
    }

    const loadAffiliate = useCallback(async () => {
        setRequestState('loading');
        try {
            const normalized = normalizeAffiliate(await getAffiliateEligibility(), uid);
            if (!normalized) throw new Error('POST /api/user/affiliate：200 · 返回数据格式无效');
            setEligibility(normalized);
            setRequestError('');
            setRequestState('ready');
        } catch (error) {
            setRequestError(affiliateErrorMessage(error));
            setRequestState('error');
        }
    }, [uid]);

    useEffect(() => {
        if (previewState) {
            setRequestState('ready');
            return;
        }
        if (sessionBootstrapReady) void loadAffiliate();
    }, [loadAffiliate, previewState, sessionBootstrapReady]);

    return (
        <div className="creator-program-page">
            <div ref={scrollRef} className="creator-program-page__scroll">
                <ReelShortTopNav scrollParentRef={scrollRef} showPrimaryNav />
                <ProgramFlowPreview title={t('program_preview_title')} hint={t('program_preview_hint')} active={previewState ?? state} steps={previewSteps} onSelect={selectPreview} exitLabel={t('program_preview_exit')} onExit={previewState ? () => { const next = new URLSearchParams(searchParams); next.delete('preview'); setSearchParams(next, { replace: true }); } : undefined} />
                <main className="affiliate-reference">
                    <header><h1>{t('affiliate_title')}</h1><p>{t('affiliate_subtitle')}</p></header>
                    {!previewState && requestState === 'loading' ? <AffiliateStateCard icon="clock" title={t('loading')} description="" /> : null}
                    {!previewState && requestState === 'error' ? <AffiliateStateCard icon="clock" tone="gold" title="推广接口调用失败" description={requestError} action={<button type="button" className="creator-program__button" onClick={() => void loadAffiliate()}>重试</button>} /> : null}
                    {(previewState || requestState === 'ready') && state === 'in_progress' && displayedEligibility ? <AffiliateProgress eligibility={displayedEligibility} /> : null}
                    {state === 'active' ? <AffiliateDashboard preview={previewState === 'active'} sessionReady={sessionBootstrapReady} /> : null}
                    <AffiliateExplainer />
                </main>
            </div>
        </div>
    );
}
