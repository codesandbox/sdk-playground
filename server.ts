import { config } from "dotenv";
import { CodeSandbox } from "@codesandbox/sdk";
import express from "express";

// Load environment variables from .env file
config();

const app = express();
const sdk = new CodeSandbox(process.env.CSB_API_KEY);

app.post("/api/sandboxes", async (req, res) => {
  try {
    console.log("Creating sandbox from git repository...");
    const sandbox = await sdk.sandboxes.create({
      source: "git",
      url: "https://github.com/codesandbox/sdk-playground.git",
      branch: "tasks", // Use the current branch with your custom tasks
    });

    const session = await sandbox.createBrowserSession();
    console.log("Sandbox created successfully:", session.id);
    res.json(session);
  } catch (error) {
    console.error("Failed to create sandbox:", error);
    res.status(500).json({ error: "Failed to create sandbox", details: error.message });
  }
});

app.get("/api/sandboxes/:id", async (req, res) => {
  try {
    const sandbox = await sdk.sandboxes.resume(req.params.id);
    const session = await sandbox.createBrowserSession();
    res.json(session);
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
