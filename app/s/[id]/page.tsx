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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
      {/* Stops polling once all three are in -- there is nothing left to wait for. */}
      <AutoRefresh stop={done === total} />
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Your flat search</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Share this link with the other two. Each of you fills it in separately.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <code className="min-w-0 flex-1 truncate text-sm">/s/{id}</code>
        <CopyLink url={shareUrl} label={`/s/${id}`} />
      </div>

      <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
        <p className="text-xl font-medium">
          {done} of {total} in.{' '}
          {done < total ? (
            <span className="text-gray-600 dark:text-gray-400">
              {waitingLine(status.waitingFor)}
            </span>
          ) : (
            <span className="text-gray-600 dark:text-gray-400">All three are in.</span>
          )}
        </p>

        <ul className="mt-4 space-y-2">
          {PEOPLE.map((person) => {
            const submitted = status.submitted.includes(person)
            return (
              <li key={person} className="flex items-center justify-between text-sm">
                <span>{personName(person)}</span>
                {submitted ? (
                  <span className="text-gray-500">Submitted</span>
                ) : (
                  <Link
                    href={`/s/${id}/${person}`}
                    className="font-medium underline underline-offset-4"
                  >
                    Fill in my form
                  </Link>
                )}
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-xs text-gray-500">
          Names only. This page never shows what anyone answered.
        </p>
      </div>

      {done === total &&
        (listings.length === 0 ? (
          <div className="rounded-xl border border-gray-200 p-6 dark:border-gray-800">
            <h2 className="text-lg font-medium">No flats to filter yet</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Add the demo flats and the shortlist appears here. These are stand-ins
              with the same shape as scraped NoBroker listings.
            </p>
            <form action={loadDemoListingsAction} className="mt-4">
              <input type="hidden" name="searchId" value={id} />
              <button
                type="submit"
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-gray-900"
              >
                Load the demo flats
              </button>
            </form>
          </div>
        ) : (
          <Results result={buildShortlist(responses, listings)} />
        ))}
    </main>
  )
}
