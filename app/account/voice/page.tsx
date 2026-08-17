import AccountBackLink from "@/components/AccountBackLink";
import VoiceTokenPanel from "@/components/VoiceTokenPanel";
import { getMyVoiceToken } from "@/app/actions/voice-token";

export default async function VoicePage() {
  const token = await getMyVoiceToken();

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink />
      <h1 className="font-display text-xl font-light mb-2">Add by Voice</h1>
      <p className="text-sm text-ink-light mb-6">
        Say &ldquo;Hey Siri, [Shortcut name]&rdquo; to add something to your Shopping List
        without opening the app.
      </p>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
            1. Get the Shortcut
          </h2>
          <p className="text-sm text-ink-light">Shortcut link coming soon.</p>
        </div>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-wide text-ink-light mb-2">
            2. Paste your token
          </h2>
          <p className="text-sm text-ink-light mb-2">
            The Shortcut will ask you to paste a token the first time you run it — only once.
          </p>
          <VoiceTokenPanel initialToken={token} />
        </div>
      </div>
    </div>
  );
}
