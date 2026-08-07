"use client";

import { MachineShell } from "@/components/machine/MachineShell";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-paper font-mono text-sm text-chassis-dark">
          Powering up…
        </div>
      }
    >
      <MachineShell />
    </Suspense>
  );
}
