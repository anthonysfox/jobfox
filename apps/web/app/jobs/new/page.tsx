import Link from "next/link";
import { PasteForm } from "@/components/PasteForm";
import { config } from "@/lib/queries";

export default function PasteJobPage() {
  return (
    <div className="space-y-6">
      <Link href="/jobs" className="text-sm text-stone-500 hover:underline">
        ← All jobs
      </Link>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Paste a job</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          For a posting jobfox didn&apos;t find. It&apos;s scored and drafted like any other job:
          fit, tailored summary and bullets, answers, a message, and the resume PDF. It stays in
          your list whatever the filters say.
        </p>
      </header>
      <PasteForm defaultQuestions={config.drafting.defaultQuestions} />
    </div>
  );
}
