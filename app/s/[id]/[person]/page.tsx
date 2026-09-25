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
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">
          {personName(person)}, your form is in
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          It is locked now. Your answers stay private &mdash; they are not shown back
          here or anywhere else.
        </p>
        <Link href={`/s/${id}`} className="font-medium underline underline-offset-4">
          Back to the search
        </Link>
      </main>
    )
  }

  return <ResponseForm searchId={id} person={person} />
}
