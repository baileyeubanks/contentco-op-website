import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Astro Cleaning Services",
  description: "Professional cleaning services in Houston, TX",
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Image
            src="/brand/assets/acs/logos/png/logo-texas.png"
            alt="Astro Cleaning Services"
            width={40}
            height={40}
            className="rounded-md"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              Astro Cleaning Services
            </p>
            <p className="text-xs text-gray-500">Houston, TX</p>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
          <p>&copy; {new Date().getFullYear()} Astro Cleaning Services. All rights reserved.</p>
          <p className="mt-1">Fully insured &middot; Houston, TX</p>
        </div>
      </footer>
    </div>
  );
}
