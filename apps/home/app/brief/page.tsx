import { PublicPageLayout } from "@/app/components/public-page-layout";
import { BriefClientPage } from "./brief-client";

export default function BriefPage() {
  return (
    <PublicPageLayout surface="brief" theme="dark" navVariant="minimal">
      <BriefClientPage />
    </PublicPageLayout>
  );
}
