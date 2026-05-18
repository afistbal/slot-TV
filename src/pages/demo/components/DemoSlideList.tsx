import { useEffect, useRef, useState } from 'react';
import { DEMO_AWEME_FEED } from '../data/buildDemoAwemeFeed';
import { demoBus, DEMO_EVENT_KEY } from '../douyin/bus';
import { SlideVerticalInfinite } from './SlideVerticalInfinite';

/** douyin `SlideList.vue` + `Slide4.vue`：硬编码推荐流，无 API */
export function DemoSlideList() {
    const [list] = useState(DEMO_AWEME_FEED);
    const [index, setIndex] = useState(0);
    const indexRef = useRef(0);
    indexRef.current = index;

    useEffect(() => {
        const onSingleClick = (uid: unknown) => {
            if (uid !== 'home') {
                return;
            }
            demoBus.emit(DEMO_EVENT_KEY.SINGLE_CLICK_BROADCAST, {
                uniqueId: 'home',
                index: indexRef.current,
                type: DEMO_EVENT_KEY.ITEM_TOGGLE,
            });
        };
        demoBus.on(DEMO_EVENT_KEY.SINGLE_CLICK, onSingleClick);
        return () => demoBus.off(DEMO_EVENT_KEY.SINGLE_CLICK, onSingleClick);
    }, []);

    return (
        <SlideVerticalInfinite
            uniqueId="home"
            name="infinite"
            list={list}
            active
            index={index}
            onIndexChange={setIndex}
        />
    );
}
