import { useState } from 'react';
import { DEMO_AWEME_FEED } from '../data/buildDemoAwemeFeed';
import { DemoForYouReel } from './DemoForYouReel';

/** `/for-you`：Swiper 竖滑 + 单路视频，避免虚拟列表在移动端卡死 */
export function DemoSlideList() {
    const [list] = useState(DEMO_AWEME_FEED);

    return <DemoForYouReel list={list} />;
}
