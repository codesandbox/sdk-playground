import { useState, useEffect, useRef } from "react";
import { Command, WebSocketSession } from "@codesandbox/sdk/browser";
import { useXTerm } from "./useXTerm";
import type { IDisposable } from "@xterm/xterm";

function hasNonZeroExitCode(obj: unknown): boolean {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "exitCode" in obj &&
    typeof (obj as { exitCode?: number }).exitCode === "number" &&
    (obj as { exitCode: number }).exitCode !== 0
  );
}

export function CommandComponent({ session }: { session: WebSocketSession }) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const xterm = useXTerm(terminalContainerRef);
  const [devCommand, setDevCommand] = useState<{
    command: Command;
    disposable: IDisposable;
  } | null>(null);
  const [isError, setIsError] = useState<boolean>(false);

  // Find existing dev command on mount
  // (If you want to restore previous output, you could add logic here)
  // But for now, just set devCommand if found
  // (If you want to clear output on mount, add setOutput("") here)
  //   ...
  // (Removed useEffect for xterm and terminal refs)
  //
  // Find existing dev command on mount
  //
  // (If you want to restore previous output, you could add logic here)
  // But for now, just set devCommand if found
  // (If you want to clear output on mount, add setOutput("") here)
  //
  // NOTE: This is a simplified version of the previous useEffect
  //       for devCommand detection.
  useEffect(() => {
    const devCommand = session.commands
      .getAll()
      .find((command) => command.command === "pnpm run dev");
    if (devCommand) {
      setDevCommand({
        command: devCommand,
        disposable: devCommand.onOutput((output: string) => {
          xterm.write(output);
        }),
      });
    }
  }, [session.commands, xterm]);

  async function runEchoCommand() {
    xterm.clear();
    try {
      const result = await session.commands.run("echo 'Hello World'");
      if (typeof result === "string") {
        xterm.write(result);
        setIsError(false);
      } else if (
        typeof result === "object" &&
        result !== null &&
        "output" in result
      ) {
        xterm.write((result as { output?: string }).output || String(result));
        setIsError(hasNonZeroExitCode(result));
      } else {
        xterm.write(String(result));
        setIsError(false);
      }
    } catch (error: unknown) {
      xterm.write(error instanceof Error ? error.message : String(error));
      setIsError(true);
    }
  }

  async function runDevCommand() {
    xterm.clear();
    const command = await session.commands.create("pnpm run dev");
    setDevCommand({
      command,
      disposable: command.onOutput((output: string) => {
        xterm.write(output);
      }),
    });
  }

  async function restartDevCommand(devCommand: Command) {
    devCommand.restart();
  }

  async function killDevCommand(devCommand: Command) {
    devCommand.kill();
    setDevCommand(null);
    setIsError(false);
    xterm.clear();
  }

  async function runBadCommand() {
    xterm.clear();
    setIsError(false);
    try {
      const result = await session.commands.run("echo 'OPS!' && exit 1");
      if (typeof result === "string") {
        xterm.write(result);
        setIsError(false);
      } else if (
        typeof result === "object" &&
        result !== null &&
        "output" in result
      ) {
        xterm.write((result as { output?: string }).output || String(result));
        setIsError(hasNonZeroExitCode(result));
      } else {
        xterm.write(String(result));
        setIsError(false);
      }
    } catch (error: unknown) {
      xterm.write(error instanceof Error ? error.message : String(error));
      setIsError(true);
    }
  }

  return (
    <>
      <div className="flex flex-row gap-8 items-start w-full flex-wrap md:flex-nowrap">
        {/* Left: Buttons */}
        <div className="flex flex-col gap-3 min-w-[180px] w-full max-w-xs">
          <button
            onClick={runEchoCommand}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          >
            Run echo
          </button>
          {devCommand ? (
            <>
              <button
                onClick={() => restartDevCommand(devCommand.command)}
                className="bg-orange-400 hover:bg-orange-500 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2"
              >
                Restart Dev
              </button>
              <button
                onClick={() => killDevCommand(devCommand.command)}
                className="bg-red-500 hover:bg-red-600 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2"
              >
                Kill Dev
              </button>
            </>
          ) : (
            <button
              onClick={runDevCommand}
              className="bg-green-500 hover:bg-green-600 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-green-300 focus:ring-offset-2"
            >
              Start Dev
            </button>
          )}
          <button
            onClick={runBadCommand}
            className="bg-slate-500 hover:bg-slate-600 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2"
          >
            Run bad command
          </button>
        </div>
        {/* Right: Output */}
        <div
          ref={terminalContainerRef}
          className={`p-4 w-full max-w-2xl h-80 mt-1 rounded-lg shadow-lg overflow-hidden border-2 transition-colors duration-200 bg-slate-900 ${
            isError ? " border-red-400" : " border-slate-800"
          }`}
        />
      </div>
    </>
  );
}
