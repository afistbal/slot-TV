import { ProgramSelect } from '@/components/ProgramSelect';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { toast } from 'sonner';
import { creatorApi, creatorRequest, creatorRows, creatorText, type CreatorRecord } from '@/api/creator';
import { creatorDemoRead, isCreatorDemo } from '@/data/creatorDemo';

type Props = { tab: string; data: CreatorRecord; onRefresh: () => Promise<void>; canMutate: boolean };
const money = (value: unknown) => `$${(Number(value ?? 0) / 100).toFixed(2)}`;
const text = creatorText;
const id = (row: CreatorRecord) => text(row.id);
const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
const fileField = (form: FormData) => { const file = form.get('file'); return file instanceof File && file.size > 0 ? file : null; };

function useWords() {
    const { locale } = useIntl();
    return (simplified: string, traditional = simplified) => locale === 'zh-TW' ? traditional : simplified;
}

function useResource(load: () => Promise<unknown>, dependencies: string, fallback?: () => unknown) {
    const callback = useRef(load);
    callback.current = load;
    const fallbackRef = useRef(fallback);
    fallbackRef.current = fallback;
    const [value, setValue] = useState<unknown>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        setLoading(true); setError(''); setValue(null);
        void callback.current().then((next) => { if (active) setValue(next); }).catch((reason) => {
            if (active) {
                setError(reason instanceof Error ? reason.message : String(reason));
                setValue(fallbackRef.current?.() ?? null);
            }
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [dependencies, revision]);
    return { value, loading, error, demo: isCreatorDemo(value), refresh: () => setRevision((current) => current + 1) };
}

function ResourceState({ resource }: { resource: ReturnType<typeof useResource> }) {
    const w = useWords();
    return <>{resource.loading ? <p role="status">{w('加载中…', '載入中…')}</p> : resource.error ? <div role="alert" className="creator-workspace__error"><p>{resource.error}</p><button type="button" onClick={resource.refresh}>{w('重新加载', '重新載入')}</button></div> : null}{resource.demo ? <p className="creator-workspace__demo" role="note">{w('以下为演示假数据，真实接口错误保留。可继续查看详情和表单，不会产生真实订单或资金操作。', '以下為示範假資料，真實介面錯誤保留。可繼續查看詳情和表單，不會產生真實訂單或資金操作。')}</p> : null}</>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
    return <section className="creator-dashboard__panel creator-workspace"><h2>{title}</h2>{children}</section>;
}

function Empty({ children }: { children: ReactNode }) { return <p className="creator-workspace__empty">{children}</p>; }

function useAction(canMutate: boolean) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const inFlight = useRef(false);
    const w = useWords();
    async function run(action: () => Promise<void>) {
        if (inFlight.current || !canMutate) return;
        inFlight.current = true; setBusy(true); setError('');
        try { await action(); toast.success(w('操作成功', '操作成功')); }
        catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
        finally { inFlight.current = false; setBusy(false); }
    }
    return { busy, run, disabled: busy || !canMutate, error };
}

function ActionError({ error }: { error: string }) { return error ? <p className="creator-workspace__error" role="alert">{error}</p> : null; }

export function CreatorWorkspace(props: Props) {
    const w = useWords();
    return <>
        {!props.canMutate ? <p className="creator-workspace__notice">{w('流程预览：可以查看页面和表单，提交操作需要已审核通过的创作者账号。', '流程預覽：可以查看頁面和表單，提交操作需要已審核通過的創作者帳號。')}</p> : null}
        {props.tab === 'dashboard' ? <Overview data={props.data} /> : null}
        {props.tab === 'feedback' ? <Feedback /> : null}
        {props.tab === 'products' ? <Products {...props} /> : null}
        {props.tab === 'commissions' ? <Commissions {...props} /> : null}
        {props.tab === 'earnings' ? <Earnings {...props} /> : null}
        {props.tab === 'licenses' ? <Licenses {...props} /> : null}
        {props.tab === 'settings' ? <Settings {...props} /> : null}
    </>;
}

function SourceValues({ source }: { source: unknown }) {
    const w = useWords();
    const names: Record<string, string> = { streaming: w('播放分成', '播放分成'), download: w('下载销售', '下載銷售'), commission: w('定制收入', '訂製收入'), exclusive: w('独家授权', '獨家授權'), affiliate: w('推广佣金', '推廣佣金') };
    if (!source || typeof source !== 'object') return null;
    return <div className="creator-dashboard__stats">{Object.entries(source).filter(([key]) => Object.prototype.hasOwnProperty.call(names, key)).map(([key, amount]) => <article key={key}><span>{names[key]}</span><strong>{money(amount)}</strong></article>)}</div>;
}

function Overview({ data }: { data: CreatorRecord }) {
    const w = useWords();
    const content = creatorRows(data.contentStats);
    return <>
        <div className="creator-dashboard__stats">{[[w('累计收益', '累計收益'), money(data.totalEarnedCents)], [w('作品数量', '作品數量'), content.length], [w('总播放', '總播放'), content.reduce((sum, row) => sum + Number(row.totalPlays ?? 0), 0)], [w('关注人数', '關注人數'), data.followers ?? 0]].map(([label, value]) => <article key={String(label)}><span>{String(label)}</span><strong>{String(value)}</strong></article>)}</div>
        <Panel title={w('作品表现', '作品表現')}><DataList rows={content} fields={['title', 'status', 'episodeCount', 'totalPlays', 'totalLikes', 'totalComments', 'totalFavorites']} /><SourceValues source={data.earningsBySource} /></Panel>
    </>;
}

const fieldNames: Record<string, [string, string]> = {
    deliveryType: ['交付方式', '交付方式'], watermark: ['水印保护', '浮水印保護'], filePath: ['文件位置', '檔案位置'],
    title: ['标题', '標題'], titleI18n: ['作品', '作品'], dramaTitle: ['作品', '作品'], status: ['状态', '狀態'], episodeCount: ['集数', '集數'], totalPlays: ['播放', '播放'], totalLikes: ['点赞', '按讚'], totalComments: ['评论', '評論'], totalFavorites: ['收藏', '收藏'],
    createdAt: ['创建时间', '建立時間'], priceCents: ['售价', '售價'], amountCents: ['金额', '金額'], usdMicros: ['提现金额', '提現金額'], feeMicros: ['手续费', '手續費'], netUsdMicros: ['预计到账', '預計到帳'], expiresAt: ['报价有效期', '報價有效期'],
    content: ['内容', '內容'], body: ['内容', '內容'], nickname: ['用户', '使用者'], message: ['说明', '說明'], note: ['备注', '備註'], totalCents: ['收益', '收益'], cents: ['收益', '收益'], day: ['日期', '日期'], bucket: ['日期', '日期'], submittedAt: ['提交时间', '提交時間'], seq: ['集数', '集數'], likes: ['点赞', '按讚'], comments: ['评论', '評論'], favorites: ['收藏', '收藏'], displayMask: ['收款账户', '收款帳戶'], payoutAssetId: ['收款币种', '收款幣種'], displayName: ['名称', '名稱'], price: ['报价', '報價'], days: ['交付天数', '交付天數'], budgetCents: ['预算', '預算'], minBudgetCents: ['最低预算', '最低預算'], maxBudgetCents: ['最高预算', '最高預算'], amount: ['金额', '金額'], offerCents: ['授权报价', '授權報價'],
};

function DataList({ rows, fields }: { rows: CreatorRecord[]; fields: string[] }) {
    const w = useWords();
    if (!rows.length) return <Empty>{w('暂无记录', '暫無紀錄')}</Empty>;
    return <div className="creator-workspace__list">{rows.map((row, index) => <dl key={id(row) || text(row.dramaId) || index}>{fields.filter((key) => row[key] != null).map((key) => <div key={key}><dt>{w(...(fieldNames[key] ?? [key, key]))}</dt><dd>{key.endsWith('Cents') || key === 'cents' ? money(row[key]) : key.endsWith('Micros') ? `$${(Number(row[key]) / 1e6).toFixed(2)}` : text(row[key])}</dd></div>)}</dl>)}</div>;
}

function Products({ data, onRefresh, canMutate }: Props) {
    const w = useWords();
    const action = useAction(canMutate && !isCreatorDemo(data));
    const [deliveryType, setDeliveryType] = useState('upload');
    const [draftId, setDraftId] = useState('');
    const [draftFile, setDraftFile] = useState<File | null>(null);
    const products = creatorRows(data.products);
    function create(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        const file = fileField(form); const externalUrl = field(form, 'externalUrl');
        void action.run(async () => {
            if (!field(form, 'title')) throw new Error(w('请填写标题', '請填寫標題'));
            if (deliveryType === 'upload' && !file) throw new Error(w('请选择交付文件', '請選擇交付檔案'));
            if (deliveryType === 'external' && !externalUrl.startsWith('https://')) throw new Error(w('外部交付地址必须为 HTTPS', '外部交付位址必須為 HTTPS'));
            const created = await creatorApi.createProduct({ title: field(form, 'title'), description: field(form, 'description') || null, priceCents: Number(form.get('priceCents')), watermark: deliveryType === 'upload' && form.get('watermark') === 'on', filePath: deliveryType === 'upload' ? 'pending-upload' : externalUrl, deliveryType });
            if (file) {
                const productId = typeof created === 'string' ? created : text(created?.productId ?? created?.id);
                if (!productId) throw new Error(w('已创建草稿，但接口没有返回 productId，无法继续上传。', '已建立草稿，但介面沒有回傳 productId，無法繼續上傳。'));
                setDraftId(productId); setDraftFile(file);
                await creatorApi.uploadProduct(productId, file); setDraftId(''); setDraftFile(null);
            }
            await onRefresh();
        });
    }
    return <Panel title={w('下载商品', '下載商品')}><ActionError error={action.error} />
        <details className="creator-dashboard__workflow-details"><summary>{w('新增商品', '新增商品')}</summary><form className="creator-dashboard__workflow-form" onSubmit={create}>
            <label>{w('商品标题', '商品標題')}<input name="title" required maxLength={120} /></label><label>{w('价格（美元分）', '價格（美元分）')}<input name="priceCents" required type="number" min={1} step={1} defaultValue={500} /></label>
            <label className="creator-dashboard__workflow-full">{w('商品说明', '商品說明')}<textarea name="description" maxLength={1000} /></label>
            <label>{w('交付方式', '交付方式')}<ProgramSelect aria-label={w('交付方式', '交付方式')} value={deliveryType} onValueChange={setDeliveryType} options={[{ value: 'upload', label: w('上传文件', '上傳檔案') }, { value: 'external', label: w('外部链接', '外部連結') }]} /></label>
            {deliveryType === 'upload' ? <><label>{w('交付文件', '交付檔案')}<input type="file" name="file" required /></label><label className="creator-workspace__check"><input name="watermark" type="checkbox" defaultChecked />{w('水印保护', '浮水印保護')}</label></> : <label>{w('HTTPS 交付链接', 'HTTPS 交付連結')}<input name="externalUrl" type="url" required pattern="https://.*" /></label>}
            <button className="creator-program__button" disabled={action.disabled || !!draftId}>{w('创建草稿', '建立草稿')}</button>
        </form></details>
        {draftId && draftFile ? <button type="button" disabled={action.disabled} onClick={() => void action.run(async () => { await creatorApi.uploadProduct(draftId, draftFile); setDraftId(''); setDraftFile(null); await onRefresh(); })}>{w('重试草稿文件上传', '重試草稿檔案上傳')}</button> : null}
        {!products.length ? <Empty>{w('暂无商品', '暫無商品')}</Empty> : products.map((product) => <article className="creator-workspace__item" key={id(product)}><DataList rows={[product]} fields={['title', 'status', 'priceCents']} /><details><summary>{w('查看商品详情', '查看商品詳情')}</summary><p>{text(product.description)}</p><DataList rows={[product]} fields={['deliveryType', 'watermark', 'filePath']} /></details>
            {product.status === 'draft' && (!product.filePath || product.filePath === 'pending-upload') ? <label>{w('补传交付文件', '補傳交付檔案')}<input disabled={action.disabled} type="file" onChange={(e) => { const file = e.target.files?.[0]; if (file) void action.run(async () => { await creatorApi.uploadProduct(id(product), file); await onRefresh(); }); }} /></label> : null}
            {product.status === 'draft' || product.status === 'published' ? <button type="button" disabled={action.disabled || !id(product) || (product.status === 'draft' && (!product.filePath || product.filePath === 'pending-upload'))} onClick={() => void action.run(async () => { if (product.status === 'draft') await creatorApi.publishProduct(id(product)); else await creatorApi.unpublishProduct(id(product)); await onRefresh(); })}>{product.status === 'draft' ? w('上架', '上架') : w('下架', '下架')}</button> : null}
        </article>)}
    </Panel>;
}

function Commissions({ data, canMutate, onRefresh }: Props) {
    const w = useWords();
    const [section, setSection] = useState('open');
    const [sort, setSort] = useState('newest');
    const [offset, setOffset] = useState(0);
    const resource = useResource(() => creatorApi.commissions({ sort, limit: 20, offset }), `${sort}:${offset}`, () => creatorDemoRead('commissions', { sort, offset, limit: 20 }));
    const [selected, setSelected] = useState<CreatorRecord | null>(null);
    const action = useAction(canMutate && !isCreatorDemo(selected));
    const rows = section === 'open' ? creatorRows(resource.value) : creatorRows(section === 'active' ? data.activeCommissions : data.myBids);
    const commissionId = selected ? text(selected.commissionId ?? selected.id) : '';
    return <Panel title={w('定制广场', '訂製廣場')}><ActionError error={action.error} /><div className="creator-dashboard__filters">{[['open', w('公开需求', '公開需求')], ['active', w('我的订单', '我的訂單')], ['bids', w('我的报价', '我的報價')]].map(([key, label]) => <button type="button" key={key} aria-pressed={section === key} onClick={() => { setSection(key); setSelected(null); }}>{label}</button>)}<ProgramSelect aria-label={w('排序', '排序')} value={sort} onValueChange={(value) => { setSort(value); setOffset(0); }} options={[{ value: 'newest', label: w('最新', '最新') }, { value: 'budget', label: w('预算', '預算') }]} /></div>
        {section === 'open' ? <ResourceState resource={resource} /> : null}
        <DataList rows={rows} fields={['title', 'status', 'budgetCents', 'minBudgetCents', 'maxBudgetCents', 'priceCents', 'days', 'message']} />
        {rows.map((row) => <button type="button" key={text(row.commissionId ?? row.id)} onClick={() => setSelected(row)}>{text(row.title) || w('查看需求', '查看需求')} · {section === 'open' ? w('报价', '報價') : w('查看进度', '查看進度')}</button>)}
        {selected ? <article className="creator-workspace__item"><h3>{text(selected.title)}</h3><p>{text(selected.description ?? selected.message)}</p><DataList rows={[selected]} fields={['status', 'budgetCents', 'priceCents', 'days']} />{isCreatorDemo(selected) ? <p className="creator-workspace__demo">{w('演示详情：可以填写表单预览，不能提交真实业务。', '示範詳情：可以填寫表單預覽，不能提交真實業務。')}</p> : null}</article> : null}
        {section === 'open' ? <div className="creator-workspace__actions"><button type="button" disabled={offset === 0 || resource.loading} onClick={() => setOffset(Math.max(0, offset - 20))}>{w('上一页', '上一頁')}</button><button type="button" disabled={rows.length < 20 || resource.loading} onClick={() => setOffset(offset + 20)}>{w('下一页', '下一頁')}</button></div> : null}
        {selected && section === 'open' ? <form className="creator-dashboard__workflow-form" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void action.run(async () => { await creatorApi.bid(commissionId, { priceCents: Number(form.get('priceCents')), days: Number(form.get('days')), message: field(form, 'message') || null, sampleUrl: field(form, 'sampleUrl') || null }); setSelected(null); resource.refresh(); await onRefresh(); }); }}><h3 className="creator-dashboard__workflow-full">{text(selected.title)}</h3><label>{w('报价（美元分）', '報價（美元分）')}<input required name="priceCents" type="number" min={1} step={1} /></label><label>{w('交付天数', '交付天數')}<input required name="days" type="number" min={1} step={1} /></label><label>{w('交付计划', '交付計畫')}<textarea name="message" /></label><label>{w('样例链接', '範例連結')}<input name="sampleUrl" type="url" /></label><button disabled={action.disabled || !commissionId}>{w('提交报价', '提交報價')}</button></form> : null}
        {selected && section === 'active' ? <Milestones key={commissionId} commissionId={commissionId} canMutate={canMutate} onRefresh={onRefresh} /> : null}
    </Panel>;
}

function Milestones({ commissionId, canMutate, onRefresh }: { commissionId: string; canMutate: boolean; onRefresh: () => Promise<void> }) {
    const w = useWords();
    const resource = useResource(() => creatorApi.milestones(commissionId), commissionId, () => creatorDemoRead('milestones', { commissionId }));
    const action = useAction(canMutate && !resource.demo);
    const rows = creatorRows(resource.value);
    return <div><h3>{w('订单里程碑', '訂單里程碑')}</h3><ResourceState resource={resource} /><ActionError error={action.error} />{rows.map((row) => <article key={id(row)} className="creator-workspace__item"><DataList rows={[row]} fields={['title', 'status', 'amountCents', 'note']} />{row.status === 'funded' || row.status === 'revision' ? <form className="creator-dashboard__workflow-form" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void action.run(async () => { const file = fileField(form); if (!file) throw new Error(w('请选择交付文件', '請選擇交付檔案')); const uploaded = await creatorApi.uploadDelivery(commissionId, file); if (!uploaded.filePath) throw new Error('上传接口缺少 filePath'); await creatorApi.deliver(id(row), { filePath: uploaded.filePath, note: field(form, 'note') || null }); resource.refresh(); await onRefresh(); }); }}><label>{w('交付文件', '交付檔案')}<input required name="file" type="file" /></label><label>{w('交付说明', '交付說明')}<textarea name="note" /></label><button disabled={action.disabled || !id(row)}>{w('提交交付', '提交交付')}</button></form> : null}</article>)}</div>;
}

function Feedback() {
    const w = useWords(); const [days, setDays] = useState(30); const [dramaId, setDramaId] = useState(''); const [episodeId, setEpisodeId] = useState(''); const [query, setQuery] = useState(''); const [offset, setOffset] = useState(0); const [sort, setSort] = useState('latest'); const [substantive, setSubstantive] = useState('');
    const dramas = useResource(() => creatorApi.commentDramas({ days }), String(days), () => creatorDemoRead('dramas'));
    const episodes = useResource(() => dramaId ? creatorApi.commentEpisodes({ dramaId, days }) : Promise.resolve(null), `${dramaId}:${days}`, () => creatorDemoRead('episodes', { dramaId }));
    const comments = useResource(() => creatorApi.comments({ dramaId: dramaId || null, episodeId: episodeId || null, days, substantive: substantive === '' ? null : substantive === 'true', query: query || null, sort, offset, limit: 20 }), JSON.stringify([dramaId, episodeId, days, substantive, query, sort, offset]), () => creatorDemoRead('comments', { dramaId, episodeId, query, substantive: substantive === '' ? null : substantive === 'true', sort, offset, limit: 20 }));
    const dramaData = dramas.value as CreatorRecord | null; const episodeData = episodes.value as CreatorRecord | null;
    const dramaRows = creatorRows(dramaData?.dramas ?? dramas.value); const episodeRows = creatorRows(episodeData?.episodes ?? episodes.value);
    return <Panel title={w('观众反馈', '觀眾回饋')}><div className="creator-dashboard__filters"><ProgramSelect aria-label={w('时间范围', '時間範圍')} value={days} onValueChange={(value) => { setDays(Number(value)); setOffset(0); }} options={[7, 30, 90].map((value) => ({ value, label: value + ' ' + w('天', '天') }))} /><ProgramSelect aria-label={w('作品', '作品')} value={dramaId} onValueChange={(value) => { setDramaId(value); setEpisodeId(''); setOffset(0); }} options={[{ value: '', label: w('全部作品', '全部作品') }, ...dramaRows.map((row) => ({ value: text(row.dramaId ?? row.id), label: text(row.titleI18n ?? row.title ?? row.slug) }))]} /><ProgramSelect aria-label={w('剧集', '劇集')} value={episodeId} disabled={!dramaId} onValueChange={(value) => { setEpisodeId(value); setOffset(0); }} options={[{ value: '', label: w('全部剧集', '全部劇集') }, ...episodeRows.map((row) => ({ value: text(row.episodeId ?? row.id), label: text(row.title ?? row.seq) }))]} />
        <ProgramSelect aria-label={w('评论类型', '評論類型')} value={substantive} onValueChange={(value) => { setSubstantive(value); setOffset(0); }} options={[{ value: '', label: w('全部评论', '全部評論') }, { value: 'true', label: w('有效评论', '有效評論') }, { value: 'false', label: w('其他评论', '其他評論') }]} /><ProgramSelect aria-label={w('排序', '排序')} value={sort} onValueChange={(value) => { setSort(value); setOffset(0); }} options={[{ value: 'latest', label: w('最新', '最新') }, { value: 'hot', label: w('热门', '熱門') }]} /></div>
        <form className="creator-workspace__actions" onSubmit={(e) => { e.preventDefault(); setQuery(field(new FormData(e.currentTarget), 'query')); setOffset(0); }}><input name="query" placeholder={w('搜索评论', '搜尋評論')} /><button>{w('搜索', '搜尋')}</button></form>
        <ResourceState resource={dramas} />{dramaId ? <ResourceState resource={episodes} /> : null}<ResourceState resource={comments} />
        {!comments.loading ? <DataList rows={creatorRows(comments.value)} fields={['nickname', 'content', 'body', 'createdAt', 'likes']} /> : null}
        <div className="creator-workspace__actions"><button type="button" disabled={offset === 0 || comments.loading} onClick={() => setOffset(Math.max(0, offset - 20))}>{w('上一页', '上一頁')}</button><button type="button" disabled={creatorRows(comments.value).length < 20 || comments.loading} onClick={() => setOffset(offset + 20)}>{w('下一页', '下一頁')}</button></div>
    </Panel>;
}

const payoutOptions = [
    { label: 'USDT (TRC20)', methodType: 'crypto_wallet', payoutAssetId: 'USDT_TRC20', adapterKey: 'manual_crypto' },
    { label: 'USDT (ERC20)', methodType: 'crypto_wallet', payoutAssetId: 'USDT_ERC20', adapterKey: 'manual_crypto' },
    { label: 'USD Bank', methodType: 'bank_account', payoutAssetId: 'USD_FIAT', adapterKey: 'manual_bank' },
    { label: 'CNY Bank', methodType: 'bank_account', payoutAssetId: 'CNY_FIAT', adapterKey: 'manual_bank' },
    { label: 'Alipay', methodType: 'alipay', payoutAssetId: 'CNY_FIAT', adapterKey: 'manual_alipay' },
];

function Earnings({ data, canMutate, onRefresh }: Props) {
    const w = useWords(); const action = useAction(canMutate); const [quote, setQuote] = useState<CreatorRecord | null>(null);
    const [range, setRange] = useState(() => ({ from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), gran: 'day', tz: Intl.DateTimeFormat().resolvedOptions().timeZone, dramaId: '' }));
    const report = useResource(() => creatorApi.earnings(range), JSON.stringify(range), () => creatorDemoRead('earnings', range));
    const methods = useResource(creatorApi.payoutMethods, 'methods', () => creatorDemoRead('payoutMethods')); const methodRows = creatorRows(methods.value);
    const reportData = report.value as CreatorRecord | null;
    return <>
        <Panel title={w('收益中心', '收益中心')}><div className="creator-dashboard__stats">{[['pendingCents', w('待结算', '待結算')], ['availableCents', w('可提现', '可提現')], ['reservedCents', w('处理中', '處理中')], ['paidOutCents', w('已到账', '已到帳')]].map(([key, label]) => <article key={key}><span>{label}</span><strong>{money(data[key])}</strong></article>)}</div><ActionError error={action.error} /><SourceValues source={data.earningsBySource} />
            <h3>{w('收益报表', '收益報表')}</h3><form className="creator-dashboard__workflow-form" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); const from = field(form, 'from'), to = field(form, 'to'); if (from > to) { toast.error(w('结束日期不能早于开始日期', '結束日期不能早於開始日期')); return; } setRange({ from, to, gran: field(form, 'gran'), tz: field(form, 'tz'), dramaId: field(form, 'dramaId') }); }}><label>{w('开始日期', '開始日期')}<input required name="from" type="date" defaultValue={range.from} /></label><label>{w('结束日期', '結束日期')}<input required name="to" type="date" defaultValue={range.to} /></label><label>{w('粒度', '粒度')}<ProgramSelect aria-label={w('粒度', '粒度')} name="gran" options={[{ value: 'day', label: w('日', '日') }, { value: 'week', label: w('周', '週') }, { value: 'month', label: w('月', '月') }]} /></label><label>{w('时区', '時區')}<input required name="tz" defaultValue={range.tz} /></label><label>{w('作品', '作品')}<ProgramSelect aria-label={w('作品', '作品')} name="dramaId" options={[{ value: '', label: w('全部作品', '全部作品') }, ...creatorRows(data.contentStats).map((row) => ({ value: text(row.dramaId), label: text(row.title) }))]} /></label><button>{w('查询', '查詢')}</button></form><ResourceState resource={report} />
            {reportData ? <><p>{w('合计', '合計')} {money(reportData.totalCents ?? (reportData.summary as CreatorRecord | undefined)?.totalCents)}</p><DataList rows={creatorRows(reportData.series)} fields={['bucket', 'day', 'cents', 'totalCents']} /><DataList rows={creatorRows(reportData.byDrama ?? reportData.breakdown)} fields={['title', 'titleI18n', 'cents', 'totalCents']} /></> : null}
        </Panel>
        <Panel title={w('收款方式与提现', '收款方式與提現')}><ResourceState resource={methods} />
            {methodRows.map((method) => <article className="creator-workspace__item" key={id(method)}><DataList rows={[method]} fields={['payoutAssetId', 'displayMask', 'status']} />{method.status === 'active' || method.status === 'pending_verification' ? <button type="button" disabled={action.disabled || !id(method)} onClick={() => void action.run(async () => { await creatorApi.disablePayoutMethod(id(method)); setQuote(null); methods.refresh(); })}>{w('停用', '停用')}</button> : null}</article>)}
            <details><summary>{w('新增收款方式', '新增收款方式')}</summary><form className="creator-dashboard__workflow-form" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void action.run(async () => { const option = payoutOptions[Number(form.get('option'))]; const details = field(form, 'details'); if (!option || !details) throw new Error(w('请填写收款信息', '請填寫收款資訊')); await creatorApi.addPayoutMethod({ methodType: option.methodType, payoutAssetId: option.payoutAssetId, adapterKey: option.adapterKey, details, displayMask: details.length > 8 ? `${details.slice(0, 4)}****${details.slice(-4)}` : '****' }); methods.refresh(); }); }}><label>{w('收款方式', '收款方式')}<ProgramSelect aria-label={w('收款方式', '收款方式')} name="option" options={payoutOptions.map((option, index) => ({ value: index, label: option.label }))} /></label><label>{w('账户或完整银行收款信息', '帳戶或完整銀行收款資訊')}<textarea name="details" required /></label><button disabled={action.disabled}>{w('添加并等待审核', '新增並等待審核')}</button></form></details>
            <form className="creator-dashboard__workflow-form" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void action.run(async () => { const amount = Number(form.get('amount')); const payoutMethodId = field(form, 'payoutMethodId'); if (amount < 50 || Math.round(amount * 100) > Number(data.availableCents ?? 0)) throw new Error(w('最低提现 $50，且不能超过可用余额', '最低提現 $50，且不能超過可用餘額')); const result = await creatorApi.payoutQuote({ payoutMethodId, usdMicros: Math.round(amount * 1e6) }); setQuote(typeof result === 'string' ? { quoteId: result, usdMicros: Math.round(amount * 1e6) } : result); }); }}><label>{w('已审核收款方式', '已審核收款方式')}<ProgramSelect aria-label={w('已审核收款方式', '已審核收款方式')} required name="payoutMethodId" onValueChange={() => setQuote(null)} options={[{ value: '', label: w('请选择', '請選擇') }, ...methodRows.filter((row) => row.status === 'active').map((row) => ({ value: id(row), label: text(row.payoutAssetId) + ' · ' + text(row.displayMask) }))]} /></label><label>{w('金额（美元）', '金額（美元）')}<input required name="amount" type="number" min={50} step="0.01" onChange={() => setQuote(null)} /></label><button disabled={action.disabled || methods.loading || !!methods.error}>{w('获取提现报价', '取得提現報價')}</button></form>
            {quote ? <div className="creator-workspace__item"><DataList rows={[quote]} fields={['usdMicros', 'feeMicros', 'netUsdMicros', 'expiresAt']} /><button type="button" disabled={action.disabled} onClick={() => void action.run(async () => { if (quote.expiresAt && Date.parse(text(quote.expiresAt)) <= Date.now()) throw new Error(w('报价已过期，请重新获取', '報價已過期，請重新取得')); const quoteId = text(quote.quoteId ?? quote.id); if (!quoteId) throw new Error('报价缺少 quoteId'); await creatorApi.payout(quoteId); setQuote(null); await onRefresh(); })}>{w('确认提交提现', '確認提交提現')}</button></div> : null}
            <h3>{w('提现记录', '提現紀錄')}</h3><DataList rows={creatorRows(data.payouts)} fields={['status', 'usdMicros', 'amountCents', 'createdAt']} /><ActionError error={action.error} />
        </Panel>
    </>;
}

function Licenses({ data, canMutate, onRefresh }: Props) {
    const w = useWords(); const action = useAction(canMutate); const rows = creatorRows(data.licenses);
    return <Panel title={w('独家授权', '獨家授權')}><ActionError error={action.error} />{!rows.length ? <Empty>{w('暂无授权邀请', '暫無授權邀請')}</Empty> : rows.map((row) => <article className="creator-workspace__item" key={id(row)}><DataList rows={[row]} fields={['dramaTitle', 'title', 'status', 'offerCents', 'priceCents', 'amountCents', 'createdAt']} /><p>{text(row.terms ?? row.note)}</p>{row.status === 'offered' ? <div className="creator-workspace__actions">{[true, false].map((accept) => <button key={String(accept)} disabled={action.disabled || !id(row)} type="button" onClick={() => void action.run(async () => { await creatorApi.respondLicense(id(row), accept); await onRefresh(); })}>{accept ? w('接受授权', '接受授權') : w('拒绝授权', '拒絕授權')}</button>)}</div> : null}</article>)}</Panel>;
}

function Settings({ data, canMutate, onRefresh }: Props) {
    const w = useWords(); const action = useAction(canMutate); const creator = data.creator as CreatorRecord | undefined;
    return <Panel title={w('创作者设置', '創作者設定')}><ActionError error={action.error} />
        <form className="creator-dashboard__workflow-form" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void action.run(async () => { await creatorApi.handle(field(form, 'handle').toLowerCase()); await onRefresh(); }); }}><label>{w('公开主页名称', '公開主頁名稱')}<input name="handle" required pattern="[a-zA-Z0-9_]+" defaultValue={text(creator?.handle)} /></label><button disabled={action.disabled}>{w('保存主页名称', '儲存主頁名稱')}</button></form>
        <form className="creator-dashboard__workflow-form" key={JSON.stringify(creator)} onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void action.run(async () => { const intro = field(form, 'intro'); if (intro.length < 50) throw new Error(w('创作介绍至少 50 字', '創作介紹至少 50 字')); await creatorApi.profile({ displayName: field(form, 'displayName'), contact: field(form, 'contact'), intro, tools: field(form, 'tools').split(/[,，]/).map((value) => value.trim()).filter(Boolean), monthlyOutput: field(form, 'monthlyOutput'), acceptsExclusive: form.get('acceptsExclusive') === 'on' }); await creatorApi.publicBio(field(form, 'bio')); await onRefresh(); }); }}>
            <label>{w('显示名称', '顯示名稱')}<input required name="displayName" maxLength={30} defaultValue={text(creator?.displayName)} /></label><label>{w('联系方式', '聯絡方式')}<input required name="contact" maxLength={100} defaultValue={text(creator?.contact)} /></label><label className="creator-dashboard__workflow-full">{w('创作介绍（至少 50 字）', '創作介紹（至少 50 字）')}<textarea name="intro" required minLength={50} maxLength={1000} defaultValue={text(creator?.intro)} /></label><label>{w('擅长的工具（逗号分隔）', '擅長的工具（逗號分隔）')}<input name="tools" defaultValue={Array.isArray(creator?.tools) ? creator.tools.join(', ') : ''} /></label><label>{w('每月预计产量', '每月預計產量')}<input name="monthlyOutput" maxLength={50} defaultValue={text(creator?.monthlyOutput)} /></label><label className="creator-dashboard__workflow-full">{w('公开简介', '公開簡介')}<textarea name="bio" maxLength={500} defaultValue={text(creator?.publicBio)} /></label><label className="creator-workspace__check"><input name="acceptsExclusive" type="checkbox" defaultChecked={creator?.acceptsExclusive === true} />{w('接受独家合作邀请', '接受獨家合作邀請')}</label><button disabled={action.disabled}>{w('保存资料', '儲存資料')}</button>
        </form>
    </Panel>;
}

/** The same dashboard response is used after every mutation, so server IDs remain authoritative. */
export function loadCreatorWorkspace() { return creatorRequest<CreatorRecord>('POST', 'creator/dashboard'); }
