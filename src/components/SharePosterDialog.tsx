import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowUpRight, Copy, Crown, Download, Heart, Loader2, Share2, X } from 'lucide-react';
import { LegacyCoinIcon as Coins } from '@/components/LegacyCoinIcon';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BRAND_DISPLAY_NAME, BRAND_TOPNAV_WORDMARK_SRC } from '@/constants/brand';
import { useSharePosterStore, type SharePosterData } from '@/stores/sharePoster';
import { claimLuckyDailyShare, getLuckyRewards } from '@/api/lucky';
import { getInviteInfo } from '@/api/invite';
import { decodeLuckyReferralBenefits, type LuckyReferralBenefits } from '@/lib/luckyPageData';
import { skipRemoteApi } from '@/env';
import '@/styles/share-poster.scss';

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('图片加载失败'));
        image.src = src;
    });
}

async function renderPoster(data: SharePosterData): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = 720; canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('当前浏览器无法生成海报');
    const [cover, logo, qr] = await Promise.all([
        data.coverUrl ? loadImage(data.coverUrl).catch(() => null) : null,
        loadImage(BRAND_TOPNAV_WORDMARK_SRC).catch(() => null),
        QRCode.toDataURL(data.url, { width: 256, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#101216', light: '#ffffff' } }).then(loadImage),
    ]);
    ctx.fillStyle = '#15151e'; ctx.fillRect(0, 0, 720, 1080);
    if (cover) {
        const scale = Math.max(720 / cover.width, 860 / cover.height);
        ctx.drawImage(cover, (720 - cover.width * scale) / 2, (860 - cover.height * scale) / 2, cover.width * scale, cover.height * scale);
    } else {
        const glow = ctx.createLinearGradient(0, 0, 720, 860);
        glow.addColorStop(0, '#4a3518'); glow.addColorStop(.5, '#2a2118'); glow.addColorStop(1, '#101216');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, 720, 860);
        ctx.font = '800 70px sans-serif'; ctx.fillStyle = '#ffffff18'; ctx.fillText(BRAND_DISPLAY_NAME, 60, 450);
    }
    const shade = ctx.createLinearGradient(0, 0, 0, 1080);
    shade.addColorStop(0, '#10121699'); shade.addColorStop(.3, '#10121600'); shade.addColorStop(.62, '#10121680'); shade.addColorStop(.82, '#101216'); shade.addColorStop(1, '#101216');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 720, 1080);
    if (logo) ctx.drawImage(logo, 40, 36, 224, 64);
    ctx.fillStyle = '#fff'; ctx.font = '700 32px sans-serif';
    ctx.fillText(data.inviteCode ? '邀请好友，一起发现好剧' : '好剧值得一起看', 42, 148);
    ctx.fillStyle = '#e8c268'; ctx.font = '600 20px sans-serif'; ctx.fillText('精彩短剧 · 扫码即看', 42, 186);
    ctx.font = '800 42px sans-serif'; ctx.fillStyle = '#fff';
    let line = ''; const lines: string[] = [];
    const words = data.title.match(/[A-Za-z0-9'’-]+\s*|./gu) ?? [];
    for (const word of words) {
        if (ctx.measureText(line + word).width > 630 && line) { lines.push(line.trim()); line = word; } else line += word;
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((text, index) => {
        let display = text;
        if (index === 2 && lines.length > 3) { while (ctx.measureText(display + '…').width > 630) display = display.slice(0, -1); display += '…'; }
        ctx.fillText(display, 42, 724 + index * 54);
    });
    ctx.fillStyle = '#e8c268'; ctx.fillRect(42, 884, 52, 5);
    ctx.font = '600 22px sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(data.inviteCode ? '我的邀请码' : '扫码观看完整剧集', 42, 934);
    ctx.font = '800 32px sans-serif';
    if (data.inviteCode) ctx.fillText(data.inviteCode, 42, 982, 390);
    ctx.font = '400 19px sans-serif'; ctx.fillStyle = '#b0b3bd'; ctx.fillText(data.inviteCode ? '扫码打开，加入精彩世界' : `更多精彩，尽在 ${BRAND_DISPLAY_NAME}`, 42, 1030, 390);
    ctx.drawImage(qr, 494, 866, 184, 184);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('海报生成失败')), 'image/png'));
}

export function SharePosterDialog() {
    const data = useSharePosterStore(state => state.data);
    const close = useSharePosterStore(state => state.close);
    const [poster, setPoster] = useState<{ url: string; file: File } | null>(null);
    const [error, setError] = useState('');
    const [revision, setRevision] = useState(0);
    const [benefits, setBenefits] = useState<LuckyReferralBenefits | null>(null);
    const [benefitsLoading, setBenefitsLoading] = useState(false);
    const rewarded = useRef(false);
    useEffect(() => {
        setPoster(null); setError(''); rewarded.current = false;
        if (!data || data.reward) return;
        let cancelled = false; let objectUrl = '';
        void renderPoster(data).then(blob => {
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob);
            setPoster({ url: objectUrl, file: new File([blob], 'YogoShort-poster.png', { type: 'image/png' }) });
        }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : '海报生成失败'); });
        return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [data, revision]);
    useEffect(() => {
        if (!data?.reward) {
            setBenefits(null);
            setBenefitsLoading(false);
            return;
        }
        let active = true;
        setBenefits(null);
        setBenefitsLoading(true);
        void Promise.allSettled([getLuckyRewards(), getInviteInfo()]).then(([rewardsResult, inviteResult]) => {
            if (!active) return;
            const configured = rewardsResult.status === 'fulfilled'
                ? decodeLuckyReferralBenefits(rewardsResult.value)
                : { dailyShare: null, signupInviter: null, signupInvitee: null, purchasePct: null };
            const invite = inviteResult.status === 'fulfilled' ? inviteResult.value : null;
            setBenefits({
                dailyShare: configured.dailyShare,
                signupInviter: configured.signupInviter ?? invite?.config.signupInviter ?? null,
                signupInvitee: configured.signupInvitee ?? invite?.config.signupInvitee ?? null,
                purchasePct: configured.purchasePct ?? invite?.config.purchasePct ?? null,
            });
        }).finally(() => { if (active) setBenefitsLoading(false); });
        return () => { active = false; };
    }, [data]);
    async function onShared() {
        if (!data?.reward || rewarded.current || skipRemoteApi) return;
        rewarded.current = true;
        try { const coins = await claimLuckyDailyShare(); if (coins && coins > 0) toast.success(`分享成功，获得 ${coins} 金币`); }
        catch { /* Sharing remains successful when the daily reward has already been claimed. */ }
    }
    async function copy() {
        if (!data) return;
        try { await navigator.clipboard.writeText(data.url); toast.success('链接已复制'); void onShared(); }
        catch { toast.error('复制失败，请重试'); }
    }
    function save() {
        if (!poster) return;
        const anchor = document.createElement('a'); anchor.href = poster.url; anchor.download = poster.file.name; anchor.click();
        toast.success('已下载海报；手机也可长按图片保存');
    }
    async function sharePoster() {
        if (!poster || !data) return;
        if (!navigator.canShare?.({ files: [poster.file] })) { toast.info('当前浏览器不支持分享图片，请保存海报后分享'); return; }
        try { await navigator.share({ files: [poster.file], title: data.title }); void onShared(); }
        catch (reason) { if (!(reason instanceof Error && reason.name === 'AbortError')) toast.error('分享失败，请保存海报后重试'); }
    }
    async function shareLink() {
        if (!data) return;
        if (!navigator.share) {
            await copy();
            return;
        }
        try {
            await navigator.share({ title: data.title, text: `一起看《${data.title}》`, url: data.url });
            void onShared();
        } catch (reason) {
            if (!(reason instanceof Error && reason.name === 'AbortError')) await copy();
        }
    }
    const signupInviter = benefits?.signupInviter ?? 0;
    const signupInvitee = benefits?.signupInvitee ?? 0;
    const purchasePct = benefits?.purchasePct ?? 0;
    const dailyShare = benefits?.dailyShare ?? 0;
    const hasSignupReward = signupInviter > 0 || signupInvitee > 0;
    const amountText = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value);
    const signupCopy = signupInviter > 0 && signupInvitee > 0
        ? `好友用你的链接注册：TA 得 ${amountText(signupInvitee)} 金币见面礼；TA 看满 1 分钟，你得 ${amountText(signupInviter)} 金币`
        : signupInviter > 0
            ? `好友用你的链接注册并看满 1 分钟，你得 ${amountText(signupInviter)} 金币`
            : `好友用你的链接注册，TA 得 ${amountText(signupInvitee)} 金币见面礼`;
    return <Dialog open={Boolean(data)} onOpenChange={open => { if (!open) close(); }}>
        <DialogContent contentPreset="plain" hideCloseButton className={data?.reward ? 'share-invite-dialog' : 'share-poster-dialog'} overlayClassName="share-poster-overlay">
            <DialogTitle className="sr-only">{data?.reward ? '邀请好友一起看' : '分享海报'}</DialogTitle>
            <DialogDescription className="sr-only">{data?.reward ? '发送邀请链接给好友' : '保存或分享带二维码的海报，也可以复制链接'}</DialogDescription>
            {data?.reward ? <>
                <button className="share-invite-dialog__close" aria-label="关闭" onClick={close}><X /></button>
                <div className="share-invite-dialog__icon"><ArrowUpRight /></div>
                <h2>邀请好友一起看</h2>
                <p className="share-invite-dialog__drama">《{data.title}》</p>
                <div className="share-invite-dialog__benefits">
                    {hasSignupReward ? <div className="is-highlight"><Heart /><span><b>{signupCopy}</b></span></div> : null}
                    {purchasePct > 0 ? <div><Crown /><span><b>好友每次充值/开会员，你都得 {amountText(purchasePct)}% 返币（终身）</b></span></div> : null}
                    {dailyShare > 0 ? <div className="is-compact"><Coins /><span><b>每日首次分享 +{amountText(dailyShare)} 金币</b></span></div> : null}
                    {!benefitsLoading && !hasSignupReward && purchasePct <= 0 && dailyShare <= 0 ? <div className="is-empty"><span><b>奖励配置暂未返回</b><small>邀请链接仍可正常分享</small></span></div> : null}
                    {benefitsLoading ? <div className="is-loading"><Loader2 className="animate-spin" /><span><b>正在读取邀请奖励…</b></span></div> : null}
                </div>
                <button className="share-invite-dialog__primary" onClick={() => void shareLink()}><ArrowUpRight />发给好友</button>
                <button className="share-invite-dialog__secondary" onClick={() => void copy()}><Copy />复制邀请链接</button>
                <button className="share-invite-dialog__later" onClick={close}>下次再说</button>
            </> : <>
                <div className="share-poster-preview">
                    {poster ? <img src={poster.url} alt={`${data?.title ?? ''}分享海报，含观看二维码`} /> : error ? <div className="share-poster-status" role="alert"><p>{error}</p><button onClick={() => setRevision(value => value + 1)}>重新生成</button></div> : <div className="share-poster-status" role="status"><Loader2 className="animate-spin" /><p>正在生成分享海报…</p></div>}
                </div>
                <div className="share-poster-actions">
                    <button disabled={!poster} onClick={save}><Download />保存海报</button>
                    <button className="is-primary" disabled={!poster} onClick={() => void sharePoster()}><Share2 />分享海报</button>
                    <button onClick={() => void copy()}><Copy />复制链接</button>
                </div>
                <button className="share-poster-close" aria-label="关闭分享海报" onClick={close}><X /></button>
            </>}
        </DialogContent>
    </Dialog>;
}
