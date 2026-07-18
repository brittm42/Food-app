import AccountBackLink from "@/components/AccountBackLink";
import FeedbackForm from "@/components/FeedbackForm";

export default function FeedbackPage() {
  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <AccountBackLink />
      <h1 className="font-display text-xl font-light mb-2">Feedback</h1>
      <p className="text-sm text-ink-light mb-6">
        Bugs, ideas, anything else — goes straight to us.
      </p>
      <FeedbackForm />
    </div>
  );
}
