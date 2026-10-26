import Link from "next/link";
import { saveLabel } from "@/app/actions";
import { LabelKeys } from "@/components/LabelKeys";
import { DEFAULT_LABEL_TARGET, getLabelQueue } from "@/lib/queries";

/*
 * Blind labeling for the eval: the model's score is never shown here, so it
 * can't anchor my judgment.
 */

const CHOICES = [
  { label: "STRONG", key: "s", text: "Strong", hint: "I'd apply" },
  { label: "POSSIBLE", key: "p", text: "Possible", hint: "maybe" },
  { label: "WEAK", key: "w", text: "Weak", hint: "skip" },
] as const;

const DESCRIPTION_PREVIEW = 4000;

export default async function LabelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const target = Math.max(10, Number(params.target) || DEFAULT_LABEL_TARGET);
  const skipped = typeof params.skip === "string" ? params.skip.split(",").filter(Boolean) : [];
  const { next, labeled, size, totalLabels } = await getLabelQueue(target, new Set(skipped));

  if (!next) {
    return (
      <div className="space-y-3 py-12 text-center">
        <p className="text-lg font-medium">
          {labeled} of {size} labeled{skipped.length > 0 && `, ${skipped.length} skipped`}.
        </p>
        <p className="text-stone-500">Run pnpm eval to measure the scorer against your labels.</p>
        <Link href={`/label?target=${target + 10}`} className="inline-block text-sm underline">
          Label 10 more
        </Link>
      </div>
    );
  }

  const description = next.description ?? "No description.";
  const skipHref = `/label?target=${target}&skip=${[...skipped, next.id].join(",")}`;

  return (
    <div className="space-y-5">
      <LabelKeys />
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>
          {labeled} of {size} labeled · {totalLabels} labels total
        </span>
        <span>Keys: S / P / W to label, N to skip</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
        <div
          className="h-full bg-stone-900 dark:bg-stone-100"
          style={{ width: `${(labeled / size) * 100}%` }}
        />
      </div>

      <header>
        <h1 className="text-xl font-semibold">{next.title}</h1>
        <p className="text-stone-600 dark:text-stone-400">
          {[
            next.company.name,
            next.location,
            next.workplaceType !== "UNKNOWN" ? next.workplaceType.toLowerCase() : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <a
          href={next.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Open posting ↗
        </a>
      </header>

      <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-200 bg-white p-4 text-sm leading-relaxed dark:border-stone-800 dark:bg-stone-900">
        {description.slice(0, DESCRIPTION_PREVIEW)}
        {description.length > DESCRIPTION_PREVIEW && "…"}
      </div>

      <form key={next.id} className="space-y-3">
        <textarea
          name="note"
          rows={2}
          placeholder="Note (optional): why?"
          className="w-full rounded-md border border-stone-300 bg-white p-2 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
        <div className="flex flex-wrap gap-2">
          {CHOICES.map((c) => (
            <button
              key={c.label}
              type="submit"
              data-key={c.key}
              formAction={saveLabel.bind(null, next.id, c.label)}
              className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              {c.text}{" "}
              <span className="text-stone-500">
                ({c.key.toUpperCase()}, {c.hint})
              </span>
            </button>
          ))}
          <Link
            href={skipHref}
            data-key="n"
            className="rounded-md px-4 py-2 text-sm text-stone-500 hover:underline"
          >
            Not sure, skip (N)
          </Link>
        </div>
      </form>
    </div>
  );
}
