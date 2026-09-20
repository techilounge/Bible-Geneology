import type { Dataset } from './dataset';

/**
 * Scripture references, in reading order.
 *
 * Alphabetical sorting puts Genesis 5:14 before Genesis 5:9, which reads as
 * a mistake to anyone who knows the text. Reading order is a property of a
 * reference rather than of whatever is showing it, so it lives here and
 * every surface that lists references gets the same order.
 */
export function compareReferences(a: string, b: string): number {
  const parse = (id: string): [string, number, number] => {
    const [book = '', chapter = '0', verse = '0'] = id.split('.');
    return [book, Number(chapter), Number(verse)];
  };
  const [bookA, chapterA, verseA] = parse(a);
  const [bookB, chapterB, verseB] = parse(b);
  return bookA.localeCompare(bookB) || chapterA - chapterB || verseA - verseB;
}

/**
 * Every reference behind a set of people's chronology records, deduplicated
 * and in reading order. This is the provenance that travels with a finding
 * or a question, so a reader can check it against the text.
 */
export function referencesFor(dataset: Dataset, personIds: readonly string[]): string[] {
  const refs = new Set<string>();
  for (const personId of personIds) {
    /* v8 ignore next -- @preserve: every id here came out of the dataset. */
    for (const reference of dataset.chronology.get(personId)?.sourceReferences ?? []) {
      refs.add(reference);
    }
  }
  return [...refs].sort(compareReferences);
}
