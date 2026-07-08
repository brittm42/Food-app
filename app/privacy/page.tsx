export default function PrivacyPage() {
  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <h1 className="font-display text-xl font-light mb-6">Privacy Notice</h1>

      <p className="text-sm text-ink-light mb-4">
        WeeklyNom is a personal meal-planning app built for a single household.
        It isn&apos;t a commercial product, and the data described below is
        never sold or used for advertising.
      </p>

      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2 mt-6">
        What we collect
      </h2>
      <p className="text-sm text-ink-light mb-4">
        Your email address (for sign-in and to identify you to other members
        of your household), and whatever recipes, ratings, shopping list
        items, pantry state, and food preferences/allergies you or your
        household choose to enter into the app.
      </p>

      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2 mt-6">
        Third-party services
      </h2>
      <p className="text-sm text-ink-light mb-2">
        WeeklyNom is built on a small number of third-party services, each
        used only for its stated purpose:
      </p>
      <ul className="text-sm text-ink-light mb-4 list-disc pl-5 space-y-1">
        <li>Supabase — database hosting and sign-in.</li>
        <li>Anthropic (Claude) — drafts recipes from text you provide.</li>
        <li>Resend — sends household invite emails.</li>
        <li>
          Login with Amazon / Alexa — only if you choose to link your Amazon
          account for the voice shopping-list feature. This shares your
          Amazon account&apos;s name and email with WeeklyNom, used solely to
          match your voice request to the correct household&apos;s shopping
          list. It is never shared with anyone else.
        </li>
      </ul>

      <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2 mt-6">
        Questions
      </h2>
      <p className="text-sm text-ink-light">
        Contact brittany.madruga@gmail.com.
      </p>
    </div>
  );
}
