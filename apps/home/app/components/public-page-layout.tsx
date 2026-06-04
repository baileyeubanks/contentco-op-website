import { type ReactNode } from "react";
import { Nav } from "@contentco-op/ui";
import { PublicFooter } from "./public-footer";
import { FilmGrain } from "./film-grain";
import { SmoothScroll } from "./smooth-scroll";
import { PublicPwaRegistration } from "./public-pwa-registration";

interface PublicPageLayoutProps {
  surface: Parameters<typeof Nav>[0]["surface"];
  theme?: "dark" | "light" | "cream";
  children: ReactNode;
  showNav?: boolean;
  showFooter?: boolean;
  navVariant?: "full" | "minimal";
}

export function PublicPageLayout({
  surface,
  theme = "dark",
  children,
  showNav = true,
  showFooter = true,
  navVariant = "full",
}: PublicPageLayoutProps) {
  return (
    <div
      className="public-page"
      data-surface={surface}
      data-theme={theme}
      data-nav-variant={navVariant}
    >
      <SmoothScroll>
        <PublicPwaRegistration />
        {showNav && <Nav surface={surface} />}
        {children}
        {showFooter && <PublicFooter />}
      </SmoothScroll>
      <FilmGrain />
    </div>
  );
}
