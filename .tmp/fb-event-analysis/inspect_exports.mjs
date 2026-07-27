import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const files = [
  "C:\\Users\\Administrator\\Downloads\\Jul 24, 2026, 9_18 PM.xlsx",
  "C:\\Users\\Administrator\\Downloads\\Jul 24, 2026, 9_20 PM (1).xlsx",
  "C:\\Users\\Administrator\\Downloads\\Jul 24, 2026, 9_21 PM.xlsx",
  "C:\\Users\\Administrator\\Downloads\\soul_1577690270680633_Purchase_Jul 24, 2026, 8_57 PM.csv",
];

for (const file of files) {
  const workbook = file.endsWith(".csv")
    ? await Workbook.fromCSV(await fs.readFile(file, "utf8"), { sheetName: "CSV" })
    : await SpreadsheetFile.importXlsx(await FileBlob.load(file));
  const summary = await workbook.inspect({
    kind: "workbook,sheet,table",
    maxChars: 12000,
    tableMaxRows: 50,
    tableMaxCols: 30,
    tableMaxCellChars: 300,
  });
  console.log(`\n### ${path.basename(file)}\n${summary.ndjson}`);
}
