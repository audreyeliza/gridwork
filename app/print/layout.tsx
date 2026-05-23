export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Covers the gradient blob layer (z-index -10) so it doesn't show in the print route */}
      <div className="fixed inset-0 bg-white" style={{ zIndex: -5 }} />
      <div className="relative min-h-screen bg-white text-zinc-900 print:min-h-0 print:bg-white print:text-black">
        {children}
      </div>
    </>
  );
}
