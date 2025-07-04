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

  // Helper functions
  const requiresDependencies = (taskName: string) => {
    return ['dev', 'build', 'lint', 'server'].includes(taskName);
  };

  const isDemoTask = (taskName: string) => {
    return ['success-demo', 'fail-demo', 'long-demo'].includes(taskName);
  };

  useEffect(() => {
    console.log("🔍 Loading tasks using official SDK Tasks API...");
    
    (async () => {
      try {
        // Use the official SDK Tasks API as documented
        console.log("📋 Calling client.tasks.getAll()...");
        const allTasks = await session.tasks.getAll();
        console.log("✅ Successfully retrieved tasks:", allTasks);
        
        if (allTasks.length === 0) {
          console.log("⚠️  No tasks found. Make sure .codesandbox/tasks.json exists with task definitions.");
          setAvailableTasks([]);
          return;
        }

        // Extract task names and sort them
        const foundTaskNames = allTasks.map((task: Task) => task.id);
        console.log("📝 Found task names:", foundTaskNames);
        
        // Sort tasks: demo tasks first, then dependency tasks, then others
        const sortedTaskNames = foundTaskNames.sort((a, b) => {
          const getTaskPriority = (taskName: string) => {
            if (isDemoTask(taskName)) return 1;
            if (requiresDependencies(taskName)) return 2;
            return 3;
          };
          
          const aPriority = getTaskPriority(a);
          const bPriority = getTaskPriority(b);
          
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
          
          return a.localeCompare(b);
        });
        
        console.log("📋 Final sorted task names:", sortedTaskNames);
        setAvailableTasks(sortedTaskNames);

        // Initialize task states
        const initialStates: { [key: string]: TaskState } = {};
        allTasks.forEach((task: Task) => {
          console.log(`🎯 Setting up task: ${task.id}`, {
            name: task.name,
            command: task.command,
            status: task.status,
            runAtStart: task.runAtStart
          });
          
          initialStates[task.id] = {
            task: task,
            status: task.status,
            isRunning: task.status === "RUNNING" || task.status === "RESTARTING",
            hasError: task.status === "ERROR",
            output: ""
          };

          // Set up status change listeners for each task
          if (typeof task.onStatusChange === 'function') {
            task.onStatusChange((status: string) => {
              console.log(`🔄 Task ${task.id} status changed:`, status);
              setTaskStates(prev => ({
                ...prev,
                [task.id]: {
                  ...prev[task.id],
                  status,
                  isRunning: status === "RUNNING" || status === "RESTARTING",
                  hasError: status === "ERROR"
                }
              }));
            });
          }
        });
        
        setTaskStates(initialStates);
        
      } catch (error) {
        console.error("❌ Error loading tasks:", error);
        setAvailableTasks([]);
      }
    })();

  }, [session]);

  const runTask = async (taskName: string) => {
    const taskState = taskStates[taskName];
    if (!taskState?.task) {
      console.error(`Task "${taskName}" not found in taskStates`);
      return;
    }

    // Automatically select this task for output display
    setSelectedTask(taskName);

    const task = taskState.task;
    
    console.log(`🚀 Starting task "${taskName}"`);
    console.log(`📊 Current task status:`, task.status);

    try {
      // Use official SDK methods as per documentation
      if (task.status === "RUNNING") {
        console.log(`🔄 Task "${taskName}" is already running, restarting...`);
        await task.restart();
      } else {
        console.log(`▶️ Starting task "${taskName}"...`);
        await task.run();
      }
      
      console.log(`📊 Task status after run:`, task.status);
      
      // Set up output listener using task.onOutput() and task.open() as documented
      if (typeof task.onOutput === 'function' && typeof task.open === 'function') {
        console.log(`📺 Setting up output listener for task "${taskName}"`);
        
        // Set up output listener first
        task.onOutput((output: string) => {
          console.log(`📝 Output from "${taskName}":`, output);
          setTaskStates(prev => ({
            ...prev,
            [taskName]: {
              ...prev[taskName],
              output: prev[taskName].output + output
            }
          }));

          // Write to terminal
          xterm.write(output);
        });
        
        // Open the task to get initial output and start streaming
        const initialOutput = await task.open();
        console.log(`📋 Initial output from "${taskName}":`, initialOutput);
        
        setTaskStates(prev => ({
          ...prev,
          [taskName]: {
            ...prev[taskName],
            output: initialOutput || ""
          }
        }));

        // Clear terminal and show output
        xterm.clear();
        if (initialOutput) {
          xterm.write(initialOutput);
        }
      }
      
      // Special handling for tasks that might open ports
      if (taskName === "server" && typeof task.waitForPort === 'function') {
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
    if (hasError || status === "ERROR") return "text-red-600";
    if (status === "RUNNING" || status === "RESTARTING") return "text-blue-600";
    if (status === "FINISHED") return "text-green-600";
    if (status === "KILLED") return "text-orange-600";
    if (status === "IDLE") return "text-gray-500";
    return "text-gray-600";
  };

  const getStatusIcon = (status: string, hasError: boolean) => {
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
      {/* Task Controls */}
      <div className="bg-slate-50 p-4 rounded-lg border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">Available Tasks</h3>
          <span className="text-sm text-slate-600">
            {availableTasks.length} task{availableTasks.length !== 1 ? 's' : ''} found
          </span>
        </div>
        
        {availableTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No tasks found in your sandbox.</p>
            <p className="text-sm mt-2">Tasks are defined in `.codesandbox/tasks.json`</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Demo Tasks */}
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

            {/* Development Tasks */}
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

            {/* Other Tasks */}
            {availableTasks.some(name => !requiresDependencies(name) && !isDemoTask(name)) && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">📋 Other Tasks</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                  {availableTasks.filter(name => !requiresDependencies(name) && !isDemoTask(name)).map((taskName) => {
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
        <h4 className="font-bold text-base mb-2">Tasks API Usage (SDK 2.0.2)</h4>
        <pre className="text-xs bg-slate-800 text-slate-100 p-3 rounded overflow-x-auto">
{`// Get all tasks (from official documentation)
const tasks = await client.tasks.getAll();
for (const task of tasks) {
  console.log(\`Task: \${task.name} (\${task.command})\`);
}

// Get and run a specific task
const task = client.tasks.get("dev");
if (task) {
  // Run the task
  await task.run();
  
  // Listen for output
  task.onOutput((output) => console.log(output));
  const initialOutput = await task.open();
  
  // Wait for ports (if task opens one)
  const port = await task.waitForPort();
  console.log(\`Preview: \${port.host}\`);
  
  // Stop the task
  await task.stop();
}`}
        </pre>
      </div>
    </div>
  );
}
