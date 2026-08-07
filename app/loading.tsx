export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper">
      <div className="flex items-center gap-[5px]" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="punch-loading-dot"
            style={{ animationDelay: `${i * 0.12}s` }}
          />
        ))}
      </div>
      <p className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase punch-print-faint">
        Reading card…
      </p>
    </div>
  );
}
