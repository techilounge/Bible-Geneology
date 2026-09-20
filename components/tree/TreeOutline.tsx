import Link from 'next/link';
import type { OutlineBranch, TreeOutlineModel } from '@/lib/graph/tree-layout';

/**
 * The family tree in words.
 *
 * Built first, like the timeline's list, and always in the DOM. A tree
 * drawn as lines between boxes tells a screen reader nothing about who
 * descends from whom; a nested list says exactly that, in the markup
 * rather than in an ARIA overlay.
 *
 * The outline arrives already assembled from the same edges the picture is
 * drawn from, so the two cannot describe different families, and this file
 * holds no opinion about what a relationship is.
 */
export interface OutlinePerson {
  personId: string;
  name: string;
  slug: string;
}

export function TreeOutline({
  outline,
  people,
}: {
  outline: TreeOutlineModel;
  people: Readonly<Record<string, OutlinePerson>>;
}) {
  const rootName = people[outline.root.personId]?.name ?? outline.root.personId;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
          Line of descent to {rootName}
        </h3>
        {outline.ancestorLine.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No parent is recorded for {rootName} within this view.
          </p>
        ) : (
          <ol className="flex flex-wrap items-baseline gap-x-2 text-sm">
            {outline.ancestorLine.map((id) => (
              <li
                key={id}
                className="after:ml-2 after:content-['→'] last:after:content-['']"
              >
                <PersonLink person={people[id]} id={id} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold tracking-wide text-[var(--color-text-muted)] uppercase">
          Descendants shown
        </h3>
        <Branch branch={outline.root} people={people} depth={0} />
      </section>
    </div>
  );
}

function Branch({
  branch,
  people,
  depth,
}: {
  branch: OutlineBranch;
  people: Readonly<Record<string, OutlinePerson>>;
  depth: number;
}) {
  return (
    <ul
      className={
        depth === 0
          ? 'flex flex-col gap-1'
          : 'ml-4 flex flex-col gap-1 border-l border-[var(--color-border-subtle)] pl-4'
      }
    >
      <li>
        <span className="flex min-h-11 flex-wrap items-baseline gap-x-2">
          <PersonLink person={people[branch.personId]} id={branch.personId} />
          {branch.spouseIds.length > 0 ? (
            <span className="text-sm text-[var(--color-text-muted)]">
              with{' '}
              {branch.spouseIds.map((id, index) => (
                <span key={id}>
                  {index > 0 ? ', ' : ''}
                  <PersonLink person={people[id]} id={id} />
                </span>
              ))}
            </span>
          ) : null}
        </span>
        {branch.children.map((child) => (
          <Branch key={child.personId} branch={child} people={people} depth={depth + 1} />
        ))}
      </li>
    </ul>
  );
}

function PersonLink({ person, id }: { person: OutlinePerson | undefined; id: string }) {
  if (!person) return <span>{id}</span>;
  return (
    <Link
      href={`/people/${person.slug}`}
      className="font-medium underline decoration-transparent underline-offset-4 hover:decoration-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
    >
      {person.name}
    </Link>
  );
}
