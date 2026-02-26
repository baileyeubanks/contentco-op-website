import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { PortalClient } from "./portal-client";
import s from "./page.module.css";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  reviewed: "Reviewed",
  in_progress: "In Progress",
  delivered: "Delivered",
  closed: "Closed",
};

export default async function PortalPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className={s.wrap}>
        <div className={s.shell}>
          <Link href="/" className={s.backLink}>&larr; Back to Home</Link>
          <div className={s.error}>
            <h1 className={s.errorTitle}>Access denied</h1>
            <p className={s.errorBody}>A valid token is required to view this portal.</p>
          </div>
        </div>
      </div>
    );
  }

  const { data: brief } = await supabase
    .from("creative_briefs")
    .select("*")
    .eq("id", id)
    .eq("access_token", token)
    .single();

  if (!brief) {
    return (
      <div className={s.wrap}>
        <div className={s.shell}>
          <Link href="/" className={s.backLink}>&larr; Back to Home</Link>
          <div className={s.error}>
            <h1 className={s.errorTitle}>Brief not found</h1>
            <p className={s.errorBody}>This link may have expired or the brief doesn&apos;t exist.</p>
          </div>
        </div>
      </div>
    );
  }

  const { data: history } = await supabase
    .from("brief_status_history")
    .select("*")
    .eq("brief_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className={s.wrap}>
      <div className={s.shell}>
        <Link href="/" className={s.backLink}>&larr; Back to Home</Link>

        <div className={s.header}>
          <div className={s.headerRow}>
            <div>
              <p className={s.kicker}>Client Portal</p>
              <h1 className={s.title}>
                {brief.company || brief.contact_name}&apos;s Project
              </h1>
            </div>
            <div className={s.statusBadge}>
              <span className={s.statusDot} />
              {STATUS_LABELS[brief.status] || brief.status}
            </div>
          </div>
        </div>

        <PortalClient brief={brief} history={history ?? []} token={token} />
      </div>
    </div>
  );
}
