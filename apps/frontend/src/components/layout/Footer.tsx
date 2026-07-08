export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white/60 px-6 py-4">
      <div className="flex flex-col items-center justify-between gap-2 text-xs text-slate-500 sm:flex-row">
        <p>
          <span className="font-semibold text-slate-700">AI Project Hunter</span>
          <span className="mx-1.5 text-slate-300">•</span>© {year}
        </p>
        <p className="text-slate-400">
          AI-powered freelance project acquisition system
        </p>
      </div>
    </footer>
  );
}
