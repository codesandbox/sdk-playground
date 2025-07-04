import { useEffect, useRef, useState } from "react";

import {
  SandboxClient,
  createPreview,
  Preview,
} from "@codesandbox/sdk/browser";
import "../node_modules/@xterm/xterm/css/xterm.css";

// Extend window interface for our setup function
declare global {
  interface Window {
    setupPreviewProtocol?: (previewProtocol: any) => void;
    setupPongCommunication?: (previewProtocol: any) => void;
  }
}

export function PreviewComponent({ session }: { session: SandboxClient }) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<Preview<
    { type: "start" } | { type: "stop" }, 
    { type: "ping" } | { type: "pong" } | { type: "game_over"; winner: string; score: any } | { type: "game_started" } | { type: "game_stopped" }
  >>(null);
  const [messages, setMessages] = useState<unknown[]>([]);
  const [previewReady, setPreviewReady] = useState(false);
  const [gameActive, setGameActive] = useState(false);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (container && session) {
      // Create preview using the sandbox URL for port 3000 (dev server)
      const previewUrl = session.hosts.getUrl(3000);
      console.log("🌐 Creating preview for Pong game at port 3000:", previewUrl);

      const preview = createPreview<
        { type: "start" } | { type: "stop" }, 
        { type: "ping" } | { type: "pong" } | { type: "game_over"; winner: string; score: any } | { type: "game_started" } | { type: "game_stopped" }
      >(previewUrl);

      previewRef.current = preview;
      preview.iframe.style.height = "100%";
      preview.iframe.style.width = "100%";

      // Set up message listener using SDK method
      preview.onMessage((msg: any) => {
        console.log("🎯 PARENT: Message received from Pong game:", msg);
        
        // Handle game_over messages to reset button state
        if (msg.type === 'game_over') {
          setGameActive(false);
        }
        
        setMessages((prev) => {
          const newMessages = [msg, ...prev];
          console.log("🎯 PARENT: Updated messages array:", newMessages);
          return newMessages;
        });
      });

      preview.onStatusChange((status: string) => {
        console.log("🔌 Preview status changed:", status);
        if (status === "CONNECTED") {
          console.log("🚀 Preview connected, setting up protocol...");
          
          // Use SDK injection properly - just set up the communication protocol
          preview.injectAndInvoke(function setupPongProtocol({ previewProtocol }: any) {
            console.log("📡 IFRAME: Setting up Pong communication protocol...");
            
            // Set up the Pong game to send messages back to parent
            if (window.setupPongCommunication) {
              window.setupPongCommunication(previewProtocol);
              console.log("✅ IFRAME: Pong communication protocol established");
            } else {
              console.log("⏳ IFRAME: Waiting for Pong game to load...");
              // Poll for the setup function
              let attempts = 0;
              const maxAttempts = 10;
              
              function pollForPong() {
                attempts++;
                if (window.setupPongCommunication) {
                  window.setupPongCommunication(previewProtocol);
                  console.log("✅ IFRAME: Pong communication protocol established after", attempts, "attempts");
                } else if (attempts < maxAttempts) {
                  setTimeout(pollForPong, 500);
                } else {
                  console.error("❌ IFRAME: Failed to establish Pong communication");
                }
              }
              pollForPong();
            }
          }, {});
          
          setPreviewReady(true);
          console.log("✅ Preview marked as ready");
        }
      });

      container.append(preview.iframe);
      console.log("🖼️ Preview iframe appended to container");
    }
  }, [session]);

  const startGame = () => {
    if (previewRef.current && previewReady && !gameActive) {
      console.log("🎮 Starting Pong game using SDK sendMessage...");
      // Use proper SDK method to send message to preview
      previewRef.current.sendMessage({ type: "start" });
      setGameActive(true);
    }
  };

  const stopGame = () => {
    if (previewRef.current && previewReady && gameActive) {
      console.log("🛑 Stopping Pong game using SDK sendMessage...");
      // Use proper SDK method to send message to preview
      previewRef.current.sendMessage({ type: "stop" });
      setGameActive(false);
    }
  };

  return (
    <>
      {/* Larger preview container */}
      <div className="flex flex-col gap-4 w-full">
        {/* Explanation text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 text-xl">ℹ️</div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">How This Preview Works</h3>
              <p className="text-blue-800 text-sm">
                This preview displays content served by the <strong>"dev" task</strong> above, which runs a Node.js web server on port 3000. 
                The server automatically starts when you create a sandbox and serves our retro Pong game. 
                Use the controls below to start the game and watch the real-time ping/pong messages!
              </p>
            </div>
          </div>
        </div>

        {/* Controls row */}
        <div className="flex gap-4 items-center">
          <div className={`text-sm px-3 py-2 rounded-lg ${previewReady ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {previewReady ? '✅ Pong Ready' : '🔄 Loading...'}
          </div>
          
          <div className={`text-sm px-3 py-2 rounded-lg ${gameActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
            {gameActive ? '🎮 Game Active' : '⏸️ Game Idle'}
          </div>
          
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-4 py-2 font-medium shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            onClick={() => {
              previewRef.current?.reload();
            }}
          >
            Reload Preview
          </button>
          
          <button
            className={`rounded-md px-4 py-2 font-medium shadow transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              previewReady 
                ? gameActive
                  ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-400'
                  : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-400'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={gameActive ? stopGame : startGame}
            disabled={!previewReady}
          >
            {gameActive ? '🛑 Stop Game' : '🎮 Start Game'}
          </button>
        </div>

        {/* Preview iframe - better sized for page layout */}
        <div
          ref={previewContainerRef}
          className="w-full h-[450px] bg-black rounded-lg border border-slate-300 overflow-hidden shadow-lg"
        />
      </div>
      
      {/* Message log below preview */}
      <div className="w-full mt-4 bg-slate-50 rounded-lg border border-slate-200 p-4 font-mono text-sm text-slate-800 max-h-60 overflow-y-auto">
        <div className="font-bold mb-2 text-slate-600 flex items-center justify-between">
          <span>🏓 Game Messages ({messages.length}):</span>
          <button 
            onClick={() => setMessages([])}
            className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
          >
            Clear
          </button>
        </div>
        {messages.length === 0 ? (
          <div className="opacity-50">No messages yet. Start the game to see ping/pong messages!</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="mb-2 p-2 bg-white rounded border-l-4 border-blue-500">
              <div className="text-xs text-slate-500 mb-1">
                Message #{messages.length - i}: {new Date().toLocaleTimeString()}
              </div>
              <div className="whitespace-pre-wrap break-all">
                {typeof msg === "object" && msg && 'type' in msg && typeof (msg as any).type === 'string' ? (
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      (msg as any).type === 'ping' ? 'bg-blue-100 text-blue-800' :
                      (msg as any).type === 'pong' ? 'bg-green-100 text-green-800' :
                      (msg as any).type === 'game_over' ? 'bg-red-100 text-red-800' :
                      (msg as any).type === 'game_started' ? 'bg-green-100 text-green-800' :
                      (msg as any).type === 'game_stopped' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {((msg as any).type as string).toUpperCase()}
                    </span>
                    <span className="text-gray-600">
                      {(msg as any).type === 'ping' ? '🏓 Player hit!' :
                       (msg as any).type === 'pong' ? '🏓 AI hit!' :
                       (msg as any).type === 'game_over' ? `🎯 Game Over! ${(msg as any).winner} wins!` :
                       (msg as any).type === 'game_started' ? '🚀 Game started!' :
                       (msg as any).type === 'game_stopped' ? '🛑 Game stopped!' :
                       'Game event'}
                    </span>
                  </div>
                ) : (
                  JSON.stringify(msg, null, 2)
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
