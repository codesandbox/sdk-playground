import { useEffect, useRef } from "react";
import "./App.css";
import { WebSocketSession, Terminal } from "@codesandbox/sdk/browser";
import { Terminal as XTerminal } from "@xterm/xterm";
import "../node_modules/@xterm/xterm/css/xterm.css";

export function TerminalComponent({ session }: { session: WebSocketSession }) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  // const terminalRef = useTerminal(session, terminalContainerRef);
  const xtermRef = useRef<XTerminal>(null);
  const terminalRef = useRef<Terminal>(null);

  if (!xtermRef.current) {
    xtermRef.current = new XTerminal();
  }

  useEffect(() => {
    if (!xtermRef.current || !terminalContainerRef.current) {
      return;
    }

    const xterm = xtermRef.current;
    const terminalContainer = terminalContainerRef.current;

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
  }, [session]);

  return (
    <>
      <h1>SDK TEST</h1>
      <button onClick={() => terminalRef.current?.run(`echo "Hello World"`)}>
        Run echo
      </button>
      <button
        onClick={() => {
          terminalRef.current?.kill().then(console.log).catch(console.error);
        }}
      >
        Kill
      </button>
      <div ref={terminalContainerRef} />
    </>
  );
}
