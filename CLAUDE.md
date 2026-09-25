# FlatSearch: CLAUDE.md

## What we're building
A web app for three friends (Riya, Meera, Kavita) looking for a shared flat in Pune. Each person privately enters her constraints. The app filters listings against all three sets of constraints and shows up to 3 flats, each with a clear breakdown of what every person gets and gives up.

**The app never picks the flat.** It shortlists. The three of them decide together (the Human Gate).

Riya's ask: *"One form, three people fill it in separately, and we come out the other side with two or three flats we can actually discuss, with a clear view of what each of us gets and what each of us is giving up."*

The components map is in `docs/components-map.png`. Follow it. It and this file agree; if you find a place where they don't, stop and say so rather than picking one.

## Stack
- **Frontend + backend:** Next.js (App Router), deployed on Vercel
- **Database:** Supabase (Postgres)
- **AI:** Gemini Flash, used ONLY to write the per-person breakdown text
- **Listings:** paste-in form for the MVP. The Apify NoBroker scraper comes later (stretch goal).
- **Commute:** a lookup table checked into the repo. No Maps API, no third-party key. See "Commute without a Maps API" below.
- **Version control:** GitHub. Push at the end of every session.

## The flow (matches the components map)
1. **Trigger:** Riya opens the app and clicks "New search". The app creates a `search` row and shows a shareable link: `/s/[searchId]`. Riya pastes it into WhatsApp herself (manual, not automated).
2. **Input:** each flatmate opens the link, picks her name (Riya / Meera / Kavita) and fills in her form privately.
3. **Context:** Supabase stores the forms. Nobody can see anyone else's answers. Filtering unlocks only when all 3 forms are submitted. Listings are added via the paste-in form.
4. **Processing (code, not AI):** the filter engine applies hard rules and ranks the survivors.
5. **AI:** Gemini Flash turns the computed facts for each shortlisted flat into a short per-person breakdown.
6. **Output:** the same link becomes the results page. It shows the status before all 3 are in, and the shortlist after.
7. **Human Gate:** the three discuss and decide. The app shows no "winner".

**The form lives in this app, not in Google Forms.** A Google Form puts every response in a sheet owned by whoever made it — Riya would be able to read Meera's and Kavita's answers. That is the exact dynamic the tool exists to remove.

## The form (per person)
- `rent_cap`: max monthly rent she will pay (₹)
- `no_go_areas`: areas she won't consider (multi-select from `data/pune-areas.json` + free text)
- `must_be_near`: **maximum 2** places, each `{ label, area, max_mins }` — e.g. `{ "office", "Hinjewadi", 45 }`. `area` is picked from the same canonical area list. Each place is marked either a dealbreaker or a nice-to-have.
- `dealbreakers`: **maximum 3**, chosen from a fixed list (enforce in the UI AND on the server):
  - Lift required
  - Parking required
  - Minimum bathrooms (number)
  - Pet-friendly required
  - Maximum floor (number)
  - Must be near a place I named (one entry from `must_be_near`)
- `nice_to_haves`: any number, from the same list plus extras (balcony, furnished, gym in building, etc.), including `must_be_near` places not spent on a dealbreaker slot
- **Do NOT ask for reasons.** We store constraints, never why (e.g. "needs a lift", never a medical reason).

The max-3 cap still holds now that commute is on the list, and that is deliberate: it forces a real choice between "lift required" and "within 45 minutes of Hinjewadi" instead of letting anyone hold six absolutes. Forcing that prioritisation is the point of the tool.

## Commute without a Maps API
Two of the three failures in the scenario are distance failures, so commute is a first-class constraint. It is computed locally.

- `data/pune-areas.json` — ~18 areas people actually flat-hunt in, each with an approximate lat/long. This is the **single source of truth** for the no-go multi-select, the `must_be_near` area picker, and `listing.area`. No-go matching and commute lookup must agree on spelling or both fail silently.
- `data/commute-overrides.json` — a short list of area pairs where the real trip is much worse than the straight line suggests (anything into Hinjewadi at peak, anything crossing the centre).
- `commuteMinutes(fromArea, toArea)` — straight-line distance from the coordinates × a road-detour factor × an average city speed, then the override file applied on top. **This is the only function that knows how a commute is computed.** A real routing API can replace its body later without touching anything else.

Rules:
- It is an **estimate**, and the UI says so. Never present it as a routing result.
- Unknown area, or a pair the table can't resolve → `⚠️ Confirm before visiting: commute not estimated`. Kept and flagged, never a silent pass. Same rule as a null lift.
- It must be deterministic. The same three forms and the same listings must always produce the same shortlist.

Rejected, on purpose: Google Maps Platform requires a billing account with a card on file before it will issue a working key, traffic-aware route matrix calls sit on the pricier tier, and a live external call in the request path is a liability on a graded demo URL. It buys nothing here, because listings carry an `area` and not an address — so a Maps call would return area-centroid to area-centroid numbers, which is what the table already gives.

## Filter rules (Processing: plain code, deterministic, NO AI)
1. **Rent:** `max_rent = 3 × min(rent_cap of all three)`. Drop any listing with rent above it.
2. **Areas:** drop a listing if its area is in ANYONE's no-go list.
3. **Dealbreakers:** drop a listing if it breaks ANY person's dealbreaker.
   - A `must_be_near` place marked as a dealbreaker breaks when `commuteMinutes(listing.area, place.area) > place.max_mins`.
   - If a listing field is **unknown (null)**, do NOT drop it and do NOT treat it as a pass. Keep it and flag it: "⚠️ Confirm before visiting: lift not stated".
4. **Ranking:** rank survivors by nice-to-haves met. Prefer balanced options: sort by the *lowest* per-person score first, then by the total, so no one person always loses. A `must_be_near` place marked nice-to-have counts as a miss when it's over its threshold.
5. Keep the top 3.
6. **If fewer than 3 pass:** show which dealbreaker or constraint blocked the most listings, and how many more listings would qualify if it were relaxed. Do not show an empty screen.

## AI step (Gemini Flash)
- Input: a structured JSON of facts the filter already computed (per listing, per person: dealbreakers met, nice-to-haves met/missed, commute minutes, flags).
- Output: 2–3 plain sentences per person: what she gets and what she gives up.
- Gemini must NOT add facts that aren't in the JSON, must NOT rank or recommend a flat, and never mentions reasons.
- **Fallback:** if the Gemini call fails, show a template-generated breakdown from the same JSON. Build and test the template path first; the AI path is a layer on top of something that already works.

## Results page
- Before all 3 have submitted: "2 of 3 in. Waiting for Kavita." Show names only, never answers.
- After: 3 flats **side by side as equals**, not a numbered ranking. Each has a per-person breakdown, commute minutes per person, and any "confirm before visiting" flags.
- Once all 3 have submitted, forms are locked. Editing a form reopens the search and marks results as out of date.

## Data model (suggested; confirm in the plan)
- `searches`: id, created_at, status (collecting / ready)
- `responses`: id, search_id, person (riya/meera/kavita), rent_cap, no_go_areas, must_be_near (max 2), dealbreakers (max 3), nice_to_haves, submitted_at
- `listings`: id, search_id, source (paste/apify), url, rent, area, floor, has_lift, parking, bathrooms, pet_friendly, extras, added_at. Unknown fields stay NULL.
- `results`: search_id, listing_id, passed, blocked_by, scores, commute_mins, ai_summary

## Security: non-negotiable
- All API keys (Supabase service key, Gemini, later Apify) go in `.env.local` locally and in Vercel environment variables. Never in frontend code, never in a prompt, never in a commit.
- `.env*` must be in `.gitignore` **before the first commit**, not before the first push.
- Turn on Supabase **Row Level Security**. Read and write responses only through server routes, so no one can read other people's answers from the browser.
- If a key ever leaks: rotate it immediately.

## Build order
1. **Phase 1:** Next.js app + Supabase + "New search" + shareable link + the private form + "2 of 3 in" status. Push to GitHub, **and deploy it to Vercel straight away even though it does almost nothing yet.** A TypeScript error fails `next build`, so the first deploy is the one most likely to break — do it while there is time, not on Saturday night. Every later phase then ships to a URL that already works.
2. **Phase 2:** `data/` files + `commuteMinutes()` + paste-in listing form + filter engine + results page (template text, no AI yet). Include the "fewer than 3 passed" view.
3. **Phase 3:** Gemini Flash breakdowns with template fallback, tested by forcing a failure.
4. **Phase 4:** final deploy (the Vercel project already exists from Phase 1). Test end-to-end on the live URL with 3 fake people and about 10 fake listings, including one with no lift, one with unknown fields, and one blocked only by a commute threshold.
5. **Stretch (only if time):** Apify NoBroker scraper as a listing source; a real routing API swapped in behind `commuteMinutes()`; a Telegram "shortlist ready" message.

Phase 2 is the core. It is the only part that answers Riya's actual ask and the only part with no external dependency — no Supabase outage, Gemini quota or Vercel build failure can stop it. If time gets tight, Phase 3 degrades to the template fallback and almost nothing is lost.

## Deliberately NOT building
- Auto-posting to WhatsApp (manual paste is fine for 3 people)
- Picking or recommending a single flat
- Accounts/login (shared link + name picker is enough among close friends)
- Any live Maps or routing API (see "Commute without a Maps API")

## Working rules for Claude Code
- Plan before code. Show the plan and wait for approval.
- Keep it simple: this is for 3 people, not a startup.
- After each phase: tell me what to test, then push to GitHub.
- If something in this file turns out to be wrong or unbuildable, say so directly instead of building around it.
