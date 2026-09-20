import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  deriveChronology,
  deriveEventChronology,
  type ChronologyInputRecord,
  type EventChronologyInputRecord,
} from '../lib/chronology/derive';
import { EventChronologySchema, PersonChronologySchema } from '../lib/domain';

/**
 * Computes data/generated/person-chronology.<chronology>.json from the sourced
 * figures in data/canonical.
 *
 * Derived years are never hand-entered into data/canonical — the validator
 * fails the build if they appear there. This script is the only thing that
 * writes them, and the output directory is git-ignored: the figures a human
 * read from the text are the artefact worth versioning, not the arithmetic
 * over them.
 */
const CANONICAL = join(process.cwd(), 'data', 'canonical');
const GENERATED = join(process.cwd(), 'data', 'generated');

interface OverrideFile {
  chronologyId: string;
  baseChronologyId: string;
  rationale: string;
  records: Array<Partial<ChronologyInputRecord> & { personId: string }>;
}

async function readJson(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(CANONICAL, name), 'utf8')) as unknown;
}

async function exists(name: string): Promise<boolean> {
  try {
    await stat(join(CANONICAL, name));
    return true;
  } catch {
    return false;
  }
}

async function loadBase(chronologyId: string): Promise<ChronologyInputRecord[]> {
  const parsed = await readJson(`person-chronology.${chronologyId}.json`);
  if (!Array.isArray(parsed)) {
    throw new Error(`person-chronology.${chronologyId}.json must contain a JSON array`);
  }
  return parsed as ChronologyInputRecord[];
}

/**
 * An alternate chronology is expressed as the records that actually differ
 * from its base, not as a second copy of the whole dataset. Two copies drift;
 * one copy plus a short list of differences cannot.
 */
async function loadInput(chronologyId: string): Promise<ChronologyInputRecord[]> {
  const overrideName = `chronology-overrides.${chronologyId}.json`;
  if (!(await exists(overrideName))) {
    return loadBase(chronologyId);
  }

  const override = (await readJson(overrideName)) as OverrideFile;
  if (override.chronologyId !== chronologyId) {
    throw new Error(`${overrideName} declares chronologyId ${override.chronologyId}`);
  }

  const base = await loadBase(override.baseChronologyId);
  const patches = new Map(override.records.map((r) => [r.personId, r]));

  for (const personId of patches.keys()) {
    if (!base.some((r) => r.personId === personId)) {
      throw new Error(
        `${overrideName} overrides ${personId}, who has no record in ${override.baseChronologyId}`,
      );
    }
  }

  return base.map((record) => {
    const patch = patches.get(record.personId);
    return { ...record, ...(patch ?? {}), chronologyId };
  });
}

async function run(chronologyId: string): Promise<number> {
  const input = await loadInput(chronologyId);
  const { records, issues, unread } = deriveChronology(input, chronologyId);

  for (const record of records) {
    const parsed = PersonChronologySchema.safeParse(record);
    if (!parsed.success) {
      issues.push({
        personId: record.personId,
        message: `derived record fails the schema: ${parsed.error.issues
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join('; ')}`,
      });
    }
  }

  const eventInputName = `event-chronology.${chronologyId}.json`;
  const eventBase = (await exists(eventInputName))
    ? chronologyId
    : ((await readJson(`chronology-overrides.${chronologyId}.json`)) as OverrideFile)
        .baseChronologyId;
  const eventInput = (await readJson(
    `event-chronology.${eventBase}.json`,
  )) as EventChronologyInputRecord[];
  const events = deriveEventChronology(
    eventInput.map((e) => ({ ...e, chronologyId })),
    chronologyId,
    records,
  );
  issues.push(...events.issues);

  for (const record of events.records) {
    const parsed = EventChronologySchema.safeParse(record);
    if (!parsed.success) {
      issues.push({
        personId: record.eventId,
        message: `derived event fails the schema: ${parsed.error.issues
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join('; ')}`,
      });
    }
  }

  await mkdir(GENERATED, { recursive: true });
  await writeFile(
    join(GENERATED, `person-chronology.${chronologyId}.json`),
    `${JSON.stringify(records, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(GENERATED, `event-chronology.${chronologyId}.json`),
    `${JSON.stringify(events.records, null, 2)}\n`,
    'utf8',
  );

  const dated = records.filter((r) => r.birthYear !== null).length;
  const datedEvents = events.records.filter((e) => e.startYear !== null).length;
  console.log(
    `\n${chronologyId}: ${records.length} person record(s), ${dated} with a birth year; ` +
      `${events.records.length} event(s), ${datedEvents} dated.`,
  );

  if (unread.size > 0) {
    console.log(`\nAwaiting a reading from the text (${unread.size} person(s)):`);
    for (const [personId, count] of [...unread.entries()].sort()) {
      console.log(`  ${personId}: ${count} figure(s)`);
    }
  }

  if (issues.length > 0) {
    console.error(`\nISSUES (${issues.length})`);
    for (const issue of issues) console.error(`  ${issue.personId}: ${issue.message}`);
  }

  return issues.length;
}

async function main() {
  const requested = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const chronologies =
    requested.length > 0 ? requested : ['masoretic', 'masoretic-gen11-26'];

  let failures = 0;
  for (const chronologyId of chronologies) {
    failures += await run(chronologyId);
  }

  if (failures > 0) {
    console.error(`\n${failures} issue(s). Derivation failed.`);
    process.exit(1);
  }
  console.log('\nDerivation complete.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
