import { useEffect, useRef, useState } from 'react';
import { getLuckyLevel, type LuckyLevel } from '@/api/lucky';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LuckyIcon } from '@/components/LuckyIcon';
import { disableLuckyPushSubscription, enableLuckyPushSubscription, inspectLuckyPushSubscription, type LuckyPushProgress } from '@/lib/luckyPushSubscription';

export function LuckyAccountDialogs({ kind, demo, onClose }: { kind: 'push' | 'level' | null; demo: boolean; onClose: () => void }) {
    const [level, setLevel] = useState<LuckyLevel | null>(null);
    const [pushReady, setPushReady] = useState(false);
    const [subscribed, setSubscribed] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [pushProgress, setPushProgress] = useState<LuckyPushProgress | null>(null);
    const busyRef = useRef(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!kind) return;
        let cancelled = false;
        setError(''); setNotice(''); setLevel(null); setPushReady(false); setSubscribed(false);
        if (demo) { setNotice('演示模式，不读取或修改真实账号。'); return; }
        setBusy(true);
        void (async () => {
            if (kind === 'level') { const data = await getLuckyLevel(); if (!cancelled) setLevel(data); }
            else {
                const state = await inspectLuckyPushSubscription();
                if (!cancelled) { setPushReady(true); setSubscribed(state.subscribed); }
            }
        })().catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
            .finally(() => { if (!cancelled) setBusy(false); });
        return () => { cancelled = true; };
    }, [kind, demo, revision]);
    async function changePush() {
        if (demo || !pushReady || busyRef.current) return;
        busyRef.current = true; setBusy(true); setError(''); setNotice('');
        try {
            if (subscribed) {
                await disableLuckyPushSubscription();
                setSubscribed(false); setNotice('已关闭本设备推送。');
            } else {
                await enableLuckyPushSubscription(undefined, setPushProgress);
                setSubscribed(true); setNotice('推送订阅已保存，请返回任务列表核验并领取奖励。');
            }
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally { busyRef.current = false; setBusy(false); setPushProgress(null); }
    }
    return <Dialog open={Boolean(kind)} onOpenChange={next => { if (!next && !busy) onClose(); }}><DialogContent contentPreset="plain" hideCloseButton className="lucky-rating-sheet" overlayClassName="lucky-rating-overlay">
        <header><div><DialogTitle>{kind === 'push' ? '通知设置' : '等级进度'}</DialogTitle><DialogDescription>{kind === 'push' ? '保存本设备的真实推送订阅，奖励由服务端核验。' : '查看当前账号的经验和等级。'}</DialogDescription></div><button type="button" disabled={busy} className="lucky-rating-close" aria-label="关闭" onClick={onClose}><LuckyIcon name="close" size={18} /></button></header>
        {busy ? <p role="status">{pushProgress === 'permission' ? '请在浏览器提示中允许通知' : pushProgress === 'connection' ? '正在连接通知服务…' : pushProgress === 'saving' ? '正在保存通知设置…' : '处理中…'}</p> : null}
        {error ? <div className="lucky-rating-error" role="alert"><p>{error}</p><button type="button" disabled={busy} className="lucky-task__button" onClick={() => setRevision(value => value + 1)}>重试</button></div> : null}
        {notice ? <p role="status">{notice}</p> : null}
        {kind === 'push' ? <button type="button" className="lucky-task__button is-claim" disabled={demo || busy || !pushReady} onClick={() => void changePush()}>{subscribed ? '关闭本设备通知' : '开启推送通知'}</button> : level ? <div className="lucky-level"><strong>Lv{level.level}</strong><p>经验 {level.xp} / {level.nextNeed ?? '最高等级'}</p><div className="lucky-progress"><span style={{ width: `${level.nextNeed === null ? 100 : Math.max(0, Math.min(100, (level.xp - level.currNeed) / Math.max(1, level.nextNeed - level.currNeed) * 100))}%` }} /></div></div> : null}
    </DialogContent></Dialog>;
}
