import Link from 'next/link'
import { notFound } from 'next/navigation'

import { isPerson, personName } from '@/lib/constraints'
import { hasSubmitted, searchExists } from '@/lib/db'

import { ResponseForm } from './form'

export const dynamic = 'force-dynamic'

export default async function PersonFormPage({
  params,
}: {
  params: Promise<{ id: string; person: string }>
}) {
  const { id, person } = await params
  if (!isPerson(person)) notFound()
  if (!(await searchExists(id))) notFound()

  // A submitted form is locked. Note what is *not* here: no attempt to load the
  // answers back. Nothing in this app reads a stored answer, so no page can
  // show one -- not even to the person who wrote it.
  if (await hasSubmitted(id, person)) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
        <div className="card p-8 sm:p-12">
        <p className="field-label">All done</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          {personName(person)}, your form is in
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">
          It is locked now. Your answers stay private &mdash; they are not shown back
          here or anywhere else.
        </p>
        <Link href={`/s/${id}`} className="btn-primary mt-8 inline-block">
          Back to the search
        </Link>
        </div>
      </main>
    )
  }

  return <ResponseForm searchId={id} person={person} />
}
