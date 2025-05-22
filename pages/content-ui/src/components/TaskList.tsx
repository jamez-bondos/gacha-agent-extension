import React from 'react';
import { Clipboard } from 'lucide-react';
import TaskCard from './TaskCard';
import { type ImageGenTask, AppStatus } from '@extension/shared/lib/types'; // Value import for AppStatus

interface TaskListProps {
  tasks: ImageGenTask[];
  currentTask?: ImageGenTask | null;
  appStatus: AppStatus;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  currentTask,
  appStatus,
}) => {
  const hasCompletedTasks = tasks.some(task => task.status === 'SUCCEEDED' || task.status === 'FAILED');

  if (tasks.length === 0) {
    return (
      <div className="h-full p-8 text-center bg-white shadow-sm rounded-lg border border-gray-200 flex flex-col justify-center items-center text-slate-600">
        <div className="flex justify-center items-center mb-6">
          <div className="p-5 bg-gray-100 rounded-lg">
            <Clipboard size={24} className="text-gray-400" />
          </div>
        </div>
        <p className="text-gray-500 text-md">填入提示词，设置参数，点击发送批量任务</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="h-full p-1 bg-white rounded-lg border border-gray-200 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
};

export default TaskList;
