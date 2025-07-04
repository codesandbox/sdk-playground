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
    
    console.log("Sandbox created successfully. ID:", sandbox.id);
    
    // Create a session to get connection details
    const session = await sandbox.createSession();
    console.log("Session created successfully");
    
    // Connect to the sandbox using the SDK
    console.log("Connecting to sandbox...");
    const client = await sandbox.connect();
    console.log("Connected to sandbox successfully");
    
    // Instead of creating fake config files, demonstrate real Tasks API
    console.log("Setting up demonstration with actual Tasks API...");
    
    // Create a basic package.json so we have some real commands to work with
    const packageJson = {
      "name": "codesandbox-tasks-demo",
      "version": "1.0.0",
      "description": "CodeSandbox Tasks API demonstration",
      "main": "index.js",
      "scripts": {
        "dev": "python3 -m http.server 3000",
        "build": "mkdir -p dist && echo '<!DOCTYPE html><html><head><title>Built App</title></head><body><h1>Production Build</h1><p>Built at: '$(date)'</p></body></html>' > dist/index.html && echo 'Build artifacts created in dist/'",
        "start": "node -e \"const http = require('http'); const fs = require('fs'); const server = http.createServer((req, res) => { try { const html = fs.readFileSync('dist/index.html', 'utf8'); res.writeHead(200, {'Content-Type': 'text/html'}); res.end(html); } catch(e) { res.writeHead(404); res.end('<h1>Build not found</h1><p>Run build task first!</p>'); } }); server.listen(8080, () => console.log('Production server running on port 8080'));\"",
        "test": "node -e \"const fs = require('fs'); console.log('Running tests...'); const tests = ['✅ Package.json exists', '✅ Main file accessible', '✅ Dependencies valid']; tests.forEach((test, i) => setTimeout(() => console.log(\`Test \${i+1}/\${tests.length}: \${test}\`), i * 500)); setTimeout(() => console.log('All tests passed!'), tests.length * 500);\"",
        "lint": "find . -name '*.json' -exec echo 'Checking {}' \\; -exec node -e \"try { JSON.parse(require('fs').readFileSync('{}', 'utf8')); console.log('✅ {} is valid JSON'); } catch(e) { console.log('❌ {} has JSON errors'); process.exit(1); }\" \\;",
        "server": "node -e \"const http = require('http'); const server = http.createServer((req, res) => { res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<h1>🎉 Tasks API Demo Server</h1><p>Real HTTP server on port 3000</p><p>Request: ' + req.url + '</p><p>Time: ' + new Date().toISOString() + '</p>'); }); server.listen(3000, () => console.log('HTTP server listening on port 3000'));\""
      },
      "keywords": ["codesandbox", "sdk", "tasks"],
      "author": "CodeSandbox",
      "license": "MIT"
    };
    
    // Create the package.json file
    const packageJsonCommand = `cat > package.json << 'EOF'
${JSON.stringify(packageJson, null, 2)}
EOF`;
    await client.commands.run(packageJsonCommand);
    console.log("package.json created with npm scripts");
    
    // Create a tasks.json file with proper task definitions
    const tasksConfig = {
      "tasks": {
        "dev": {
          "name": "Development Server",
          "command": "npm run dev",
          "runAtStart": false,
          "preview": {
            "port": 3000
          }
        },
        "build": {
          "name": "Production Build", 
          "command": "npm run build",
          "runAtStart": false
        },
        "start": {
          "name": "Start Application",
          "command": "npm run start",
          "runAtStart": false,
          "preview": {
            "port": 8080
          }
        },
        "test": {
          "name": "Run Tests",
          "command": "npm run test",
          "runAtStart": false
        },
        "lint": {
          "name": "Lint Code",
          "command": "npm run lint",
          "runAtStart": false
        },
        "server": {
          "name": "HTTP Server Demo",
          "command": "npm run server",
          "runAtStart": false,
          "preview": {
            "port": 3000
          }
        },
        "success-demo": {
          "name": "Success Demo",
          "command": "ls -la && pwd && whoami && echo 'Task completed successfully!'",
          "runAtStart": false
        },
        "fail-demo": {
          "name": "Failure Demo", 
          "command": "echo 'Attempting to access non-existent file...' && cat /nonexistent/file.txt",
          "runAtStart": false
        },
        "long-demo": {
          "name": "Long Running Demo",
          "command": "echo 'Starting long computation...' && for i in $(seq 1 10); do echo \"Processing step $i/10...\"; sleep 1; done && echo 'Long task completed!'",
          "runAtStart": false
        },
        "file-operations": {
          "name": "File Operations Demo",
          "command": "echo 'Creating demo files...' && mkdir -p demo && echo 'Hello from Tasks API!' > demo/test.txt && cat demo/test.txt && ls -la demo/",
          "runAtStart": false
        },
        "system-info": {
          "name": "System Information",
          "command": "echo '=== System Info ===' && uname -a && echo '=== Node Version ===' && node --version && echo '=== Current Directory ===' && pwd && echo '=== Disk Usage ===' && df -h .",
          "runAtStart": false
        }
      }
    };
    
    // Create .codesandbox directory and tasks.json
    await client.commands.run("mkdir -p .codesandbox");
    const writeTasksCommand = `cat > .codesandbox/tasks.json << 'EOF'
${JSON.stringify(tasksConfig, null, 2)}
EOF`;
    await client.commands.run(writeTasksCommand);
    console.log("Tasks configuration created");
    
    // Test the actual Tasks API
    console.log("Testing Tasks API...");
    try {
      // Give it a moment for the tasks to be registered
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const allTasks = await client.tasks.getAll();
      console.log("✅ Successfully retrieved tasks via SDK API:", allTasks.length, "tasks found");
      
      allTasks.forEach(task => {
        console.log(`  - Task: ${task.name} (${task.id}) - Status: ${task.status}`);
      });
      
    } catch (error) {
      console.log("❌ Error testing Tasks API:", error.message);
    }
    
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
