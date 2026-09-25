import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CopyLink } from '@/app/components/copy-link'
import { PEOPLE, personName } from '@/lib/constraints'
import { getStatus } from '@/lib/db'

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

  const done = status.submitted.length
  const total = PEOPLE.length

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-6 py-16">
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

      {done === total && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          All three forms are in and locked. The shortlist gets built here next.
        </p>
      )}
    </main>
  )
}
