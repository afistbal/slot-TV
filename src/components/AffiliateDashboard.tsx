import { openSharePoster } from '@/stores/sharePoster';
import { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { affiliateErrorMessage, getAffiliateStatistics, type AffiliateFunnel, type AffiliateSummary } from '@/api/affiliate';
import { demoAffiliateFunnel, demoAffiliateSummary } from '@/data/creatorDemo';
import { ProgramIcon } from '@/components/ProgramIcon';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';
import { buildAffiliateShareUrl } from '@/lib/shareUrls';
import { useUserStore } from '@/stores/user';

type DashboardData = {
    summary: AffiliateSummary | null;
    funnel: AffiliateFunnel | null;
    errors: string[];
    demo: boolean;
};

const AFFILIATE_DASHBOARD_CACHE_PREFIX = 'yogo:affiliate-dashboard:v1:';

function emptyAffiliateSummary(uid: string): AffiliateSummary {
    return {
        status: 'active',
        activatedAt: '',
        shareBps: 0,
        referralCode: uid,
        referralUrl: buildAffiliateShareUrl(uid),
        invitedCount: 0,
        totalEarnedCents: 0,
        pendingCents: 0,
        availableCents: 0,
        reversedCents: 0,
        paidOutCents: 0,
        earnings: [],
    };
}

function emptyAffiliateFunnel(): AffiliateFunnel {
    return {
        holdDays: 0,
        summary: {
            totalClicks: 0,
            totalDevices: 0,
            totalSignups: 0,
            totalPayers: 0,
            totalCommissionMicros: 0,
        },
        daily: [],
    };
}

function emptyDashboardData(uid: string): DashboardData {
    return { summary: emptyAffiliateSummary(uid), funnel: emptyAffiliateFunnel(), errors: [], demo: false };
}

function readDashboardCache(uid: string): DashboardData | null {
    if (!uid) return null;
    try {
        const cached = JSON.parse(localStorage.getItem(`${AFFILIATE_DASHBOARD_CACHE_PREFIX}${uid}`) ?? 'null') as Partial<DashboardData> | null;
        if (!cached?.summary || !cached.funnel) return null;
        return { summary: cached.summary, funnel: cached.funnel, errors: [], demo: false };
    } catch {
        return null;
    }
}

function writeDashboardCache(uid: string, summary: AffiliateSummary, funnel: AffiliateFunnel): void {
    if (!uid) return;
    try {
        localStorage.setItem(`${AFFILIATE_DASHBOARD_CACHE_PREFIX}${uid}`, JSON.stringify({ summary, funnel }));
    } catch {
        // Keep rendering fresh data when storage is unavailable.
    }
}

export function AffiliateDashboard({ preview, sessionReady }: { preview: boolean; sessionReady: boolean }) {
    const intl = useIntl();
    const t = (id: string) => intl.formatMessage({ id });
    const w = (cn: string, tw = cn) => intl.locale === 'zh-TW' ? tw : cn;
    const uid = useUserStore((store) => getUserUidForDisplay(store.info));
    const [data, setData] = useState<DashboardData>(() => preview
        ? { summary: demoAffiliateSummary(), funnel: demoAffiliateFunnel(), errors: [], demo: true }
        : readDashboardCache(uid) ?? emptyDashboardData(uid));
    const [loading, setLoading] = useState(false);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        if (preview) {
            setData({ summary: demoAffiliateSummary(), funnel: demoAffiliateFunnel(), errors: [], demo: true });
            setLoading(false);
            return;
        }
        if (!sessionReady) return;
        let cancelled = false;
        setLoading(true);
        setData(readDashboardCache(uid) ?? emptyDashboardData(uid));
        void getAffiliateStatistics().then((result) => {
            if (cancelled) return;
            writeDashboardCache(uid, result.income, result.stat);
            setData({
                summary: result.income,
                funnel: result.stat,
                errors: [],
                demo: false,
            });
            setLoading(false);
        }).catch((error) => {
            if (cancelled) return;
            setData((current) => ({ ...current, errors: [affiliateErrorMessage(error)], demo: false }));
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, [preview, sessionReady, revision, uid]);

    const { summary, funnel, errors, demo } = data;
    const referralUrl = buildAffiliateShareUrl(uid);
    const money = (value: number | undefined) => `¥${(Number(value ?? 0) / 100).toFixed(2)}`;
    const earnings = Array.isArray(summary?.earnings) ? summary.earnings : [];
    const daily = Array.isArray(funnel?.daily) ? funnel.daily : [];
    const total = (key: 'clicks' | 'devices' | 'signups' | 'payers') => daily.reduce((sum, day) => sum + Number(day[key] ?? 0), 0);

    function copyLink() {
        if (referralUrl) openSharePoster({ url: referralUrl, title: '邀请好友，一起看精彩短剧', inviteCode: new URL(referralUrl).searchParams.get('ref') || undefined });
    }

    return <section className="affiliate-inline-dashboard" aria-label={t('affiliate_dashboard_title')} aria-busy={loading}>
        <header className="affiliate-inline-dashboard__heading">
            <div><h2>{t('affiliate_dashboard_title')}</h2><p>{t('affiliate_dashboard_desc')}</p></div>
            <span className="creator-program__status-badge creator-program__status-badge--approved"><ProgramIcon name="checkCircle" />{preview ? w('推广后台预览', '推廣後台預覽') : t('affiliate_active_title')}</span>
        </header>
        {errors.length ? <div className="affiliate-reference__refresh-note" role="status">
            <span>{w('数据刷新失败，当前展示上次数据', '資料重新整理失敗，目前顯示上次資料')}</span>
            <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>{w('重试', '重試')}</button>
            {errors.map((error) => <small key={error}>{error}</small>)}
        </div> : null}
        {demo ? <p className="creator-workspace__demo">{preview
            ? w('演示假数据：仅供查看推广后台，不代表真实资格、收益或订单。', '示範假資料：僅供查看推廣後台，不代表真實資格、收益或訂單。')
            : w('未接通的接口保留真实错误，对应区域展示演示假数据，不代表真实收益。', '未接通的介面保留真實錯誤，對應區域顯示示範假資料，不代表真實收益。')}</p> : null}
        {summary ? <>
            <div className="creator-dashboard__stats">
                <article><span>{t('affiliate_total_commission')}</span><strong>{money(summary.totalEarnedCents)}</strong><small>{t('affiliate_all_time')}</small></article>
                <article><span>{w('待结算佣金', '待結算佣金')}</span><strong>{money(summary.pendingCents)}</strong><small>{w('冻结期结束后转为可提现', '凍結期結束後轉為可提現')}</small></article>
                <article><span>{t('affiliate_available')}</span><strong>{money(summary.availableCents)}</strong><small>{t('affiliate_can_withdraw')}</small></article>
                <article><span>{t('affiliate_invited')}</span><strong>{summary.invitedCount ?? 0}</strong><small>{t('affiliate_registered_users')}</small></article>
            </div>
            <div className="affiliate-dashboard__link-card">
                <div><ProgramIcon name="send" /><span><b>{t('affiliate_your_link')}</b><small>{t('affiliate_your_link_desc')}</small></span></div>
                <div className="affiliate-dashboard__copy"><input aria-label={t('affiliate_your_link')} value={referralUrl} readOnly /><button type="button" className="creator-program__button" disabled={!referralUrl} onClick={() => void copyLink()}>分享海报</button></div>
            </div>
        </> : null}
        {funnel ? <section className="affiliate-inline-dashboard__section">
            <h3>{w('最近 30 天推广统计', '最近 30 天推廣統計')}</h3>
            <div className="creator-dashboard__stats">
                {[
                    [w('点击', '點擊'), funnel.summary?.totalClicks ?? total('clicks')],
                    [w('设备', '裝置'), funnel.summary?.totalDevices ?? total('devices')],
                    [w('注册', '註冊'), funnel.summary?.totalSignups ?? total('signups')],
                    [w('付费用户', '付費用戶'), funnel.summary?.totalPayers ?? total('payers')],
                ].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}
            </div>
        </section> : null}
        {summary ? <section className="affiliate-inline-dashboard__section">
            <h3>{w('最近佣金', '最近佣金')}</h3>
            {earnings.length ? <div className="affiliate-inline-dashboard__earnings">{earnings.map((earning) => <article key={earning.id}>
                <div><span>{earning.orderDate}</span><small>{({ pending: w('待结算', '待結算'), available: w('可提现', '可提現'), reversed: w('已冲正', '已沖正') })[earning.entryStatus] ?? earning.entryStatus}</small></div>
                <strong>{money(earning.amountCents)}</strong>
            </article>)}</div> : <p>{w('暂无佣金记录', '暫無佣金紀錄')}</p>}
        </section> : null}
    </section>;
}
