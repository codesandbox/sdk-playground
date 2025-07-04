import { useEffect, useRef, useState } from "react";
import { Task, SandboxClient } from "@codesandbox/sdk/browser";

import "../node_modules/@xterm/xterm/css/xterm.css";
import { useXTerm } from "./useXTerm";

interface TaskState {
  task: Task | null;
  status: string;
  isRunning: boolean;
  hasError: boolean;
  output: string;
}

export function TasksComponent({ session }: { session: SandboxClient }) {
  const [availableTasks, setAvailableTasks] = useState<string[]>([]);
  const [taskStates, setTaskStates] = useState<{ [key: string]: TaskState }>({});
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const xterm = useXTerm(terminalContainerRef);

  // Helper functions (defined before useEffect to avoid reference errors)
  const requiresDependencies = (taskName: string) => {
    // Tasks that need npm dependencies to be installed first
    return ['dev', 'build', 'lint', 'preview', 'server'].includes(taskName);
  };

  const isInstallTask = (taskName: string) => {
    return taskName === 'install';
  };

  const isDemoTask = (taskName: string) => {
    return ['success-demo', 'fail-demo', 'long-demo', 'quick-test', 'port-demo'].includes(taskName);
  };

  useEffect(() => {
    console.log("🔍 Debugging Tasks API:", session.tasks);
    console.log("🔍 Available properties:", Object.keys(session.tasks));
    console.log("🔍 Available methods:", Object.getOwnPropertyNames(session.tasks));
    console.log("🔍 Prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(session.tasks)));
    
    // Use official SDK method to get all tasks
    let allTasks: any[] = [];
    
    // Use the official SDK methods as per documentation
    try {
      // Try the official client.tasks.getAll() method first
      if (typeof (session.tasks as any).getAll === 'function') {
        allTasks = (session.tasks as any).getAll();
        console.log("✅ Found tasks via session.tasks.getAll():", allTasks);
      } else {
        console.log("❌ session.tasks.getAll() method not available");
        console.log("🔍 Available methods on session.tasks:", Object.getOwnPropertyNames(session.tasks));
        console.log("🔍 session.tasks object:", session.tasks);
        
        // Fallback: try to find tasks by checking known task names from our config
        const possibleTaskNames = [
          "install", "dev", "build", "server", "lint", "preview", 
          "success-demo", "fail-demo", "long-demo", "quick-test", "port-demo"
        ];
        
        // Try session.tasks.get() for each task
        if (typeof (session.tasks as any).get === 'function') {
          allTasks = possibleTaskNames.map(name => {
            try {
              const task = (session.tasks as any).get(name);
              if (task) {
                console.log(`✅ Found task "${name}":`, task);
                return task;
              }
              return null;
            } catch (error) {
              console.log(`❌ Error getting task "${name}":`, error);
              return null;
            }
          }).filter(Boolean);
          console.log("✅ Found tasks via individual session.tasks.get():", allTasks);
        } else {
          console.log("❌ session.tasks.get() method also not available");
        }
      }
    } catch (error) {
      console.error("❌ Error accessing tasks:", error);
    }

    // Remove duplicates and log results
    const uniqueTasks = Array.from(new Map(allTasks.map(task => [task.name, task])).values());
    const foundTaskNames = uniqueTasks.map((task: any) => task.name || 'unnamed');
    
    // Sort tasks: install first, then dependency tasks, then demo tasks, then others
    const sortedTaskNames = foundTaskNames.sort((a, b) => {
      // Priority order: install > dependency tasks > demo tasks > others
      const getTaskPriority = (taskName: string) => {
        if (isInstallTask(taskName)) return 1;
        if (requiresDependencies(taskName)) return 2;
        if (isDemoTask(taskName)) return 3;
        return 4;
      };
      
      const aPriority = getTaskPriority(a);
      const bPriority = getTaskPriority(b);
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Within same priority, sort alphabetically
      return a.localeCompare(b);
    });
    
    console.log("📋 Final sorted task names:", sortedTaskNames);
    setAvailableTasks(sortedTaskNames);

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

  }, [session.tasks]);

  const runTask = async (taskName: string) => {
    const taskState = taskStates[taskName];
    if (!taskState?.task) return;

    // Automatically select this task for output display
    setSelectedTask(taskName);

    const task = taskState.task;
    
    console.log(`🚀 Starting task "${taskName}"`);
    console.log(`📊 task.status before run:`, task.status);

    try {
      // Use official SDK methods as per documentation
      if (task.status === "RUNNING") {
        console.log(`🔄 Task "${taskName}" is already running, restarting...`);
        await task.restart();
      } else {
        console.log(`▶️ Starting task "${taskName}"...`);
        await task.run();
      }
      
      console.log(`📊 task.status after run:`, task.status);
      
      // Set up output listener using task.open() and task.onOutput() as documented
      if (typeof task.open === 'function' && typeof task.onOutput === 'function') {
        console.log(`📺 Opening shell for task "${taskName}"`);
        
        // Output will not be emitted until you open the task
        task.onOutput((output: string) => {
          console.log(`📝 Output from "${taskName}":`, output);
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
        
        // Get initial output
        const initialOutput = await task.open();
        console.log(`📋 Initial output from "${taskName}":`, initialOutput);
        
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
      }
      
      // Special handling for port-demo task - demonstrate waitForPort
      if (taskName === "port-demo") {
        console.log(`🔌 Waiting for port to open for task "${taskName}"`);
        try {
          const port = await task.waitForPort();
          const portUrl = session.hosts.getUrl(port.port);
          console.log(`✅ Port opened! Preview available at: ${portUrl}`);
          xterm.write(`\r\n✅ Port opened! Preview available at: ${portUrl}\r\n`);
        } catch (error) {
          console.log(`❌ Failed to wait for port:`, error);
          xterm.write(`\r\n❌ Failed to wait for port: ${error}\r\n`);
        }
      }

    } catch (error) {
      console.error(`Failed to run task ${taskName}:`, error);
      xterm.write(`\r\n❌ Failed to run task: ${error}\r\n`);
    }
  };

  const stopTask = async (taskName: string) => {
    const taskState = taskStates[taskName];
    if (!taskState?.task) return;

    try {
      // Use official SDK method as per documentation
      console.log(`🛑 Stopping task "${taskName}"`);
      await taskState.task.stop();
      
      setTaskStates(prev => ({
        ...prev,
        [taskName]: {
          ...prev[taskName],
          status: "KILLED",
          isRunning: false,
          hasError: false
        }
      }));
      
      console.log(`✅ Task "${taskName}" stopped successfully`);
    } catch (error) {
      console.error(`Failed to stop task ${taskName}:`, error);
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
      {availableTasks.length > 0 && !availableTasks.some(name => ['success-demo', 'fail-demo', 'long-demo', 'quick-test', 'port-demo'].includes(name)) && (
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

      {/* Task Controls */}
      <div className="bg-slate-50 p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Available Tasks</h3>
        </div>
        
        {availableTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No tasks found in your project's `.codesandbox/tasks.json` file.</p>
            <p className="text-sm mt-2">Add tasks to your configuration to see them here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Install Tasks Section */}
            {availableTasks.some(name => isInstallTask(name)) && (
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2">📦 Setup</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {availableTasks.filter(name => isInstallTask(name)).map((taskName) => {
                    const taskState = taskStates[taskName];
                    const isSelected = selectedTask === taskName;
                    const isDisabled = taskState?.isRunning;
                    
                    return (
                      <button
                        key={taskName}
                        onClick={() => runTask(taskName)}
                        disabled={isDisabled}
                        className={`text-left p-2 rounded border transition-all border-green-300 bg-green-50 hover:bg-green-100 ring-2 ring-green-200 ${
                          isSelected ? "ring-4 ring-green-400" : ""
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
                        
                        <div className="text-xs text-green-600 font-medium">
                          {taskState?.isRunning ? "⏸️ Installing..." : "📦 Install deps"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dependency Tasks Section */}
            {availableTasks.some(name => requiresDependencies(name)) && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">🔧 Development Tasks</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {availableTasks.filter(name => requiresDependencies(name)).map((taskName) => {
                    const taskState = taskStates[taskName];
                    const isSelected = selectedTask === taskName;
                    const isDisabled = taskState?.isRunning;
                    
                    return (
                      <button
                        key={taskName}
                        onClick={() => runTask(taskName)}
                        disabled={isDisabled}
                        className={`text-left p-2 rounded border transition-all ${
                          taskState?.isRunning 
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
                        
                        <div className="text-xs text-slate-500">
                          {taskState?.isRunning ? "⏸️ Running..." : "▶️ Run"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Demo Tasks Section */}
            {availableTasks.some(name => isDemoTask(name)) && (
              <div>
                <h4 className="text-sm font-medium text-purple-700 mb-2">🎯 Demo Tasks</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {availableTasks.filter(name => isDemoTask(name)).map((taskName) => {
                    const taskState = taskStates[taskName];
                    const isSelected = selectedTask === taskName;
                    const isDisabled = taskState?.isRunning;
                    
                    return (
                      <button
                        key={taskName}
                        onClick={() => runTask(taskName)}
                        disabled={isDisabled}
                        className={`text-left p-2 rounded border transition-all ${
                          taskState?.isRunning 
                            ? "opacity-75 cursor-not-allowed border-blue-300 bg-blue-50" 
                            : isSelected
                            ? "border-blue-500 bg-blue-50 hover:bg-blue-100"
                            : "border-purple-200 bg-purple-50 hover:border-purple-300 hover:bg-purple-100"
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
                        
                        <div className="text-xs text-purple-600">
                          {taskState?.isRunning ? "⏸️ Running..." : "▶️ Run"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other Tasks Section */}
            {availableTasks.some(name => !isInstallTask(name) && !requiresDependencies(name) && !isDemoTask(name)) && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">📋 Other Tasks</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {availableTasks.filter(name => !isInstallTask(name) && !requiresDependencies(name) && !isDemoTask(name)).map((taskName) => {
                    const taskState = taskStates[taskName];
                    const isSelected = selectedTask === taskName;
                    const isDisabled = taskState?.isRunning;
                    
                    return (
                      <button
                        key={taskName}
                        onClick={() => runTask(taskName)}
                        disabled={isDisabled}
                        className={`text-left p-2 rounded border transition-all ${
                          taskState?.isRunning 
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
                        
                        <div className="text-xs text-slate-500">
                          {taskState?.isRunning ? "⏸️ Running..." : "▶️ Run"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
        <h4 className="font-bold text-base mb-2">Tasks API Usage (Official SDK)</h4>
        <pre className="text-xs bg-slate-800 text-slate-100 p-3 rounded overflow-x-auto">
{`// Get all tasks
const tasks = client.tasks.getAll();
for (const task of tasks) {
  console.log(\`Task: \${task.name} (\${task.command})\`);
}

// Get a specific task
const task = client.tasks.get("build");

if (task) {
  console.log(\`Task: \${task.name}\`);
  console.log(\`Command: \${task.command}\`);
  // "RUNNING" | "FINISHED" | "ERROR" | "KILLED" | "RESTARTING" | "IDLE"
  console.log(\`Status: \${task.status}\`);
  console.log(\`Runs at start: \${task.runAtStart}\`);
  
  // Control task execution
  await task.run();     // Run the task
  await task.restart(); // Restart if already running
  await task.stop();    // Stop the task
  
  // Open shell and listen for output
  task.onOutput((output) => {
    console.log(output);
  });
  const output = await task.open();
  
  // Wait for port to open (if task opens a port)
  const port = await task.waitForPort();
  console.log(\`Preview available at: \${port.host}\`);
}`}
        </pre>
        <div className="mt-3 text-xs text-slate-600">
          <strong>📚 Reference:</strong> <a href="https://codesandbox.io/docs/sdk/tasks" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">CodeSandbox SDK Tasks Documentation</a>
        </div>
      </div>
    </div>
  );
}
