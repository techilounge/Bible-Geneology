import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  validateDataset,
  type CanonicalFiles,
  type Finding,
} from '../lib/validation/validate-dataset';

/**
 * Validates the canonical dataset and exits non-zero on any severe finding, so
 * a canonical data error fails the build rather than reaching production
 * (requirement section 21).
 */
const DIR = join(process.cwd(), 'data', 'canonical');

async function load(name: string): Promise<unknown[]> {
  const text = await readFile(join(DIR, name), 'utf8');
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error(`${name} must contain a JSON array`);
  return parsed;
}

async function loadObject(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(DIR, name), 'utf8')) as unknown;
}

function render(findings: Finding[]) {
  const severe = findings.filter((f) => f.severity === 'severe');
  const warnings = findings.filter((f) => f.severity === 'warning');

  const group = (list: Finding[]) => {
    const byCheck = new Map<string, Finding[]>();
    for (const f of list) {
      byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), f]);
    }
    for (const [check, items] of [...byCheck.entries()].sort()) {
      console.log(`\n  ${check} (${items.length})`);
      for (const item of items.slice(0, 20)) {
        console.log(`    ${item.subject}: ${item.message}`);
      }
      if (items.length > 20) console.log(`    ... and ${items.length - 20} more`);
    }
  };

  if (severe.length > 0) {
    console.error(`\nSEVERE (${severe.length}) — these fail the build`);
    group(severe);
  }
  if (warnings.length > 0) {
    console.log(`\nWARNINGS (${warnings.length}) — reported, do not fail the build`);
    group(warnings);
  }

  console.log(`\n${severe.length} severe, ${warnings.length} warning(s).`);
  return severe.length;
}

async function main() {
  const files: CanonicalFiles = {
    people: await load('people.json'),
    personNames: await load('person-names.json'),
    relationships: await load('relationships.json'),
    chronologies: await load('chronologies.json'),
    personChronology: await load('person-chronology.masoretic.json'),
    chronologyOverrides: {
      'masoretic-gen11-26': await loadObject(
        'chronology-overrides.masoretic-gen11-26.json',
      ),
    },
    events: await load('events.json'),
    eventChronology: await load('event-chronology.masoretic.json'),
    scriptureReferences: await load('scripture-references.json'),
    sources: await load('sources.json'),
    assumptions: await load('assumptions.json'),
    eras: await load('eras.json'),
  };

  console.log(
    `Validating ${files.people.length} people, ${files.relationships.length} relationships, ` +
      `${files.personChronology.length} chronology records, ${files.eventChronology.length} event dates, ` +
      `${files.scriptureReferences.length} references.`,
  );

  const severeCount = render(validateDataset(files));
  if (severeCount > 0) process.exit(1);
  console.log('Canonical dataset validation passed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
