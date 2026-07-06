import Link from "next/link";

export default function AccountSectionRow({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between bg-surface border border-border rounded-lg px-4 py-3 hover:border-teal transition-colors"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        {subtitle && (
          <div className="text-xs text-ink-light truncate mt-0.5">{subtitle}</div>
        )}
      </div>
      <span className="text-ink-light text-sm flex-shrink-0 ml-3">›</span>
    </Link>
  );
}
