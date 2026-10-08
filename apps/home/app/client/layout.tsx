import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Content Co-op",
  description: "Video production and creative services",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">
              Content Co-op
            </p>
            <p className="text-xs text-gray-500">Video production</p>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6 text-center text-xs text-gray-400">
          <p>&copy; {new Date().getFullYear()} Content Co-op. All rights reserved.</p>
          <p className="mt-1">Fully insured &middot; Video production</p>
        </div>
      </footer>
    </div>
  );
}
