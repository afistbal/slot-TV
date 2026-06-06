import weeklyIcon1 from '@/assets/profile/icon_short@2x.png';
import weeklyIcon2 from '@/assets/profile/icon_ad@2x.png';
import weeklyIcon3 from '@/assets/profile/icon_hd@2x.png';
import weeklyIcon4 from '@/assets/profile/icon_benefit@2x.png';
import yearIcon1 from '@/assets/profile/icon_short_nor@2x.png';
import yearIcon2 from '@/assets/profile/icon_ad_nor@2x.png';
import yearIcon3 from '@/assets/profile/icon_hd_nor@2x.png';
import yearIcon4 from '@/assets/profile/icon_benefit_nor@2x.png';


/**
 * 购物页 Top UP VIP 卡底部权益图标（选中 / 未选中各 4 张）。
 * `weekly` = 选中态（彩色）；`yearly` = 未选中态（_nor 灰金色）。
 */
export type ShoppingVipBenefitIconSet = {
    unlimited: string;
    adFree: string;
    hd: string;
    more: string;
};

export const shoppingVipBenefitIcons = {
    weekly: {
        unlimited: weeklyIcon1,
        adFree: weeklyIcon2,
        hd: weeklyIcon3,
        more: weeklyIcon4,
    },
    yearly: {
        unlimited: yearIcon1,
        adFree: yearIcon2,
        hd: yearIcon3,
        more: yearIcon4,
    },
} as const satisfies Record<'weekly' | 'yearly', ShoppingVipBenefitIconSet>;
