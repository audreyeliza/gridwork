import { redirect } from "next/navigation";

type Props = { searchParams?: Promise<{ pattern?: string }> };

export default async function EditorRedirect({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  if (sp.pattern) {
    redirect(`/?zone=reader&pattern=${encodeURIComponent(sp.pattern)}`);
  }
  redirect("/?zone=reader");
}
