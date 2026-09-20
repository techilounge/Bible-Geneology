/**
 * The chronology engine.
 *
 * Framework-independent by construction: nothing under lib/chronology or
 * lib/graph may import React, Next, Supabase, or anything from app/ or
 * components/. An ESLint zone enforces it, so requirement section 18's "the
 * engine must contain no UI code" fails the lint run rather than a review.
 *
 * Every function takes a Dataset as its first argument and returns either a
 * plain value or a ChronologyResult, which forces callers to handle the
 * unknown and disputed cases.
 */
export {
  buildDataset,
  hasDates,
  isPresent,
  lookup,
  type Dataset,
  type DatasetInput,
} from './dataset';
export {
  deriveChronology,
  deriveEventChronology,
  topologicalOrder,
  type ChronologyInputRecord,
  type DeriveResult,
  type DeriveEventsResult,
  type EventChronologyInputRecord,
} from './derive';
export {
  compareLifespans,
  getLifetimeOverlap,
  type LifespanComparison,
  type Overlap,
} from './overlap';
export {
  datedPeople,
  getAgeAtPersonBirth,
  getAgeAtPersonDeath,
  getAgeAtYear,
  getPersonTimeline,
  type Age,
  type PersonTimeline,
} from './ages';
export {
  agesAtYear,
  getLivingAncestorsAtYear,
  getLivingDescendantsAtYear,
  getMaximumConcurrentGenerations,
  getPeopleAliveAtBirth,
  getPeopleAliveAtDeath,
  getPeopleAliveAtYear,
  type ConcurrentGenerations,
  type LivingPerson,
} from './alive';
export { getEventsDuringLifetime, type EventDuringLifetime } from './events';
export { getChronologyExplanation, type ChronologyExplanation } from './explanation';
export {
  ancestorsOf,
  childrenOf,
  descendantsOf,
  generationDepths,
  getAncestorPath,
  getDescendantPath,
  getGenerationDistance,
  getRelationshipPath,
  parentsOf,
  siblingsOf,
  spousesOf,
  type RelationshipEdge,
} from '@/lib/graph/relationships';
export {
  buildOverlapGraph,
  getOverlapChain,
  type OverlapGraph,
} from '@/lib/graph/overlap-graph';
export {
  axisTicks,
  buildRows,
  clampDomain,
  createScale,
  extentOf,
  overlappingIds,
  packLanes,
  visibleRows,
  zoomAbout,
  type TimelineEvent,
  type TimelineInput,
  type TimelineRow,
  type TimelineScale,
} from './scale';
