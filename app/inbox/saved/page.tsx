import Link from "next/link";

// Shown right after a share. If opened in the share-sheet popup it tries to
// close itself; otherwise it links back into the app.
export default function SavedPage() {
  return (
    <div className="mx-auto mt-16 max-w-sm text-center">
      <div className="text-4xl">✓</div>
      <h1 className="mt-3 text-lg font-semibold">Saved to your inbox</h1>
      <p className="mt-1 text-sm text-muted">
        We&apos;re finding where it fits on the tree. Open your inbox to route
        it.
      </p>
      <div className="mt-5 flex justify-center gap-2">
        <Link
          href="/inbox"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Open inbox
        </Link>
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){try{window.close()}catch(e){}},1500)`,
        }}
      />
    </div>
  );
}
