import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const XLSX = require("../src/frontend/node_modules/xlsx");

const sourceFile = "C:/Users/james/Downloads/BAWJIASE COMMUNITY BANK SHARE LIST.xlsx";
const outputFile = path.resolve(
  "src/frontend/src/data/bawjiase-shareholders.json",
);

const workbook = XLSX.readFile(sourceFile);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

const shareholders = rows.map((row) => {
  const memberNo = String(row["Member No"] ?? "").trim();
  const title = String(row.Title ?? "").trim();
  const forenames = String(row.Forenames ?? "").trim();
  const surname = String(row.Surname ?? "").trim();
  const fullName = [title, forenames, surname]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    shareholderNumber: memberNo,
    fullName,
    idNumber: `MEM-${memberNo}`,
    shareholding: 0,
    tags: [],
  };
});

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(
  outputFile,
  JSON.stringify(
    {
      sourceFile: path.basename(sourceFile),
      total: shareholders.length,
      shareholders,
    },
    null,
    2,
  ),
);

console.log(
  `Wrote ${shareholders.length} shareholders to ${path.relative(process.cwd(), outputFile)}`,
);
