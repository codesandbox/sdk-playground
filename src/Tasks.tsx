import { useEffect, useRef, useState } from "react";
import { Task, WebSocketSession } from "@codesandbox/sdk/browser";
import { Terminal as XTerminal } from "@xterm/xterm";
import "../node_modules/@xterm/xterm/css/xterm.css";

export function TasksComponent({ session }: { session: WebSocketSession }) {
  const taskRef = useRef<Task | null>(null);
  const [status, setStatus] = useState("IDLE");
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerminal>(null);

  if (!xtermRef.current) {
    xtermRef.current = new XTerminal();
  }

  useEffect(() => {
    if (!xtermRef.current || !terminalContainerRef.current) {
      return;
    }

    const devTask = session.tasks.getTask("dev");

    if (!devTask) {
      return;
    }

    const xterm = xtermRef.current;
    const terminalContainer = terminalContainerRef.current;

    xterm.open(terminalContainer);

    taskRef.current = devTask;

    setStatus(devTask.status);

    const statusChangeDisposer = devTask.onStatusChange((status) => {
      setStatus(status);
    });

    devTask.open().then((output) => {
      xterm.write(output);

      devTask.onOutput((output) => {
        xterm.write(output);
      });
    });

    return () => {
      statusChangeDisposer.dispose();
    };
  }, []);
  return (
    <div className="flex flex-row gap-8 items-start w-full flex-wrap md:flex-nowrap">
      {/* Left: Buttons & status */}
      <div className="flex flex-col gap-3 min-w-[180px] w-full max-w-xs">
        <span className="mb-2 text-base font-semibold text-slate-700">Status: <span className="font-mono text-sm text-slate-900">{status}</span></span>
        <button
          onClick={async () => {
            await taskRef.current?.restart();
            console.log("Opened port", await taskRef.current?.waitForPort());
          }}
          className="bg-orange-400 hover:bg-orange-500 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2"
        >
          Restart
        </button>
        <button
          onClick={() => {
            taskRef.current?.stop();
          }}
          className="bg-red-500 hover:bg-red-600 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
        >
          Stop
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
