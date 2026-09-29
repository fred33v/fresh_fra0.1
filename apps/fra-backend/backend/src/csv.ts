import type { Context } from 'hono';

// Cells starting with these characters are run as formulas by Excel/Sheets
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString()
    : typeof value === 'object' ? JSON.stringify(value)
    : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialise rows to RFC 4180 CSV. Columns default to the keys of the first row. */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [cols.map(csvCell).join(',')];
  for (const row of rows) lines.push(cols.map((col) => csvCell(row[col])).join(','));
  return lines.join('\r\n') + '\r\n';
}

export function wantsCsv(c: Context): boolean {
  return c.req.query('format') === 'csv';
}

export function csvResponse(c: Context, filename: string, rows: Record<string, unknown>[], columns?: string[]) {
  return c.body(toCsv(rows, columns), 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'no-store',
  });
}
