import { useState, useEffect } from "react";

import { connectToSandbox, WebSocketSession } from "@codesandbox/sdk/browser";
import { CommandComponent } from "./Command";
import "../node_modules/@xterm/xterm/css/xterm.css";
import { InterpretersComponent } from "./Interpreters";
import { TasksComponent } from "./Tasks";
import { PreviewComponent } from "./Preview";
import { TerminalComponent } from "./Terminal";

type State =
  | {
      current: "IDLE";
    }
  | {
      current: "CREATING_SANDBOX";
      progress: string;
    }
  | {
      current: "CONNECTING_TO_SANDBOX";
      sandboxId: string;
      progress: string;
    }
  | {
      current: "CONNECTED";
      sandboxId: string;
      session: WebSocketSession;
      selectedExample: number | null;
    };

function App() {
  const [state, setState] = useState<State>({
    current: "IDLE",
  });

  // On mount, check localStorage for sandboxId and connect if present
  useEffect(() => {
    const storedId = localStorage.getItem("sandboxId");
    if (storedId) {
      (async () => {
        setState({
          current: "CONNECTING_TO_SANDBOX",
          sandboxId: storedId,
          progress: "Connecting to sandbox...",
        });
        try {
          const sessionData = await fetch(`/api/sandboxes/${storedId}`).then(
            (res) => res.json()
          );
          const session = await connectToSandbox({
            session: sessionData,
            getSession: (id) =>
              fetch(`/api/sandboxes/${id}`).then((res) => res.json()),
            initStatusCb(status) {
              setState({
                current: "CONNECTING_TO_SANDBOX",
                sandboxId: storedId,
                progress: status.message,
              });
            },
          });
          setState({
            current: "CONNECTED",
            sandboxId: storedId,
            session,
            selectedExample: null,
          });
        } catch {
          localStorage.removeItem("sandboxId"); // Remove if invalid
          setState({ current: "IDLE" });
        }
      })();
    }
  }, []);

  const handleCreateSandbox = async () => {
    setState({
      current: "CREATING_SANDBOX",
      progress: "Creating sandbox...",
    });
    try {
      const res = await fetch("/api/sandboxes", { method: "POST" });
      const sessionData = await res.json();
      // Store sandboxId in localStorage
      localStorage.setItem("sandboxId", sessionData.id);
      setState({
        current: "CONNECTING_TO_SANDBOX",
        sandboxId: sessionData.id,
        progress: "Connecting to sandbox...",
      });
      const session = await connectToSandbox({
        session: sessionData,
        getSession: (id) => {
          return fetch(`/api/sandboxes/${id}`).then((res) => res.json());
        },
        initStatusCb(status) {
          setState({
            current: "CONNECTING_TO_SANDBOX",
            sandboxId: sessionData.id,
            progress: status.message,
          });
        },
      });
      setState({
        current: "CONNECTED",
        sandboxId: sessionData.id,
        session,
        selectedExample: null,
      });
    } catch {
      alert("Failed to create sandbox");
    }
  };

  // Example wrapper component for all examples
  function ExampleWrapper({
    title,
    sourcePath,
    children,
  }: {
    title: string;
    sourcePath: string;
    children: React.ReactNode;
  }) {
    return (
      <div
        style={{
          maxWidth: 900,
          width: "100%",
          margin: "32px auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 2px 24px rgba(0,0,0,0.10)",
          padding: 36,
          border: "1px solid #ececec",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 28,
            fontWeight: 800,
            letterSpacing: 1,
            fontSize: 28,
          }}
        >
          {title}
        </h2>
        {children}
        <div style={{ marginTop: 24 }}>
          <a
            href={`https://github.com/codesandbox/sdk-playground/blob/main/src/${sourcePath}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 14,
              color: "#0366d6",
              textDecoration: "underline",
              fontWeight: 500,
            }}
          >
            View source on GitHub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">
        Playground Examples
      </h1>
      {state.current === "IDLE" ? (
        <>
          <button
            onClick={handleCreateSandbox}
            className={`mb-2 px-6 py-3 rounded-lg font-semibold text-white transition-all bg-blue-500 hover:bg-blue-600`}
          >
            Create Sandbox
          </button>
          <div className="mb-8 text-center text-gray-700">
            <p className="mb-1 font-medium max-w-2xl">
              Click the button above to create a Sandbox and connect. This will
              fork a snapshot of a template already running a vite dev server
              and wake it up on a new VM for you.
            </p>
          </div>
        </>
      ) : state.current === "CONNECTED" ? (
        <>
          <div className="mb-8 text-center">Connected to Sandbox</div>
          <ExampleWrapper title="Command Example" sourcePath="Command.tsx">
            <CommandComponent session={state.session} />
          </ExampleWrapper>

          <ExampleWrapper title="Terminal Example" sourcePath="Terminal.tsx">
            <TerminalComponent session={state.session} />
          </ExampleWrapper>

          <ExampleWrapper
            title="Interpreters Example"
            sourcePath="Interpreters.tsx"
          >
            <InterpretersComponent session={state.session} />
          </ExampleWrapper>

          <ExampleWrapper title="Tasks Example" sourcePath="Tasks.tsx">
            <TasksComponent session={state.session} />
          </ExampleWrapper>

          <ExampleWrapper title="Preview Example" sourcePath="Preview.tsx">
            <PreviewComponent session={state.session} />
          </ExampleWrapper>
        </>
      ) : (
        <div className="mb-8 text-center">{state.progress}</div>
      )}
    </div>
  );
}

export default App;
