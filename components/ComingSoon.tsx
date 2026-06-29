export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-16 px-5">
      <div className="font-display text-xl font-light mb-2">{title}</div>
      <p className="text-sm text-ink-light max-w-xs mx-auto leading-relaxed">
        {description}
      </p>
    </div>
  );
}
