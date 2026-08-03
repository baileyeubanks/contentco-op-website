import { redirect } from "next/navigation";

export default async function RootInvoicePrintRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/api/os/invoices/${id}/preview`);
}
