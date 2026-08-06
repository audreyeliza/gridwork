import type { Metadata } from "next";
import { LegalManualPage } from "@/components/LegalManualPage";

export const metadata: Metadata = {
  title: "Terms · Gridwork",
  description: "The terms governing your use of Gridwork.",
};

const SECTIONS = [
  {
    id: "account",
    title: "Your account",
    body: "You are responsible for keeping your account credentials secure. You must be 13 or older to create an account.",
  },
  {
    id: "content",
    title: "Your content",
    body: "You own the patterns you create. By marking a pattern public, you give other users permission to view and copy it. You can make a pattern private again at any time.",
  },
  {
    id: "use",
    title: "Acceptable use",
    body: "Don't use Gridwork to store or share content that is illegal, harmful, or infringes someone else's copyright. We reserve the right to remove content or suspend accounts that violate this.",
  },
  {
    id: "availability",
    title: "Service availability",
    body: "Gridwork is provided as-is. We don't guarantee uptime or that your data will never be lost — back up patterns you care about by printing or exporting them.",
  },
  {
    id: "changes",
    title: "Changes",
    body: "We may update these terms. Continued use of Gridwork after changes means you accept the new terms.",
  },
  {
    id: "contact",
    title: "Contact",
    body: "gridworkapp@gmail.com",
  },
] as const;

export default function TermsPage() {
  return (
    <LegalManualPage
      title="Terms of Service"
      updated="May 29, 2026"
      sections={SECTIONS}
      otherHref="/privacy"
      otherLabel="Privacy Policy"
    />
  );
}
