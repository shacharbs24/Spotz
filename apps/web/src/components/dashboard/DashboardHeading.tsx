export function DashboardHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="text-3xl font-bold tracking-tight text-ink">{title}</h1>
      <p className="max-w-[65ch] leading-7 text-ink-muted">{description}</p>
    </header>
  );
}
