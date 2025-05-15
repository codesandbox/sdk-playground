import { useState } from "react";
import { WebSocketSession } from "@codesandbox/sdk/browser";

export function InterpretersComponent({
  session,
}: {
  session: WebSocketSession;
}) {
  const [jsState, setJsState] = useState({
    input: "",
    output: "",
    loading: false,
    error: false,
  });
  const [pyState, setPyState] = useState({
    input: "",
    output: "",
    loading: false,
    error: false,
  });

  return (
    <div className="flex flex-col gap-12 w-full">
      <div>
        <h2 className="font-bold text-lg mb-2">JavaScript Interpreter</h2>
        <div className="flex flex-row gap-8 items-start w-full flex-wrap md:flex-nowrap">
          {/* Left: code input and button */}
          <div className="flex flex-col gap-3 min-w-[180px] w-full max-w-xs">
            <textarea
              className="rounded-md border border-slate-300 p-2 font-mono text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y min-h-[80px]"
              disabled={jsState.loading}
              value={jsState.input}
              onChange={(e) =>
                setJsState({ ...jsState, input: e.target.value })
              }
              placeholder={"// Write JS code here..."}
            />
            <button
              disabled={jsState.loading}
              className={`bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 ${
                jsState.loading ? "opacity-50" : ""
              }`}
              onClick={async () => {
                setJsState({ ...jsState, loading: true, error: false });
                try {
                  const result = await session.interpreters.javascript(
                    jsState.input
                  );
                  setJsState({
                    ...jsState,
                    output: result,
                    loading: false,
                    error: false,
                  });
                } catch (e: unknown) {
                  let message = "";
                  if (e instanceof Error) {
                    message = e.message;
                  } else {
                    message = String(e);
                  }
                  setJsState({
                    ...jsState,
                    output: message,
                    loading: false,
                    error: true,
                  });
                }
              }}
            >
              Run
            </button>
          </div>
          {/* Right: Terminal-like output */}
          <div
            className={`p-4 w-full max-w-2xl h-48 mt-1 rounded-lg shadow-lg overflow-auto border-2 transition-colors duration-200 bg-slate-900 font-mono text-base text-slate-100 whitespace-pre-wrap ${
              jsState.error ? "border-red-400" : "border-slate-800"
            }`}
            style={{ minHeight: 120 }}
            aria-label="JavaScript Output Terminal"
          >
            {jsState.output || (
              <span className="opacity-50">// Output will appear here</span>
            )}
          </div>
        </div>
      </div>
      <div>
        <h2 className="font-bold text-lg mb-2">Python Interpreter</h2>
        <div className="flex flex-row gap-8 items-start w-full flex-wrap md:flex-nowrap">
          {/* Left: code input and button */}
          <div className="flex flex-col gap-3 min-w-[180px] w-full max-w-xs">
            <textarea
              className="rounded-md border border-slate-300 p-2 font-mono text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y min-h-[80px]"
              disabled={pyState.loading}
              value={pyState.input}
              onChange={(e) =>
                setPyState({ ...pyState, input: e.target.value })
              }
              placeholder={"# Write Python code here..."}
            />
            <button
              disabled={pyState.loading}
              className={`bg-green-600 hover:bg-green-700 text-white rounded-md px-4 py-2 font-medium text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 ${
                pyState.loading ? "opacity-50" : ""
              }`}
              onClick={async () => {
                setPyState({ ...pyState, loading: true, error: false });
                try {
                  const result = await session.interpreters.python(
                    pyState.input
                  );
                  setPyState({
                    ...pyState,
                    output: result,
                    loading: false,
                    error: false,
                  });
                } catch (e: unknown) {
                  let message = "";
                  if (e instanceof Error) {
                    message = e.message;
                  } else {
                    message = String(e);
                  }
                  setPyState({
                    ...pyState,
                    output: message,
                    loading: false,
                    error: true,
                  });
                }
              }}
            >
              Run
            </button>
          </div>
          {/* Right: Terminal-like output */}
          <div
            className={`p-4 w-full max-w-2xl h-48 mt-1 rounded-lg shadow-lg overflow-auto border-2 transition-colors duration-200 bg-slate-900 font-mono text-base text-slate-100 whitespace-pre-wrap ${
              pyState.error ? "border-red-400" : "border-slate-800"
            }`}
            style={{ minHeight: 120 }}
            aria-label="Python Output Terminal"
          >
            {pyState.output || (
              <span className="opacity-50"># Output will appear here</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
