import { redirect } from "next/navigation";

export const dynamic = "force-static";

export async function GET() {
  redirect("/brandcentral");
}
