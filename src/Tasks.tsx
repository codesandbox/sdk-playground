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

  // Custom tasks for demonstration
  const [customTasks] = useState([
    { name: "success-task", command: "echo 'Task completed successfully!' && sleep 2 && echo 'All done!'" },
    { name: "fail-task", command: "echo 'Starting task...' && sleep 1 && echo 'Something went wrong!' && exit 1" },
    { name: "long-task", command: "for i in {1..10}; do echo \"Step $i of 10\"; sleep 1; done && echo 'Long task completed!'" },
  ]);

  // Pre-defined task names from tasks.json
  const predefinedTasks = ["dev", "build", "server", "lint", "preview"];

  useEffect(() => {
    // Check which predefined tasks exist and add our custom demonstration tasks
    const existingTaskNames = predefinedTasks.filter(name => {
      const task = session.tasks.getTask(name);
      return task !== undefined;
    });
    const allTaskNames = [...existingTaskNames, ...customTasks.map(t => t.name)];
    setAvailableTasks(allTaskNames);

    // Initialize task states
    const initialStates: { [key: string]: TaskState } = {};
    allTaskNames.forEach(name => {
      const existingTask = session.tasks.getTask(name);
      initialStates[name] = {
        task: existingTask || null,
        status: existingTask?.status || "IDLE",
        isRunning: existingTask?.status === "RUNNING",
        hasError: false,
        output: ""
      };
    });
    setTaskStates(initialStates);

    // Set up listeners for existing tasks
    existingTaskNames.forEach(name => {
      const task = session.tasks.getTask(name);
      if (task) {
        task.onStatusChange((status: string) => {
          setTaskStates(prev => ({
            ...prev,
            [name]: {
              ...prev[name],
              status,
              isRunning: status === "RUNNING",
              hasError: status === "FAILED" || status === "ERROR"
            }
          }));
        });
      }
    });
  }, [session.tasks, customTasks]);

  const runCustomTask = async (taskName: string, command: string) => {
    try {
      setTaskStates(prev => ({
        ...prev,
        [taskName]: {
          ...prev[taskName],
          status: "STARTING",
          isRunning: true,
          hasError: false,
          output: ""
        }
      }));

      // Run command using the session's command API
      const result = await session.commands.runBackground(command);
      
      const newTaskState: TaskState = {
        task: result as any, // The command result can be treated as a task-like object
        status: "RUNNING",
        isRunning: true,
        hasError: false,
        output: ""
      };

      setTaskStates(prev => ({
        ...prev,
        [taskName]: newTaskState
      }));

      // Listen for output
      result.onOutput((output: string) => {
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

    } catch (error) {
      setTaskStates(prev => ({
        ...prev,
        [taskName]: {
          ...prev[taskName],
          status: "FAILED",
          isRunning: false,
          hasError: true,
          output: prev[taskName].output + `\nError: ${error}`
        }
      }));
    }
  };

  const runExistingTask = async (taskName: string) => {
    const task = session.tasks.getTask(taskName);
    if (!task) return;

    try {
      await task.restart();
      
      setTaskStates(prev => ({
        ...prev,
        [taskName]: {
          ...prev[taskName],
          task,
          status: task.status,
          isRunning: task.status === "RUNNING",
          hasError: false
        }
      }));

    } catch (error) {
      setTaskStates(prev => ({
        ...prev,
        [taskName]: {
          ...prev[taskName],
          status: "FAILED",
          isRunning: false,
          hasError: true
        }
      }));
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
    if (hasError || status === "FAILED" || status === "ERROR") return "text-red-600";
    if (status === "RUNNING" || status === "STARTING") return "text-blue-600";
    if (status === "SUCCESS" || status === "COMPLETED") return "text-green-600";
    if (status === "STOPPED") return "text-orange-600";
    return "text-gray-600";
  };

  const getStatusIcon = (status: string, hasError: boolean) => {
    if (hasError || status === "FAILED" || status === "ERROR") return "❌";
    if (status === "RUNNING" || status === "STARTING") return "🔄";
    if (status === "SUCCESS" || status === "COMPLETED") return "✅";
    if (status === "STOPPED") return "⏹️";
    return "⭕";
  };

  useEffect(() => {
    if (terminalContainerRef.current && !terminalContainerRef.current.hasChildNodes()) {
      xterm.open(terminalContainerRef.current);
    }
  }, [xterm]);

  // Check if there are any existing project tasks
  const hasProjectTasks = predefinedTasks.some(name => session.tasks.getTask(name) !== undefined);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Task Status Overview */}
      <div className="bg-slate-50 p-4 rounded-lg border">
        <h3 className="font-bold text-lg mb-4">Tasks Status Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {availableTasks.map((taskName) => {
            const taskState = taskStates[taskName];
            const isCustomTask = customTasks.some(ct => ct.name === taskName);
            
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
                {isCustomTask && (
                  <div className="text-xs text-slate-500 mt-1">Custom Demo Task</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-row gap-8 items-start w-full flex-wrap lg:flex-nowrap">
        {/* Left: Task Controls */}
        <div className="flex flex-col gap-3 min-w-[220px] w-full max-w-sm">
          <h4 className="font-bold text-base">Task Controls</h4>
          
          {/* Custom Demo Tasks */}
          <div className="space-y-2">
            <h5 className="font-medium text-sm text-slate-700">Demo Tasks:</h5>
            {customTasks.map((customTask) => (
              <button
                key={customTask.name}
                onClick={() => runCustomTask(customTask.name, customTask.command)}
                disabled={taskStates[customTask.name]?.isRunning}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  customTask.name.includes('success') 
                    ? "bg-green-100 hover:bg-green-200 text-green-800" 
                    : customTask.name.includes('fail')
                    ? "bg-red-100 hover:bg-red-200 text-red-800"
                    : "bg-blue-100 hover:bg-blue-200 text-blue-800"
                } ${taskStates[customTask.name]?.isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {taskStates[customTask.name]?.isRunning ? "Running..." : `Run ${customTask.name}`}
              </button>
            ))}
          </div>

          {/* Existing Tasks */}
          {hasProjectTasks && (
            <div className="space-y-2">
              <h5 className="font-medium text-sm text-slate-700">Project Tasks:</h5>
              {predefinedTasks.filter(name => session.tasks.getTask(name) !== undefined).map((taskName) => (
                <button
                  key={taskName}
                  onClick={() => runExistingTask(taskName)}
                  disabled={taskStates[taskName]?.isRunning}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors bg-slate-100 hover:bg-slate-200 text-slate-800 ${
                    taskStates[taskName]?.isRunning ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {taskStates[taskName]?.isRunning ? "Running..." : `Run ${taskName}`}
                </button>
              ))}
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
const task = session.tasks.getTask("taskName");

// Monitor task status
task.onStatusChange((status) => {
  console.log(\`Task status: \${status}\`);
});

// Control task execution
await task.restart(); // Restart the task
await task.stop();    // Stop the task

// Get task output
const output = await task.open();
task.onOutput((output) => {
  console.log(output);
});`}
        </pre>
      </div>
    </div>
  );
}
