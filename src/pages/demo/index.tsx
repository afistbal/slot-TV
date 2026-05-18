import { useEffect } from 'react';
import { DemoSlideList } from './components/DemoSlideList';
import { initDemoDouyinGlobals } from './douyin/globals';
import './demo-douyin.scss';

/** `/demo`：纯 douyin 首页推荐竖滑，不依赖 slot_old 播放链路 */
export default function DemoDouyinHome() {
    useEffect(() => initDemoDouyinGlobals(), []);

    return (
        <div className="demo-douyin-page">
            <DemoSlideList />
        </div>
    );
}
