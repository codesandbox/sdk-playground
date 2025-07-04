import { useState, useEffect } from "react";

import { connectToSandbox, SandboxClient } from "@codesandbox/sdk/browser";
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
      session: SandboxClient;
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
          console.log("🔍 DEBUG: Reconnecting to stored sandbox:", storedId);
          console.log("🔍 DEBUG: Session data for stored sandbox:", sessionData);
          
          const client = await connectToSandbox({
            session: sessionData.session,
            getSession: (id) => fetch(`/api/sandboxes/${id}`).then(res => res.json()).then(data => data.session)
          });
          
          console.log("🔍 DEBUG: Reconnected client:", client);
          setState({
            current: "CONNECTED",
            sandboxId: storedId,
            session: client,
            selectedExample: null,
          });
        } catch (error) {
          console.error("Failed to connect to sandbox:", error);
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
      console.log("🔍 DEBUG: Creating sandbox returned:", sessionData);
      console.log("🔍 DEBUG: Sandbox ID from server:", sessionData.id);
      
      const client = await connectToSandbox({
        session: sessionData.session,
        getSession: (id) => fetch(`/api/sandboxes/${id}`).then(res => res.json()).then(data => data.session),
        initStatusCb(status) {
          setState({
            current: "CONNECTING_TO_SANDBOX",
            sandboxId: sessionData.id,
            progress: status.message,
          });
        },
      });
      
      console.log("🔍 DEBUG: Connected client:", client);
      setState({
        current: "CONNECTED",
        sandboxId: sessionData.id,
        session: client,
        selectedExample: null,
      });
    } catch (error) {
      console.error("Failed to create sandbox:", error);
      alert(`Failed to create sandbox: ${error instanceof Error ? error.message : String(error)}`);
      setState({ current: "IDLE" });
    }
  };

  const handleDisconnect = async () => {
    if (state.current === "CONNECTED") {
      try {
        // Disconnect the session
        await state.session.disconnect();
        // Clear stored sandbox ID
        localStorage.removeItem("sandboxId");
        // Return to idle state
        setState({ current: "IDLE" });
      } catch (error) {
        console.error("Error disconnecting:", error);
        // Even if disconnect fails, clear localStorage and return to idle
        localStorage.removeItem("sandboxId");
        setState({ current: "IDLE" });
      }
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
          <div className="mb-8 text-center text-gray-700">
            <p className="mb-1 font-medium max-w-2xl">
              Experience the functionality of the SDK with this interactive
              playground.
            </p>
            <p className="mb-1 font-medium max-w-2xl">
              To start, create a sample playground
            </p>
          </div>
          <button
            onClick={handleCreateSandbox}
            className={`mb-2 px-6 py-3 rounded-lg font-semibold text-white transition-all bg-blue-500 hover:bg-blue-600`}
          >
            Create Sandbox
          </button>
          <div className="mb-6 w-full max-w-2xl bg-slate-900 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-800">
              <span className="text-slate-300 font-aeonik-medium text-sm">
                Example Code
              </span>
              <button
                onClick={() =>
                  navigator.clipboard
                    .writeText(`const handleCreateSandbox = async () => {
  // Create a new sandbox
  const res = await fetch("/api/sandboxes", { method: "POST" });
  const initialSession = await res.json();
  
  // Store sandboxId for reconnection
  localStorage.setItem("sandboxId", initialSession.id);
  
  // Connect to the sandbox
  const session = await connectToSandbox({
    id: initialSession.id,
    getSession: (id) => fetch(\`/api/sandboxes/\${id}\`).then((res) => res.json())
  });
}`)
                }
                className="text-slate-400 hover:text-slate-200 text-sm font-aeonik-medium"
              >
                Copy
              </button>
            </div>
            <pre className="p-4 text-slate-100 font-mono text-sm overflow-x-auto">
              <code>
                {`import { CodeSandbox } from "@codesandbox/sdk";
 
const sdk = new CodeSandbox(process.env.CSB_API_KEY!);
const sandbox = await sdk.sandboxes.create();
              `}
              </code>
            </pre>
          </div>
        </>
      ) : state.current === "CONNECTED" ? (
        <>
          <div className="mb-8 text-center">
            <div className="text-lg font-semibold text-gray-800 mb-4">
              Connected to Sandbox: {state.sandboxId}
            </div>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all"
            >
              Disconnect Sandbox
            </button>
          </div>
          <ExampleWrapper title="Tasks API Playground" sourcePath="Tasks.tsx">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">
                📋 Interactive Tasks API demonstration with real development workflows, success/failure examples, and real-time status monitoring.
              </p>
              <p className="text-sm text-blue-700 mt-2">
                💡 <strong>Try it:</strong> Run tasks like "dev", "build", or demo tasks to see real command execution with live output streaming.
              </p>
            </div>
            <TasksComponent session={state.session} />
          </ExampleWrapper>

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
