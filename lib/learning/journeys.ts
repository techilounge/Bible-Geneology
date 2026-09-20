import type { QuizMode } from '@/lib/quiz';

/**
 * The six guided journeys in requirement section 39.
 *
 * What is written here is structure and explanation: which people a step
 * is about, which events, and why they are worth looking at together.
 * What is deliberately not written here is a single figure. Every number
 * a journey shows is read from the chronology at render time, so a step
 * cannot go on asserting an age after the chronology that produced it has
 * changed — the failure `docs/COPY_CORRECTIONS.md` records. A test bans
 * digits in this file's prose so the rule cannot erode.
 */
export interface JourneyStep {
  id: string;
  title: string;
  body: string;
  /** Whose dates the step shows, from the engine. */
  personIds: readonly string[];
  eventIds: readonly string[];
  /** A question generated for this step, if it has one. */
  question?: { mode: QuizMode; seed: string };
}

export interface Journey {
  slug: string;
  title: string;
  summary: string;
  steps: readonly JourneyStep[];
}

export const JOURNEYS: readonly Journey[] = [
  {
    slug: 'adam-to-noah',
    title: 'Adam to Noah',
    summary:
      'The first genealogy, and what happens to it when you stop reading it as a list and start reading it as a set of overlapping lives.',
    steps: [
      {
        id: 'the-list',
        title: 'A list of names, and their lifespans',
        body: 'Genesis 5 reads as a chain: each man lives, fathers a son, and dies. Read down the column and it is a list. Read across the years and it is a room full of people who were alive at the same time.',
        personIds: ['adam', 'seth', 'enosh', 'kenan', 'mahalalel'],
        eventIds: ['creation-of-adam'],
      },
      {
        id: 'the-long-lives',
        title: 'The long lives in the middle',
        body: 'Jared, Methuselah and Noah carry the longest spans in the chapter. Long lives are what make the early chronology so tightly connected: a handful of lifetimes covers the whole stretch.',
        personIds: ['jared', 'methuselah', 'lamech', 'noah'],
        eventIds: [],
        question: { mode: 'who-lived-longer', seed: 'adam-to-noah/long-lives' },
      },
      {
        id: 'enoch',
        title: 'The one whose death is not recorded',
        body: 'Enoch is the exception. The text gives his span but never says he died, so the chronology records a length and no end. He is shown with an open bar rather than a guessed one.',
        personIds: ['enoch', 'methuselah'],
        eventIds: [],
      },
      {
        id: 'who-overlapped',
        title: 'Who was in the room',
        body: 'Pick a year inside the chapter and the overlapping spans answer a question the list cannot: who was living at the same time as whom. That overlap is a matter of years, not of meetings.',
        personIds: ['adam', 'methuselah', 'lamech', 'noah'],
        eventIds: [],
        question: { mode: 'who-was-alive', seed: 'adam-to-noah/who-overlapped' },
      },
    ],
  },
  {
    slug: 'the-flood-generation',
    title: 'The Flood generation',
    summary:
      'The generation the Flood falls in, and how the chronology places it against the lives around it.',
    steps: [
      {
        id: 'the-family',
        title: 'Noah and his sons',
        body: 'Noah, Shem, Ham and Japheth are the family the account follows through the Flood. Only some of them have dated records, and the ones that do not are shown as unknown rather than filled in.',
        personIds: ['noah', 'shem', 'ham', 'japheth'],
        eventIds: [],
      },
      {
        id: 'the-flood-year',
        title: 'Where the Flood sits',
        body: 'The Flood is dated from Noah’s own age when it began, which is why it can be placed on the same axis as the lifetimes rather than floating beside it.',
        personIds: ['noah', 'shem'],
        eventIds: ['the-flood'],
        question: { mode: 'guess-the-age', seed: 'flood/age' },
      },
      {
        id: 'the-generation-before',
        title: 'The generation before it',
        body: 'Methuselah and Lamech belong to the generation just before. Comparing the end of their spans with the year of the Flood is a chronological exercise, and the text does not narrate it for us.',
        personIds: ['methuselah', 'lamech', 'noah'],
        eventIds: ['the-flood'],
        question: { mode: 'could-lifetimes-overlap', seed: 'flood/overlap' },
      },
    ],
  },
  {
    slug: 'noah-to-abraham',
    title: 'Noah to Abraham',
    summary:
      'The second genealogy, where the lifespans shorten and the chronology becomes the thing that decides who could have been alive together.',
    steps: [
      {
        id: 'the-shortening',
        title: 'The spans get shorter',
        body: 'From Shem onward the recorded lifespans fall away steadily. The change is in the text itself, and it is why this stretch feels different from Genesis 5 even though it is built the same way.',
        personIds: ['shem', 'arphaxad', 'shelah', 'eber', 'peleg'],
        eventIds: [],
        question: { mode: 'put-them-in-order', seed: 'noah-to-abraham/order' },
      },
      {
        id: 'babel',
        title: 'An event with an era and no year',
        body: 'The Tower of Babel is placed in the days of Peleg, which is an era rather than a year. The chronology leaves it undated rather than choosing a year to make the chart tidy.',
        personIds: ['peleg', 'reu'],
        eventIds: ['tower-of-babel'],
      },
      {
        id: 'terah',
        title: 'Where the chronologies disagree',
        body: 'Terah is the point at which two readings of the text part company, and the two give Abraham different birth years. The alternate reading is kept beside the default rather than hidden, and switching between them changes what the pages say.',
        personIds: ['terah', 'abraham', 'nahor-son-of-terah', 'haran'],
        eventIds: [],
        question: { mode: 'timeline-placement', seed: 'noah-to-abraham/placement' },
      },
    ],
  },
  {
    slug: 'abrahams-family',
    title: "Abraham's family",
    summary:
      'A household the text gives unusually precise ages for, and the places where it gives none at all.',
    steps: [
      {
        id: 'the-household',
        title: 'The household',
        body: 'Abraham, Sarah, Hagar, Ishmael and Isaac are all named with enough detail to place most of them on the axis. Hagar is the one the text gives no ages for, so her record stays empty.',
        personIds: ['abraham', 'sarah', 'hagar', 'ishmael', 'isaac'],
        eventIds: [],
      },
      {
        id: 'departure',
        title: 'Leaving Haran',
        body: 'The departure from Haran is dated from Abraham’s stated age at the time, and it is one of the anchors the surrounding chronology is built on.',
        personIds: ['abraham', 'terah'],
        eventIds: ['abraham-departs-haran'],
        question: { mode: 'guess-the-age', seed: 'abrahams-family/age' },
      },
      {
        id: 'sarah',
        title: 'A stated age, and one that is worked out',
        body: 'Sarah’s age at her death is stated outright. Her age at Isaac’s birth is not: it follows from two other verses, so the app marks it as derived rather than as something the text says.',
        personIds: ['sarah', 'isaac', 'abraham'],
        eventIds: [],
        question: { mode: 'who-am-i', seed: 'abrahams-family/who' },
      },
    ],
  },
  {
    slug: 'isaac-and-jacob',
    title: 'Isaac and Jacob',
    summary:
      'Two generations where the ages are given at the moments that matter, and the women are named without dates.',
    steps: [
      {
        id: 'isaac',
        title: 'Isaac and Rebekah',
        body: 'Isaac has a full record. Rebekah is named throughout the account and given no ages at all, and the app shows that absence rather than estimating around it.',
        personIds: ['isaac', 'rebekah'],
        eventIds: [],
      },
      {
        id: 'the-twins',
        title: 'Esau and Jacob',
        body: 'The twins are born in the same year, which makes them a useful test of how the app handles two lives that start together and are recorded very differently.',
        personIds: ['esau', 'jacob', 'isaac'],
        eventIds: [],
        question: { mode: 'could-lifetimes-overlap', seed: 'isaac-and-jacob/overlap' },
      },
      {
        id: 'the-mothers',
        title: 'Leah, Rachel, Bilhah and Zilpah',
        body: 'The four mothers of Jacob’s children are people in the dataset with no chronology of their own. They appear in the family tree and stay off the timeline, because there is nothing to place them with.',
        personIds: ['leah', 'rachel', 'bilhah', 'zilpah', 'jacob'],
        eventIds: [],
      },
    ],
  },
  {
    slug: 'the-twelve-tribes',
    title: 'The twelve tribes',
    summary:
      "Jacob's children, and the single life in that generation the chronology can place.",
    steps: [
      {
        id: 'the-children',
        title: 'The children of Jacob',
        body: 'The sons and daughter are recorded as a family without ages. They are in the relationship graph, which is what the family tree draws, and absent from the timeline, which needs years.',
        personIds: ['reuben', 'simeon', 'levi', 'judah', 'dinah', 'benjamin'],
        eventIds: [],
        question: { mode: 'family-connection', seed: 'twelve-tribes/family' },
      },
      {
        id: 'joseph',
        title: 'Joseph, the one with dates',
        body: 'Joseph is the exception: the account gives his age at several points, so his record can be placed. His age when the family arrives in Egypt is worked out from three of those statements rather than stated in one.',
        personIds: ['joseph', 'jacob'],
        eventIds: ['jacob-enters-egypt'],
        question: { mode: 'timeline-placement', seed: 'twelve-tribes/placement' },
      },
      {
        id: 'the-end-of-genesis',
        title: 'Where the dataset stops',
        body: 'The chronology ends with Joseph, because that is as far as this dataset has been sourced and checked. Later periods are architected for and deliberately not invented.',
        personIds: ['joseph'],
        eventIds: ['jacob-enters-egypt'],
      },
    ],
  },
];

export function journeyBySlug(slug: string): Journey | null {
  return JOURNEYS.find((journey) => journey.slug === slug) ?? null;
}
