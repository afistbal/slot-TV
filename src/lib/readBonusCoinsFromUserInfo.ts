/** 从 `login/token` 写入的 `user.info` 中读取赠送金币（与 `RadixRc` / Profile 侧栏展示一致） */
export function readBonusCoinsFromUserInfo(info: { [key: string]: unknown } | undefined): number {
    if (!info) return 0;
    const keys = ['bonus_coin', 'bonus_coins', 'gift_coin', 'free_coin', 'bonus_balance'] as const;
    for (const k of keys) {
        const n = Number(info[k]);
        if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
    return 0;
}
