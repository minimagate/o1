import { ModelTable } from "@/lib/model-table";
import { addModelTags, getLatestModelSnapshot } from "@/lib/model-snapshot";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await getLatestModelSnapshot({ bootstrapIfMissing: true });
  const rows = addModelTags(snapshot.rows);

  return (
    <main className="min-h-screen bg-black text-zinc-300">
      <ModelTable rows={rows} />
    </main>
  );
}
