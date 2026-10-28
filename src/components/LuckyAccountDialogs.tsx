import { useEffect, useState } from 'react';
import { getLuckyLevel, type LuckyLevel } from '@/api/lucky';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LuckyIcon } from '@/components/LuckyIcon';

export function LuckyAccountDialogs({ kind, demo, onClose }: { kind: 'level' | null; demo: boolean; onClose: () => void }) {
    const [level, setLevel] = useState<LuckyLevel | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!kind) return;
        let cancelled = false;
        setError(''); setLevel(null);
        if (demo) return;
        setBusy(true);
        void getLuckyLevel().then(data => { if (!cancelled) setLevel(data); })
            .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
            .finally(() => { if (!cancelled) setBusy(false); });
        return () => { cancelled = true; };
    }, [kind, demo, revision]);
    return <Dialog open={Boolean(kind)} onOpenChange={next => { if (!next && !busy) onClose(); }}><DialogContent contentPreset="plain" hideCloseButton className="lucky-rating-sheet" overlayClassName="lucky-rating-overlay">
        <header><div><DialogTitle>等级进度</DialogTitle><DialogDescription>查看当前账号的经验和等级。</DialogDescription></div><button type="button" disabled={busy} className="lucky-rating-close" aria-label="关闭" onClick={onClose}><LuckyIcon name="close" size={18} /></button></header>
        {busy ? <p role="status">处理中…</p> : null}
        {error ? <div className="lucky-rating-error" role="alert"><p>{error}</p><button type="button" disabled={busy} className="lucky-task__button" onClick={() => setRevision(value => value + 1)}>重试</button></div> : null}
        {demo ? <p role="status">演示模式，不读取或修改真实账号。</p> : null}
        {level ? <div className="lucky-level"><strong>Lv{level.level}</strong><p>经验 {level.xp} / {level.nextNeed ?? '最高等级'}</p><div className="lucky-progress"><span style={{ width: `${level.nextNeed === null ? 100 : Math.max(0, Math.min(100, (level.xp - level.currNeed) / Math.max(1, level.nextNeed - level.currNeed) * 100))}%` }} /></div></div> : null}
    </DialogContent></Dialog>;
}
