import { permanentRedirect } from "next/navigation";
import { CREATIVE_BRIEF_PATH } from "@/lib/public-booking";

export default function OnboardPage() {
  permanentRedirect(CREATIVE_BRIEF_PATH);
}
