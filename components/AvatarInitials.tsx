function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const trimmed = name?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/);
    return parts.length === 1
      ? parts[0].slice(0, 2).toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export default function AvatarInitials({
  name,
  email,
  size = 48,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  return (
    <div
      className="rounded-full bg-teal text-white flex items-center justify-center font-display font-medium flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {getInitials(name, email)}
    </div>
  );
}
