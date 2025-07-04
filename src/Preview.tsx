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
  }
}

export function PreviewComponent({ session }: { session: SandboxClient }) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<Preview<{ type: "ping" }, { type: "pong" }>>(null);
  const [messages, setMessages] = useState<unknown[]>([]);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    const container = previewContainerRef.current;
    if (container) {
      // Create preview pointing to our demo HTML page
      const preview = createPreview<{ type: "ping" }, { type: "pong" }>(
        "http://localhost:5173/preview-demo.html"
      );

      previewRef.current = preview;
      preview.iframe.style.height = "100%";
      preview.iframe.style.width = "100%";

      // Set up message listener FIRST
      preview.onMessage((msg) => {
        console.log("🎯 PARENT: Message received from preview:", msg);
        setMessages((prev) => {
          const newMessages = [msg, ...prev];
          console.log("🎯 PARENT: Updated messages array:", newMessages);
          return newMessages;
        });
      });

      preview.onStatusChange((status: string) => {
        console.log("🔌 Preview status changed:", status);
        if (status === "CONNECTED") {
          console.log("🚀 Preview connected, injecting protocol...");
          
          // Inject the preview protocol setup function
          preview.injectAndInvoke(function setupProtocol({ previewProtocol }) {
            // This code runs in the iframe context
            console.log("📡 IFRAME: Protocol injected, setting up listeners...");
            
            // Set up ping listener in the iframe
            previewProtocol.addListener('ping', function(data) {
              console.log('📨 IFRAME: Received ping:', data);
              // Send pong back to parent
              var pongMessage = { type: 'pong' } as const;
              console.log('📤 IFRAME: Sending pong:', pongMessage);
              previewProtocol.sendMessage(pongMessage);
            });
            
            // Send initial test message to confirm protocol is working
            console.log('📤 IFRAME: Sending initial test message...');
            previewProtocol.sendMessage({ type: 'pong' } as const);
            
            console.log('✅ IFRAME: Protocol setup complete');
          }, {});
          
          setPreviewReady(true);
          console.log("✅ Preview marked as ready");
        }
      });

      container.append(preview.iframe);
      console.log("🖼️ Preview iframe appended to container");
    }
  }, [session]);

  const sendPing = () => {
    if (previewRef.current && previewReady) {
      const pingMessage = { type: "ping" as const };
      console.log("Parent sending ping:", pingMessage);
      previewRef.current.sendMessage(pingMessage);
    } else {
      console.log("Preview not ready yet");
    }
  };

  return (
    <>
      {/* Larger preview container */}
      <div className="flex flex-col gap-4 w-full">
        {/* Controls row */}
        <div className="flex gap-4 items-center">
          <div className={`text-sm px-3 py-2 rounded-lg ${previewReady ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {previewReady ? '✅ Protocol Ready' : '🔄 Loading...'}
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
                ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-400' 
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
            }`}
            onClick={sendPing}
            disabled={!previewReady}
          >
            Send Ping
          </button>
        </div>

        {/* Preview iframe - much larger */}
        <div
          ref={previewContainerRef}
          className="w-full h-96 bg-white rounded-lg border border-slate-300 overflow-hidden shadow-lg"
        />
      </div>
      
      {/* Message log below preview */}
      <div className="w-full mt-4 bg-slate-50 rounded-lg border border-slate-200 p-4 font-mono text-sm text-slate-800 max-h-60 overflow-y-auto">
        <div className="font-bold mb-2 text-slate-600 flex items-center justify-between">
          <span>Messages from Preview ({messages.length}):</span>
          <button 
            onClick={() => setMessages([])}
            className="text-xs bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded"
          >
            Clear
          </button>
        </div>
        {messages.length === 0 ? (
          <div className="opacity-50">No messages yet. Click "Send Ping" to start communication.</div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="mb-2 p-2 bg-white rounded border-l-4 border-blue-500">
              <div className="text-xs text-slate-500 mb-1">Message #{messages.length - i}:</div>
              <div className="whitespace-pre-wrap break-all">
                {typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg)}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
