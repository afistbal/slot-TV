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

/** 与 Search 页一致：仅 `movie_tag`（接口 tag/name），列表请求只用 tag、不带 keyword */
export function videoIntroTagSearchPath(tag: { name: string; unique_id: string }): string {
    return `/search?${new URLSearchParams({ movie_tag: tag.name }).toString()}`;
}
