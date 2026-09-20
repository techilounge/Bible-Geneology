# SECURITY.md

**Project:** Bible Timeline Explorer
**Date:** 2026-09-20

---

## 1. Threat model

The product holds no payment data and little personal data, so the realistic threats
are narrower than for a typical consumer app, and two of them are specific to what this
product is:

| Threat                                                               | Severity | Where it is addressed |
| -------------------------------------------------------------------- | -------- | --------------------- |
| Service-role key reaching a client bundle                            | Critical | §3                    |
| An unauthorized write to canonical chronology data                   | Critical | §4, §5                |
| One user reading or writing another's data                           | High     | §4                    |
| Unverified data marked VERIFIED                                      | High     | §5                    |
| Prompt injection into an AI feature producing a false biblical claim | High     | §8                    |
| Scraping or abuse of the read API                                    | Medium   | §6                    |
| Dependency vulnerability                                             | Medium   | §7                    |
| Stack traces or database errors reaching users                       | Low      | §9                    |

The two unusual ones are third and fourth from the bottom. For this product, a false
chronology claim is a more damaging security failure than most data leaks would be,
because the product's entire value is that its numbers can be trusted. Data integrity
is treated as a security property here, not only a quality one.

---

## 2. Authentication

Supabase Auth with Google OAuth, email magic link, and Apple sign-in where practical.

- Core exploration requires no account (§46), so no route is gated by default.
- Sessions are cookie-based via `@supabase/ssr`, `httpOnly`, `secure`, `sameSite=lax`.
- No JWT is read on the client for authorization purposes. Client-side session state
  drives what is _displayed_; the database decides what is _permitted_.
- Redirect URLs are allow-listed in Supabase configuration, not accepted from a query
  parameter.

---

## 3. Credential handling

| Key                             | Exposure                       | Enforcement                                                                     |
| ------------------------------- | ------------------------------ | ------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public by design               | Safe only because RLS is correct. Treated as a public identifier, not a secret. |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server only, never in a bundle | See below.                                                                      |
| `ANTHROPIC_API_KEY`             | Server only                    | Never reachable from a client component.                                        |

Three layers keep the service-role key out of the browser:

1. It has no `NEXT_PUBLIC_` prefix, so Next.js will not inline it.
2. `lib/supabase/admin.ts` begins with a server-only guard that throws if it is
   imported into a client bundle.
3. A CI step greps the built client chunks for the key's value and for the string
   `service_role`, and fails the build on a hit.

The third layer exists because the first two are conventions and the consequence of
getting this wrong is total database compromise.

No secret is committed. `.env.local` is git-ignored; `.env.example` holds names with
empty values. Secret scanning runs on the repository.

---

## 4. Row Level Security

RLS is enabled on every table in the same migration that creates it. A CI check
queries `pg_tables` and fails if any table in the public schema has
`rowsecurity = false`. Disabling RLS "temporarily" is a prohibited shortcut (§64).

**Canonical tables** — `people`, `person_names`, `relationships`, `chronologies`,
`person_chronology`, `events`, `event_chronology`, `scripture_references`,
`scripture_attachments`, `sources`, `source_claims`, `eras`:

```sql
-- Anyone may read VERIFIED records.
CREATE POLICY "public read verified" ON person_chronology
  FOR SELECT USING (review_status = 'VERIFIED');

-- Editors and admins may read everything, including drafts.
CREATE POLICY "staff read all" ON person_chronology
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('editor','admin'))
  );

-- No INSERT, UPDATE or DELETE policy exists for any role.
```

That last line is the important one. Canonical writes never happen through the
anon or authenticated client, in any phase. Phase 2 seeds through the service-role key
in a script. The Phase 14 CMS writes through server actions that check the caller's
role in the database and then use the service-role client. There is no policy for a
client to exploit because there is no client write path at all.

Since Phase 14 this is tested rather than stated: `tests/db/governance.test.ts` tries
an insert, an update and a delete against five canonical tables from three roles —
anonymous, a signed-in reader, and an administrator — and every one of the forty-five
attempts is refused. The administrator is in that list deliberately, because the claim
is not "admins only": it is that no client role can write a canonical table at all.

**User tables** — `favorites`, `saved_comparisons`, `quiz_attempts`,
`user_achievements`, `profiles`:

```sql
CREATE POLICY "owner reads own" ON favorites
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner writes own" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner updates own" ON favorites
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner deletes own" ON favorites
  FOR DELETE USING (auth.uid() = user_id);
```

`profiles.role` has no user-writable policy — a user may update their display name and
preferences, not their role. The update policy excludes the column explicitly rather
than relying on the application not to send it.

**`audit_logs`**: insert-only by the service role, readable by admins. No UPDATE or
DELETE policy exists for any role, so the log cannot be rewritten from the application
even by an admin.

**Content tables** — `discoveries`, `quiz_questions`, `learning_paths`,
`learning_path_steps`, `achievements`: public read, service-role write.

RLS policies are tested, not assumed. Phase 13's gate includes a suite that
authenticates as two separate users and asserts each cannot read, update, or delete the
other's rows across every user table, and that an authenticated non-admin cannot write
to any canonical table.

---

## 5. Data governance authorization

The DRAFT → SOURCE_CHECKED → VERIFIED workflow is a security control, since VERIFIED
is what the public reads.

- Only `admin` may transition a record to VERIFIED. Enforced server-side by a role
  check against `profiles`, plus a database trigger that rejects the transition when
  the acting role is not admin — so a bug in the application layer is not sufficient
  to promote a record.
- Promoting to VERIFIED requires `verifiedBy`, `verifiedAt`, and a source reference.
  A trigger rejects the write otherwise.
- Editing an already-VERIFIED record requires a reason and source information, writes
  an audit row with before and after, and returns the record to SOURCE_CHECKED rather
  than silently keeping its VERIFIED status.
- Every canonical mutation writes to `audit_logs` in the same transaction. A write that
  cannot be audited does not happen.

---

## 6. Input validation and abuse

- Every route handler and server action validates its input with the Zod schema from
  `lib/domain/schemas.ts` before anything else. No handler reads a raw request body.
- Path parameters are validated against known identifiers. A person slug that does not
  exist returns a 404, not a database error.
- Year inputs are bounded integers; the year slider and the manual input share one
  validator so the typed path is not looser than the dragged one.
- Rate limiting on write endpoints, auth endpoints, share-card generation, and any AI
  endpoint, keyed by user id where authenticated and IP otherwise.
- Share-card image generation takes only known entity identifiers, never arbitrary
  text, so the endpoint cannot be used to render attacker-supplied content under the
  product's branding.
- All database access goes through parameterized queries via the Supabase client. No
  string-interpolated SQL anywhere, checked by lint.

---

## 7. Dependencies and supply chain

- `npm audit` in CI; high and critical severities fail the build.
- Dependabot on npm and GitHub Actions.
- Lockfile committed; CI installs with `npm ci`.
- Actions pinned to commit SHAs, not floating tags.
- A deliberately small dependency list — the §45 decision to use `d3-scale` rather than
  a timeline framework is a supply-chain decision as much as a rendering one.

---

## 8. AI feature security

AI is optional and secondary (§49), and it is the feature most able to damage the
product's credibility. Its constraints:

- AI never writes to any canonical table. There is no code path from a model response
  to `data/canonical/` or to a chronology row. This is architectural, not a policy.
- AI receives only verified structured context assembled server-side by the services
  layer. It does not query the database itself and it has no tools.
- The system instruction carries the §49 rules: never invent dates, never invent
  relationships, never claim two people met because their lifetimes overlapped,
  distinguish Scripture from calculation, identify uncertainty, use the provided
  references, say so when information is unavailable.
- User input reaching an AI feature is treated as untrusted and is never concatenated
  into the system instruction.
- Responses are rendered as plain text in a visually distinct container labelled as an
  explanation rather than as sourced data, so a reader can always tell which numbers on
  a page came from the dataset and which sentences came from a model.
- AI endpoints are rate-limited and require a session.

---

## 9. Error handling and headers

- Production error responses are generic. Database errors, stack traces, and query
  text never reach a client.
- Server-side errors are logged with a correlation id; the user sees the id and a plain
  message.
- Error boundaries at the route and the visualization level, so a timeline failure does
  not blank the page.
- Content Security Policy with no `unsafe-inline` for scripts, `frame-ancestors 'none'`,
  `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and a restrictive
  `Permissions-Policy`.
- CSP is set in `next.config.ts` with a nonce, and is tested in CI rather than assumed.

---

## 10. Privacy

- Privacy-conscious analytics, no third-party advertising trackers, no cross-site
  identifiers.
- Analytics events (§58) carry entity identifiers and no personal data. A
  `timeline_person_selected` event records which person, never who selected them.
- The product is used by children (§23), so data collection is minimal by default and
  no feature requires a real name.
- Account deletion removes all user rows; the cascade is tested.

---

## 11. Pre-launch checklist (Phase 15)

- [ ] RLS enabled on every table, verified by query
- [ ] RLS isolation suite passing between two real users
- [ ] No canonical write policy exists for anon or authenticated
- [ ] Client bundle grep for service-role key clean
- [ ] Secret scanning clean, no secrets in history
- [ ] `npm audit` clean at high and critical
- [ ] Rate limits configured and verified on write, auth, share and AI endpoints
- [ ] CSP and security headers present, verified by test
- [ ] Error responses generic in production
- [ ] Audit logging verified on every canonical mutation path
- [ ] VERIFIED transition blocked for non-admins, verified by test
- [ ] Account deletion cascade verified
- [ ] AI system instruction reviewed against §49 and injection-tested
