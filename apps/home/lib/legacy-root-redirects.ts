/** Legacy /root paths → CCO OS /os. Used by next.config redirects. */
export const legacyRootRedirects = [
  { source: "/root", destination: "/os", permanent: true },
  { source: "/root/:path*", destination: "/os/:path*", permanent: true },
  { source: "/api/root/:path*", destination: "/api/os/:path*", permanent: true },
] as const;
