export default function Loading() {
  return (
    <div className="max-w-md mx-auto py-8 px-4 flex flex-col items-center gap-4 text-center">
      <div className="w-8 h-8 border-2 border-border border-t-teal rounded-full animate-spin" />
      <div>
        <h1 className="font-display text-xl font-light">Preparing your cart…</h1>
        <p className="text-sm text-ink-light mt-1">
          Matching your list against real store products.
        </p>
      </div>
    </div>
  );
}
