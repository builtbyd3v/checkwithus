'use client';

import { CODE_LENGTH, canonicalCode, nextCode } from '@/lib/short-code';

type CodeInputProps = {
  id: string;
  /** Form field name; it carries the canonical XXXX-XXXX, or nothing until all 8 are in. */
  name: string;
  /** The cleaned characters, no dash, at most 8. */
  value: string;
  onChange: (value: string) => void;
};

const slots = Array.from({ length: CODE_LENGTH }, (_, i) => i);

/**
 * One real input behind 8 drawn boxes, so screen readers, Voice Control and Dictation see a single field.
 * The dash is drawn, never typed or counted.
 */
export function CodeInput({ id, name, value, onChange }: CodeInputProps) {
  const active = Math.min(value.length, CODE_LENGTH - 1);
  const box = (i: number) => <span key={i} className={`flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl bg-card font-sans text-2xl font-semibold text-foreground sm:h-16 sm:text-3xl ${
    i === active ? 'group-focus-within:bg-card group-focus-within:ring-3 group-focus-within:ring-action' : ''}`}>{value[i] ?? ''}</span>;
  return <div className="group relative">
    <input id={id} value={value} aria-describedby={`${id}-count`}
      autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} inputMode="text"
      maxLength={CODE_LENGTH} pattern={`[0-9A-HJKMNP-TV-Z]{${CODE_LENGTH}}`}
      onChange={(event) => onChange(nextCode(value, event.target.value))}
      // maxLength would cut a pasted XXXX-XXXX to 7 code characters, so paste goes through nextCode instead.
      onPaste={(event) => { event.preventDefault(); onChange(nextCode(value, value + event.clipboardData.getData('text'))); }}
      // The caret is hidden, so it always sits after the last character.
      onSelect={(event) => { const end = event.currentTarget.value.length; if (event.currentTarget.selectionStart !== end) event.currentTarget.setSelectionRange(end, end); }}
      className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent" />
    <div aria-hidden className="flex items-center gap-1.5 sm:gap-2">
      {slots.slice(0, 4).map(box)}
      <span className="px-0.5 text-2xl font-semibold text-muted">-</span>
      {slots.slice(4).map(box)}
    </div>
    <span id={`${id}-count`} className="sr-only">{CODE_LENGTH} characters, {value.length} entered</span>
    <input type="hidden" name={name} value={canonicalCode(value) ?? ''} />
  </div>;
}
