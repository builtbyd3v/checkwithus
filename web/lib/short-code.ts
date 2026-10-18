/**
 * Client-side twin of normalizeShortCode in lib/auth/tokens.ts (that file imports node:crypto, so the
 * browser cannot load it). Same alphabet, same forgiveness. The server stays the authority.
 * ios/GuardKit/Sources/GuardKit/ShortCode.swift mirrors this for the iPhone apps.
 */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_LENGTH = 8;

function codeChars(input: string): string {
  return [...input.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')]
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('');
}

/** Whatever was typed or pasted -> at most 8 code characters, no dash. Unknown characters are dropped. */
export function cleanCode(input: string): string {
  return codeChars(input).slice(0, CODE_LENGTH);
}

/**
 * The field's next value after an edit. A full code pasted onto a partly or fully filled field
 * replaces it; anything else keeps the first 8.
 */
export function nextCode(previous: string, edited: string): string {
  const all = codeChars(edited);
  const added = all.startsWith(previous) ? all.slice(previous.length) : '';
  return all.length > CODE_LENGTH && added.length >= CODE_LENGTH ? added.slice(0, CODE_LENGTH) : all.slice(0, CODE_LENGTH);
}

/** XXXX-XXXX once all 8 are in, else null. */
export function canonicalCode(cleaned: string): string | null {
  return cleaned.length === CODE_LENGTH ? `${cleaned.slice(0, 4)}-${cleaned.slice(4)}` : null;
}
