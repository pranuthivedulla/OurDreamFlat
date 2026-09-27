import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { fetchLiveListingsAction, loadDemoListingsAction } from '@/app/actions'
import { AutoRefresh } from '@/app/components/auto-refresh'
import { LiveSearchButton } from '@/app/components/live-search-button'
import { CopyLink } from '@/app/components/copy-link'
import { Results } from '@/app/components/results'
import { PEOPLE, personName } from '@/lib/constraints'
import { getListings, getResponses, getStatus, pollLiveFetch } from '@/lib/db'
import { buildShortlist } from '@/lib/filter'

export const dynamic = 'force-dynamic'

function waitingLine(waitingFor: string[]): string {
  const names = waitingFor.map((p) => personName(p as never))
  if (names.length === 1) return `Waiting for ${names[0]}.`
  if (names.length === 2) return `Waiting for ${names[0]} and ${names[1]}.`
  return `Waiting for ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ livefetch?: string }>
}) {
  const { id } = await params
  const { livefetch } = await searchParams
  const status = await getStatus(id)
  if (!status) notFound()

  // Absolute URL from the request itself, so it is right on localhost and on
  // Vercel with no configured base URL and no client-side window access.
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const shareUrl = `${proto}://${h.get('host')}/s/${id}`

  // Answers are read only once all three are in, and only to compute the
  // shortlist. Before that the page holds names and nothing else.
  const everyoneIn = status.submitted.length === PEOPLE.length
  // While a scrape is outstanding this checks it and ingests the results once
  // it finishes. Reading a run costs nothing; only starting one spends credits.
  const fetchState = everyoneIn ? await pollLiveFetch(id) : ({ state: 'idle' } as const)

  const [responses, listings] = everyoneIn
    ? await Promise.all([getResponses(id), getListings(id)])
    : [[], []]

  const done = status.submitted.length
  const total = PEOPLE.length

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      {/* Stops polling once all three are in -- there is nothing left to wait for. */}
      <AutoRefresh stop={done === total && fetchState.state !== 'running'} />

      <div className="card p-6 sm:p-10">
        <p className="field-label">Your flat search</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {done} of {total} in
        </h1>
        <p className="mt-2 text-lg leading-relaxed text-ink-soft">
          {done < total ? waitingLine(status.waitingFor) : 'All three are in.'}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-field p-3">
          <code className="min-w-0 flex-1 truncate px-2 text-sm text-ink-soft">{shareUrl}</code>
          <CopyLink url={shareUrl} label={`/s/${id}`} />
        </div>

        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {PEOPLE.map((person) => {
            const submitted = status.submitted.includes(person)
            return (
              <li key={person} className="flex items-center justify-between gap-3 p-4">
                <span className="font-semibold">{personName(person)}</span>
                {submitted ? (
                  <span className="rounded-full bg-[color:var(--positive)]/10 px-3 py-1 text-xs font-bold text-positive">
                    Submitted
                  </span>
                ) : (
                  <Link href={`/s/${id}/${person}`} className="btn-primary px-5 py-2 text-sm">
                    Fill in my form
                  </Link>
                )}
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-sm text-ink-faint">
          Names only. This page never shows what anyone answered.
        </p>
      </div>

      {done === total && (
        <div className="card mt-6 p-6 sm:p-10">
          {livefetch === 'failed' && (
            <p className="mb-6 rounded-2xl bg-warn-bg p-4 text-sm font-medium text-warn-ink">
              The live search could not be started, so nothing was charged. The flats
              below are unchanged. A demo run always works.
            </p>
          )}
          {fetchState.state === 'running' ? (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight">Fetching flats…</h2>
              <p className="mt-2 text-ink-soft">
                Pulling live rentals in Pune. This takes a minute or two; the page
                checks by itself and the shortlist appears when they land.
              </p>
            </>
          ) : listings.length === 0 ? (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight">No flats to filter yet</h2>
              {fetchState.state === 'failed' && (
                <p className="mt-3 rounded-2xl bg-warn-bg p-4 text-sm font-medium text-warn-ink">
                  That didn&rsquo;t work &mdash; {fetchState.why}. Try again, or use the
                  demo flats.
                </p>
              )}
              <p className="mt-2 text-ink-soft">
                Search MagicBricks for live Pune rentals, or do a demo run on
                built-in flats that have the same shape as scraped listings.
              </p>
              <SourceChoice id={id} fetchState={fetchState} />
            </>
          ) : (
            <>
              <Results result={buildShortlist(responses, listings)} />
              {/* Repeated here so a search that already has flats can be run
                  again -- otherwise the only way to switch from demo to live
                  is to start a whole new search. */}
              <div className="mt-8 border-t border-line pt-6">
                <h3 className="font-extrabold tracking-tight">Look again</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  Replace these flats with a fresh set. Your three forms stay as they are.
                </p>
                <SourceChoice id={id} fetchState={fetchState} />
              </div>
            </>
          )}
        </div>
      )}
    </main>
  )
}

/** The two ways to fill a search with flats. Shown when it is empty, and again under the results. */
function SourceChoice({
  id,
  fetchState,
}: {
  id: string
  fetchState: { state: string }
}) {
  const liveOff = fetchState.state === 'unavailable'
  return (
    <>
      <div className="mt-5 flex flex-wrap items-start gap-3">
        {!liveOff && <LiveSearchButton action={fetchLiveListingsAction} searchId={id} />}
        <form action={loadDemoListingsAction}>
          <input type="hidden" name="searchId" value={id} />
          <button
            type="submit"
            className={
              liveOff
                ? 'btn-primary'
                : 'rounded-full border border-line bg-field px-6 py-3.5 text-sm font-bold text-ink-soft transition hover:border-ink-faint hover:text-ink'
            }
          >
            Demo test run
          </button>
        </form>
      </div>
      <p className="mt-3 text-xs text-ink-faint">
        {liveOff
          ? 'Searching the internet is switched off until migration 003 has been run on the database.'
          : 'Searching the internet pulls 15 live Pune rentals and charges about 4–5 US cents of Apify credit each time. The demo test run uses 12 built-in flats and costs nothing.'}
      </p>
    </>
  )
}
