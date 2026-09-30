export interface CodeWords {
  none: (length: number) => string;
  more: (left: number) => string;
}

/**
 * What a screen reader is given as the code field's value: each character on its own ("K 7 M 4", not the word "k7m4")
 * and, until the code is whole, how many are still to enter. The boxes on screen are a picture of this value.
 */
export function spokenCode(value: string, length: number, words: CodeWords): string {
  if (value.length === 0) return words.none(length);
  const typed = value.split("").join(" ");
  return value.length >= length ? typed : `${typed}, ${words.more(length - value.length)}`;
}
