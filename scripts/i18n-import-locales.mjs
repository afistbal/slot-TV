/**
 * 将翻译后的 Excel 写回 src/locales/{code}.json（扁平 JSON，与 zh-CN.json 结构一致）。
 *
 * 用法：
 *   node scripts/i18n-import-locales.mjs --file ./翻译稿.xlsx
 *   node scripts/i18n-import-locales.mjs --file ./x.xlsx --out ./src/locales
 *   node scripts/i18n-import-locales.mjs --file ./x.xlsx --langs zh-TW
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import {
  loadSourceMessages,
  loadLocaleMessages,
  mergePreservingKeyOrder,
  parseCommaList,
  parseLangCodeFromHeader,
  root,
  writeJson,
} from "./i18n-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = {
    file: null,
    out: path.join(root, "src", "locales"),
    langs: null,
    keepSource: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) out.file = argv[++i];
    if (argv[i] === "--out" && argv[i + 1]) out.out = path.resolve(root, argv[++i]);
    if (argv[i] === "--langs" && argv[i + 1]) out.langs = parseCommaList(argv[++i]);
    if (argv[i] === "--keep-source") out.keepSource = true;
  }
  return out;
}

function sheetToRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function buildFlatMessages(rows, colIdx, sourceByKey, options = {}) {
  const { stripIfMatchesSource = true } = options;
  const out = {};
  for (const row of rows) {
    if (!row || !row.length) continue;
    const key = String(row[0] ?? "").trim();
    if (!key || key.toLowerCase() === "key") continue;
    const sourceRef = row[1] == null ? "" : String(row[1]);
    const raw = row[colIdx];
    let val = raw == null ? "" : String(raw);
    if (!val.trim()) continue;
    if (stripIfMatchesSource && val === sourceRef) continue;
    if (stripIfMatchesSource && sourceRef && val === sourceByKey[key]) continue;
    out[key] = val;
  }
  return out;
}

function main() {
  const { file, out, langs: langsFilter, keepSource } = parseArgs();
  if (!file || !fs.existsSync(file)) {
    console.error("请指定 Excel：node scripts/i18n-import-locales.mjs --file ./xxx.xlsx");
    process.exit(1);
  }

  const source = loadSourceMessages();
  const wb = XLSX.readFile(file);
  const sheetName = wb.SheetNames.includes("locales") ? "locales" : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.error("未找到工作表");
    process.exit(1);
  }

  const rows = sheetToRows(ws);
  const header = rows[0]?.map((c) => String(c).trim()) ?? [];
  if (!header[0]?.toLowerCase().includes("key")) {
    console.warn("首列建议为 key；仍按首行解析语言列");
  }

  const dataRows = rows.slice(1);
  const langColumns = [];
  for (let i = 2; i < header.length; i++) {
    const title = header[i];
    if (!title || title.toLowerCase() === "notes") break;
    const code = parseLangCodeFromHeader(title);
    if (!code || code === "zh-CN") continue;
    if (langsFilter && !langsFilter.includes(code)) continue;
    langColumns.push({ code, colIdx: i });
  }

  if (!langColumns.length) {
    console.error("未从表头解析到目标语言列（期望形如 zh-TW (繁體中文)）");
    process.exit(1);
  }

  const sourceKeyOrder = Object.keys(source);
  fs.mkdirSync(out, { recursive: true });
  for (const { code, colIdx } of langColumns) {
    const messages = buildFlatMessages(dataRows, colIdx, source, {
      stripIfMatchesSource: !keepSource,
    });
    const target = path.join(out, `${code}.json`);
    const existing = loadLocaleMessages(code);
    const { merged, changed, updatedCount, addedCount } = mergePreservingKeyOrder(
      existing,
      messages,
      sourceKeyOrder,
    );
    if (!changed) {
      console.log(`跳过 ${target}（Excel 中 ${Object.keys(messages).length} 条，无变化）`);
      continue;
    }
    writeJson(target, merged);
    console.log(
      `已写入 ${target}（新增 ${addedCount}，更新 ${updatedCount}，合计 ${Object.keys(merged).length} 条，顺序不变）`,
    );
  }
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
