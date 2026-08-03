export function RootEmptyState({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <div className="root-empty-state">
      <strong>{title}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}
