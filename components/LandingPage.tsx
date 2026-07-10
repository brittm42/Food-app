import Link from "next/link";

const FEATURES = [
  {
    icon: "🗓️",
    bg: "bg-teal-light",
    title: "Plan your week",
    body: 'Queue recipes into a "This Week" list so dinner stops being a daily decision.',
  },
  {
    icon: "🛒",
    bg: "bg-coral-light",
    title: "Pantry-aware shopping",
    body: "Your shopping list nets out what you already have on hand — no duplicate salt, ever.",
  },
  {
    icon: "👨‍👩‍👧‍👦",
    bg: "bg-plum-light",
    title: "Built for the whole household",
    body: "Shared accounts, kid profiles, and kid-friendly filters — everyone eats off the same plan.",
  },
  {
    icon: "✨",
    bg: "bg-gold-light",
    title: "AI that helps you cook",
    body: "Turn a link, a photo, or a rough idea into a full recipe, ready to add to your week.",
  },
];

export default function LandingPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center py-6">
        <p className="text-ink-mid text-[15px] max-w-md mx-auto mb-6 leading-relaxed">
          WeeklyNom is a smarter system for the whole planning process — recipes,
          weekly menus, pantry, and shopping — organized so eating well stops
          taking extra effort.
        </p>
        <div className="flex gap-3 justify-center items-center flex-wrap">
          <Link
            href="/login"
            className="bg-teal text-white rounded-lg px-7 py-3 text-[15px] font-medium hover:opacity-90"
          >
            Get started free
          </Link>
          <a
            href="#features"
            className="text-ink-mid text-sm font-medium underline underline-offset-4 hover:text-ink"
          >
            See how it works
          </a>
        </div>
      </div>

      <div id="features" className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-10">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="bg-surface border border-border rounded-2xl p-6"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4 ${f.bg}`}
            >
              {f.icon}
            </div>
            <h3 className="text-[17px] font-medium mb-2">{f.title}</h3>
            <p className="text-sm text-ink-mid leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>

      <div className="text-center py-10 border-t border-border">
        <p className="text-ink-mid text-sm mb-5">Ready to plan your first week?</p>
        <Link
          href="/login"
          className="bg-teal text-white rounded-lg px-7 py-3 text-[15px] font-medium hover:opacity-90 inline-block"
        >
          Get started free
        </Link>
      </div>
    </div>
  );
}
