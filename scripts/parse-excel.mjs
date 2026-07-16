import pkg from 'xlsx';
const { readFile, utils } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const wb = readFile(join(__dirname, '../docs/MIS 2026-2027.xlsx'), {
  cellFormula: true,
  cellNF: true,
  cellStyles: true,
  sheetStubs: true,
});

let output = '';

wb.SheetNames.forEach(sheetName => {
  const ws = wb.Sheets[sheetName];
  output += `\n${'='.repeat(90)}\n`;
  output += `SHEET: "${sheetName}"   Range: ${ws['!ref'] || 'N/A'}\n`;
  output += '='.repeat(90) + '\n';

  // Get all cell addresses
  const range = utils.decode_range(ws['!ref'] || 'A1');

  for (let R = range.s.r; R <= range.e.r; R++) {
    let rowHasContent = false;
    let rowLine = `  Row ${String(R + 1).padStart(3)}: `;
    let cellParts = [];

    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];

      if (cell) {
        rowHasContent = true;
        let cellStr = '';
        if (cell.f) {
          // Has formula
          cellStr = `[${addr}] v="${cell.v ?? ''}" f="${cell.f}"`;
        } else if (cell.v !== undefined && cell.v !== '') {
          cellStr = `[${addr}] v="${cell.v}"`;
        } else {
          cellStr = `[${addr}] empty`;
        }
        cellParts.push(cellStr);
      }
    }

    if (rowHasContent && cellParts.length > 0) {
      // Only output rows with real content (skip all-empty)
      const hasRealContent = cellParts.some(p => !p.endsWith('empty'));
      if (hasRealContent) {
        output += rowLine + '\n';
        cellParts.forEach(p => {
          if (!p.endsWith('empty')) {
            output += `    ${p}\n`;
          }
        });
      }
    }
  }
});

const outPath = join(__dirname, '../docs/mis-formulas.txt');
writeFileSync(outPath, output, 'utf-8');
console.log('Written to docs/mis-formulas.txt');
console.log('Total characters:', output.length);
