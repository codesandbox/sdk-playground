import { config } from "dotenv";
import { CodeSandbox } from "@codesandbox/sdk";
import express from "express";

// Load environment variables from .env file
config();

const app = express();
const sdk = new CodeSandbox(process.env.CSB_API_KEY);

app.post("/api/sandboxes", async (req, res) => {
  try {
    console.log("Creating sandbox...");
    const sandbox = await sdk.sandboxes.create();
    
    // Debug: log the entire sandbox object to see its structure
    console.log("Sandbox object:", JSON.stringify(sandbox, null, 2));
    console.log("Sandbox created successfully. ID:", sandbox.id);
    
    // Create a session to get connection details
    const session = await sandbox.createSession();
    console.log("Session object:", JSON.stringify(session, null, 2));
    
    res.json({ 
      id: sandbox.id,
      sandboxId: sandbox.id,
      session: session
    });
  } catch (error) {
    console.error("Failed to create sandbox:", error);
    res.status(500).json({ error: "Failed to create sandbox", details: error.message });
  }
});

app.get("/api/sandboxes/:id", async (req, res) => {
  try {
    const sandbox = await sdk.sandboxes.resume(req.params.id);
    console.log("Sandbox resumed successfully:", sandbox.id);
    
    // Create a session to get connection details
    const session = await sandbox.createSession();
    
    res.json({ 
      id: sandbox.id,
      sandboxId: sandbox.id,
      session: session
    });
  } catch (error) {
    console.error("Failed to resume sandbox:", error);
    res.status(500).json({ error: "Failed to resume sandbox", details: error.message });
  }
});

app.listen(4001, (error) => {
  if (error) {
    console.error(error);
  } else {
    console.log("Server is running on port 4001");
    console.log("API Key configured:", process.env.CSB_API_KEY ? "✅ Yes" : "❌ No");
  }
});
