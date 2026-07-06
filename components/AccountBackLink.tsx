import Link from "next/link";

export default function AccountBackLink({
  href = "/account",
  label = "Account",
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-ink-light hover:text-teal inline-flex items-center gap-1 mb-4"
    >
      ‹ {label}
    </Link>
  );
}
