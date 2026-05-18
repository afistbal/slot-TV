/** 与 douyin `SHORTS_DEMO_VIDEOS` 一致，仅 demo 推荐流使用 */

export type ShortsDemoVideoItem = {
    id: number;
    url: string;
    title?: string;
};

export const SHORTS_DEMO_VIDEOS: ShortsDemoVideoItem[] = [
    {
        id: 1,
        url: 'https://cos.yogoshort.com/c8abc3e35d553fdbc921504bd352f2b898fb24322b4a1e122a9cb37fac624bc6.mp4',
    },
    {
        id: 2,
        url: 'https://cos.yogoshort.com/2d18605798b2ae621c87f190db1b8b7f90c38c1e4079f0154c365fb7c0458a6b.mp4',
    },
    {
        id: 3,
        url: 'https://cos.yogoshort.com/3e6c10ac7358a0552b837a8496a336177ba92f779770051afb84d117d576713f.mp4',
    },
    {
        id: 4,
        url: 'https://cos.yogoshort.com/3f50abd6214d8c076ddb9406b88092803da9e7d5c4717d3e78a95637e3167ee7.mp4',
    },
    {
        id: 5,
        url: 'https://cos.yogoshort.com/6651dfad2a8fa0fce15dadb29f66fdc65e4044a7e587f392b02382f09b98a0b9.mp4',
    },
    {
        id: 6,
        url: 'https://cos.yogoshort.com/8e3c9cce5b05bd929bf8fdb22c0ab6313c6c582fd9f9fbff278ad5994e5a99bd.mp4',
    },
    {
        id: 7,
        title: 'Runaway Bride, Ruthless Hunt',
        url: 'https://cos.yogoshort.com/50ce3b6755f89543156856df7c163b395817bd6a0147c93357320c21b35030a1.mp4',
    },
    {
        id: 8,
        url: 'https://cos.yogoshort.com/e602e97c772653667f5e18a7bf17a7053b49f2352fcb78ee8e00dbccfcb97135.mp4',
    },
];
