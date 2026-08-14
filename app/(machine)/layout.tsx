"use client";

import { MachineShellPage } from "@/components/machine/MachineShellPage";

/** Shared shell so Manual / Hopper / Program / Profile do not remount the editor. */
export default function MachineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MachineShellPage />
      {children}
    </>
  );
}
