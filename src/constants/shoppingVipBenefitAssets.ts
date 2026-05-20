import weeklyBenefitUnlimited from '@/assets/profile/icon_short@2x.png';

/**
 * 购物页 H5 VIP 卡底部权益图标（周卡 / 年卡各 4 张金色图）。
 * 将文件放入 `src/assets/profile/` 后 import 并填入对应字段即可（参考下方 `weekly.unlimited`）。
 *
 * 周卡建议文件名：
 * - shopping_weekly_benefit_unlimited@2x.png  （已临时用 icon_short@2x.png）
 * - shopping_weekly_benefit_ad@2x.png
 * - shopping_weekly_benefit_hd@2x.png
 * - shopping_weekly_benefit_more@2x.png
 *
 * 年卡建议文件名：
 * - shopping_yearly_benefit_unlimited@2x.png
 * - shopping_yearly_benefit_ad@2x.png
 * - shopping_yearly_benefit_hd@2x.png
 * - shopping_yearly_benefit_more@2x.png
 */
export type ShoppingVipBenefitIconSet = {
    unlimited: string;
    adFree: string;
    hd: string;
    more: string;
};

export const shoppingVipBenefitIcons = {
    weekly: {
        unlimited: weeklyBenefitUnlimited,
        adFree: '',
        hd: '',
        more: '',
    },
    yearly: {
        unlimited: '',
        adFree: '',
        hd: '',
        more: '',
    },
} as const satisfies Record<'weekly' | 'yearly', ShoppingVipBenefitIconSet>;
