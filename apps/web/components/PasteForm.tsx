"use client";

import Link from "next/link";
import { useActionState } from "react";
import { addPastedJob, type PasteState } from "@/app/actions";

const inputClass =
  "w-full rounded-md border border-stone-300 bg-white p-2 text-sm dark:border-stone-700 dark:bg-stone-950";

function Field({
  name,
  label,
  hint,
  required = false,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | undefined;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {hint && <span className="font-normal text-stone-500"> · {hint}</span>}
      </span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={inputClass}
      />
    </label>
  );
}

export function PasteForm({ defaultQuestions }: { defaultQuestions: string[] }) {
  const [state, action, pending] = useActionState<PasteState, FormData>(addPastedJob, {});
  const values = state.values;
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="company" label="Company" required defaultValue={values?.company} />
        <Field name="title" label="Job title" required defaultValue={values?.title} />
        <Field
          name="location"
          label="Location"
          hint="optional"
          placeholder="New York, NY or Remote"
          defaultValue={values?.location}
        />
        <Field
          name="url"
          label="Link to the posting"
          hint="optional"
          placeholder="https://…"
          defaultValue={values?.url}
        />
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Job description</span>
        <textarea
          name="description"
          required
          minLength={200}
          rows={14}
          defaultValue={values?.description}
          placeholder="Paste the whole posting: responsibilities, requirements, and anything about the company."
          className={inputClass}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">
          Questions from the application form, one per line
        </span>
        <textarea
          name="questions"
          rows={Math.min(8, Math.max(3, defaultQuestions.length + 1))}
          defaultValue={values?.questions ?? defaultQuestions.join("\n")}
          className={inputClass}
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
        >
          {pending ? "Scoring and drafting…" : "Score and draft"}
        </button>
        {pending && (
          <span className="text-xs text-stone-500">
            Usually under a minute. You&apos;ll land on the job page when it&apos;s done.
          </span>
        )}
        {state.error && (
          <span role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.error}{" "}
            {state.jobId && (
              <Link href={`/jobs/${state.jobId}`} className="underline">
                Open the job
              </Link>
            )}
          </span>
        )}
      </div>
    </form>
  );
}
