import React, { useState } from 'react';
import { Layers, LayoutGrid } from 'lucide-react';
import { AppStatus } from '@extension/shared/lib/types';
import Tabs, { Tab } from './Tabs';
import { NumberInput } from './ui/number-input';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { Textarea } from './ui/textarea';

// Add custom CSS for input controls
const customStyles = `  
  textarea::-webkit-scrollbar-thumb {
    background-color: #cbd5e0;
    border-radius: 6px;
  }
  
  textarea::-webkit-scrollbar {
    width: 8px;
    background-color: white !important;
  }
`;

interface TaskFormProps {
  appStatus: AppStatus;
  onSubmit: (formData: { prompt: string; numTasks: number; imageQuantity: number; aspectRatio: string }) => void;
  onStop: () => void;
}

const ASPECT_RATIOS = ['3:2', '1:1', '2:3'];
const IMAGE_QUANTITIES = [1, 2, 4];

const TaskForm: React.FC<TaskFormProps> = ({ appStatus, onSubmit, onStop }) => {
  const [activeTab, setActiveTab] = React.useState('gacha');
  const [prompt, setPrompt] = useState('一则简约且富有创意的广告，设置在纯白背景上。');
  const [numTasks, setNumTasks] = useState(2);
  const [imageQuantity, setImageQuantity] = useState<number>(IMAGE_QUANTITIES[0]);
  const [aspectRatio, setAspectRatio] = useState<string>(ASPECT_RATIOS[1]); // 默认宽高比为1:1

  const handleFormSubmit = () => {
    if (!prompt.trim() || numTasks <= 0) {
      alert('Please enter a valid prompt and number of tasks.');
      return;
    }
    onSubmit({ prompt, numTasks, imageQuantity, aspectRatio });
  };

  const isIdle = appStatus === AppStatus.IDLE;
  const isRunning = appStatus === AppStatus.RUNNING;
  const isConfiguring = appStatus === AppStatus.CONFIGURING; // Assuming CONFIGURING exists

  const formDisabled = isRunning || isConfiguring;

  const tabs: Tab[] = [
    {
      id: 'gacha',
      label: '抽卡模式',
      icon: LayoutGrid,
    }
  ];

  return (
    <>
      {/* Inject custom styles */}
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

        <form
          className="p-4"
          onSubmit={e => {
            e.preventDefault();
            e.stopPropagation(); // 防止事件冒泡
            handleFormSubmit();
          }}>
          <div className="mb-4">
            <label htmlFor="prompt" className="block text-sm font-medium mb-1 flex items-center">
              <span className="text-red-500 mr-1">*</span> 提示词 (Prompt)
            </label>
            <Textarea
              id="prompt"
              rows={4}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="输入提示词..."
              disabled={formDisabled}
              className="resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="numTasks" className="block text-sm font-medium mb-1 flex items-center">
                <span className="text-red-500 mr-1">*</span> 抽卡次数
              </label>
              <NumberInput
                id="numTasks"
                value={numTasks}
                onChange={setNumTasks}
                min={1}
                max={100}
                disabled={formDisabled}
              />
            </div>
            <div>
              <label htmlFor="aspectRatio" className="block text-sm font-medium mb-1">
                宽高比
              </label>
              <Select
                id="aspectRatio"
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
                disabled={formDisabled}
              >
                {ASPECT_RATIOS.map(ratio => (
                  <option key={ratio} value={ratio}>
                    {ratio}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-6">
            {isIdle || isConfiguring ? (
              <Button
                type="submit"
                disabled={!prompt.trim() || numTasks <= 0 || formDisabled}
                className="w-full py-3 text-base bg-blue-500 hover:bg-blue-600 text-white font-medium"
                size="lg"
              >
                <Layers size={20} className="mr-2" />
                发送批量任务
              </Button>
            ) : (
              <div className="flex space-x-3">
                <Button
                  type="button"
                  onClick={onStop}
                  variant="destructive"
                  className="flex-1 py-3 text-base bg-red-500 hover:bg-red-600 text-white font-medium"
                  disabled={isConfiguring}
                >
                  停止
                </Button>
              </div>
            )}
          </div>
        </form>
      </div>
    </>
  );
};

export default TaskForm;
