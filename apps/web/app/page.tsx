import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const jobs = await db.job.count();
  return <p className="p-8 text-lg">{jobs} jobs in the database</p>;
}
