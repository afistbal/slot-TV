/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import 'react';

// ReelShort/xgplayer：允许 JSX 写自定义标签（xg-* 等）
declare module 'react' {
    namespace JSX {
        interface IntrinsicElements {
            [elemName: string]: any;
        }
    }
}

declare module 'react/jsx-runtime' {
    namespace JSX {
        interface IntrinsicElements {
            [elemName: string]: any;
        }
    }
}

// ReelShort：video 上的非标准属性（保持 DOM 1:1）
declare module 'react' {
    interface VideoHTMLAttributes<T> {
        mediatype?: string;
        'x5-playsinline'?: string;
        'webkit-playsinline'?: string;
        'x5-video-orientation'?: string;
    }
}

export {};

