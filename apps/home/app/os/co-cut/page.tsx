import { redirect } from "next/navigation";

/** Canonical post lane lives at /os/co-edit; keep the co-cut nav id reachable. */
export default function RootCoCutRedirectPage() {
  redirect("/os/co-edit");
}
