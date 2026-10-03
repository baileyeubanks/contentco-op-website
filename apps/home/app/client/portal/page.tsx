import { PortalView } from "./portal-view";

export const dynamic = "force-dynamic";

/**
 * The client portal no longer resolves an account from a query-string email
 * or contact id. That lookup used the service-role client with no secret, so
 * any visitor who knew an address could read that client's quotes, invoices,
 * payments and conversations. Portal data is only served behind a bearer
 * capability issued by CCO OS; until that exists for contacts, the page fails
 * closed and directs the visitor to request a link.
 */
export default function PortalPage() {
  return <PortalView data={null} initialEmail="" />;
}
