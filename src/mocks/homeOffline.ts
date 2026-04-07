import type { TData } from '@/api';
import type { IData } from '@/stores/home';

/** 与 config.static 拼接：`${static}/${image}` → picsum 封面 */
export const offlineImageBasePath = 'https://picsum.photos/id';

/**
 * ReelShort 同源图床（仅离线 mock 预览用）。`Home` 里 `heroImageUrl` 遇 `https://` 会原样使用，不拼 static。
 * 正式环境请改为自己 CDN / 接口返回字段。
 *
 * 与镜像首页 Banner 一致：OSS `w_1920` + webp；构图靠前端 `object-position: 67% center`（见 Home.tsx），
 * 静态站无客户端人脸检测。
 */
export function reelShortStyleBannerUrl(imageUuid: string, width: 1080 | 1920 = 1920) {
    const q = `v=1.0&x-oss-process=image%2Fresize%2Cw_${width}%2Fquality%2Cq_80%2Fformat%2Cwebp`;
    return `https://v-img.crazymaplestudios.com/images/${imageUuid}.jpg?${q}`;
}

/** 离线首页轮播：与当前提供的 v-img 资源一一对应 */
const OFFLINE_HERO_UUIDS = [
    '34dfb980-d5cb-11f0-84ad-6b5693b490dc',
    '05759260-ec77-11f0-84ad-6b5693b490dc',
    '68747a60-ec78-11f0-84ad-6b5693b490dc',
    'effb8fc0-0738-11f1-84ad-6b5693b490dc',
    '2315d640-0739-11f1-84ad-6b5693b490dc',
    'dacd80e0-0738-11f1-84ad-6b5693b490dc',
    '0c6f7f40-0739-11f1-84ad-6b5693b490dc',
] as const;

export const offlineHomeData: IData = {
    top: OFFLINE_HERO_UUIDS.map((uuid, i) => ({
        id: 9001 + i,
        title: `Banner ${i + 1}`,
        image: reelShortStyleBannerUrl(uuid, 1920),
        // 离线模式：banner 也走新的 episodes 详情页（不再跳旧 /video/:id）
        episodeSlug:
            i === 0
                ? 'episode-2-%E7%94%B0%E5%9C%92%E6%83%85%E7%B7%A3-694507047c33a39ff605a96d-r7jxhoxjsb'
                : 'episode-2-%E7%94%B0%E5%9C%92%E6%83%85%E7%B7%A3-694507047c33a39ff605a96d-r7jxhoxjsb',
    })),
    // 观剧寰宇（More Recommended / type_5）：建议给足数量（两列竖排）
    recommend: [
        { id: 9011, title: 'Oh My Proud Heiress! Full Series', image: reelShortStyleBannerUrl('e535fc80-36d1-11ef-a6eb-0925fdddfb71', 1920), views: '1.9M', showExpo: true },
        { id: 9012, title: 'The Heiress Blacklisted Her Husband Full Series', image: reelShortStyleBannerUrl('95e84020-cf1a-11ef-9487-233a2ec55662', 1920), views: '114.2M', showExpo: true },
        { id: 9013, title: "Fortune's Gift: Spoiled by My Zillionaire Uncles Full Series", image: reelShortStyleBannerUrl('ce194b20-9daa-11ef-a2d6-41216ff1602c', 1920), views: '574k', showExpo: true },
        { id: 9014, title: 'Daisy Tucker and Mr. NYC Full Series', image: reelShortStyleBannerUrl('bcbe9430-73fa-11f0-a06b-bdb674869ea1', 1920), views: '46.8M', showExpo: true },
        { id: 9015, title: 'Uncle William, Please Say I Do! Full Series', image: reelShortStyleBannerUrl('4190b1b0-1fec-11f0-a650-71056cbfe3ac', 1920), views: '70.1M', showExpo: true },
        { id: 9016, title: "Sleep With A CEO After Fiancé's Betrayal Full Series", image: reelShortStyleBannerUrl('b3ffdc90-11b4-11ef-91f2-591dacad5fca', 1920), views: '1.7M', showExpo: true },
        { id: 9017, title: 'Accidental Triplets with the Billionaire Full Series', image: reelShortStyleBannerUrl('fb9ef330-3286-11f0-b65a-27549cd2a91e', 1920), views: '96.9M', showExpo: true },
        { id: 9018, title: 'The Dragon Within Me Full Series', image: reelShortStyleBannerUrl('a8e69bf0-5a25-11ef-838e-777d81c2a9c7', 1920), views: '1.3M', showExpo: true },
        { id: 9019, title: 'Queen Never Cry Full Series', image: reelShortStyleBannerUrl('67f76ad0-0324-11f1-84ad-6b5693b490dc', 1920), views: '83.5M', showExpo: true },
        { id: 9020, title: 'Money, Robots, and a Happy 4th of July Full Series', image: reelShortStyleBannerUrl('9fee1a10-67f7-11f0-a06b-bdb674869ea1', 1920), views: '22M', showExpo: true },
    ],
    rank: [
        { id: 9021, title: '头号焦点', image: '1038/400/600', views: '50M' },
        { id: 9022, title: '破晓行动', image: '1040/400/600', views: '19.4M' },
        { id: 9023, title: '深海谜踪', image: '1041/400/600', views: '34.5M' },
        { id: 9024, title: '逆风少年', image: '1043/400/600', views: '15M' },
    ],
    continueWatching: [
        {
            id: 9301,
            title: 'Breathe',
            image: reelShortStyleBannerUrl('6dfdc980-19c0-11f1-84ad-6b5693b490dc', 1920),
            episodeSlug: 'episode-2-%E7%94%B0%E5%9C%92%E6%83%85%E7%B7%A3-694507047c33a39ff605a96d-r7jxhoxjsb',
            currentEp: 1,
            totalEp: 70,
            progressPercent: 2,
            showPlayMask: true,
        },
        {
            id: 9302,
            title: 'Gossip Godmother',
            image: reelShortStyleBannerUrl('b68064a0-27a9-11f1-84ad-6b5693b490dc', 1920),
            // 你反馈的现象：点击会去 /video/9302；这里强制走新详情页
            episodeSlug: 'episode-2-%E7%94%B0%E5%9C%92%E6%83%85%E7%B7%A3-694507047c33a39ff605a96d-r7jxhoxjsb',
            currentEp: 12,
            totalEp: 70,
            progressPercent: 33,
            showPlayMask: true,
        },
    ],
    shelves: [
        {
            titleMessageId: 'home_continue_watching',
            titleHref: '/',
            // ReelShort 对应一般是 Continue Watching 自己的落地页；这里先保留占位
            viewAllHref: '/',
            items: [
                {
                    id: 9301,
                    title: 'Breathe',
                    image: reelShortStyleBannerUrl('6dfdc980-19c0-11f1-84ad-6b5693b490dc', 1920),
                    episodeSlug: 'episode-2-%E7%94%B0%E5%9C%92%E6%83%85%E7%B7%A3-694507047c33a39ff605a96d-r7jxhoxjsb',
                    currentEp: 1,
                    totalEp: 70,
                    progressPercent: 2,
                    showPlayMask: true,
                },
                {
                    id: 9302,
                    title: 'Gossip Godmother',
                    image: reelShortStyleBannerUrl('b68064a0-27a9-11f1-84ad-6b5693b490dc', 1920),
                    episodeSlug: 'episode-2-%E7%94%B0%E5%9C%92%E6%83%85%E7%B7%A3-694507047c33a39ff605a96d-r7jxhoxjsb',
                    currentEp: 12,
                    totalEp: 70,
                    progressPercent: 33,
                    showPlayMask: true,
                },
            ],
        },
        {
            titleMessageId: 'home_new_release',
            titleHref: '/',
            // 你提到的 ReelShort “查看全部”示例：/shelf/tear-jerkers-short-movies-dramas-119169
            // 我们的 HTML 对应点就是 HomePage_shelfHead__more 这个 <Link to={viewAllHref}>
            viewAllHref: '/shelf/tear-jerkers-short-movies-dramas-119169',
            items: [
                { id: 9401, title: 'New Release 1', image: reelShortStyleBannerUrl('7df88710-2845-11f1-84ad-6b5693b490dc', 1920), views: '2M' },
                { id: 9402, title: 'New Release 2', image: reelShortStyleBannerUrl('0c5d82c0-2847-11f1-84ad-6b5693b490dc', 1920), views: '2.1M' },
                { id: 9403, title: 'New Release 3', image: reelShortStyleBannerUrl('6595f860-1e45-11f1-84ad-6b5693b490dc', 1920), views: '4.1M' },
            ],
        },
        {
            titleMessageId: 'home_exclusive_series',
            titleHref: '/',
            viewAllHref: '/shelf/exclusive-series-119170',
            items: [
                { id: 9501, title: 'Exclusive 1', image: reelShortStyleBannerUrl('ced3e010-7136-11f0-a06b-bdb674869ea1', 1920), views: '50M' },
                { id: 9502, title: 'Exclusive 2', image: reelShortStyleBannerUrl('b70d7820-3814-11f0-b65a-27549cd2a91e', 1920), views: '19.4M' },
            ],
        },
        {
            titleMessageId: 'home_sweet_romance',
            titleHref: '/',
            viewAllHref: '/shelf/sweet-romance-119171',
            items: [
                { id: 9601, title: 'Sweet 1', image: reelShortStyleBannerUrl('3698d440-c6ae-11f0-84ad-6b5693b490dc', 1920), views: '15M' },
                { id: 9602, title: 'Sweet 2', image: reelShortStyleBannerUrl('096e1c00-dacc-11f0-84ad-6b5693b490dc', 1920), views: '34.5M' },
            ],
        },
        {
            titleMessageId: 'home_family_years',
            titleHref: '/',
            viewAllHref: '/shelf/family-years-119172',
            items: [
                { id: 9701, title: 'Family 1', image: reelShortStyleBannerUrl('34dfb980-d5cb-11f0-84ad-6b5693b490dc', 1920), views: '12k' },
                { id: 9702, title: 'Family 2', image: reelShortStyleBannerUrl('05759260-ec77-11f0-84ad-6b5693b490dc', 1920), views: '156k' },
            ],
        },
        {
            titleMessageId: 'home_love_hate',
            titleHref: '/',
            viewAllHref: '/shelf/love-hate-119173',
            items: [
                { id: 9801, title: 'Love/Hate 1', image: reelShortStyleBannerUrl('effb8fc0-0738-11f1-84ad-6b5693b490dc', 1920), views: '920k' },
                { id: 9802, title: 'Love/Hate 2', image: reelShortStyleBannerUrl('2315d640-0739-11f1-84ad-6b5693b490dc', 1920), views: '1.1M' },
            ],
        },
    ],
};

export const offlineHomeList: TData[] = [
    // 这里必须用 ReelShort 风格「banner 图」作为 list item（不再用 picsum 占位图）
    { id: 9101, title: '旧时光咖啡馆', image: reelShortStyleBannerUrl('34dfb980-d5cb-11f0-84ad-6b5693b490dc', 1920), views: '12k' },
    { id: 9102, title: '最后一班地铁', image: reelShortStyleBannerUrl('05759260-ec77-11f0-84ad-6b5693b490dc', 1920), views: '8.2k' },
    { id: 9103, title: '云端之上', image: reelShortStyleBannerUrl('68747a60-ec78-11f0-84ad-6b5693b490dc', 1920), views: '156k' },
    { id: 9104, title: '夏日重现', image: reelShortStyleBannerUrl('effb8fc0-0738-11f1-84ad-6b5693b490dc', 1920), views: '3.2M' },
    { id: 9105, title: '无声告白', image: reelShortStyleBannerUrl('2315d640-0739-11f1-84ad-6b5693b490dc', 1920), views: '920k' },
    { id: 9106, title: '平行世界', image: reelShortStyleBannerUrl('dacd80e0-0738-11f1-84ad-6b5693b490dc', 1920), views: '1.1M' },
    { id: 9107, title: '雾岛来信', image: reelShortStyleBannerUrl('0c6f7f40-0739-11f1-84ad-6b5693b490dc', 1920), views: '44k' },
    { id: 9108, title: '燃烧的季节', image: reelShortStyleBannerUrl('e535fc80-36d1-11ef-a6eb-0925fdddfb71', 1920), views: '210k' },
    { id: 9109, title: '远方来信', image: reelShortStyleBannerUrl('95e84020-cf1a-11ef-9487-233a2ec55662', 1920), views: '67k' },
    { id: 9110, title: '沉默的真相', image: reelShortStyleBannerUrl('ce194b20-9daa-11ef-a2d6-41216ff1602c', 1920), views: '88k' },
    { id: 9111, title: '逆光而行', image: reelShortStyleBannerUrl('bcbe9430-73fa-11f0-a06b-bdb674869ea1', 1920), views: '1.7M' },
    { id: 9112, title: '黎明之前', image: reelShortStyleBannerUrl('4190b1b0-1fec-11f0-a650-71056cbfe3ac', 1920), views: '2.0M' },
    { id: 9113, title: '落入人间', image: reelShortStyleBannerUrl('b3ffdc90-11b4-11ef-91f2-591dacad5fca', 1920), views: '70.1M' },
    { id: 9114, title: '与你重逢', image: reelShortStyleBannerUrl('fb9ef330-3286-11f0-b65a-27549cd2a91e', 1920), views: '96.9M' },
    { id: 9115, title: '命运回响', image: reelShortStyleBannerUrl('a8e69bf0-5a25-11ef-838e-777d81c2a9c7', 1920), views: '1.3M' },
    { id: 9116, title: '她从风里来', image: reelShortStyleBannerUrl('9fee1a10-67f7-11f0-a06b-bdb674869ea1', 1920), views: '22M' },
    { id: 9117, title: '暗夜微光', image: reelShortStyleBannerUrl('7df88710-2845-11f1-84ad-6b5693b490dc', 1920), views: '2M' },
    { id: 9118, title: '迷雾追踪', image: reelShortStyleBannerUrl('0c5d82c0-2847-11f1-84ad-6b5693b490dc', 1920), views: '2.1M' },
];
