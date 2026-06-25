import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(__dirname, "..");
export const localesDir = path.join(root, "src", "locales");

/**
 * 项目短码 ↔ 业务 locale 对照（与翻译表 country / language / locale 列对齐）。
 * 文件名：src/locales/{code}.json
 */
export const LOCALE_META = {
  en: { label: "English", locale: "en_US", country: "United States" },
  zh: { label: "繁體中文", locale: "zh_TW", country: "Taiwan" },
  ja: { label: "日本語", locale: "ja_JP", country: "Japan" },
  ko: { label: "한국어", locale: "ko_KR", country: "South Korea" },
  es: { label: "Español", locale: "es_ES", country: "Spain" },
  th: { label: "แบบไทย", locale: "th_TH", country: "Thailand" },
  id: { label: "Bahasa Indonesia", locale: "id_ID", country: "Indonesia" },
  pt: { label: "Português", locale: "pt_PT", country: "Portugal" },
  it: { label: "Italiano", locale: "it_IT", country: "Italy" },
  de: { label: "Deutsch", locale: "de_DE", country: "Germany" },
  fr: { label: "Français", locale: "fr_FR", country: "France" },
  tr: { label: "Türkçe", locale: "tr_TR", country: "Turkey" },
  ms: { label: "Melayu", locale: "ms_MY", country: "Malaysia" },
  ar: { label: "عربي", locale: "ar_AE", country: "United Arab Emirates" },
  vi: { label: "Tiếng Việt", locale: "vi_VN", country: "Vietnam" },
  hi: { label: "हिंदी", locale: "hi_IN", country: "India" },
};

/** 当前仓库已接入的运行时语言（src/lib/messagesForLocale.ts） */
export const REGISTERED_LOCALE_CODES = [
  "en",
  "zh",
  "ar",
  "de",
  "es",
  "fr",
  "hi",
  "id",
  "it",
  "ja",
  "ko",
  "ms",
  "pt",
  "th",
  "tr",
  "vi",
];

/** 新增待翻译语言；导出脚本默认只导出这些语言的待翻条目 */
export const NEW_LOCALE_CODES = ["es", "it", "fr", "hi"];

/** 除 en 外全部已接入语言（导出给产品翻译用） */
export function registeredTargetLocaleCodes() {
  return REGISTERED_LOCALE_CODES.filter((code) => code !== "en");
}

export function readJson(relOrAbs) {
  const abs = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(root, relOrAbs);
  let text = fs.readFileSync(abs, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return JSON.parse(text);
}

export function writeJson(relOrAbs, obj) {
  const abs = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(root, relOrAbs);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(obj, null, 4)}\n`, "utf8");
}

export function localeFilePath(code) {
  return path.join(localesDir, `${code}.json`);
}

export function loadEnMessages() {
  return readJson(localeFilePath("en"));
}

export function loadLocaleMessages(code) {
  const file = localeFilePath(code);
  if (!fs.existsSync(file)) return {};
  try {
    const data = readJson(file);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (e) {
    console.warn(`${code}.json 读取失败，按空对象处理:`, e.message || e);
    return {};
  }
}

export function sortedKeys(messages) {
  return Object.keys(messages).sort((a, b) => a.localeCompare(b));
}

/**
 * 合并翻译 patch，保留 existing 原有 key 顺序；新增 key 按 referenceKeyOrder（通常 en.json）定位插入。
 */
export function mergePreservingKeyOrder(existing, updates, referenceKeyOrder = null) {
  if (!updates || !Object.keys(updates).length) {
    return { merged: existing, changed: false, updatedCount: 0, addedCount: 0 };
  }

  const order = Object.keys(existing);
  const merged = { ...existing };
  let changed = false;
  let updatedCount = 0;
  let addedCount = 0;

  const findInsertIndex = (key) => {
    if (!referenceKeyOrder?.length) return order.length;
    const refIdx = referenceKeyOrder.indexOf(key);
    if (refIdx < 0) return order.length;

    for (let i = refIdx - 1; i >= 0; i--) {
      const prevIdx = order.indexOf(referenceKeyOrder[i]);
      if (prevIdx >= 0) return prevIdx + 1;
    }
    for (let i = refIdx + 1; i < referenceKeyOrder.length; i++) {
      const nextIdx = order.indexOf(referenceKeyOrder[i]);
      if (nextIdx >= 0) return nextIdx;
    }
    return order.length;
  };

  for (const [key, val] of Object.entries(updates)) {
    if (Object.prototype.hasOwnProperty.call(existing, key)) {
      if (merged[key] !== val) {
        merged[key] = val;
        changed = true;
        updatedCount++;
      }
    } else {
      const insertIdx = findInsertIndex(key);
      order.splice(insertIdx, 0, key);
      merged[key] = val;
      changed = true;
      addedCount++;
    }
  }

  const ordered =
    changed && order.length
      ? Object.fromEntries(order.map((key) => [key, merged[key]]))
      : merged;

  return { merged: ordered, changed, updatedCount, addedCount };
}

export function langColumnHeader(code) {
  const meta = LOCALE_META[code];
  return meta ? `${code} (${meta.label})` : code;
}

/** 从表头解析语言短码，如 "es (Español)" → es */
export function parseLangCodeFromHeader(cell) {
  const text = String(cell ?? "").trim();
  if (!text) return null;
  const m = text.match(/^([a-z]{2}(?:-[a-z]{2})?)\b/i);
  if (m) return m[1].toLowerCase();
  if (text in LOCALE_META) return text;
  return null;
}

export function discoverLocaleCodes(exclude = ["en"]) {
  if (!fs.existsSync(localesDir)) return [];
  return fs
    .readdirSync(localesDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .filter((code) => !exclude.includes(code))
    .sort((a, b) => a.localeCompare(b));
}

export function parseCommaList(value) {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 某 key 在目标语言中是否仍待翻译（空或与英文相同） */
export function needsTranslation(key, code, localeData, enVal) {
  const raw = localeData[code]?.[key];
  const val = raw == null ? "" : String(raw).trim();
  if (!val) return true;
  if (val === enVal) return true;
  return false;
}
