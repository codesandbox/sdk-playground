import { CodeSandbox } from "@codesandbox/sdk";
import express from "express";

const app = express();
const sdk = new CodeSandbox(process.env.CSB_API_KEY);

app.post("/api/sandboxes", async (req, res) => {
  const sandbox = await sdk.sandboxes.create({
    source: "template",
    id: "9qputt",
  });

  res.json(await sandbox.createBrowserSession());
});
app.get("/api/sandboxes/:id", async (req, res) => {
  const sandbox = await sdk.sandboxes.resume(req.params.id);
  const session = await sandbox.createBrowserSession();

  res.json(session);
});

app.listen(4001, (error) => {
  if (error) {
    console.error(error);
  } else {
    console.log("Server is running on port 4001");
  }
});
