import type { Metadata } from "next";
import CombinedPreviewClient from "@/components/CombinedPreviewClient";

export const metadata: Metadata = {
  title: "Design Preview - Combined Experience",
  description: "Design preview only - not production",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  return (
    <main>
      <CombinedPreviewClient />
    </main>
  );
}
