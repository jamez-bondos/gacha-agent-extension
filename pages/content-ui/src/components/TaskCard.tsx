import React from 'react';
import type { ImageGenTask } from '@extension/shared/lib/types';

interface TaskCardProps {
  task: ImageGenTask;
  // onCancel?: (taskId: string) => void; // Add if cancel button per card is needed
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  let statusColor = 'bg-gray-100 text-gray-600';
  let statusText = 'Pending';
  let borderColor = 'border-gray-300';

  switch (task.status) {
    case 'SUBMITTING_TO_PAGE':
    case 'IN_PROGRESS':
      statusColor = 'bg-blue-100 text-blue-700';
      statusText =
        task.status === 'IN_PROGRESS' ? `In Progress${task.progress ? ' (' + task.progress + '%)' : ''}` : 'Submitting';
      borderColor = 'border-blue-500';
      break;
    case 'SUCCEEDED':
      statusColor = 'bg-green-100 text-green-700';
      statusText = 'Succeeded';
      borderColor = 'border-green-500';
      break;
    case 'FAILED':
      statusColor = 'bg-red-100 text-red-700';
      statusText = 'Failed';
      borderColor = 'border-red-500';
      break;
    case 'PENDING':
      // Default styles are already set for PENDING
      break;
  }

  return (
    <div
      className={`p-3 mb-2 rounded-md shadow-sm border-l-4 ${borderColor} bg-white flex flex-col space-y-2 text-slate-800`}>
      <div className="flex justify-between items-center w-full">
        <div className="flex items-center">
          <span className="font-semibold text-sm text-slate-600 mr-3">#{task.originalIndex}</span>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColor}`}>{statusText}</span>
        </div>
        <div className="text-sm text-slate-500">
          <span>{task.aspectRatio}</span>
        </div>
      </div>

      {/* Display Prompt */}
      {task.prompt && (
        <div className="mt-1">
          <p
            className="text-xs text-slate-600 bg-gray-50 p-2 rounded truncate"
            title={task.prompt}>
            {task.prompt}
          </p>
        </div>
      )}

      {/* Display Error if Failed */}
      {task.status === 'FAILED' && task.error && (
        <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded">
          <p className="text-xs text-red-700">
            <span className="font-semibold">Error:</span> {task.error}
          </p>
        </div>
      )}
    </div>
  );
};

export default TaskCard;
