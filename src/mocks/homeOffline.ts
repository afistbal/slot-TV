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
    })),
    recommend: [
        { id: 9011, title: '极速追击', image: '1033/400/600' },
        { id: 9012, title: '午夜档案', image: '1035/400/600' },
        { id: 9013, title: '荒野之歌', image: '1036/400/600' },
        { id: 9014, title: '霓虹侦探', image: '1037/400/600' },
    ],
    rank: [
        { id: 9021, title: '头号焦点', image: '1038/400/600' },
        { id: 9022, title: '破晓行动', image: '1040/400/600' },
        { id: 9023, title: '深海谜踪', image: '1041/400/600' },
        { id: 9024, title: '逆风少年', image: '1043/400/600' },
    ],
};

export const offlineHomeList: TData[] = [
    { id: 9101, title: '旧时光咖啡馆', image: '1044/300/450' },
    { id: 9102, title: '最后一班地铁', image: '1045/300/450' },
    { id: 9103, title: '云端之上', image: '1047/300/450' },
    { id: 9104, title: '夏日重现', image: '1048/300/450' },
    { id: 9105, title: '无声告白', image: '1049/300/450' },
    { id: 9106, title: '平行世界', image: '1050/300/450' },
    { id: 9107, title: '雾岛来信', image: '1051/300/450' },
    { id: 9108, title: '燃烧的季节', image: '1052/300/450' },
    { id: 9109, title: '远方来信', image: '1053/300/450' },
];
