import { useEffect, useRef, useState } from 'react';
import { getLuckyLevel, getLuckyPushConfig, removeLuckyPushSubscription, saveLuckyPushSubscription, type LuckyLevel } from '@/api/lucky';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { LuckyIcon } from '@/components/LuckyIcon';

function vapidKey(value: string): Uint8Array<ArrayBuffer> {
    const raw = atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
}
async function worker(): Promise<ServiceWorkerRegistration> {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) throw new Error('当前页面的推送服务尚未就绪，请更新并重新打开页面后重试。');
    return registration;
}
export function LuckyAccountDialogs({ kind, demo, onClose }: { kind: 'push' | 'level' | null; demo: boolean; onClose: () => void }) {
    const [level, setLevel] = useState<LuckyLevel | null>(null);
    const [publicKey, setPublicKey] = useState('');
    const [subscribed, setSubscribed] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        if (!kind) return;
        let cancelled = false;
        setError(''); setNotice(''); setLevel(null); setPublicKey(''); setSubscribed(false);
        if (demo) { setNotice('演示模式，不读取或修改真实账号。'); return; }
        setBusy(true);
        void (async () => {
            if (kind === 'level') { const data = await getLuckyLevel(); if (!cancelled) setLevel(data); }
            else {
                if (!window.isSecureContext || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('当前浏览器不支持推送通知；iPhone 请先添加到主屏幕后打开。');
                const [config, registration] = await Promise.all([getLuckyPushConfig(), worker()]);
                const subscription = await registration.pushManager.getSubscription();
                if (!cancelled) { setPublicKey(config.publicKey); setSubscribed(Boolean(subscription)); }
            }
        })().catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
            .finally(() => { if (!cancelled) setBusy(false); });
        return () => { cancelled = true; };
    }, [kind, demo, revision]);
    async function changePush() {
        if (demo || !publicKey || busyRef.current) return;
        busyRef.current = true; setBusy(true); setError(''); setNotice('');
        let created: PushSubscription | null = null;
        let saved = false;
        try {
            if (!subscribed && await Notification.requestPermission() !== 'granted') throw new Error('未获得通知权限，请在浏览器设置中允许通知后重试。');
            const registration = await worker();
            const previous = await registration.pushManager.getSubscription();
            if (subscribed) {
                if (previous) { await removeLuckyPushSubscription(previous.endpoint); if (!await previous.unsubscribe()) throw new Error('浏览器未能取消订阅，请重试。'); }
                setSubscribed(false); setNotice('已关闭本设备推送。');
            } else {
                const subscription = previous ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey(publicKey) });
                if (!previous) created = subscription;
                await saveLuckyPushSubscription(subscription); saved = true;
                setSubscribed(true); setNotice('推送订阅已保存，请返回任务列表核验并领取奖励。');
            }
        } catch (reason) {
            if (created && !saved) await created.unsubscribe().catch(() => false);
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally { busyRef.current = false; setBusy(false); }
    }
    return <Dialog open={Boolean(kind)} onOpenChange={next => { if (!next && !busy) onClose(); }}><DialogContent contentPreset="plain" hideCloseButton className="lucky-rating-sheet" overlayClassName="lucky-rating-overlay">
        <header><div><DialogTitle>{kind === 'push' ? '通知设置' : '等级进度'}</DialogTitle><DialogDescription>{kind === 'push' ? '保存本设备的真实推送订阅，奖励由服务端核验。' : '查看当前账号的经验和等级。'}</DialogDescription></div><button type="button" disabled={busy} className="lucky-rating-close" aria-label="关闭" onClick={onClose}><LuckyIcon name="close" size={18} /></button></header>
        {busy ? <p role="status">处理中…</p> : null}
        {error ? <div className="lucky-rating-error" role="alert"><p>{error}</p><button type="button" disabled={busy} className="lucky-task__button" onClick={() => setRevision(value => value + 1)}>重试</button></div> : null}
        {notice ? <p role="status">{notice}</p> : null}
        {kind === 'push' ? <button type="button" className="lucky-task__button is-claim" disabled={demo || busy || !publicKey} onClick={() => void changePush()}>{subscribed ? '关闭本设备通知' : '开启推送通知'}</button> : level ? <div className="lucky-level"><strong>Lv{level.level}</strong><p>经验 {level.xp} / {level.nextNeed ?? '最高等级'}</p><div className="lucky-progress"><span style={{ width: `${level.nextNeed === null ? 100 : Math.max(0, Math.min(100, (level.xp - level.currNeed) / Math.max(1, level.nextNeed - level.currNeed) * 100))}%` }} /></div></div> : null}
    </DialogContent></Dialog>;
}
