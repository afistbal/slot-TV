import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router';
import { Clock, Coins, Gift, HelpCircle, Layers3, LoaderCircle, Sparkles, Trophy, Volume2, VolumeX } from 'lucide-react';
import { spinLuckyWheel } from '@/api/lucky';
import { decodeLuckyWheel, luckyPrizeLabel, luckyWheelAction, luckyWheelSegmentColor, luckyWheelSlots, type LuckySpinDraw, type LuckySpinMode, type LuckyWheelSlot, type LuckyWheelState } from '@/lib/luckyWheel';
import { useTopUpStore } from '@/stores/topUp';
import { useUserStore } from '@/stores/user';
import { LuckyWheelExtras } from '@/components/LuckyWheelExtras';
import '@/styles/lucky-wheel.scss';

const placeholderSlots: LuckyWheelSlot[] = ['coins', 'bonus_pct', 'coins', 'vip_day', 'coins', 'luck', 'coins', 'drama_ep'].map(kind => ({ kind, v: 0 }));

export function LuckyWheel({ state = decodeLuckyWheel(null), disabled = false, queryError = '', onRetry, children, rewardsCenter }: { state?: LuckyWheelState; disabled?: boolean; queryError?: string; onRetry?: () => void; children?: ReactNode; rewardsCenter?: ReactNode }) {
    const intl = useIntl();
    const tw = intl.locale === 'zh-TW';
    const w = (cn: string, traditional = cn) => tw ? traditional : cn;
    const navigate = useNavigate();
    const userId = useUserStore(store => store.info?.id);
    const token = localStorage.getItem('token');
    const [selectedBet, setSelectedBet] = useState(0);
    const [busy, setBusy] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [lockedSlots, setLockedSlots] = useState<LuckyWheelSlot[]>([]);
    const [lockedBet, setLockedBet] = useState(0);
    const [draws, setDraws] = useState<LuckySpinDraw[]>([]);
    const [error, setError] = useState('');
    const [now, setNow] = useState(Date.now);
    const [sound, setSound] = useState(localStorage.getItem('lucky:sound') === '1');
    const busyRef = useRef(false);
    const active = useRef(true);
    const turn = useRef(0);
    const bet = state.bets.includes(selectedBet) ? selectedBet : state.bets[0] ?? 0;
    const mode = luckyWheelAction(state, bet);
    const configuredSlots = luckyWheelSlots(state, mode, bet);
    const displayLocked = busy || draws.length > 0;
    const faces = displayLocked ? lockedSlots : configuredSlots.length ? configuredSlots : placeholderSlots;
    const faceBet = displayLocked ? lockedBet : mode === 'gift' ? 50 : bet;
    const gradient = faces.map((_, index) => `${luckyWheelSegmentColor(index, faces.length)} ${index * 360 / faces.length}deg ${(index + 1) * 360 / faces.length}deg`).join(',');
    const open = state.enabled && state.eligible && !disabled;
    const paidLeft = Math.max(0, state.paidMax - state.paidUsed);
    const tenLeft = Math.max(0, state.tenMax - state.tenUsed);
    const tenCost = Math.round(bet * state.tenPriceMult);
    const endAt = state.peak ? state.peakEndsAt : state.endsAt;
    const remaining = endAt ? Math.max(0, Date.parse(endAt) - now) : NaN;
    const countdown = Number.isFinite(remaining) ? [Math.floor(remaining / 3600000), Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60].map(n => String(n).padStart(2, '0')).join(':') : '';
    const needsRefresh = countdown !== '' && remaining === 0;
    useEffect(() => {
        if (!endAt || !Number.isFinite(Date.parse(endAt))) return;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [endAt]);

    function playSound() {
        if (!sound) return;
        try {
            const context = new AudioContext();
            const oscillator = context.createOscillator(), volume = context.createGain();
            oscillator.connect(volume); volume.connect(context.destination);
            oscillator.frequency.setValueAtTime(680, context.currentTime); oscillator.frequency.exponentialRampToValueAtTime(280, context.currentTime + .25);
            volume.gain.setValueAtTime(.035, context.currentTime); volume.gain.exponentialRampToValueAtTime(.001, context.currentTime + .3);
            oscillator.start(); oscillator.stop(context.currentTime + .3); oscillator.onended = () => { void context.close(); };
        } catch { /* Sound is optional and cannot block a draw. */ }
    }

    useEffect(() => {
        active.current = true;
        busyRef.current = false;
        setBusy(false); setDraws([]); setError(''); setRotation(0); turn.current = 0;
        return () => { active.current = false; };
    }, [userId, token]);

    async function draw(drawMode: LuckySpinMode) {
        if (busyRef.current || !open || needsRefresh) return;
        const drawBet = drawMode === 'free' || drawMode === 'ticket' ? 0 : drawMode === 'gift' ? 50 : bet;
        const drawFaces = luckyWheelSlots(state, drawMode, drawBet);
        if (!drawFaces.length) return;
        if ((drawMode === 'paid' || drawMode === 'ten') && state.coins < (drawMode === 'ten' ? tenCost : drawBet)) {
            useTopUpStore.getState().show(); return;
        }
        busyRef.current = true;
        playSound();
        setBusy(true); setError(''); setDraws([]); setLockedSlots(drawFaces); setLockedBet(drawBet);
        const session = token;
        try {
            const result = await spinLuckyWheel(drawMode, drawBet);
            if (!active.current || session !== localStorage.getItem('token')) return;
            const winner = result.reduce((best, item) => item.prizeKind === 'coins' && item.prizeValue > best.prizeValue ? item : best, result[0]);
            if (winner.slotIdx >= drawFaces.length) throw new Error(w('奖项位置无效，请刷新查看奖品记录', '獎項位置無效，請重新整理查看獎品紀錄'));
            // The server selects the slot; the client only animates to that index.
            const position = (360 - winner.slotIdx * 360 / drawFaces.length) % 360;
            turn.current = Math.ceil(turn.current / 360) * 360 + 360 * 5 + position;
            setRotation(turn.current);
            const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 2200;
            await new Promise(resolve => window.setTimeout(resolve, duration));
            if (active.current && session === localStorage.getItem('token')) setDraws(result);
        } catch (reason) {
            if (active.current && session === localStorage.getItem('token')) setError(`${reason instanceof Error ? reason.message : String(reason)}\nPOST /api/user/spin ${JSON.stringify({ p_mode: drawMode, p_bet: drawBet })}`);
        } finally {
            if (active.current && session === localStorage.getItem('token')) { busyRef.current = false; setBusy(false); }
        }
    }

    function mainAction() {
        if (mode === 'watch') { void navigate('/foryou'); return; }
        if (mode === 'topup') { useTopUpStore.getState().show(); return; }
        if (mode !== 'done') void draw(mode);
    }

    const hubLabel = busy ? w('开奖中', '開獎中') : mode === 'free' ? w('免费抽', '免費抽') : mode === 'watch' ? w('看剧解锁', '看劇解鎖') : mode === 'gift' ? w('赠送抽奖', '贈送抽獎') : mode === 'ticket' ? w('用券抽奖', '用券抽獎') : mode === 'topup' ? w('充值金币', '儲值金幣') : mode === 'done' ? w('暂未开启', '暫未開啟') : w('抽一次');
    const guide = [
        { Icon: Gift, title: w(`免费 ${state.freeMax} 次`, `免費 ${state.freeMax} 次`), desc: w('首次直接转，后续看剧解锁' + (state.freeGuaranteeCoupon ? '；本期免费必得充值券' : ''), '首次直接轉，後續看劇解鎖' + (state.freeGuaranteeCoupon ? '；本期免費必得儲值券' : '')) },
        { Icon: Coins, title: w('单抽', '單抽'), desc: w(`${state.bets.join(' / ') || '0'} 币可选，每期 ${state.paidMax} 次`, `${state.bets.join(' / ') || '0'} 幣可選，每期 ${state.paidMax} 次`) },
        { Icon: Layers3, title: w('十连', '十連'), desc: w(`一次 10 抽，优惠 ${state.tenPriceMult > 0 ? Math.max(0, Math.round((10 - state.tenPriceMult) * 10)) : 0}%，每期 ${state.tenMax} 次；保底以本期奖池为准`, `一次 10 抽，優惠 ${state.tenPriceMult > 0 ? Math.max(0, Math.round((10 - state.tenPriceMult) * 10)) : 0}%，每期 ${state.tenMax} 次；保底以本期獎池為準`) },
        { Icon: Sparkles, title: w('充值加送', '儲值加送'), desc: w(`本期每次有效充值送 ${state.giftSpinsPerTopup} 次抽奖，好运值 +${state.luckPerTopup}`, `本期每次有效儲值送 ${state.giftSpinsPerTopup} 次抽獎，好運值 +${state.luckPerTopup}`) },
    ];

    return <div className={`lucky-wheel-layout${children ? ' lucky-wheel-layout--with-tasks' : ''}`} id="wheel">
        <section className="lucky-wheel-panel lucky-panel" aria-label={w('幸运转盘', '幸運轉盤')} aria-busy={busy}>
            <header><div><span className="lucky-wheel-panel__eyebrow">{w('幸运充值日', '幸運儲值日')}</span><h2><Sparkles size={19} />{w('幸运转盘', '幸運轉盤')}</h2></div><div className="lucky-wheel-header-actions"><span>{w('抽奖券', '抽獎券')} <b>{state.tickets}</b></span><button type="button" aria-label={w(sound ? '关闭音效' : '开启音效', sound ? '關閉音效' : '開啟音效')} aria-pressed={sound} onClick={() => { setSound(!sound); localStorage.setItem('lucky:sound', sound ? '0' : '1'); }}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button></div></header>
            {countdown ? <p className="lucky-wheel-countdown" role="timer"><Clock size={13} />{w(state.peak ? '距付费抽奖结束' : '距活动结束', state.peak ? '距付費抽獎結束' : '距活動結束')} {countdown}</p> : null}
            {!state.peak ? <p className="lucky-wheel-meta">{w('本期付费抽奖已结束，仍可使用抽奖券', '本期付費抽獎已結束，仍可使用抽獎券')}{state.nextOpenAt ? ` · ${w('下次开启', '下次開啟')} ${new Date(state.nextOpenAt).toLocaleString(intl.locale)}` : ''}</p> : null}
            {needsRefresh || queryError ? <p className="lucky-task-error">{w(needsRefresh ? '当前阶段已结束，请刷新活动状态' : '活动状态暂未更新，请重试', needsRefresh ? '目前階段已結束，請重新整理活動狀態' : '活動狀態暫未更新，請重試')} <button type="button" onClick={onRetry}>{w('刷新', '重新整理')}</button></p> : null}
            <div className="lucky-wheel-stage">
                <span className="lucky-wheel-pointer" aria-hidden />
                <div className="lucky-wheel-disc" style={{ transform: `rotate(${rotation}deg)`, background: `conic-gradient(from ${-180 / faces.length}deg, ${gradient})` }} aria-hidden>
                    {faces.map((face, index) => <span key={index} className="lucky-wheel-slot" style={{ '--slot-angle': `${index * 360 / faces.length}deg`, color: luckyWheelSegmentColor(index, faces.length) === '#1b1e22' ? '#eceff1' : '#2b1e00' } as CSSProperties}>
                        <Gift size={17} /><b>{configuredSlots.length || displayLocked ? luckyPrizeLabel(face.kind, face.v ?? Math.round((face.mult ?? 0) * faceBet), tw) : face.kind === 'coins' ? w('金币', '金幣') : face.kind === 'vip_day' ? 'VIP' : face.kind === 'bonus_pct' ? w('充值券', '儲值券') : face.kind === 'luck' ? w('好运', '好運') : w('解锁剧集', '解鎖劇集')}</b>
                    </span>)}
                </div>
                {Array.from({ length: 24 }, (_, index) => <i key={index} className="lucky-wheel-bulb" style={{ '--bulb-angle': `${index * 15}deg` } as CSSProperties} aria-hidden />)}
                <button type="button" className="lucky-wheel-hub" disabled={busy || !open || needsRefresh || mode === 'done' || !configuredSlots.length && mode !== 'watch' && mode !== 'topup'} onClick={mainAction}>
                    {busy ? <LoaderCircle className="lucky-wheel-loader" size={21} /> : <Sparkles size={21} />}<strong>{hubLabel}</strong>
                    <small>{mode === 'free' ? w(`剩余 ${state.freeLeft} 次`, `剩餘 ${state.freeLeft} 次`) : mode === 'gift' ? w(`剩余 ${state.giftSpins} 次`, `剩餘 ${state.giftSpins} 次`) : mode === 'paid' ? `${bet} ${w('金币', '金幣')}` : w('好运常伴', '好運常伴')}</small>
                </button>
            </div>
            {state.freeMax > 0 && (mode === 'free' || mode === 'watch') ? <><div className="lucky-wheel-free-progress" aria-label={w(`免费剩余 ${state.freeLeft} 次`, `免費剩餘 ${state.freeLeft} 次`)}>{Array.from({ length: Math.min(state.freeMax, 20) }, (_, i) => <i key={i} className={i < state.freeLeft ? 'is-left' : ''} />)}</div><p className="lucky-wheel-meta">{w('不需要充值', '不需要儲值')}</p></> : null}
            <p className="lucky-wheel-meta">{w(`免费剩余 ${state.freeLeft} 次 · 赠抽 ${state.giftSpins} 次 · 单抽剩余 ${paidLeft} 次`, `免費剩餘 ${state.freeLeft} 次 · 贈抽 ${state.giftSpins} 次 · 單抽剩餘 ${paidLeft} 次`)}</p>
            {state.bets.length ? <div className="lucky-wheel-bets" aria-label={w('选择抽奖档位', '選擇抽獎級別')}>{state.bets.map(value => <button type="button" disabled={busy || mode === 'gift'} aria-pressed={value === bet} key={value} onClick={() => setSelectedBet(value)}>{value} {w('金币', '金幣')}</button>)}</div> : null}
            <div className="lucky-wheel-actions">
                <button type="button" disabled={busy || !open || needsRefresh || !state.peak || paidLeft < 10 || tenLeft <= 0 || tenCost <= 0 || !state.facePaid[String(bet)]?.length} onClick={() => void draw('ten')}>{w('十连', '十連')} · {tenCost} {w('币', '幣')}<small>{w(`剩余 ${tenLeft} 次`, `剩餘 ${tenLeft} 次`)}</small></button>
                <button type="button" disabled={busy || !open || needsRefresh || state.tickets <= 0 || !state.faceTicket.length} onClick={() => void draw('ticket')}>{w('用券抽奖', '用券抽獎')} · {state.tickets}</button>
            </div>
            {error ? <p className="lucky-task-error" role="alert">{w('抽奖未能完成，请刷新核对次数和奖品记录后再试', '抽獎未能完成，請重新整理核對次數和獎品紀錄後再試')} <button type="button" onClick={onRetry}>{w('刷新', '重新整理')}</button></p> : null}
            {draws.length ? <div className="lucky-wheel-result" role="status"><h3><Trophy size={18} />{w('恭喜获得', '恭喜獲得')}</h3><ul>{draws.map((draw, index) => <li key={index}>{luckyPrizeLabel(draw.prizeKind, draw.prizeValue, tw)}</li>)}</ul><button type="button" onClick={() => setDraws([])}>{w('知道了')}</button></div> : null}

        </section>
        {children}
        <section className="lucky-spin-guide lucky-panel"><h3><HelpCircle size={16} />{w('怎么获得抽奖机会', '怎麼獲得抽獎機會')}</h3><ol>{guide.map(({ Icon, title, desc }, index) => <li key={index}><span><Icon size={17} /><i>{index + 1}</i></span><div><strong>{title}</strong><p>{desc}</p></div></li>)}</ol></section>
        {rewardsCenter}
        <LuckyWheelExtras state={state} pool={configuredSlots} bet={mode === 'gift' ? 50 : bet} />
    </div>;
}
