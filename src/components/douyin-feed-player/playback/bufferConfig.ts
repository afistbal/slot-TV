/**
 * 抖音H5-iOS播放适配分析.md §3.1 / client-entry L20907-20911
 */
import { MAX_BUFFER_LENGTH, MIN_BUFFER_LENGTH } from '../constants';

export function getMp4PluginConfig() {
    return {
        maxBufferLength: MAX_BUFFER_LENGTH,
        minBufferLength: MIN_BUFFER_LENGTH,
    };
}
