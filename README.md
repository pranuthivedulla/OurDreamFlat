# FlatSearch

Three friends, one shared flat in Pune. Each person enters her constraints
privately; the app filters listings against all three sets and shortlists up to
five flats, showing what the group gets and gives up on each.

The app never picks the flat. The three of them decide together.

**Live:** https://our-dream-flat.vercel.app

See `CLAUDE.md` for the full design, the rules that must not be broken, and
where the build deliberately diverges from the original brief in
`docs/components-map.png`.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev
```

Run `supabase/schema.sql` once in the Supabase SQL editor first. It begins with
`drop table`, so only run it while the data is disposable.

## Checks that need no network, database or credits

```bash
npx tsx scripts/check-filter.ts    # filter engine, determinism, the shortfall path
npx tsx scripts/check-mapping.ts   # how demo listings map into the listings table
```

## Stack

Next.js 16 (App Router) on Vercel · Supabase (Postgres, RLS on with no policies,
all access through server code) · demo listings shaped like the Apify NoBroker
actor's output. No AI in the shortlist: the filter engine is plain deterministic
code.
