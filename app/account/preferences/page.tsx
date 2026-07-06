import AccountBackLink from "@/components/AccountBackLink";

export default function PreferencesSectionPage() {
  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink />
      <h1 className="font-display text-xl font-light mb-1">Preferences</h1>
      <p className="text-sm text-ink-light mt-3">
        Food preferences and restrictions (like allergies or cuisines to
        avoid) are coming soon.
      </p>
    </div>
  );
}
