import type { CreatorRecord } from '@/api/creator';
import type { AffiliateFunnel, AffiliateSummary } from '@/api/affiliate';

/** Local display fixtures only. Never use these IDs for a business mutation. */
export function isCreatorDemo(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) return value.some(isCreatorDemo);
    const record = value as CreatorRecord;
    return record.__demo === true || [record.id, record.dramaId, record.commissionId].some((entry) => typeof entry === 'string' && entry.startsWith('demo-'));
}

const demo = <T extends CreatorRecord>(record: T): T & { __demo: true } => ({ ...record, __demo: true });
const date = '2026-10-19T08:00:00Z';
const work = { dramaId: 'demo-drama-1', title: '星河旅人（演示作品）', status: 'published', episodeCount: 12, totalPlays: 12860, totalLikes: 860, totalComments: 36, totalFavorites: 210 };

export function creatorDemoDashboard(): CreatorRecord {
    return demo({
        creator: { displayName: '演示创作者', contact: 'demo@example.com', intro: '这是一段用于预览创作者设置表单的演示介绍。所有作品、订单和金额均为本地假数据，仅用于查看页面布局和操作流程，不代表真实创作者状态、收益或审核结果。', tools: ['Sora', 'Kling'], monthlyOutput: '每月 4 部', handle: 'demo_creator', publicBio: '用 AI 讲述故事，探索更多创作可能。', acceptsExclusive: true },
        totalEarnedCents: 126650, availableCents: 66500, pendingCents: 20150, reservedCents: 10000, paidOutCents: 30000, followers: 326,
        earningsBySource: { streaming: 80500, download: 23150, commission: 15000, exclusive: 5000, affiliate: 3000 },
        contentStats: [demo(work), demo({ ...work, dramaId: 'demo-drama-2', title: '时光来信（演示作品）', status: 'reviewing', episodeCount: 4, totalPlays: 0, totalLikes: 0, totalComments: 0, totalFavorites: 0 })],
        products: [
            demo({ id: 'demo-product-1', title: '星河旅人 · 高清完整版', description: '全 12 集高清 MP4，购买后下载。演示商品，无实际交付文件。', status: 'published', priceCents: 999, deliveryType: 'upload', filePath: 'demo/products/full.mp4', watermark: true }),
            demo({ id: 'demo-product-2', title: '时光来信 · 番外合集', description: '用于查看草稿上架流程的演示记录。', status: 'draft', priceCents: 499, deliveryType: 'upload', filePath: 'demo/products/extra.mp4', watermark: true }),
            demo({ id: 'demo-product-3', title: '幕后创作素材包', description: '用于查看文件补传入口。', status: 'draft', priceCents: 299, deliveryType: 'upload', filePath: 'pending-upload', watermark: false }),
        ],
        activeCommissions: [demo({ id: 'demo-commission-1', title: 'AI 科幻短片定制（演示订单）', status: 'in_progress', budgetCents: 50000, description: '制作一支 60 秒科幻短片，分镜确认后交付完整版。', days: 7 })],
        myBids: [demo({ id: 'demo-bid-1', commissionId: 'demo-commission-2', title: '节日品牌短片（演示报价）', status: 'pending', priceCents: 30000, days: 5, message: '提供分镜、初稿和一轮修改。' })],
        payouts: [demo({ id: 'demo-payout-1', usdMicros: 100000000, status: 'processing', createdAt: date }), demo({ id: 'demo-payout-2', usdMicros: 200000000, status: 'completed', createdAt: '2026-10-10T08:00:00Z' })],
        licenses: [demo({ id: 'demo-license-1', dramaTitle: '星河旅人', status: 'offered', offerCents: 50000, terms: '演示授权邀请：授权范围为指定作品，期限 12 个月。仅供查看页面，不构成真实授权。', createdAt: date }), demo({ id: 'demo-license-2', dramaTitle: '时光来信', status: 'accepted', offerCents: 30000, terms: '演示已接受记录。', createdAt: date })],
    });
}

export type CreatorDemoRead = 'commissions' | 'milestones' | 'dramas' | 'episodes' | 'comments' | 'earnings' | 'payoutMethods';

export function creatorDemoRead(kind: CreatorDemoRead, query: CreatorRecord = {}): CreatorRecord {
    const offset = Number(query.offset ?? 0), limit = Number(query.limit ?? 20);
    if (kind === 'commissions') {
        let items = Array.from({ length: 25 }, (_, index) => demo({ id: `demo-commission-${index + 1}`, title: `${['AI 科幻短片定制', '品牌故事短视频', '动画角色宣传片'][index % 3]} · ${index + 1}`, status: 'open', budgetCents: 20000 + index * 1500, days: 7, description: '演示需求：提供完整分镜、原创素材和成片，支持一轮修改。' }));
        if (query.sort === 'budget') items = items.sort((a, b) => Number(b.budgetCents) - Number(a.budgetCents));
        return demo({ items: items.slice(offset, offset + limit), total: items.length });
    }
    if (kind === 'milestones') return demo({ items: [
        demo({ id: 'demo-milestone-1', commissionId: query.commissionId, title: '第一阶段：分镜与样片', status: 'completed', amountCents: 15000, note: '演示已验收记录。' }),
        demo({ id: 'demo-milestone-2', commissionId: query.commissionId, title: '第二阶段：完整成片', status: 'funded', amountCents: 35000, note: '演示待交付记录，可查看文件和说明表单。' }),
        demo({ id: 'demo-milestone-3', commissionId: query.commissionId, title: '修改交付示例', status: 'revision', amountCents: 0, note: '根据需求调整配音和字幕。' }),
    ] });
    if (kind === 'dramas') return demo({ dramas: [demo({ dramaId: work.dramaId, titleI18n: { 'zh-CN': work.title, 'zh-TW': '星河旅人（示範作品）' }, slug: 'demo-star' })], words: [] });
    if (kind === 'episodes') return demo({ episodes: Array.from({ length: 3 }, (_, index) => demo({ episodeId: `demo-episode-${index + 1}`, seq: index + 1, title: `第 ${index + 1} 集（演示）` })), words: [] });
    if (kind === 'comments') {
        const messages = ['分镜和光影很有电影感，期待下一集。', '角色设计很特别，能分享一下制作过程吗？', '剧情很吸引人，期待更新。'];
        let items = Array.from({ length: 25 }, (_, index) => demo({ id: `demo-comment-${index + 1}`, dramaId: work.dramaId, episodeId: `demo-episode-${index % 3 + 1}`, nickname: `演示观众 ${index + 1}`, content: messages[index % 3], createdAt: date, likes: 3 + index, substantive: index % 2 === 0 }));
        if (query.dramaId) items = items.filter((row) => row.dramaId === query.dramaId);
        if (query.episodeId) items = items.filter((row) => row.episodeId === query.episodeId);
        if (query.query) items = items.filter((row) => row.content.includes(String(query.query)));
        if (query.substantive != null) items = items.filter((row) => row.substantive === query.substantive);
        if (query.sort === 'hot') items.sort((a, b) => b.likes - a.likes);
        return demo({ items: items.slice(offset, offset + limit), total: items.length });
    }
    if (kind === 'earnings') return demo({ totalCents: 28500, otherCents: 0, gran: query.gran ?? 'day', series: [{ bucket: query.from ?? '2026-10-01', cents: 8500 }, { bucket: query.to ?? '2026-10-19', cents: 20000 }], byDrama: [{ dramaId: work.dramaId, titleI18n: { 'zh-CN': work.title }, cents: 28500 }] });
    if (kind === 'payoutMethods') return demo({ items: [demo({ id: 'demo-method-1', methodType: 'crypto_wallet', payoutAssetId: 'USDT_TRC20', displayMask: 'DEMO****1234', status: 'active' }), demo({ id: 'demo-method-2', methodType: 'alipay', payoutAssetId: 'CNY_FIAT', displayMask: 'demo****mail', status: 'pending_verification' })] });
    throw new Error(`Unknown creator demo resource: ${kind}`);
}

export function demoAffiliateSummary(): AffiliateSummary {
    return { status: 'active', activatedAt: date, shareBps: 1500, referralCode: 'DEMO', referralUrl: '', invitedCount: 28, totalEarnedCents: 18600, pendingCents: 3600, availableCents: 15000, reversedCents: 0, paidOutCents: 0, earnings: [{ id: 'demo-earning-1', orderDate: date, amountCents: 1800, entryStatus: 'pending', availableAt: '2026-10-26T08:00:00Z' }] };
}
export function demoAffiliateFunnel(): AffiliateFunnel {
    return { holdDays: 7, summary: { totalClicks: 360, totalDevices: 240, totalSignups: 28, totalPayers: 8, totalCommissionMicros: 186000000 }, daily: [{ dt: '2026-10-19', clicks: 36, devices: 24, signups: 3, payers: 1, commissionMicros: 18000000 }] };
}
