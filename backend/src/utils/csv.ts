/** Quotes every field, so embedded commas, quotes, and newlines survive Excel. */
export const toCsv = (rows: Record<string, unknown>[]): string => {
  if (rows.length === 0) return '';

  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  return [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\r\n');
};
