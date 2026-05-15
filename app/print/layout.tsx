export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 print:bg-white print:text-black">{children}</div>
  );
}
