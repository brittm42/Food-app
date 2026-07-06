import Link from "next/link";

export default function AccountBackLink() {
  return (
    <Link
      href="/account"
      className="text-sm text-ink-light hover:text-teal inline-flex items-center gap-1 mb-4"
    >
      ‹ Account
    </Link>
  );
}
