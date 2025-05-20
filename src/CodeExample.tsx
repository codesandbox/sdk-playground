interface CodeExampleProps {
  code: string;
  title?: string;
}

export function CodeExample({
  code,
  title = "Example Code",
}: CodeExampleProps) {
  return (
    <div className="mb-6 w-full max-w-2xl bg-slate-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800">
        <span className="text-slate-300 text-sm">{title}</span>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="text-slate-400 hover:text-slate-200 text-sm"
        >
          Copy
        </button>
      </div>
      <pre className="p-4 text-slate-100 font-mono text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
