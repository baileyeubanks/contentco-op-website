type RootStatusTone = "default" | "accent" | "warn" | "success" | "critical";

function inferTone(value: string): RootStatusTone {
  const lowered = value.toLowerCase();
  if (
    lowered.includes("healthy") ||
    lowered.includes("accepted") ||
    lowered.includes("ready") ||
    lowered.includes("released") ||
    lowered.includes("live") ||
    lowered.includes("active")
  ) {
    return "success";
  }
  if (
    lowered.includes("degraded") ||
    lowered.includes("declined") ||
    lowered.includes("blocked") ||
    lowered.includes("critical")
  ) {
    return "critical";
  }
  if (
    lowered.includes("stale") ||
    lowered.includes("attention") ||
    lowered.includes("pending") ||
    lowered.includes("review") ||
    lowered.includes("expired") ||
    lowered.includes("warning")
  ) {
    return "warn";
  }
  if (
    lowered.includes("withheld") ||
    lowered.includes("contract-held") ||
    lowered.includes("system") ||
    lowered.includes("synced")
  ) {
    return "accent";
  }
  return "default";
}

export function OsStatusPill({
  children,
  tone,
}: {
  children: string;
  tone?: RootStatusTone;
}) {
  const resolvedTone = tone || inferTone(children);

  return (
    <span className={`root-status-pill root-status-pill--${resolvedTone}`}>
      {children.replace(/_/g, " ")}
    </span>
  );
}
