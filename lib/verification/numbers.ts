/**
 * Reading numbers out of a verse.
 *
 * Phase 2's verification pass compares a figure in the dataset against the
 * cited verse in a public-domain translation. Translations write numbers as
 * words, and two translations write them differently: the World English
 * Bible has "nine hundred thirty years" where the King James Version has
 * "nine hundred and thirty", "threescore and ten" or "an hundred and
 * twenty". So the check needs to read English cardinals as a human would,
 * and it needs to read the archaic forms too.
 *
 * This is deliberately a parser and not a lookup. Nothing here knows what
 * any verse says; it turns whatever text it is handed into the set of
 * numbers that text states, and the caller compares. That is what keeps the
 * verification honest: the evidence is the verse, not this file.
 */

/** Markup the KJV source carries inline: italics, notes, paragraph marks. */
const MARKUP = /<[^>]*>/g;

const UNITS: Readonly<Record<string, number>> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const MULTIPLIERS: Readonly<Record<string, number>> = {
  hundred: 100,
  thousand: 1000,
  score: 20,
};

/**
 * "Threescore and ten" is sixty and ten, written as one word. Splitting it
 * back into its parts lets the ordinary accumulator handle it.
 */
function expandScores(text: string): string {
  return text.replace(
    /\b(two|three|four|five|six|seven|eight|nine|ten)score\b/g,
    '$1 score',
  );
}

export function stripMarkup(text: string): string {
  return text.replace(MARKUP, ' ');
}

function isNumberWord(word: string): boolean {
  return word in UNITS || word in MULTIPLIERS;
}

/**
 * Evaluates one run of number words.
 *
 * A multiplier takes only the number immediately before it, not everything
 * accumulated so far, which is what "an hundred threescore and fifteen"
 * turns on: the score multiplies the three, not the hundred and three. So
 * a completed multiple goes into `section` and the loose units wait in
 * `pending` until something claims them.
 */
function evaluate(words: readonly string[]): number {
  // "A son" is not the number one. The indefinite article counts only where
  // it is standing in for "one" before a multiplier, as in "an hundred".
  const run =
    (words[0] === 'a' || words[0] === 'an') &&
    (words[1] === undefined || MULTIPLIERS[words[1]] === undefined)
      ? words.slice(1)
      : words;

  let total = 0;
  let section = 0;
  let pending = 0;

  for (const word of run) {
    const unit = UNITS[word];
    if (unit !== undefined) {
      pending += unit;
      continue;
    }
    const multiplier = MULTIPLIERS[word];
    /* v8 ignore next -- @preserve: every word in a run is one or the other. */
    if (multiplier === undefined) continue;
    if (multiplier === 1000) {
      total += (section + pending === 0 ? 1 : section + pending) * 1000;
      section = 0;
      pending = 0;
      continue;
    }
    section += (pending === 0 ? 1 : pending) * multiplier;
    pending = 0;
  }

  return total + section + pending;
}

/**
 * Every number the text states, whether written in digits or in words.
 *
 * A run of number words is broken by punctuation, so "an hundred years, and
 * he begat three sons" gives 100 and 3 rather than 103. "And" continues a
 * run only when a number word follows it, which is what lets "sixty and
 * nine" join while "thirty years, and he died" does not.
 */
export function numbersIn(text: string): Set<number> {
  const found = new Set<number>();
  const cleaned = expandScores(stripMarkup(text).toLowerCase());

  for (const digits of cleaned.matchAll(/\d+/g)) {
    found.add(Number(digits[0]));
  }

  // Segments are separated by anything that is not a letter, a space or a
  // hyphen: a comma, a full stop, a colon. Within a segment, words.
  for (const segment of cleaned.split(/[^a-z -]+/)) {
    let run: string[] = [];
    const flush = () => {
      if (run.length > 0) found.add(evaluate(run));
      run = [];
    };
    for (const word of segment.split(/[\s-]+/).filter(Boolean)) {
      if (isNumberWord(word)) {
        run.push(word);
        continue;
      }
      if (word === 'and' && run.length > 0) continue;
      flush();
    }
    flush();
  }

  found.delete(0);
  return found;
}
