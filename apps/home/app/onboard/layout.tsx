import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creative Brief | Content Co-op",
  description:
    "Send the structured creative brief when you already know the project shape and want Content Co-op to route intake before quote follow-through.",
};

export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
