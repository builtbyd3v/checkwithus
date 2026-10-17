/**
 * Payee names as typed by people and phones vary ("City Power & Light",
 * "city power and light "). Payees are matched on this normalized form so a
 * known payee is not treated as new because of spacing or punctuation.
 */
export function normalizeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
