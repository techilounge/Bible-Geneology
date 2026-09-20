import { describe, expect, it } from 'vitest';
import { numbersIn, stripMarkup } from '../numbers';

/**
 * The parser that the Phase 2 verification pass reads verses with.
 *
 * The cases here are the forms the two sources actually use, taken from the
 * verses the dataset cites. A parser that got any of these wrong would
 * either pass a figure that the text does not state or fail one it does,
 * and both are worse than no check at all.
 */
describe('numbersIn', () => {
  it('reads digits', () => {
    expect(numbersIn('Genesis 5:5 gives 930 years')).toEqual(new Set([5, 930]));
  });

  it('reads the modern form, with no "and"', () => {
    expect(
      numbersIn('All the days that Adam lived were nine hundred thirty years'),
    ).toEqual(new Set([930]));
  });

  it('reads the King James form, with "and" inside the number', () => {
    expect(
      numbersIn('all the days of Methuselah were nine hundred sixty and nine years'),
    ).toEqual(new Set([969]));
  });

  it('reads "an hundred" as a hundred', () => {
    expect(numbersIn('an hundred and thirty years')).toEqual(new Set([130]));
  });

  it('reads a score, and a threescore', () => {
    expect(numbersIn('threescore and ten years')).toEqual(new Set([70]));
    expect(numbersIn('fourscore and five years')).toEqual(new Set([85]));
  });

  it('reads thousands', () => {
    expect(numbersIn('a thousand two hundred and ninety days')).toEqual(new Set([1290]));
  });

  it('keeps separate numbers separate when punctuation divides them', () => {
    expect(
      numbersIn('lived an hundred years, and he became the father of three sons'),
    ).toEqual(new Set([100, 3]));
  });

  it('does not read the indefinite article as the number one', () => {
    expect(numbersIn('and became the father of a son in his own likeness')).toEqual(
      new Set(),
    );
    expect(numbersIn('a hundred twenty-seven years')).toEqual(new Set([127]));
  });

  it('reads a hyphenated number', () => {
    expect(numbersIn('thirty-nine years old')).toEqual(new Set([39]));
  });

  it('strips the markup the King James source carries', () => {
    expect(stripMarkup('and darkness <FI>was<Fi> upon the face<CM>')).toBe(
      'and darkness  was  upon the face ',
    );
    expect(numbersIn('were seven hundred <FI>and<Fi> seventy years')).toContain(770);
  });

  it('finds nothing in a verse that states no number', () => {
    expect(numbersIn('Then he came out of the land of the Chaldaeans')).toEqual(
      new Set(),
    );
  });
});

describe('a multiplier takes only the number before it', () => {
  /**
   * The case that caught the first version of this parser. "An hundred
   * threescore and fifteen" is 175: the score multiplies the three, not
   * the hundred and three. Reading it the other way gave 2075, and a
   * verification pass that reports a figure as unverified because its own
   * parser is wrong is worse than useless.
   */
  it('reads "an hundred threescore and fifteen" as 175', () => {
    expect(numbersIn('an hundred threescore and fifteen years')).toEqual(new Set([175]));
  });

  it('reads "an hundred and fourscore" as 180', () => {
    expect(
      numbersIn('And the days of Isaac were an hundred and fourscore years'),
    ).toEqual(new Set([180]));
  });

  it('still reads the plain forms the same way', () => {
    expect(numbersIn('one hundred seventy-five years')).toEqual(new Set([175]));
    expect(numbersIn('nine hundred sixty and nine years')).toEqual(new Set([969]));
    expect(numbersIn('two hundred five years')).toEqual(new Set([205]));
  });
});
