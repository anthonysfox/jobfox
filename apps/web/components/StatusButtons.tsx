import { setStatus } from "@/app/actions";

const BUTTONS = [
  { status: "SAVED", label: "Save" },
  { status: "APPLIED", label: "Applied" },
  { status: "SKIPPED", label: "Skip" },
] as const;

/** Plain forms bound to a server action: they work without client-side JavaScript. */
export function StatusButtons({ jobId, current }: { jobId: string; current: string }) {
  return (
    <div className="flex gap-2">
      {BUTTONS.filter((b) => b.status !== current).map((b) => (
        <form key={b.status} action={setStatus.bind(null, jobId, b.status)}>
          <button
            type="submit"
            className="rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            {b.label}
          </button>
        </form>
      ))}
      {current !== "NEW" && (
        <form action={setStatus.bind(null, jobId, "NEW")}>
          <button
            type="submit"
            className="px-1 py-1 text-xs text-stone-500 underline-offset-2 hover:underline"
          >
            Undo
          </button>
        </form>
      )}
    </div>
  );
}
