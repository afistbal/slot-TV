import iconHomeActive from '@/assets/bottom-tab/tab_icon_home@2x.webp';
import iconHomeNor from '@/assets/bottom-tab/tab_icon_home_nor@2x.webp';
import iconForYouActive from '@/assets/bottom-tab/tab_icon_foryou@2x.webp';
import iconForYouNor from '@/assets/bottom-tab/tab_icon_foryou_nor@2x.webp';
import iconListActive from '@/assets/bottom-tab/tab_icon_list@2x.webp';
import iconListNor from '@/assets/bottom-tab/tab_icon_list_nor@2x.webp';
import iconProfileActive from '@/assets/bottom-tab/tab_icon_profile@2x.webp';
import iconProfileNor from '@/assets/bottom-tab/tab_icon_profile_nor@2x.webp';
import iconAddDesktopLogo from '@/assets/bottom-tab/icon_logo@2x.webp';

export const bottomTabAddDesktopIcon = iconAddDesktopLogo;

export const bottomTabIcons = {
    home: { active: iconHomeActive, nor: iconHomeNor },
    forYou: { active: iconForYouActive, nor: iconForYouNor },
    myList: { active: iconListActive, nor: iconListNor },
    profile: { active: iconProfileActive, nor: iconProfileNor },
} as const;
