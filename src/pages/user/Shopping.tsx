import { useEffect } from 'react';

const SHOPPING_URL = 'https://www.reelshort.com/zh-TW/shopping?from=store_from_fast_pay';

export default function Shopping() {
    useEffect(() => {
        window.location.replace(SHOPPING_URL);
    }, []);

    return null;
}

