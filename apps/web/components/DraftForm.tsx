"use client";

import { useActionState } from "react";
import { generateDraft, type DraftState } from "@/app/actions";

export function DraftForm({
  jobId,
  questions,
  hasDraft,
}: {
  jobId: string;
  questions: string[];
  hasDraft: boolean;
}) {
  const [state, action, pending] = useActionState<DraftState, FormData>(
    generateDraft.bind(null, jobId),
    {},
  );
  return (
    <form action={action} className="space-y-2">
      <label htmlFor="questions" className="block text-sm font-medium">
        Questions from the application form, one per line
      </label>
      <textarea
        id="questions"
        name="questions"
        rows={Math.min(8, Math.max(3, questions.length + 1))}
        defaultValue={questions.join("\n")}
        className="w-full rounded-md border border-stone-300 bg-white p-2 text-sm dark:border-stone-700 dark:bg-stone-950"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-stone-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
        >
          {pending ? "Drafting…" : hasDraft ? "Redraft" : "Draft bullets and answers"}
        </button>
        {pending && <span className="text-xs text-stone-500">Usually 10 to 30 seconds.</span>}
        {state.error && (
          <span role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.error}
          </span>
        )}
      </div>
    </form>
  );
}
