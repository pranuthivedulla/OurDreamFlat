# FlatSearch

Three friends, one shared flat in Pune. Each person enters her constraints
privately; the app filters listings against all three sets and shortlists up to
3 flats, showing what each person gets and gives up.

The app never picks the flat. The three of them decide together.

See `CLAUDE.md` for the full brief and `docs/components-map.png` for the flow.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev
```

## Stack

Next.js (App Router) on Vercel · Supabase (Postgres, RLS on) · Gemini Flash for
the per-person breakdown text only · commute estimated from a lookup table in
`data/`, no Maps API.
