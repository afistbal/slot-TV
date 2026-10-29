import { useIntl } from 'react-intl';
import { Gift, Sparkles, Ticket, Trophy } from 'lucide-react';
import { luckyPrizeLabel, type LuckyWheelSlot, type LuckyWheelState } from '@/lib/luckyWheel';
import { useTopUpStore } from '@/stores/topUp';

export function LuckyWheelExtras({ state, pool, bet }: { state: LuckyWheelState; pool: LuckyWheelSlot[]; bet: number }) {
    const intl = useIntl(), tw = intl.locale === 'zh-TW';
    const w = (cn: string, traditional = cn) => tw ? traditional : cn;
    const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(intl.locale) : '—';
    return <div className="lucky-wheel-extras">
        <section className="lucky-panel lucky-wheel-pool-panel"><h3><Gift size={18} />{w('本期奖池', '本期獎池')}</h3><p>{w('已有', '已有')} <b>{state.winnersCoupon}</b> {w('人抽中充值加成券', '人抽中儲值加成券')}</p><ul>{(pool.length ? pool : [{ kind: 'coins', v: 0 }, { kind: 'bonus_pct', v: 0 }, { kind: 'vip_day', v: 0 }, { kind: 'luck', v: 0 }]).map((face, index) => <li key={index}><Gift size={19} /><strong>{luckyPrizeLabel(face.kind, face.v ?? Math.round((face.mult ?? 0) * bet), tw)}</strong></li>)}</ul></section>
        <section className="lucky-panel lucky-wheel-mine"><h3><Ticket size={18} />{w('我的充值加成券', '我的儲值加成券')}</h3>{state.coupons.length ? state.coupons.map(coupon => <div className="lucky-wheel-coupon" key={coupon.id}><strong>+{coupon.pct}% {w('充值加赠', '儲值加贈')}</strong><span>{w('最多加赠', '最多加贈')} {coupon.cap} {w('金币', '金幣')} · {w('有效期至')} {date(coupon.expiresAt)}</span><button type="button" disabled={!coupon.expiresAt || !Number.isFinite(Date.parse(coupon.expiresAt)) || Date.parse(coupon.expiresAt) <= Date.now()} onClick={() => useTopUpStore.getState().show()}>{w('去使用')}</button></div>) : <p className="lucky-wheel-empty">{w('暂无充值加成券，参与转盘有机会获得', '暫無儲值加成券，參與轉盤有機會獲得')}</p>}<p className="lucky-wheel-fine-print">{w('充值时由服务端匹配可用券，赠币以订单确认为准', '儲值時由服務端匹配可用券，贈幣以訂單確認為準')}</p><div className="lucky-wheel-mine-stats"><div><strong>{state.coupons.length}</strong><span>{w('充值券', '儲值券')}</span></div><div><strong>Lv{state.luckLevel}</strong><span><Sparkles size={12} />{w('好运等级', '好運等級')}</span></div></div></section>
        <section className="lucky-panel lucky-wheel-records"><h3><Trophy size={18} />{w('本期战绩', '本期戰績')}</h3><div className="lucky-wheel-mine-stats"><div><strong>{state.prizes.length}</strong><span>{w('最近中奖记录', '最近中獎紀錄')}</span></div><div><strong>{state.tickets}</strong><span>{w('抽奖券', '抽獎券')}</span></div></div><details><summary>{w('查看我的奖品与记录', '查看我的獎品與紀錄')}</summary>{state.prizes.length ? <ul>{state.prizes.map(prize => <li key={prize.id}><strong>{luckyPrizeLabel(prize.prizeKind, prize.prizeValue, tw)}</strong><time>{date(prize.createdAt)}</time></li>)}</ul> : <p className="lucky-wheel-empty">{w('暂无中奖记录', '暫無中獎紀錄')}</p>}</details></section>
    </div>;
}
