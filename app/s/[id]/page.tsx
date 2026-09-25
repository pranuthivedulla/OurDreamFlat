import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { loadDemoListingsAction } from '@/app/actions'
import { AutoRefresh } from '@/app/components/auto-refresh'
import { CopyLink } from '@/app/components/copy-link'
import { Results } from '@/app/components/results'
import { PEOPLE, personName } from '@/lib/constraints'
import { getListings, getResponses, getStatus } from '@/lib/db'
import { buildShortlist } from '@/lib/filter'

export const dynamic = 'force-dynamic'

function waitingLine(waitingFor: string[]): string {
  const names = waitingFor.map((p) => personName(p as never))
  if (names.length === 1) return `Waiting for ${names[0]}.`
  if (names.length === 2) return `Waiting for ${names[0]} and ${names[1]}.`
  return `Waiting for ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`
}

export default async function SearchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
  const [responses, listings] = everyoneIn
    ? await Promise.all([getResponses(id), getListings(id)])
    : [[], []]

  const done = status.submitted.length
  const total = PEOPLE.length

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      {/* Stops polling once all three are in -- there is nothing left to wait for. */}
      <AutoRefresh stop={done === total} />

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
          {listings.length === 0 ? (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight">No flats to filter yet</h2>
              <p className="mt-2 text-ink-soft">
                Add the demo flats and the shortlist appears here. They are stand-ins with
                the same shape as scraped NoBroker listings.
              </p>
              <form action={loadDemoListingsAction} className="mt-6">
                <input type="hidden" name="searchId" value={id} />
                <button type="submit" className="btn-primary">
                  Load the demo flats
                </button>
              </form>
            </>
          ) : (
            <Results result={buildShortlist(responses, listings)} />
          )}
        </div>
      )}
    </main>
  )
}
