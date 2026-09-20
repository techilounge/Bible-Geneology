import { cpSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Proves the data gate bites.
 *
 * The unit tests assert that the validators return findings. This asserts
 * something weaker but harder to fake: that corrupting the real canonical
 * files makes `npm run validate` exit non-zero. A validator that reports a
 * finding nobody wires to an exit code is decoration, and that is precisely
 * the failure this gate exists to prevent (requirement section 21).
 *
 * It works on a copy in a temporary directory and restores the originals in
 * a finally block, so a crash cannot leave the working tree corrupted.
 */
const CANONICAL = join(process.cwd(), 'data', 'canonical');

interface Corruption {
  name: string;
  file: string;
  apply: (data: unknown) => unknown;
}

const CORRUPTIONS: Corruption[] = [
  {
    name: 'a derived year typed into the canonical figures',
    file: 'person-chronology.masoretic.json',
    apply: (data) => {
      const rows = data as Array<Record<string, unknown>>;
      const first = rows[0];
      if (first) first['birthYear'] = 0;
      return rows;
    },
  },
  {
    name: 'a scripture reference that does not resolve',
    file: 'person-chronology.masoretic.json',
    apply: (data) => {
      const rows = data as Array<Record<string, unknown>>;
      const lifespan = rows[0]?.['lifespan'] as Record<string, unknown> | undefined;
      if (lifespan) lifespan['reference'] = 'GEN.99.1';
      return rows;
    },
  },
  {
    name: 'a relationship pointing at a person who does not exist',
    file: 'relationships.json',
    apply: (data) => {
      const rows = data as Array<Record<string, unknown>>;
      const first = rows[0];
      if (first) first['targetPersonId'] = 'nobody';
      return rows;
    },
  },
  {
    name: 'a parent cycle',
    file: 'relationships.json',
    apply: (data) => {
      const rows = data as Array<Record<string, unknown>>;
      return [
        ...rows,
        {
          sourcePersonId: 'seth',
          targetPersonId: 'adam',
          relationshipType: 'parent',
          sourceReferences: ['GEN.5.3'],
          confidence: 'EXPLICIT',
          sourceType: 'SCRIPTURE_EXPLICIT',
          reviewStatus: 'DRAFT',
        },
      ];
    },
  },
  {
    name: 'a fathering age that makes a son older than his father',
    file: 'person-chronology.masoretic.json',
    apply: (data) => {
      const rows = data as Array<Record<string, unknown>>;
      const seth = rows.find((r) => r['personId'] === 'seth');
      const offset = seth?.['birthOffsetFromFather'] as
        Record<string, unknown> | undefined;
      if (offset) offset['value'] = -200;
      return rows;
    },
  },
];

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'ignore', shell: false });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const backup = await mkdtemp(join(tmpdir(), 'canonical-'));
  await cp(CANONICAL, backup, { recursive: true });

  // A finally block does not run on SIGINT, and leaving a developer's
  // canonical data corrupted because they pressed Ctrl-C would be a far
  // worse bug than the one this script exists to prevent.
  const restoreAndExit = () => {
    cpSync(backup, CANONICAL, { recursive: true });
    process.exit(130);
  };
  process.on('SIGINT', restoreAndExit);
  process.on('SIGTERM', restoreAndExit);

  let failures = 0;
  try {
    for (const corruption of CORRUPTIONS) {
      const path = join(CANONICAL, corruption.file);
      const original = await readFile(path, 'utf8');
      const corrupted = corruption.apply(JSON.parse(original) as unknown);
      await writeFile(path, `${JSON.stringify(corrupted, null, 2)}\n`, 'utf8');

      const code = await run('npm', ['run', 'validate', '--silent']);
      await writeFile(path, original, 'utf8');

      if (code === 0) {
        console.error(`  NOT CAUGHT: ${corruption.name}`);
        failures += 1;
      } else {
        console.log(`  caught: ${corruption.name}`);
      }
    }
  } finally {
    await cp(backup, CANONICAL, { recursive: true });
    await rm(backup, { recursive: true, force: true });
    process.off('SIGINT', restoreAndExit);
    process.off('SIGTERM', restoreAndExit);
  }

  if (failures > 0) {
    console.error(
      `\n${failures} corruption(s) passed validation. The data gate does not bite.`,
    );
    process.exit(1);
  }
  console.log(`\nAll ${CORRUPTIONS.length} corruptions were caught. The gate bites.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
