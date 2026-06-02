import { isOpaqueTagId } from '@/lib/isOpaqueTagId';
import { buildTagSearchQuery, resolveMovieTagLocalLabel } from '@/lib/movieTagLabels';
import { getBackendTagDisplayText, type PlayerTagRow } from '@/lib/normalizePlayerTags';

/** 与简介抽屉 pill 展示一致：首字母大写、下划线转空格 */
export function formatVideoIntroTagLabel(uniqueId: string): string {
    return uniqueId
        .split('')
        .map((ch, k) => {
            let c = ch;
            if (k === 0) {
                c = c.toUpperCase();
            }
            if (c === '_') {
                c = ' ';
            }
            return c;
        })
        .join('');
}

function readableTagLabelForSearch(tag: PlayerTagRow): string {
    const localized = resolveMovieTagLocalLabel(tag);
    if (localized) {
        return localized;
    }
    const text = getBackendTagDisplayText(tag);
    if (text && text !== '-' && !isOpaqueTagId(text)) {
        return text;
    }
    return '';
}

/** 与 Search 页一致：`movie_tag` + 可选 `tag_label`（首屏即显示全称） */
export function videoIntroTagSearchPath(tag: PlayerTagRow): string {
    return `/tagSearch?${buildTagSearchQuery(tag.name, readableTagLabelForSearch(tag))}`;
}
