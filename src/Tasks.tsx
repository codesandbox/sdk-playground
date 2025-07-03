import { useEffect, useRef, useState } from "react";
import { Task, WebSocketSession } from "@codesandbox/sdk/browser";

import "../node_modules/@xterm/xterm/css/xterm.css";
import { useXTerm } from "./useXTerm";

interface TaskState {
  task: Task | null;
  status: string;
  isRunning: boolean;
  hasError: boolean;
  output: string;
}

export function TasksComponent({ session }: { session: WebSocketSession }) {
  const [availableTasks, setAvailableTasks] = useState<string[]>([]);
  const [taskStates, setTaskStates] = useState<{ [key: string]: TaskState }>({});
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const xterm = useXTerm(terminalContainerRef);

  useEffect(() => {
    console.log("🔍 Debugging Tasks API:", session.tasks);
    console.log("🔍 Available properties:", Object.keys(session.tasks));
    console.log("🔍 Available methods:", Object.getOwnPropertyNames(session.tasks));
    console.log("🔍 Prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(session.tasks)));
    
    // Try different API methods to find tasks
    let allTasks: any[] = [];
    
    // Extended list of possible task names (from tasks.json + common ones)
    const possibleTaskNames = [
      // Standard npm tasks
      "dev", "build", "server", "lint", "preview", "start", "test",
      // Our custom demo tasks
      "success-demo", "fail-demo", "long-demo", "quick-test",
      // Other common tasks
      "install", "setup", "deploy", "watch", "clean"
    ];
    
    // Method 1: Try getAll() first (most comprehensive)
    if (typeof (session.tasks as any).getAll === 'function') {
      try {
        allTasks = (session.tasks as any).getAll() || [];
        console.log("✅ Found tasks via getAll():", allTasks);
      } catch (error) {
        console.log("❌ Error with getAll():", error);
      }
    }
    
    // Method 2: If no tasks found, try individual getTask calls
    if (allTasks.length === 0 && typeof (session.tasks as any).getTask === 'function') {
      console.log("✅ Found getTask method, trying individual tasks...");
      possibleTaskNames.forEach(name => {
        try {
          const task = (session.tasks as any).getTask(name);
          if (task) {
            console.log(`✅ Found task "${name}":`, task);
            allTasks.push(task);
          } else {
            console.log(`❌ Task "${name}" returned null/undefined`);
          }
        } catch (error) {
          console.log(`❌ Error getting task "${name}":`, error);
        }
      });
    }
    
    // Method 3: Try get() method
    if (allTasks.length === 0 && typeof (session.tasks as any).get === 'function') {
      console.log("✅ Trying get() method...");
      allTasks = possibleTaskNames.map(name => {
        try {
          return (session.tasks as any).get(name);
        } catch {
          return null;
        }
      }).filter(Boolean);
      console.log("✅ Found tasks via individual get():", allTasks);
    }
    
    // Method 4: Check if tasks object has direct properties
    if (allTasks.length === 0) {
      console.log("❌ No tasks found via methods, checking for direct properties...");
      const taskKeys = Object.keys(session.tasks).filter(key => 
        typeof (session.tasks as any)[key] === 'object' && 
        (session.tasks as any)[key] !== null
      );
      console.log("🔍 Found potential task keys:", taskKeys);
    }

    // Remove duplicates and log results
    const uniqueTasks = Array.from(new Map(allTasks.map(task => [task.name, task])).values());
    const foundTaskNames = uniqueTasks.map((task: any) => task.name || 'unnamed');
    console.log("📋 Final unique task names:", foundTaskNames);
    setAvailableTasks(foundTaskNames);

    // Initialize task states
    const initialStates: { [key: string]: TaskState } = {};
    uniqueTasks.forEach((task: any) => {
      const taskName = task.name || 'unnamed';
      console.log(`🎯 Setting up task: ${taskName}`, task);
      console.log(`📊 Initial task.status for "${taskName}":`, task.status);
      
      initialStates[taskName] = {
        task: task,
        status: task.status || "IDLE",
        isRunning: task.status === "RUNNING" || task.status === "RESTARTING",
        hasError: task.status === "ERROR",
        output: ""
      };

      // Set up status change listeners for each task
      if (typeof task.onStatusChange === 'function') {
        task.onStatusChange((status: string) => {
          console.log(`🔄 Task ${taskName} status changed:`, status);
          console.log(`📊 Live task.status for "${taskName}":`, task.status);
          setTaskStates(prev => ({
            ...prev,
            [taskName]: {
              ...prev[taskName],
              status,
              isRunning: status === "RUNNING" || status === "RESTARTING",
              hasError: status === "ERROR"
            }
          }));
        });
      }
    });
    setTaskStates(initialStates);

    // Check for setup completion by looking for dependencies
    const checkSetupComplete = async () => {
      try {
        // Simple heuristic: if we can access session.fs, check for node_modules
        // Or wait a reasonable time for setup to complete
        setTimeout(() => {
          setSetupComplete(true);
        }, 10000); // Assume setup completes within 10 seconds
        
        // Try to detect if npm install completed by checking for typical files
        // This is a simple approach - in a real app you'd monitor the actual setup task
      } catch (error) {
        console.log("Setup detection error:", error);
        setSetupComplete(true); // Default to allowing tasks
      }
    };

    checkSetupComplete();
  }, [session.tasks]);

  const requiresDependencies = (taskName: string) => {
    // Tasks that need npm dependencies to be installed first
    return ['dev', 'build', 'lint', 'preview', 'server'].includes(taskName);
  };

  const isInstallTask = (taskName: string) => {
    return taskName === 'install';
  };

  const runTask = async (taskName: string) => {
    const taskState = taskStates[taskName];
    if (!taskState?.task) return;

    // Prevent running dependency tasks before setup completes
    if (requiresDependencies(taskName) && !setupComplete) {
      console.log(`⚠️ Task "${taskName}" requires dependencies. Waiting for setup to complete...`);
      return;
    }

    // Automatically select this task for output display
    setSelectedTask(taskName);

    const task = taskState.task;
    
    console.log(`🚀 Starting task "${taskName}"`);
    console.log(`📊 task.status before restart:`, task.status);

    try {
      // Use the proper task.restart() method from the docs
      await task.restart();
      
      console.log(`📊 task.status after restart:`, task.status);
      
      // Set up periodic status checking to demonstrate live task.status updates
      const statusInterval = setInterval(() => {
        console.log(`📊 Periodic check - task.status for "${taskName}":`, task.status);
        if (task.status === "FINISHED" || task.status === "ERROR" || task.status === "KILLED") {
          console.log(`✅ Task "${taskName}" completed with status:`, task.status);
          clearInterval(statusInterval);
        }
      }, 1000);
      
      // Set up output listener using task.open() and task.onOutput() as documented
      if (typeof task.open === 'function' && typeof task.onOutput === 'function') {
        // Get initial output
        const initialOutput = await task.open();
        
        setTaskStates(prev => ({
          ...prev,
          [taskName]: {
            ...prev[taskName],
            output: initialOutput || ""
          }
        }));

        // Always show output since we auto-selected this task
        xterm.clear();
        xterm.write(initialOutput || "");

        // Listen for new output
        task.onOutput((output: string) => {
          setTaskStates(prev => ({
            ...prev,
            [taskName]: {
              ...prev[taskName],
              output: prev[taskName].output + output
            }
          }));

          // Always write to terminal since this is the active task
          xterm.write(output);
        });
      }

    } catch (error) {
      console.error(`Failed to run task ${taskName}:`, error);
    }
  };

  const stopTask = async (taskName: string) => {
    const taskState = taskStates[taskName];
    if (!taskState?.task) return;

    try {
      // Try different stop methods based on what's available
      if (typeof (taskState.task as any).kill === 'function') {
        await (taskState.task as any).kill();
      } else if (typeof (taskState.task as any).stop === 'function') {
        await (taskState.task as any).stop();
      }
      
      setTaskStates(prev => ({
        ...prev,
        [taskName]: {
          ...prev[taskName],
          status: "STOPPED",
          isRunning: false,
          hasError: false
        }
      }));
    } catch (error) {
      console.error("Failed to stop task:", error);
    }
  };



  const getStatusColor = (status: string, hasError: boolean) => {
    // SDK task statuses: "RUNNING" | "FINISHED" | "ERROR" | "KILLED" | "RESTARTING" | "IDLE"
    if (hasError || status === "ERROR") return "text-red-600";
    if (status === "RUNNING" || status === "RESTARTING") return "text-blue-600";
    if (status === "FINISHED") return "text-green-600";
    if (status === "KILLED") return "text-orange-600";
    if (status === "IDLE") return "text-gray-500";
    return "text-gray-600";
  };

  const getStatusIcon = (status: string, hasError: boolean) => {
    // SDK task statuses: "RUNNING" | "FINISHED" | "ERROR" | "KILLED" | "RESTARTING" | "IDLE"
    if (hasError || status === "ERROR") return "❌";
    if (status === "RUNNING" || status === "RESTARTING") return "🔄";
    if (status === "FINISHED") return "✅";
    if (status === "KILLED") return "⏹️";
    if (status === "IDLE") return "⭕";
    return "❓";
  };

  useEffect(() => {
    if (terminalContainerRef.current && !terminalContainerRef.current.hasChildNodes()) {
      xterm.open(terminalContainerRef.current);
    }
  }, [xterm]);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Warning for missing demo tasks */}
      {availableTasks.length > 0 && !availableTasks.some(name => ['success-demo', 'fail-demo', 'long-demo', 'quick-test'].includes(name)) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-lg">⚠️</span>
            <div>
              <p className="text-yellow-800 font-medium">Custom demo tasks not found</p>
              <p className="text-yellow-700 text-sm mt-1">
                You're connected to a sandbox that doesn't include our custom demo tasks (success-demo, fail-demo, etc.). 
                <strong> Disconnect and create a new sandbox</strong> to see the full Tasks API demonstration.
              </p>
              <p className="text-yellow-600 text-xs mt-2">
                Found tasks: {availableTasks.join(', ') || 'none'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dependency warning */}
      {availableTasks.some(name => requiresDependencies(name)) && availableTasks.includes('install') && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 text-lg">💡</span>
            <div>
              <p className="text-blue-800 font-medium">Dependencies Required</p>
              <p className="text-blue-700 text-sm mt-1">
                Some tasks require npm packages to be installed first. If you see "command not found" errors, 
                <strong> run the "install" task</strong> to install dependencies.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Task Controls */}
      <div className="bg-slate-50 p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Available Tasks</h3>
          {!setupComplete && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-600 font-medium">⏳ Setup in progress</span>
              <button
                onClick={() => setSetupComplete(true)}
                className="text-xs px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded"
                title="Force enable all tasks"
              >
                Override
              </button>
            </div>
          )}
        </div>
        
        {availableTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No tasks found in your project's `.codesandbox/tasks.json` file.</p>
            <p className="text-sm mt-2">Add tasks to your configuration to see them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
            {availableTasks.map((taskName) => {
              const taskState = taskStates[taskName];
              const task = taskState?.task;
              const isSelected = selectedTask === taskName;
              const needsDeps = requiresDependencies(taskName);
              const isWaitingForSetup = needsDeps && !setupComplete;
              const isDisabled = taskState?.isRunning || isWaitingForSetup;
              const isInstall = isInstallTask(taskName);
              
              return (
                <button
                  key={taskName}
                  onClick={() => runTask(taskName)}
                  disabled={isDisabled}
                  className={`text-left p-2 rounded border transition-all ${
                    isInstall
                      ? "border-green-300 bg-green-50 hover:bg-green-100 ring-2 ring-green-200"
                      : isWaitingForSetup
                      ? "opacity-50 cursor-not-allowed border-orange-200 bg-orange-50"
                      : taskState?.isRunning 
                      ? "opacity-75 cursor-not-allowed border-blue-300 bg-blue-50" 
                      : isSelected
                      ? "border-blue-500 bg-blue-50 hover:bg-blue-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-xs truncate pr-1">{taskName}</span>
                    <span className="text-sm">
                      {getStatusIcon(taskState?.status || "IDLE", taskState?.hasError || false)}
                    </span>
                  </div>
                  
                  <div className={`text-xs font-mono mb-1 ${getStatusColor(taskState?.status || "IDLE", taskState?.hasError || false)}`}>
                    {taskState?.status || "IDLE"}
                  </div>
                  
                  <div className={`text-xs ${isInstall ? 'text-green-600 font-medium' : 'text-slate-500'}`}>
                    {isInstall
                      ? taskState?.isRunning 
                        ? "⏸️ Installing..."
                        : "📦 Install deps"
                      : isWaitingForSetup
                      ? "⏳ Waiting..."
                      : taskState?.isRunning 
                      ? "⏸️ Running..."
                      : "▶️ Run"
                    }
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Stop Button */}
        {selectedTask && taskStates[selectedTask]?.isRunning && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => stopTask(selectedTask)}
              className="px-6 py-2 rounded-lg text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              🛑 Stop {selectedTask}
            </button>
          </div>
        )}
      </div>

      {/* Terminal Output */}
      <div className="relative">
        <h3 className="font-bold text-lg mb-3">
          Terminal Output {selectedTask && `- ${selectedTask}`}
        </h3>
        <div
          ref={terminalContainerRef}
          className="w-full h-[500px] rounded-lg shadow-lg overflow-hidden border-2 transition-colors duration-200 bg-slate-900 border-slate-800"
        />
        {!selectedTask && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-90 rounded-lg mt-12">
            <p className="text-slate-300 text-center">
              Click any task above to run it and view its output
            </p>
          </div>
        )}
      </div>

      {/* API Usage Example */}
      <div className="bg-slate-50 p-4 rounded-lg border">
        <h4 className="font-bold text-base mb-2">Tasks API Usage</h4>
        <pre className="text-xs bg-slate-800 text-slate-100 p-3 rounded overflow-x-auto">
{`// Get a specific task
const task = session.tasks.getTask("build");

if (task) {
  console.log(\`Task: \${task.name}\`);
  console.log(\`Command: \${task.command}\`);
  // "RUNNING" | "FINISHED" | "ERROR" | "KILLED" | "RESTARTING" | "IDLE"
  console.log(\`Status: \${task.status}\`);
  console.log(\`Runs at start: \${task.runAtStart}\`);
  
  // Monitor status changes
  task.onStatusChange((status) => {
    console.log(\`Task status changed: \${status}\`);
  });
  
  // Control task execution
  await task.restart(); // Restart the task
  await task.stop();    // Stop the task
}`}
        </pre>
      </div>
    </div>
  );
}
