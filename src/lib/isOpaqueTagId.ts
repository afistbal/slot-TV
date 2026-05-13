/** 判断接口是否把可读标签名误填成内部十六进制 id（与 Search / 简介 pill 展示一致） */
export function isOpaqueTagId(value: string) {
    return /^[a-f0-9]{10,}$/i.test(value);
}
