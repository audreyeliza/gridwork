import { HoleRow, OperatorCardHeader } from "@/components/OperatorCardHeader";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div
        className="punch-card relative flex min-h-[18rem] w-full max-w-sm flex-col px-6 py-5"
        style={{ ["--manila-stock" as string]: "#E8E2D0" }}
      >
        <OperatorCardHeader title="Not found card" colLabel="JOB 404" />

        <div className="mt-8 flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="font-mono text-[13px] leading-relaxed punch-print-ink">
            This card isn&apos;t in the deck.
          </p>
          <p className="font-mono text-[11px] leading-relaxed punch-print-faint">
            The page you&apos;re looking for doesn&apos;t exist or was moved.
          </p>
          <Link href="/" className="punch-print mt-2 text-[11px]">
            ← Back to Gridwork
          </Link>
        </div>

        <div className="mt-auto flex justify-center pt-4">
          <HoleRow />
        </div>
      </div>
    </div>
  );
}
