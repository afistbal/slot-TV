import { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { getLuckyRatingCandidates, submitLuckyRating, type LuckyRatingCandidate, type LuckyRatingQuota } from '@/api/lucky';
import { useLuckyStore } from '@/stores/lucky';
import { camelLuckyPayload } from '@/lib/luckyPageData';
import { LuckyIcon } from '@/components/LuckyIcon';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useConfigStore } from '@/stores/config';

export function LuckyRatingSheet({ open, demo, onClose, onRated }: { open: boolean; demo: boolean; onClose: () => void; onRated: () => void }) {
    const { locale } = useIntl();
    const navigate = useNavigate();
    const staticBase = useConfigStore(store => String(store.config.static ?? ''));
    const w = (cn: string, tw = cn) => locale === 'zh-TW' ? tw : cn;
    const [rows, setRows] = useState<LuckyRatingCandidate[]>([]);
    const [quota, setQuota] = useState<LuckyRatingQuota | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const busyRef = useRef(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setRows([]); setError(''); setQuota(null);
        if (demo) { setLoading(false); setQuota({ left: 5, reward: 3 }); return; }
        setLoading(true);
        const tasks = camelLuckyPayload(useLuckyStore.getState().tasks) as { tasks?: Array<{ key: string; left?: number; cap?: number }> } | undefined;
        const ratingTask = tasks?.tasks?.find(task => task.key === 'rating');
        const nextQuota = { left: ratingTask?.left ?? 5, reward: 3 };
        void getLuckyRatingCandidates(100, locale, staticBase).then((nextRows) => {
            if (cancelled) return;
            setQuota(nextQuota); setRows(Array.isArray(nextRows) ? nextRows : []);
        }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); }).finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, demo, revision, locale, staticBase]);

    async function rate(row: LuckyRatingCandidate, score: number) {
        if (busyRef.current || demo || row.myRating || !quota || quota.left <= 0) return;
        busyRef.current = true; setBusy(row.dramaId); setError('');
        try {
            const result = await submitLuckyRating(row.dramaId, score);
            setRows((current) => current.map((item) => item.dramaId === row.dramaId ? { ...item, myRating: score } : item));
            setQuota((current) => current ? { ...current, left: Math.max(0, current.left - 1) } : current);
            toast.success(result !== undefined && result > 0 ? w(`评分成功，获得 ${result} 金币`, `評分成功，獲得 ${result} 金幣`) : w('感谢你的评分', '感謝你的評分'));
            onRated();
        } catch (reason) { const message = reason instanceof Error ? reason.message : String(reason); setError(message); toast.error(message); }
        finally { busyRef.current = false; setBusy(''); }
    }

    return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}><DialogContent contentPreset="plain" hideCloseButton className="lucky-rating-sheet" overlayClassName="lucky-rating-overlay">
        <header><div><DialogTitle>{w('待评分', '待評分')}</DialogTitle><DialogDescription>{!quota ? w('看过的剧点星即评', '看過的劇點星即評') : quota.left === 0 ? w('今日评分奖励额度已用完', '今日評分獎勵額度已用完') : w(`看过的剧点星即评，每部 +${quota.reward} 币 · 今天还能评 ${quota.left} 部`, `看過的劇點星即評，每部 +${quota.reward} 幣 · 今天還能評 ${quota.left} 部`)}</DialogDescription></div><button type="button" aria-label={w('关闭', '關閉')} className="lucky-rating-close" onClick={onClose}><LuckyIcon name="close" size={18} /></button></header>
        {demo ? <p className="lucky-restricted">{w('演示预览，不提交真实评分。', '示範預覽，不提交真實評分。')}</p> : null}
        {error ? <div className="lucky-rating-error" role="alert"><p>{error}</p><button type="button" className="lucky-task__button" onClick={() => setRevision((value) => value + 1)}>{w('重试', '重試')}</button></div> : null}
        {loading ? <div className="lucky-rating-loading" role="status" aria-label={w('加载中', '載入中')}><span className="lucky-rating-spinner" aria-hidden="true" /><span className="sr-only">{w('加载中…', '載入中…')}</span></div> : rows.length ? <ul className="lucky-rating-list">{rows.map((row) => <li key={row.dramaId}>
            <button type="button" className="lucky-rating-cover" aria-label={row.title} onClick={() => { onClose(); navigate(`/foryou?dramaId=${encodeURIComponent(row.dramaId)}`); }}>{row.coverUrl ? <img src={row.coverUrl} alt="" /> : <LuckyIcon name="play" size={22} />}</button>
            <div><strong>{row.title}</strong><small>{w(`已观看 ${row.epsWatched} 集`, `已觀看 ${row.epsWatched} 集`)}</small><div className={`lucky-rating-stars${row.myRating ? ' is-rated' : ''}`}>{[1, 2, 3, 4, 5].map((score) => <button type="button" key={score} className={(row.myRating ?? 0) >= score ? 'is-active' : ''} aria-label={`${score} ${w('星', '星')}`} disabled={demo || Boolean(busy) || Boolean(row.myRating) || !quota || quota.left === 0} onClick={() => void rate(row, score)}><LuckyIcon name="star" size={22} filled={(row.myRating ?? 0) >= score} /></button>)}{row.myRating ? <span>{w('已评', '已評')}</span> : null}</div></div>
        </li>)}</ul> : !error ? <div className="lucky-rating-empty"><LuckyIcon name="star" size={24} /><p>{w('看过 2 集以上的剧会出现在这里，先去刷几集吧', '看過 2 集以上的劇會出現在這裡，先去刷幾集吧')}</p><button type="button" className="lucky-task__button is-claim" onClick={() => { onClose(); navigate('/foryou'); }}>{w('去刷剧', '去刷劇')}</button></div> : null}
    </DialogContent></Dialog>;
}
