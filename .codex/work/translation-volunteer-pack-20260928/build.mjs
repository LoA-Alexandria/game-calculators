import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repository = "C:/Users/futor/Desktop/PopEpoch";
const outputDir = `${repository}/outputs/translation-volunteer-20260928`;
const outputPath = `${outputDir}/Pop-Epoch-Translation-Pack.xlsx`;
const enUrl = pathToFileURL(`${repository}/lib/i18n/dictionaries/en.ts`);
const { default: dictionary } = await import(enUrl.href);

const rows = [];
const walk = (value, path = []) => {
  if (typeof value === "string") {
    if (value.trim()) {
      const id = path.join(".");
      const context = path.slice(0, -1).map((part) => String(part)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
        .replace(/[-_]/g, " "))
        .join(" · ");
      rows.push([id, value, context, "", ""]);
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, [...path, index]));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => walk(item, [...path, key]));
  }
};
walk(dictionary);

const workbook = Workbook.create();
const guide = workbook.worksheets.add("Start Here");
guide.showGridLines = false;
guide.getRange("A1:B1").values = [["Pop Epoch translation pack", ""]];
guide.mergeCells("A1:B1");
guide.getRange("A2:B2").values = [[
  "A complete snapshot of the English reference text for volunteer translation.",
  "",
]];
guide.mergeCells("A2:B2");
guide.getRange("A4:B4").values = [["Target language and locale code", ""]];
guide.getRange("A6:B12").values = [
  ["How to translate", "Instructions"],
  ["1. Fill in the target language", "Enter the language and locale code in the yellow cell above, for example Español (es)."],
  ["2. Translate", "On the Translations tab, fill only the yellow Translation column. Keep every ID and English source unchanged."],
  ["3. Preserve formatting", "Keep placeholders such as {count}, links, tags, punctuation, and line breaks intact unless the sentence requires a natural equivalent."],
  ["4. Ask questions", "Put uncertainties or alternatives in Translator notes. Do not add, delete, or reorder rows."],
  ["5. Return the file", "Send this completed workbook back to the project owner in Discord. Volunteers do not edit the website, pages, or code."],
  ["What is included", `${rows.length.toLocaleString("en-US")} non-empty strings from the English reference dictionary, including site, calculator, guide, and editor text. Snapshot date: 2026-09-28.`],
];
guide.getRange("A1:B12").format.font = { name: "Aptos", size: 11, color: "#263445" };
guide.getRange("A1:B1").format = {
  font: { name: "Aptos", size: 18, bold: true, color: "#172B4D" },
  rowHeight: 32,
};
guide.getRange("A2:B2").format.font = { name: "Aptos", size: 11, color: "#5B6573", italic: true };
guide.getRange("A4").format.font = { name: "Aptos", size: 11, bold: true, color: "#263445" };
guide.getRange("B4").format = {
  fill: "#FFF2CC",
  borders: { preset: "outside", style: "thin", color: "#D6B656" },
  rowHeight: 25,
};
guide.getRange("A6:B6").format = {
  fill: "#24476B",
  font: { name: "Aptos", size: 11, bold: true, color: "#FFFFFF" },
};
guide.getRange("A7:A12").format.font = { name: "Aptos", size: 11, bold: true, color: "#263445" };
guide.getRange("B7:B12").format = { wrapText: true, verticalAlignment: "center" };
guide.getRange("A1:A12").format.columnWidth = 31;
guide.getRange("B1:B12").format.columnWidth = 104;
guide.getRange("A7:B12").format.rowHeight = 38;
guide.getRange("A12:B12").format.rowHeight = 54;
guide.freezePanes.freezeRows(6);

const translations = workbook.worksheets.add("Translations");
translations.showGridLines = false;
translations.getRange(`A1:E${rows.length + 1}`).values = [
  ["String ID (keep unchanged)", "English source (do not edit)", "Context", "Translation", "Translator notes"],
  ...rows,
];
const table = translations.tables.add(`A1:E${rows.length + 1}`, true, "TranslationStrings");
table.style = "TableStyleMedium2";
translations.getRange(`A1:E${rows.length + 1}`).format.font = { name: "Aptos", size: 10, color: "#263445" };
translations.getRange("A1:E1").format = {
  fill: "#24476B",
  font: { name: "Aptos", size: 10, bold: true, color: "#FFFFFF" },
  wrapText: true,
  verticalAlignment: "center",
  rowHeight: 32,
};
translations.getRange(`A2:A${rows.length + 1}`).format.columnWidth = 42;
translations.getRange(`B2:B${rows.length + 1}`).format.columnWidth = 70;
translations.getRange(`C2:C${rows.length + 1}`).format.columnWidth = 34;
translations.getRange(`D2:D${rows.length + 1}`).format.columnWidth = 70;
translations.getRange(`E2:E${rows.length + 1}`).format.columnWidth = 34;
translations.getRange(`B2:E${rows.length + 1}`).format.wrapText = true;
translations.getRange(`A2:E${rows.length + 1}`).format.verticalAlignment = "top";
translations.getRange(`D2:D${rows.length + 1}`).format.fill = "#FFF2CC";
translations.getRange(`A2:E${rows.length + 1}`).format.autofitRows();
translations.freezePanes.freezeRows(1);

await fs.mkdir(outputDir, { recursive: true });
const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 3000,
  tableMaxRows: 3,
  tableMaxCols: 5,
});
const sample = await workbook.inspect({
  kind: "table",
  range: "Translations!A1:E6",
  include: "values",
  tableMaxRows: 6,
  tableMaxCols: 5,
});
const startPreview = await workbook.render({ sheetName: "Start Here", range: "A1:B12", scale: 1, format: "png" });
const translationPreview = await workbook.render({ sheetName: "Translations", range: "A1:E14", scale: 1, format: "png" });
const longTextPreview = await workbook.render({ sheetName: "Translations", range: "A1128:E1132", scale: 1, format: "png" });
await fs.writeFile(`${outputDir}/start-preview.png`, new Uint8Array(await startPreview.arrayBuffer()));
await fs.writeFile(`${outputDir}/translations-preview.png`, new Uint8Array(await translationPreview.arrayBuffer()));
await fs.writeFile(`${outputDir}/long-text-preview.png`, new Uint8Array(await longTextPreview.arrayBuffer()));
const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(JSON.stringify({ outputPath, stringCount: rows.length, overview: overview.ndjson, sample: sample.ndjson }, null, 2));
