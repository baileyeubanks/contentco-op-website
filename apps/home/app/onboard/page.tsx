import { redirect } from "next/navigation";
import { CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

export default function OnboardPage() {
  redirect(CREATIVE_BRIEF_PATH);
}
