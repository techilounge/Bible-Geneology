/**
 * Wordings the product is not allowed to get wrong.
 *
 * Requirement section 21. A lifetime overlap means two people were alive in
 * the same years. It is not evidence that they met, knew of each other, or
 * that anything passed between them. That sentence has to appear wherever
 * an overlap is reported, so it lives here rather than being retyped, and
 * the test suite asserts its presence by importing this constant rather
 * than by matching a string it keeps in step by hand.
 */
export const NOT_CONTACT =
  'An overlap means both were alive in the same years. It is not evidence ' +
  'that they met, or that anything passed between them.';

/**
 * The same rule for a chain of overlapping lifetimes (requirement section
 * 20). The chain is called a Lifetime Connection and is never described as
 * a route that anything travelled.
 */
export const CONNECTION_IS_NOT_A_ROUTE =
  'Each step is two people who were alive in the same years. The chain is not a ' +
  'route anything travelled, and it is not evidence that anyone in it met anyone else.';
