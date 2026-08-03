export function OsStateCallout({
  tone = "default",
  title,
  detail,
}: {
  tone?: "default" | "healthy" | "attention" | "critical" | "withheld" | "stale";
  title: string;
  detail?: string;
}) {
  return (
    <div className={`os-state-callout os-state-callout--${tone}`}>
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}
