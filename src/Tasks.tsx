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

    const task = taskState.task;

    try {
      // Use the proper task.restart() method from the docs
      await task.restart();
      
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

        if (selectedTask === taskName) {
          xterm.clear();
          xterm.write(initialOutput || "");
        }

        // Listen for new output
        task.onOutput((output: string) => {
          setTaskStates(prev => ({
            ...prev,
            [taskName]: {
              ...prev[taskName],
              output: prev[taskName].output + output
            }
          }));

          if (selectedTask === taskName) {
            xterm.write(output);
          }
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

  const selectTask = (taskName: string) => {
    setSelectedTask(taskName);
    const taskState = taskStates[taskName];
    
    xterm.clear();
    if (taskState?.output) {
      xterm.write(taskState.output);
    }

    // If task exists and is running, connect to its output
    if (taskState?.task && taskState.isRunning) {
      if (typeof (taskState.task as any).open === 'function') {
        (taskState.task as any).open().then((output: string) => {
          xterm.write(output);
        });
      }
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
      {/* Task Status Overview */}
      <div className="bg-slate-50 p-4 rounded-lg border">
        <h3 className="font-bold text-lg mb-4">Tasks Status Overview</h3>
        {availableTasks.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p>No tasks found in your project's `.codesandbox/tasks.json` file.</p>
            <p className="text-sm mt-2">Add tasks to your configuration to see them here.</p>
          </div>
        ) : !availableTasks.some(name => ['success-demo', 'fail-demo', 'long-demo', 'quick-test'].includes(name)) ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableTasks.map((taskName) => {
              const taskState = taskStates[taskName];
              const task = taskState?.task;
              
              return (
                <div
                  key={taskName}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedTask === taskName 
                      ? "border-blue-500 bg-blue-50" 
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                  onClick={() => selectTask(taskName)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{taskName}</span>
                    <span className="text-lg">
                      {getStatusIcon(taskState?.status || "IDLE", taskState?.hasError || false)}
                    </span>
                  </div>
                  <div className={`text-xs font-mono ${getStatusColor(taskState?.status || "IDLE", taskState?.hasError || false)}`}>
                    {taskState?.status || "IDLE"}
                  </div>
                  {task?.command && (
                    <div className="text-xs text-slate-500 mt-1 truncate" title={task.command}>
                      {task.command}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-row gap-8 items-start w-full flex-wrap lg:flex-nowrap">
        {/* Left: Task Controls */}
        <div className="flex flex-col gap-3 min-w-[220px] w-full max-w-sm">
          <h4 className="font-bold text-base">Task Controls</h4>
          
          {availableTasks.length === 0 ? (
            <div className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
              No tasks available. Add tasks to your `.codesandbox/tasks.json` file to get started.
            </div>
          ) : (
            <div className="space-y-2">
              <h5 className="font-medium text-sm text-slate-700">Available Tasks:</h5>
              {availableTasks.map((taskName) => {
                const taskState = taskStates[taskName];
                const task = taskState?.task;
                
                return (
                  <button
                    key={taskName}
                    onClick={() => runTask(taskName)}
                    disabled={taskState?.isRunning}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors bg-slate-100 hover:bg-slate-200 text-slate-800 ${
                      taskState?.isRunning ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{taskState?.isRunning ? "Running..." : `Run ${taskName}`}</span>
                      <span className="text-xs opacity-60">
                        {getStatusIcon(taskState?.status || "IDLE", taskState?.hasError || false)}
                      </span>
                    </div>
                    {task?.command && (
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        {task.command}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Stop Button */}
          {selectedTask && taskStates[selectedTask]?.isRunning && (
            <button
              onClick={() => stopTask(selectedTask)}
              className="w-full px-3 py-2 rounded-md text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
            >
              Stop {selectedTask}
            </button>
          )}

          {/* Selected Task Info */}
          {selectedTask && (
            <div className="mt-4 p-3 bg-slate-100 rounded-lg">
              <h5 className="font-medium text-sm mb-2">Selected Task:</h5>
              <div className="text-sm text-slate-700">
                <div><strong>Name:</strong> {selectedTask}</div>
                <div className="flex items-center gap-2">
                  <strong>Status:</strong> 
                  <span className={getStatusColor(taskStates[selectedTask]?.status || "IDLE", taskStates[selectedTask]?.hasError || false)}>
                    {getStatusIcon(taskStates[selectedTask]?.status || "IDLE", taskStates[selectedTask]?.hasError || false)} 
                    {taskStates[selectedTask]?.status || "IDLE"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Terminal Output */}
        <div className="flex-1 min-w-0 relative">
          <h4 className="font-bold text-base mb-3">Task Output {selectedTask && `(${selectedTask})`}</h4>
          <div
            ref={terminalContainerRef}
            className="w-full h-80 rounded-lg shadow-lg overflow-hidden border-2 transition-colors duration-200 bg-slate-900 border-slate-800"
          />
          {!selectedTask && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 bg-opacity-90 rounded-lg">
              <p className="text-slate-300 text-center">
                Select a task from the status overview above to view its output
              </p>
            </div>
          )}
        </div>
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
