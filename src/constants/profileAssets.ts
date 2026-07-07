import iconBenefit from '@/assets/profile/subscribe_icon_benefit@2x.png';
import iconHd from '@/assets/profile/subscribe_icon_hd@2x.png';
import iconShort from '@/assets/profile/subscribe_icon_short@2x.png';
import cardIconVip from '@/assets/profile/card_icon_vip@2x.png';
import { BRAND_COIN_ICON_SRC } from '@/constants/brand';
import iconMore from '@/assets/profile/icon_more@2x.png';
import iconWatchHistory from '@/assets/profile/icon_watchhistory@2x.png';
import iconLanguage from '@/assets/profile/icon_language@2x.png';
import iconHelp from '@/assets/profile/icon_help@2x.png';
import iconHelpPc from '@/assets/profile/icon_help.webp';
import iconHistoryPc from '@/assets/profile/icon_history.webp';
import iconListPc from '@/assets/profile/icon_list.webp';
import iconWatchHistoryPc from '@/assets/profile/icon_watchhistory.webp';

/** H5 /profile 页图标（`src/assets/profile`） */
export const profileH5Assets = {
    vipCardDecor: cardIconVip,
    benefitShort: iconShort,
    benefitHd: iconHd,
    benefitMore: iconBenefit,
    coin: BRAND_COIN_ICON_SRC,
    chevron: iconMore,
    menuHistory: iconWatchHistory,
    menuLanguage: iconLanguage,
    menuHelp: iconHelp,
} as const;

/** PC /profile 侧栏菜单图标（设计稿 webp） */
export const profilePcMenuAssets = {
    wallet: iconHistoryPc,
    myList: iconListPc,
    watchHistory: iconWatchHistoryPc,
    help: iconHelpPc,
} as const;
