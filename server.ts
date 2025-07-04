import { CodeSandbox } from "@codesandbox/sdk";
import express from "express";
import * as fs from 'fs';
import * as path from 'path';

// Validate API key is available from environment
if (!process.env.CSB_API_KEY) {
  console.error("❌ CSB_API_KEY environment variable is not set!");
  console.error("   Please set CSB_API_KEY in your environment");
  process.exit(1);
}

const app = express();
const sdk = new CodeSandbox(process.env.CSB_API_KEY);

console.log("✅ CodeSandbox SDK initialized successfully");

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
    
    console.log("Setting up demonstration with Tasks API...");
    
    // Create a basic package.json so we have some real commands to work with
    const packageJson = {
      "name": "codesandbox-tasks-demo",
      "version": "1.0.0",
      "description": "CodeSandbox Tasks API demonstration",
      "main": "index.js",
      "scripts": {
        "dev": "node -e \"const http = require('http'); const fs = require('fs'); const path = require('path'); const server = http.createServer((req, res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('X-Content-Type-Options', \\\"default-src 'self' 'unsafe-inline' 'unsafe-eval' https://codesandbox.io https://*.csb.app; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://codesandbox.io https://*.csb.app data: blob:; style-src 'self' 'unsafe-inline'; frame-ancestors *; connect-src 'self' https://codesandbox.io https://*.csb.app wss://*.csb.app ws://*.csb.app\\\"); if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; } let filePath = req.url === '/' ? '/index.html' : req.url; try { const content = fs.readFileSync('.' + filePath, 'utf8'); const ext = path.extname(filePath); const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'text/plain'; res.writeHead(200, {'Content-Type': contentType + '; charset=utf-8'}); res.end(content); } catch(e) { res.writeHead(404, {'Content-Type': 'text/html'}); res.end('<h1>404 Not Found</h1><p>File not found: ' + filePath + '</p>'); } }); server.listen(3000, () => console.log('🌐 HTTP server running on port 3000 with CodeSandbox SDK injection support'));\"",
        "build": "npm install --no-save uglify-js html-minifier-terser && rm -rf dist && mkdir -p dist && npx html-minifier-terser --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true index.html -o dist/index.html && find . -name '*.js' -not -path './node_modules/*' -not -path './dist/*' -exec cat {} \\; > dist/bundle.tmp.js && (test -s dist/bundle.tmp.js && npx uglify-js dist/bundle.tmp.js -o dist/bundle.min.js -c -m) && rm -f dist/bundle.tmp.js && node -e \"const fs=require('fs'); const stats={name:'codesandbox-tasks-demo',version:'1.0.0',buildTime:new Date().toISOString(),files:fs.readdirSync('dist'),sizes:fs.readdirSync('dist').reduce((acc,f)=>{try{acc[f]=fs.statSync('dist/'+f).size+'B'}catch(e){acc[f]='0B'} return acc},{})};fs.writeFileSync('dist/build-stats.json',JSON.stringify(stats,null,2));console.log('Build complete!');console.log('Files:',Object.keys(stats.sizes).join(', '));console.log('Total files:',stats.files.length);\" && ls -la dist/",
        "start": "node -e \"const http = require('http'); const fs = require('fs'); const server = http.createServer((req, res) => { try { const html = fs.readFileSync('dist/index.html', 'utf8'); res.writeHead(200, {'Content-Type': 'text/html'}); res.end(html); } catch(e) { res.writeHead(404); res.end('<h1>Build not found</h1><p>Run build task first!</p>'); } }); server.listen(8080, () => console.log('Production server running on port 8080'));\"",
        "test": "node -e \"const fs = require('fs'); const assert = require('assert'); try { const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); assert(pkg.name); assert(pkg.version); console.log('✓ package.json is valid'); } catch(e) { console.error('✗ package.json test failed:', e.message); process.exit(1); } try { fs.accessSync('index.html', fs.constants.R_OK); console.log('✓ index.html is readable'); } catch(e) { console.error('✗ index.html test failed:', e.message); process.exit(1); } console.log('All tests passed!');\"",
        "lint": "npm install --no-save jsonlint && find . -name '*.json' -not -path './node_modules/*' -exec npx jsonlint {} \\;",
        "server": "node -e \"const http = require('http'); const server = http.createServer((req, res) => { res.writeHead(200, {'Content-Type': 'text/html'}); res.end('<h1>🎉 Tasks API Demo Server</h1><p>Real HTTP server on port 3001</p><p>Request: ' + req.url + '</p><p>Time: ' + new Date().toISOString() + '</p>'); }); server.listen(3001, () => console.log('HTTP server listening on port 3001'));\""
      },
      "keywords": ["codesandbox", "sdk", "tasks"],
      "author": "CodeSandbox",
      "license": "MIT"
    };
    
    // Write package.json using SDK filesystem API
    await client.fs.writeTextFile("package.json", JSON.stringify(packageJson, null, 2));
    console.log("package.json created with npm scripts");
    
    // Create a tasks.json file with proper task definitions
    const tasksConfig = {
      "tasks": {
        "dev": {
          "name": "Development Server (Node.js)",
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
            "port": 3001
          }
        },
        "success-demo": {
          "name": "Success Demo",
          "command": "ls -la && pwd && whoami",
          "runAtStart": false
        },
        "fail-demo": {
          "name": "Failure Demo", 
          "command": "cat /nonexistent/file.txt",
          "runAtStart": false
        },
        "long-demo": {
          "name": "Long Running Demo",
          "command": "node -e \"for(let i=1; i<=10; i++) { console.log('Processing step ' + i + '/10...'); require('child_process').execSync('sleep 1'); }\"",
          "runAtStart": false
        },
        "file-operations": {
          "name": "File Operations Demo",
          "command": "mkdir -p demo && node -e \"require('fs').writeFileSync('demo/test.txt', 'Hello from Tasks API!\\n');\" && cat demo/test.txt && ls -la demo/",
          "runAtStart": false
        },
        "system-info": {
          "name": "System Information",
          "command": "uname -a && node --version && pwd && df -h .",
          "runAtStart": false
        }
      }
    };
    
    // Create .codesandbox directory and write tasks.json using SDK filesystem API
    await client.fs.writeTextFile(".codesandbox/tasks.json", JSON.stringify(tasksConfig, null, 2));
    console.log("Tasks configuration created");
    
    // Test the Tasks API
    console.log("Testing Tasks API...");
    try {
      // Wait for tasks to be registered
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const allTasks = await client.tasks.getAll();
      console.log("✅ Successfully retrieved tasks via SDK API:", allTasks.length, "tasks found");
      
      allTasks.forEach(task => {
        console.log(`  - Task: ${task.name} (${task.id}) - Status: ${task.status}`);
      });
      
    } catch (error) {
      console.log("❌ Error testing Tasks API:", error.message);
    }
    
    // Write the Pong game HTML file using SDK filesystem API properly
    console.log('📁 Writing Pong game HTML using SDK filesystem API...');
    const pongHtmlPath = path.join(__dirname, 'public', 'pong.html');
    const pongHtmlContent = fs.readFileSync(pongHtmlPath, 'utf8');
    
    // Use SDK filesystem API - files are written to /project/workspace
    await client.fs.writeTextFile("index.html", pongHtmlContent);
    console.log('✅ Created Pong game HTML file using SDK filesystem API');
    
    // Verify the file was written using SDK
    try {
      const fileList = await client.fs.readdir("./");
      console.log('📁 Files in workspace:', fileList);
      
      const fileContent = await client.fs.readTextFile("index.html");
      console.log('📄 File size:', fileContent.length, 'characters');
      console.log('📄 File preview:', fileContent.substring(0, 100) + '...');
    } catch (error) {
      console.error('❌ Error verifying file:', error.message);
    }

    // Automatically start the dev task and wait for the port properly
    console.log('🚀 Starting dev task and waiting for port...');
    try {
      // Wait for tasks to be registered
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const allTasks = await client.tasks.getAll();
      console.log('📋 Available tasks after registration:', allTasks.map(t => t.id));
      
      const devTask = allTasks.find(task => task.id === 'dev');
      
      if (devTask) {
        console.log('📡 Found dev task, starting Node.js web server...');
        await devTask.run();
        console.log('✅ Dev task started, waiting for port 3000 to open...');
        
        // Use proper SDK method to wait for port
        try {
          const portInfo = await client.ports.waitForPort(3000, { timeoutMs: 30000 });
          console.log('🌐 Port 3000 is ready:', portInfo);
          console.log('🔗 Server URL:', client.hosts.getUrl(3000));
        } catch (portError) {
          console.log('⚠️ Port 3000 did not open within timeout:', portError.message);
          // Still continue, the server might be starting
        }
      } else {
        console.log('❌ Dev task not found in:', allTasks.map(t => t.id));
      }
    } catch (error) {
      console.log('⚠️ Could not auto-start dev task:', error.message);
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
