import { redirect } from "next/navigation";

type ContactRouteProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RootContactCompatibilityPage({ params, searchParams }: ContactRouteProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const target = new URLSearchParams();

  if (id) target.set("contact_id", id);

  for (const [key, rawValue] of Object.entries(resolvedSearchParams)) {
    const value = firstValue(rawValue);
    if (!value || key === "contact_id") continue;
    target.set(key, value);
  }

  const suffix = target.toString();
  redirect(suffix ? `/root/contacts?${suffix}` : "/root/contacts");
}
