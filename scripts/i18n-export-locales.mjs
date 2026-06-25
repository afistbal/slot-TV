/**
 * 导出 src/locales → Excel，以 en.json 为 key 全集与英文参考。
 * 默认只导出「待翻译」条目（目标语言列为空或与英文相同）。
 *
 * 用法：
 *   npm run i18n:export
 *   node scripts/i18n-export-locales.mjs --langs es,fr,hi,it
 *   node scripts/i18n-export-locales.mjs --all-keys
 *   node scripts/i18n-export-locales.mjs --prefix retention_promo_
 *   node scripts/i18n-export-locales.mjs --all-langs --prefix retention_promo_ --out ./dist/retention-promo-i18n.xlsx
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import {
  discoverLocaleCodes,
  langColumnHeader,
  loadEnMessages,
  loadLocaleMessages,
  needsTranslation,
  NEW_LOCALE_CODES,
  parseCommaList,
  registeredTargetLocaleCodes,
  root,
  sortedKeys,
} from "./i18n-shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const out = {
    file: null,
    langs: null,
    pendingOnly: true,
    allKeys: false,
    prefix: null,
    allLangs: false,
  };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) out.file = argv[++i];
    if (argv[i] === "--langs" && argv[i + 1]) out.langs = parseCommaList(argv[++i]);
    if (argv[i] === "--prefix" && argv[i + 1]) out.prefix = argv[++i];
    if (argv[i] === "--all-langs") out.allLangs = true;
    if (argv[i] === "--all-keys") {
      out.allKeys = true;
      out.pendingOnly = false;
    }
    if (argv[i] === "--pending-only") out.pendingOnly = true;
  }
  return out;
}

function defaultLangs() {
  const existing = NEW_LOCALE_CODES.filter((code) =>
    fs.existsSync(path.join(root, "src", "locales", `${code}.json`))
  );
  if (existing.length) return existing;
  return discoverLocaleCodes(["en", "zh"]);
}

function main() {
  const { file: outArg, langs: langsArg, pendingOnly, prefix, allLangs } = parseArgs();
  const en = loadEnMessages();
  let allKeys = sortedKeys(en);
  if (prefix) {
    allKeys = allKeys.filter((key) => key.startsWith(prefix));
    if (!allKeys.length) {
      console.error(`en.json 中无匹配前缀 "${prefix}" 的 key`);
      process.exit(1);
    }
  }
  if (!allKeys.length) {
    console.error("en.json 为空");
    process.exit(1);
  }

  const langs = langsArg?.length
    ? langsArg
    : allLangs
      ? registeredTargetLocaleCodes()
      : defaultLangs();
  if (!langs.length) {
    console.error("未指定 --langs，且 locales 目录下无可用目标语言");
    process.exit(1);
  }

  const localeData = Object.fromEntries(langs.map((code) => [code, loadLocaleMessages(code)]));
  const keys = pendingOnly
    ? allKeys.filter((key) => {
        const enVal = en[key] == null ? "" : String(en[key]);
        return langs.some((code) => needsTranslation(key, code, localeData, enVal));
      })
    : allKeys;

  if (!keys.length) {
    console.log("所选语言均已翻译完成，无需导出。");
    process.exit(0);
  }

  const header = ["key", "en (source)", ...langs.map(langColumnHeader), "notes"];
  const aoa = [
    header,
    ...keys.map((key) => {
      const enVal = en[key] == null ? "" : String(en[key]);
      const cols = langs.map((code) => {
        const raw = localeData[code][key];
        const val = raw == null ? "" : String(raw);
        return val.trim() !== "" ? val : "";
      });
      return [key, enVal, ...cols, ""];
    }),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 42 },
    { wch: 56 },
    ...langs.map(() => ({ wch: 40 })),
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "locales");

  const readme = [
    ["说明"],
    ["1. 请勿修改 A 列 key；B 列为 en.json 英文参考。"],
    ["2. 默认仅导出待翻译行（目标语言列为空或与英文相同）。"],
    ["3. 默认语言列：es / it / fr / hi；--all-langs 导出全部 15 种目标语言。"],
    ["4. 导出全部 key：加 --all-keys；按前缀：--prefix retention_promo_"],
    ["5. 导入：npm run i18n:import -- --file ./翻译稿.xlsx（仅 patch Excel 行，保留 json 原 key 顺序）"],
    ["6. 占位符如 {price}、{renewal}、{percent}、{sec} 请保留。"],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(readme);
  XLSX.utils.book_append_sheet(wb, ws2, "README");

  const outFile = path.resolve(root, outArg || "i18n-locales-export.xlsx");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  XLSX.writeFile(wb, outFile);
  console.log("已生成:", outFile);
  console.log(
    pendingOnly
      ? `待翻译 ${keys.length} / ${allKeys.length} 条 key；语言列: ${langs.join(", ")}`
      : `共 ${keys.length} 条 key；语言列: ${langs.join(", ")}`
  );
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
