import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Renders every unread figure in the chronology input file as a worksheet, so
 * the numbers can be read off the text and filled in one pass instead of
 * navigating JSON.
 *
 * This is a convenience for the human doing the sourcing. It produces no data;
 * the numbers still come from the text.
 */
interface Figure {
  value: number | null;
  reference: string;
}

const FIELD_LABELS: Record<string, string> = {
  birthOffsetFromFather: 'age of father when this person was born',
  lifespan: 'total years lived',
  'lifespan.ageAtFathering': 'age when the next in the chain was born',
  'lifespan.remainingYears': 'years lived after fathering the next in the chain',
  ageAtFlood: 'age at the flood',
  yearsAfterFloodAtArphaxadBirth: 'years after the flood when Arphaxad was born',
  ageAtDepartureFromHaran: 'age when he left Haran',
  ageAtIsaacBirth: 'age when Isaac was born',
  ageBeforePharaoh: 'age when he stood before Pharaoh',
  ageWhenSold: 'age when he was sold into Egypt',
};

async function main() {
  const dir = join(process.cwd(), 'data', 'canonical');
  const rows: Array<Record<string, unknown>> = JSON.parse(
    await readFile(join(dir, 'person-chronology.masoretic.json'), 'utf8'),
  );
  const refs: Array<{ id: string; displayLabel: string }> = JSON.parse(
    await readFile(join(dir, 'scripture-references.json'), 'utf8'),
  );
  const label = new Map(refs.map((r) => [r.id, r.displayLabel]));

  const lines: string[] = [
    '# Dataset worksheet',
    '',
    'Every figure the Masoretic chronology needs, with the verse that holds it.',
    'Read each one from the text and write it in the Value column, then transfer',
    'the numbers into `data/canonical/person-chronology.masoretic.json`.',
    '',
    'No number here comes from a model. That is the point of the file.',
    '',
    'Where two translations disagree, leave the value blank, note both readings,',
    'and the record becomes DISPUTED rather than VERIFIED.',
    '',
    '| Person | Figure | Verse | Value |',
    '| --- | --- | --- | --- |',
  ];

  let count = 0;
  for (const row of rows) {
    const person = String(row.personId);
    const emit = (path: string, figure: Figure) => {
      if (figure.value !== null) return;
      const name = FIELD_LABELS[path] ?? path;
      lines.push(
        `| ${person} | ${name} | ${label.get(figure.reference) ?? figure.reference} |  |`,
      );
      count += 1;
    };

    const walk = (node: unknown, path: string) => {
      if (Array.isArray(node)) {
        for (const item of node) {
          const named = item as { name?: string };
          walk(item, named.name ?? path);
        }
        return;
      }
      if (node === null || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      if ('value' in record && 'reference' in record) {
        emit(path, record as unknown as Figure);
        return;
      }
      for (const [key, value] of Object.entries(record)) {
        walk(value, path ? `${path}.${key}` : key);
      }
    };

    for (const key of ['birthOffsetFromFather', 'lifespan', 'additionalFigures']) {
      if (key in row) walk(row[key], key === 'additionalFigures' ? '' : key);
    }
  }

  lines.push('', `${count} figures.`, '');
  await writeFile(join(process.cwd(), 'docs', 'DATASET_WORKSHEET.md'), lines.join('\n'));
  console.log(`Wrote docs/DATASET_WORKSHEET.md with ${count} figures.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
