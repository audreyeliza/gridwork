import type { Metadata } from "next";
import { LegalManualPage } from "@/components/LegalManualPage";

export const metadata: Metadata = {
  title: "Privacy · Gridwork",
  description: "How Gridwork collects, uses, and stores your data.",
};

const SECTIONS = [
  {
    id: "collect",
    title: "What we collect",
    body: "When you create an account, we collect your email address through Supabase Auth. We also store the patterns you create, including grid data, pattern names, yarn settings, and any thumbnail images. We store a display name and optional avatar you choose for your public profile. We do not collect payment information, physical addresses, or any sensitive personal data.",
  },
  {
    id: "use",
    title: "How we use it",
    body: "Your email is used only to authenticate your account. We do not send marketing emails. Your patterns are stored so you can access them across devices. Patterns you mark as public are visible to other users in the gallery.",
  },
  {
    id: "stored",
    title: "How it's stored",
    body: "All data is stored on Supabase, a hosted PostgreSQL database service, in the United States. You can read Supabase's privacy policy at supabase.com/privacy.",
  },
  {
    id: "visible",
    title: "What others can see",
    body: "Your display name, avatar, and any patterns you mark as public are visible to anyone. Your email address is never shown publicly.",
  },
  {
    id: "rights",
    title: "Your rights",
    body: "You can delete your account and all associated patterns by contacting us at gridworkapp@gmail.com. If you are in the EU or UK, you have the right to request a copy of your data or ask us to delete it.",
  },
  {
    id: "children",
    title: "Children",
    body: "Gridwork is not directed at children under 13 and we do not knowingly collect data from anyone under 13. If you believe a child has created an account, contact us at gridworkapp@gmail.com and we will delete it.",
  },
  {
    id: "contact",
    title: "Contact",
    body: "gridworkapp@gmail.com",
  },
] as const;

export default function PrivacyPage() {
  return (
    <LegalManualPage
      title="Privacy Policy"
      updated="May 29, 2026"
      sections={SECTIONS}
      otherHref="/terms"
      otherLabel="Terms of Service"
    />
  );
}
