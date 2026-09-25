# FlatSearch: CLAUDE.md

Context for any session picking up this project. Read before changing anything.

**Last updated 25 September 2026, after Phase 1 and Phase 2 were built and
deployed.** This file describes what exists. Where it differs from
`docs/components-map.png`, this file is right and the map is out of date —
see "Where this diverges from the original brief" for what changed and why.

---

## What this is

A web app for three friends (Riya, Meera, Kavita) looking for a shared flat in
Pune. Each person privately enters her constraints. The app filters listings
against all three sets of constraints and shows up to 5 flats, each with a
breakdown of what the group gets and gives up.

**The app never picks the flat.** It shortlists. The three of them decide
together (the Human Gate).

Riya's ask: *"One form, three people fill it in separately, and we come out the
other side with two or three flats we can actually discuss, with a clear view of
what each of us gets and what each of us is giving up."*

Live: **https://our-dream-flat.vercel.app**
Repo: **https://github.com/pranuthivedulla/OurDreamFlat**

This is a graded assessment. The submitted artifact is the working Vercel URL.

## Stack

- **Frontend + backend:** Next.js 16.3.6 (App Router, TypeScript, Tailwind) on Vercel
- **Database:** Supabase (Postgres), RLS on with no policies
- **Listings:** 12 demo flats in `data/demo-listings.json`, written in the exact
  output shape of the Apify NoBroker actor. No live scraping runs yet.
- **AI:** none yet. Gemini Flash for the breakdown prose is Phase 3, unbuilt.
- **Version control:** GitHub. Push at the end of every session.

Next 16 is newer than most training data. `params` is a `Promise`, forms go
through Server Actions, and the bundled docs in `node_modules/next/dist/docs/`
are the reference — read them rather than writing Next 14 idioms from memory.

## The flow as built

1. **Trigger:** Riya opens the app, clicks "New search". A `searches` row is
   created with a short token and she gets `/s/[searchId]`, with **Copy link**
   and a **WhatsApp** button (a plain `wa.me` link with the message pre-typed;
   she still picks the chat and presses send).
2. **Input:** each flatmate opens the link, picks her name, fills her form
   privately at `/s/[searchId]/[person]`.
3. **Context:** Supabase stores the forms. Nobody sees anyone else's answers.
4. **Status:** the same link shows "2 of 3 in. Waiting for Kavita." — names and
   booleans only. It **polls every 5 seconds** so a page left open on one phone
   notices a submission made on another, and stops polling once all three are in.
5. **Listings:** once all three are in, a **Load the demo flats** button seeds
   the 12 demo listings into this search.
6. **Processing:** `lib/filter.ts` applies the hard rules and ranks survivors.
   Plain code, no AI, deterministic.
7. **Output:** the same link becomes the results page — up to 5 flats side by
   side as equals, no numbering, no winner.
8. **Human Gate:** the three discuss and decide.

## The form (per person) — three questions

- **`rent_cap`** — a **slider**, ₹5,000–₹40,000 in ₹1,000 steps, her share not
  the whole flat. The handle sits mid-range until she moves it but the value
  stays empty until then, so an untouched slider fails validation rather than
  submitting a default nobody chose.
- **`preferred_areas`** — "My preferable areas". Five **zone** chips (West / IT
  belt, PCMC, Central, East, South-east) that expand to individual areas. Five
  taps instead of twenty decisions. **These rank flats up and never drop one**,
  so choosing none is fine. People pick the zone their office is in, which makes
  this a rough stand-in for commute.
- **`dealbreakers` / `nice_to_haves`** — one row per parameter with a three-way
  choice: **Dealbreaker / Preferred / Don't care**. Dealbreaker writes to
  `dealbreakers`, Preferred to `nice_to_haves`, Don't care writes nothing.
  - **Max 3 dealbreakers**, shown as a running count; the Dealbreaker button
    disables on every other row once three are spent. Forcing that choice is the
    point of the tool.
  - Only five can ever be dealbreakers: lift, parking, minimum bathrooms,
    pet-friendly, maximum floor. Balcony, furnished, gym, power backup and 24x7
    security are preference-only and render two buttons, not three.
- **Do NOT ask for reasons.** Constraints only, never why.

Every parameter maps to a field a listing actually carries. One that nothing can
be checked against is decoration: it can neither drop a flat nor rank one.

## Filter rules (`lib/filter.ts` — plain code, deterministic, NO AI)

1. **Rent:** `max_rent = 3 × min(rent_cap of all three)`. Drop anything above it.
2. **Dealbreakers:** drop a listing if it breaks ANY person's dealbreaker.
3. **Unknown is not a failure and not a pass.** If a listing field is `NULL`, do
   not drop and do not treat as met — keep it and flag it: "⚠️ Confirm before
   visiting: lift not stated".
4. **Ranking:** per-person score = preferred amenities met + 1 if the flat is in
   an area she picked. Sort by the **lowest per-person score first**, then the
   total, then cheaper rent, then listing id. Lowest-first is what stops two
   people steamrolling the third.
5. Keep the top `SHORTLIST_SIZE` (currently **5**).
6. **If fewer than that pass:** name the single constraint that blocked the most
   and how many would come back if it were relaxed. Never an empty screen.

**Determinism is tested, not assumed.** `scripts/check-filter.ts` runs the
engine over the demo listings with three worked-example forms, runs it again
with the listings reversed, and asserts the shortlist is identical. It also
exercises rule 6 by capping everyone at ₹7,000. No network, no database, no
credits:

```bash
npx tsx scripts/check-filter.ts
npx tsx scripts/check-mapping.ts
```

## Results page

- Before all three are in: "2 of 3 in. Waiting for Kavita." Names only.
- After: up to 5 flats side by side as equals, not a numbered ranking.
- **Trade-offs are shown as counts, never names.** "One of you gives up a
  balcony", not "Meera gives up a balcony". Naming who compromised turns a
  shared decision into a record of who owes whom. See the divergence section.
- Flags ("⚠️ Confirm before visiting: parking not stated") appear per flat.
- Forms lock on submit. There is no edit path: **"New search" is the reset**,
  and it produces three blank forms at a fresh token. Old links keep working.

## Listings

`data/demo-listings.json` holds 12 fake Pune flats written in the **exact output
shape of `thirdwatch/nobroker-scraper`**, so demo and live data map through the
same `mapListing()`. Edge cases are deliberate: one with no lift stated, one
with almost everything missing, one with no coordinates, one 17 km outside every
area centroid, one far over any rent ceiling.

`lib/geo.ts` `matchArea()` resolves a listing to a canonical area by
**coordinates first**, locality name only as a fallback, and `NULL` past a 6 km
ceiling. Coordinates cannot be misspelt; guessing here would break area matching
silently.

`lib/listings-source.ts` `mapListing()` turns actor output into a listings row.
**An amenity list is evidence of what a flat has, never evidence of what it
lacks** — a listing that does not mention a lift maps to `NULL`, never `false`.
Mapping absence to `false` would invent a fact the engine then drops a flat on.

`startApifyRun()` exists and **nothing calls it**. The token is verified
(`GET /users/me` → 200, free plan, $5/mo) but no actor has ever been started and
no credits have been spent. Live scraping is a submission-day switch of source,
not a rewrite.

Apify has maintained actors for all three portals if more sources are ever
wanted: `thirdwatch/nobroker-scraper`, `thirdwatch/acres99-scraper`,
`thirdwatch/magicbricks-scraper`.

**Do not use the Gemini API to scrape listings.** It can fetch URLs
(`url_context`, 20 per request) but it cannot walk a portal's search results,
those pages are JS-rendered and bot-protected, and — fatally — a model asked for
`has_lift` will answer. That fabricates at the point of ingestion, where nothing
downstream can catch it, and it breaks rule 3 and the no-fabrication rule at
once. Gemini's only job here is Phase 3 prose over facts the filter already
computed.

## Data model

- `searches`: id (short text token), created_at, status (collecting / ready)
- `responses`: id, search_id, person, rent_cap, **preferred_areas**,
  no_go_areas (unused, kept), must_be_near (unused, kept), dealbreakers,
  nice_to_haves, submitted_at. Unique on (search_id, person) — that constraint
  is what locks a form, even against a replayed POST.
- `listings`: id, search_id, source, url, rent, area, floor, has_lift, parking,
  bathrooms, pet_friendly, extras, added_at. **Unknown fields stay NULL.**
- `results`: created but unused — the shortlist is computed per request.

`supabase/schema.sql` is the full schema and **starts with `drop table`**. Safe
to re-run only while the data is disposable. Once real answers exist, write a
migration instead — see `supabase/migration-002-preferred-areas.sql` for the
additive pattern.

## Security: non-negotiable, and how it is enforced

- **The browser never receives a Supabase key.** RLS is on for all four tables
  with **no policies**, and grants are revoked from `anon` and `authenticated`,
  so the public key can do nothing. Only the server, holding the secret key,
  reads anything.
- `.env.local` holds `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (a `sb_secret_…` key,
  Settings → API Keys) and `APIFY_TOKEN`. **None are `NEXT_PUBLIC_`** — anything
  with that prefix is inlined into the browser bundle. Same three in Vercel.
- `.env*` was in `.gitignore` in the very first commit, before any key existed.
- **There are no route handlers and no endpoint that returns a stored answer.**
  The status page selects the `person` column only. Verified by fetching the
  page and searching the raw bytes for submitted values — zero matches.
- Caps are enforced twice: `validateResponse()` runs in the client form *and*
  again in the server action, because a Server Action is reachable by direct
  POST. Verified by tampering with the hidden payload to smuggle in 5
  dealbreakers and a fake area; both were refused server-side.

## Rules that must not be broken

**1. Unknown is never a guess.** `NULL` means "not stated". Never map it to
`false`, never let it silently pass. Keep the flat, flag the field. This is the
rule most likely to be quietly broken by a change that looks like a tidy-up.

**2. Never fabricate a figure, a field or a flat.** Anything the engine asserts
must trace to a listing field that was actually populated.

**3. The app never picks.** No winner, no ranking numbers on screen, no
"best match" badge. Five equals, and the three of them decide.

**4. Determinism.** The same three forms and the same listings must always
produce the same shortlist, in the same order. Every tie has an explicit
tiebreak. `scripts/check-filter.ts` asserts this; keep it passing.

**5. No secret reaches the browser.** See the security section. Before shipping
anything that touches data access, `grep -r "SUPABASE" .next/static/` must be
empty.

**6. Grading and validation are yes/no, never a score.** A yes is checkable in
five seconds; a 7/10 is not.

## Where this diverges from the original brief

All of these were decided deliberately on 25 September 2026, with the trade-off
stated at the time. `docs/components-map.png` still shows the original design.

- **No area veto.** The brief's filter rule 2 dropped a flat if its area was in
  anyone's no-go list. Removed: areas are now a positive preference that ranks.
  Cost: nobody can refuse an area outright.
- **No commute constraint.** `must_be_near`, max-minutes thresholds,
  `commuteMinutes()` and `commute-overrides.json` are all gone or unbuilt. The
  brief called commute first-class because two of the three scenario failures
  are distance failures. Preferred zones are a rough stand-in — zones are
  roughly commute-shaped — but with no threshold and no separation between where
  you work and where you want to live. **Rent is now the only shared hard rule.**
  The coordinates in `pune-areas.json` still earn their keep: they are what snap
  a scraped listing to an area.
- **5 flats, not 3.** The brief and Riya's ask both say two or three.
- **Counts, not names, in the results.** The brief and the map both specify a
  per-person breakdown. The trade-off stays visible; the attribution goes.
  Note this is soft cover with three people: someone who knows her own answers
  can deduce a good deal from "one of you gives up a balcony".
- **No edit path.** The brief says editing a form reopens the search and marks
  results out of date. Not built; "New search" is the reset.
- **`data/pune-areas.json` moved to Phase 1**, because the form's area pickers
  read it.

## What was learned by building it

**Tests caught two bugs that reading would not have.** Ties in the shortlist
broke on `listing.id`, which is a demo string in tests and a database uuid in
the app — so the same data ranked differently in the two places. And the
"biggest blocker" count keyed on reason text, which embeds each listing's own
rent, so rent blocks never aggregated: with everyone capped at ₹7,000 it blamed
a bathroom dealbreaker that had stopped one flat instead of the rent ceiling
that had stopped ten. Both were found by running the engine, not by reading it.

**A false positive nearly hid a missing schema.** A `HEAD` select against a
table that does not exist returns no error through supabase-js, so a check
reported "ok" for four tables that had never been created. Only a real `INSERT`
told the truth. Prefer a write, or a query that returns rows, when checking that
something exists.

**Lint output piped through `tail` swallows the exit code**, so `npm run lint |
tail && git commit` commits with lint errors. Check `${PIPESTATUS[0]}`.

**Ranking on the lowest per-person score visibly changes the answer.** In the
worked example Baner is the best flat for Riya and leaves Kavita with almost
nothing; Aundh ranks above it. That is the rule doing its job, and it is worth
keeping when someone proposes "just sort by total score".

## Working rules for Claude Code

- Plan before code. Show the plan and wait for approval.
- Keep it simple: this is for 3 people, not a startup.
- Verify in the browser, not by assertion. Say what was checked and what the
  check returned.
- After each phase: say what to test, then push to GitHub.
- If something here turns out to be wrong or unbuildable, say so directly
  instead of building around it.

## Status

**Built and live:** Phase 1 (app, schema, private forms, status) and Phase 2
(area matching, listing mapper, filter engine, results page), deployed and
tested end to end on the production URL.

**Not built:** Phase 3 (Gemini Flash prose over the template output, with a
template fallback — the template path already works, so this is a layer on top
of something that works). Live Apify runs. Any edit path.
