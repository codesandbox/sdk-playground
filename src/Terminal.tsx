import { useEffect, useRef } from "react";
import { Terminal, WebSocketSession } from "@codesandbox/sdk/browser";

import { useXTerm } from "./useXTerm";

export function TerminalComponent({ session }: { session: WebSocketSession }) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const xterm = useXTerm(terminalContainerRef);
  const terminalRef = useRef<Terminal | null>(null);

  useEffect(() => {
    const terminalContainer = terminalContainerRef.current;
    if (!terminalContainer) return;
    const disposers = new Set<() => void>();
    xterm.open(terminalContainer);
    const terminals = session.terminals.getAll();
    const existingTerminal =
      terminals[0] && session.terminals.get(terminals[0].id);
    const terminalPromise = existingTerminal
      ? Promise.resolve(existingTerminal)
      : session.terminals.create();
    terminalPromise.then(async (terminal) => {
      terminalRef.current = terminal;

      terminal.onOutput((output) => {
        xterm.write(output);
      });
      xterm.onData((data) => {
        terminal.write(data);
      });
      xterm.write(await terminal.open());
      disposers.add(() => terminal.kill());
    });
    return () => {
      disposers.forEach((dispose) => dispose());
    };
  }, [session, xterm]);

  return (
    <div className="flex flex-row gap-8 items-start w-full flex-wrap md:flex-nowrap">
      {/* Left: Buttons */}
      <div className="flex flex-col gap-3 min-w-[180px] w-full max-w-xs">
        <button
          onClick={() => {
            terminalRef.current?.kill();
            xterm.dispose();
          }}
          className="bg-red-500 hover:bg-red-600 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
        >
          Kill
        </button>
      </div>
      {/* Right: Terminal output */}
      <div
        ref={terminalContainerRef}
        className="p-4 w-full max-w-2xl h-80 mt-1 rounded-lg shadow-lg overflow-hidden border-2 transition-colors duration-200 bg-slate-900 border-slate-800 font-mono text-base text-slate-100"
      />
    </div>
  );
}
