import { redirect } from "next/navigation";

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function toQuery(sp: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string" && value) params.set(key, value);
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }
  return params.toString();
}

export default async function GalleryRedirect({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const qs = toQuery(sp);
  redirect(qs ? `/hopper?${qs}` : "/hopper");
}
