import { permanentRedirect } from "next/navigation";
import { BOOKING_PAGE_PATH } from "@/lib/public-booking";

export default function CoCreatePage() {
  permanentRedirect(BOOKING_PAGE_PATH);
}
