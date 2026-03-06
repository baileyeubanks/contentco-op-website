import { getSupabase } from "@/lib/supabase";

export async function getRootContacts(limit = 500) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("contacts")
    .select("id,full_name,name,email,phone,company,business_unit,status,created_at,last_contacted,last_activity,contact_type,orbit_tier,priority_score")
    .order("created_at", { ascending: false })
    .limit(limit);
  return { contacts: data || [], error: error?.message || null };
}

export async function getRootFinance(limit = 200) {
  const sb = getSupabase();
  const [invoicesRes, quotesRes] = await Promise.all([
    sb
      .from("invoices")
      .select("id,invoice_number,amount,tax,total,status,business_unit,created_at,contact_id,notes")
      .order("created_at", { ascending: false })
      .limit(limit),
    sb
      .from("quotes")
      .select("id,quote_number,estimated_total,total,status,business_unit,created_at,client_name,notes")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const rows = [
    ...((invoicesRes.data || []).map((i: Record<string, unknown>) => ({
      id: i.id,
      type: "invoice",
      description: i.invoice_number || `INV-${String(i.id).slice(0, 8)}`,
      amount: i.total || i.amount || 0,
      status: i.status || "draft",
      business_unit: i.business_unit || "ACS",
      date: i.created_at,
      contact_name: "",
      source:
        typeof i.notes === "string" && (i.notes.includes("bank") || i.notes.includes("parsed"))
          ? "bank_statement"
          : "manual",
    })) as Record<string, unknown>[]),
    ...((quotesRes.data || []).map((q: Record<string, unknown>) => ({
      id: q.id,
      type: "quote",
      description: q.quote_number ? `Q-${q.quote_number}` : `Q-${String(q.id).slice(0, 8)}`,
      amount: q.estimated_total || q.total || 0,
      status: q.status || "draft",
      business_unit: q.business_unit || "ACS",
      date: q.created_at,
      contact_name: q.client_name || "",
      source:
        typeof q.notes === "string" && q.notes.includes("Auto-generated") ? "auto" : "manual",
    })) as Record<string, unknown>[]),
  ].sort(
    (a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime(),
  );

  return {
    finance: rows,
    error: invoicesRes.error?.message || quotesRes.error?.message || null,
  };
}
