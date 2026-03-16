/**
 * ROOT Event Taxonomy — Canonical event types for the shared-business OS.
 * Every event in the system maps to one of these types.
 * Pattern: {domain}.{action}
 */

export const ROOT_EVENT_TYPES = {
  // ─── Contact events ───
  "contact.created": { category: "contacts", label: "Contact created" },
  "contact.updated": { category: "contacts", label: "Contact updated" },
  "contact.merged": { category: "contacts", label: "Contacts merged" },
  "contact.deleted": { category: "contacts", label: "Contact deleted" },
  "contact.score_changed": { category: "contacts", label: "Lead score changed" },
  "contact.lifecycle_changed": { category: "contacts", label: "Lifecycle stage changed" },
  "contact.note_added": { category: "contacts", label: "Note added to contact" },

  // ─── Company events ───
  "company.created": { category: "contacts", label: "Company created" },
  "company.updated": { category: "contacts", label: "Company updated" },
  "company.deleted": { category: "contacts", label: "Company deleted" },

  // ─── Relationship events ───
  "relationship.created": { category: "contacts", label: "Relationship created" },
  "relationship.ended": { category: "contacts", label: "Relationship ended" },

  // ─── Opportunity events ───
  "opportunity.created": { category: "pipeline", label: "Opportunity created" },
  "opportunity.stage_changed": { category: "pipeline", label: "Stage changed" },
  "opportunity.won": { category: "pipeline", label: "Deal won" },
  "opportunity.lost": { category: "pipeline", label: "Deal lost" },
  "opportunity.value_changed": { category: "pipeline", label: "Deal value changed" },

  // ─── Quote events ───
  "quote.created": { category: "finance", label: "Quote created" },
  "quote.sent": { category: "finance", label: "Quote sent" },
  "quote.accepted": { category: "finance", label: "Quote accepted" },
  "quote.rejected": { category: "finance", label: "Quote rejected" },
  "quote.expired": { category: "finance", label: "Quote expired" },

  // ─── Invoice events ───
  "invoice.created": { category: "finance", label: "Invoice created" },
  "invoice.sent": { category: "finance", label: "Invoice sent" },
  "invoice.paid": { category: "finance", label: "Invoice paid" },
  "invoice.partial_payment": { category: "finance", label: "Partial payment received" },
  "invoice.overdue": { category: "finance", label: "Invoice overdue" },
  "invoice.voided": { category: "finance", label: "Invoice voided" },
  "invoice.reminder_sent": { category: "finance", label: "Payment reminder sent" },
  "invoice.recurring_generated": { category: "finance", label: "Recurring invoice generated" },

  // ─── Payment events ───
  "payment.received": { category: "finance", label: "Payment received" },
  "payment.refunded": { category: "finance", label: "Payment refunded" },
  "payment.failed": { category: "finance", label: "Payment failed" },

  // ─── Project events ───
  "project.created": { category: "operations", label: "Project created" },
  "project.status_changed": { category: "operations", label: "Project status changed" },
  "project.completed": { category: "operations", label: "Project completed" },
  "project.cancelled": { category: "operations", label: "Project cancelled" },

  // ─── Deliverable events ───
  "deliverable.created": { category: "operations", label: "Deliverable created" },
  "deliverable.submitted": { category: "operations", label: "Deliverable submitted for review" },
  "deliverable.approved": { category: "operations", label: "Deliverable approved" },
  "deliverable.revision_requested": { category: "operations", label: "Revision requested" },
  "deliverable.delivered": { category: "operations", label: "Deliverable delivered" },

  // ─── Campaign events ───
  "campaign.created": { category: "marketing", label: "Campaign created" },
  "campaign.launched": { category: "marketing", label: "Campaign launched" },
  "campaign.paused": { category: "marketing", label: "Campaign paused" },
  "campaign.completed": { category: "marketing", label: "Campaign completed" },
  "campaign.contact_enrolled": { category: "marketing", label: "Contact enrolled in campaign" },
  "campaign.contact_completed": { category: "marketing", label: "Contact completed campaign" },
  "campaign.contact_opted_out": { category: "marketing", label: "Contact opted out of campaign" },

  // ─── ACS Job events ───
  "job.created": { category: "operations", label: "Job created" },
  "job.scheduled": { category: "operations", label: "Job scheduled" },
  "job.dispatched": { category: "operations", label: "Crew dispatched" },
  "job.started": { category: "operations", label: "Job started" },
  "job.completed": { category: "operations", label: "Job completed" },
  "job.invoiced": { category: "operations", label: "Job invoiced" },
  "job.cancelled": { category: "operations", label: "Job cancelled" },

  // ─── Automation events ───
  "automation.triggered": { category: "system", label: "Automation triggered" },
  "automation.completed": { category: "system", label: "Automation completed" },
  "automation.failed": { category: "system", label: "Automation failed" },
  "automation.rule_created": { category: "system", label: "Automation rule created" },
  "automation.rule_updated": { category: "system", label: "Automation rule updated" },

  // ─── System events ───
  "system.user_login": { category: "system", label: "User logged in" },
  "system.sync_started": { category: "system", label: "Data sync started" },
  "system.sync_completed": { category: "system", label: "Data sync completed" },
  "system.error": { category: "system", label: "System error" },

  // ─── Brief events ───
  "brief.submitted": { category: "operations", label: "Creative brief submitted" },
  "brief.converted": { category: "operations", label: "Brief converted to project" },
} as const;

export type RootEventType = keyof typeof ROOT_EVENT_TYPES;

export type EventCategory = "contacts" | "pipeline" | "finance" | "operations" | "marketing" | "system";

export const EVENT_CATEGORIES: Record<EventCategory, { label: string; color: string }> = {
  contacts: { label: "Contacts & CRM", color: "#3b82f6" },
  pipeline: { label: "Sales Pipeline", color: "#8b5cf6" },
  finance: { label: "Finance", color: "#10b981" },
  operations: { label: "Operations", color: "#f59e0b" },
  marketing: { label: "Marketing", color: "#ec4899" },
  system: { label: "System", color: "#6b7280" },
};

/** Get the category for a given event type */
export function getEventCategory(eventType: string): EventCategory | null {
  const entry = ROOT_EVENT_TYPES[eventType as RootEventType];
  return entry ? entry.category : null;
}

/** Get the human-readable label for an event type */
export function getEventLabel(eventType: string): string {
  const entry = ROOT_EVENT_TYPES[eventType as RootEventType];
  return entry ? entry.label : eventType;
}

/** List all event types for a given category */
export function getEventTypesByCategory(category: EventCategory): RootEventType[] {
  return (Object.entries(ROOT_EVENT_TYPES) as [RootEventType, { category: string }][])
    .filter(([, value]) => value.category === category)
    .map(([key]) => key);
}
