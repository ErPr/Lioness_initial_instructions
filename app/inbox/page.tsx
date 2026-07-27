import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getInboxItems } from "@/lib/inboxQuery";
import { getTreeDump } from "@/lib/treeDump";
import InboxList from "@/components/inbox/InboxList";
import TestShareForm from "@/components/inbox/TestShareForm";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/inbox");

  const [items, dump] = await Promise.all([getInboxItems(user.id), getTreeDump()]);
  const boards = dump.map((b) => ({
    boardId: b.boardId,
    name: b.name,
    nodes: b.nodes.map((n) => ({ id: n.id, title: n.title, tier: n.tier })),
  }));
  const active = items.filter(
    (i) => i.status === "pending" || i.status === "enriched" || i.status === "routed"
  ).length;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Your inbox</h1>
        <p className="text-sm text-muted">
          Everything you&apos;ve shared to Lioness, private until you place it on
          a movement&apos;s tree.{" "}
          {active > 0 && <span className="text-accent">{active} to route.</span>}
        </p>
      </div>

      <TestShareForm />

      <InboxList items={items} boards={boards} />

      <p className="text-center text-[11px] text-muted">
        On your phone, install Lioness (Add to Home Screen) and share links or
        screenshots straight to it. <Link href="/" className="underline">Home</Link>
      </p>
    </div>
  );
}
