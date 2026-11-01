export const CHINA_TIME_ZONE = 'Asia/Shanghai';

type DateValue = string | number | Date | null | undefined;

const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: CHINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
});

function dateParts(value: DateValue): Record<string, string> | null {
    if (value == null) return null;
    let normalized = value;
    if (typeof normalized === 'string') {
        normalized = normalized.trim();
        if (!normalized) return null;
        // 无时区的接口日期按北京时间解释，避免随设备时区偏移。
        if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
            normalized += 'T00:00:00+08:00';
        } else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized)) {
            normalized = normalized.replace(' ', 'T') + '+08:00';
        } else {
            normalized = normalized.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T');
        }
    }
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

/** 统一使用北京时间和年-月-日、24 小时制；接口原始时间值保持不变。 */
export function formatChinaDateTime(value: DateValue, { seconds = true, fallback = '—' } = {}): string {
    const parts = dateParts(value);
    if (!parts) return fallback;
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}${seconds ? `:${parts.second}` : ''}`;
}

export function formatChinaDate(value: DateValue, fallback = '—'): string {
    const parts = dateParts(value);
    return parts ? `${parts.year}-${parts.month}-${parts.day}` : fallback;
}

export function formatChinaTime(value: DateValue, fallback = '—'): string {
    const parts = dateParts(value);
    return parts ? `${parts.hour}:${parts.minute}` : fallback;
}
