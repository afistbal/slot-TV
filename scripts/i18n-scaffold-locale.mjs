/**
 * 为新增语言创建空的 src/locales/{code}.json（默认 {}）。
 * 导出脚本会以 en.json 的 key 为全集，空 json 对应列全部留空。
 *
 * 用法：
 *   node scripts/i18n-scaffold-locale.mjs --langs es,fr,hi,it
 *   node scripts/i18n-scaffold-locale.mjs --langs es --force
 */

import fs from "node:fs";
import {
  LOCALE_META,
  localeFilePath,
  parseCommaList,
  writeJson,
} from "./i18n-shared.mjs";

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { langs: [], force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--langs" && argv[i + 1]) out.langs = parseCommaList(argv[++i]);
    if (argv[i] === "--force") out.force = true;
  }
  return out;
}

function main() {
  const { langs, force } = parseArgs();
  if (!langs.length) {
    console.error("请指定语言：node scripts/i18n-scaffold-locale.mjs --langs es,fr,hi");
    process.exit(1);
  }

  for (const code of langs) {
    if (code === "en") {
      console.warn("跳过 en（源语言）");
      continue;
    }
    const file = localeFilePath(code);
    if (fs.existsSync(file) && !force) {
      console.log(`已存在，跳过: ${file}`);
      continue;
    }
    writeJson(file, {});
    const meta = LOCALE_META[code];
    const hint = meta ? ` (${meta.label} / ${meta.locale})` : "";
    console.log(`已创建: ${file}${hint}`);
  }
}

try {
  main();
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
