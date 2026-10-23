import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Loader2, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BRAND_DISPLAY_NAME, BRAND_TOPNAV_WORDMARK_SRC } from '@/constants/brand';
import { useSharePosterStore, type SharePosterData } from '@/stores/sharePoster';
import { claimLuckyDailyShare } from '@/api/lucky';
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
        glow.addColorStop(0, '#571d47'); glow.addColorStop(.5, '#30203e'); glow.addColorStop(1, '#101216');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, 720, 860);
        ctx.font = '800 70px sans-serif'; ctx.fillStyle = '#ffffff18'; ctx.fillText(BRAND_DISPLAY_NAME, 60, 450);
    }
    const shade = ctx.createLinearGradient(0, 0, 0, 1080);
    shade.addColorStop(0, '#10121699'); shade.addColorStop(.3, '#10121600'); shade.addColorStop(.62, '#10121680'); shade.addColorStop(.82, '#101216'); shade.addColorStop(1, '#101216');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 720, 1080);
    if (logo) ctx.drawImage(logo, 40, 36, 224, 64);
    ctx.fillStyle = '#fff'; ctx.font = '700 32px sans-serif';
    ctx.fillText(data.inviteCode ? '邀请好友，一起发现好剧' : '好剧值得一起看', 42, 148);
    ctx.fillStyle = '#ff6b94'; ctx.font = '600 20px sans-serif'; ctx.fillText('精彩短剧 · 扫码即看', 42, 186);
    ctx.font = '800 42px sans-serif'; ctx.fillStyle = '#fff';
    let line = ''; const lines: string[] = [];
    const words = data.title.match(/[A-Za-z0-9'’\-]+\s*|./gu) ?? [];
    for (const word of words) {
        if (ctx.measureText(line + word).width > 630 && line) { lines.push(line.trim()); line = word; } else line += word;
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((text, index) => {
        let display = text;
        if (index === 2 && lines.length > 3) { while (ctx.measureText(display + '…').width > 630) display = display.slice(0, -1); display += '…'; }
        ctx.fillText(display, 42, 724 + index * 54);
    });
    ctx.fillStyle = '#ff3d75'; ctx.fillRect(42, 884, 52, 5);
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
    const rewarded = useRef(false);
    useEffect(() => {
        setPoster(null); setError(''); rewarded.current = false;
        if (!data) return;
        let cancelled = false; let objectUrl = '';
        void renderPoster(data).then(blob => {
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob);
            setPoster({ url: objectUrl, file: new File([blob], 'YogoShort-poster.png', { type: 'image/png' }) });
        }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : '海报生成失败'); });
        return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [data, revision]);
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
    async function share() {
        if (!poster || !data) return;
        if (!navigator.canShare?.({ files: [poster.file] })) { toast.info('当前浏览器不支持分享图片，请保存海报后分享'); return; }
        try { await navigator.share({ files: [poster.file], title: data.title }); void onShared(); }
        catch (reason) { if (!(reason instanceof Error && reason.name === 'AbortError')) toast.error('分享失败，请保存海报后重试'); }
    }
    return <Dialog open={Boolean(data)} onOpenChange={open => { if (!open) close(); }}>
        <DialogContent contentPreset="plain" hideCloseButton className="share-poster-dialog" overlayClassName="share-poster-overlay">
            <DialogTitle className="sr-only">分享海报</DialogTitle>
            <DialogDescription className="sr-only">保存或分享带二维码的海报，也可以复制链接</DialogDescription>
            <div className="share-poster-preview">
                {poster ? <img src={poster.url} alt={`${data?.title ?? ''}分享海报，含观看二维码`} /> : error ? <div className="share-poster-status" role="alert"><p>{error}</p><button onClick={() => setRevision(value => value + 1)}>重新生成</button></div> : <div className="share-poster-status" role="status"><Loader2 className="animate-spin" /><p>正在生成分享海报…</p></div>}
            </div>
            <div className="share-poster-actions">
                <button disabled={!poster} onClick={save}><Download />保存海报</button>
                <button className="is-primary" disabled={!poster} onClick={() => void share()}><Share2 />分享海报</button>
                <button onClick={() => void copy()}><Copy />复制链接</button>
            </div>
            <button className="share-poster-close" aria-label="关闭分享海报" onClick={close}><X /></button>
        </DialogContent>
    </Dialog>;
}
