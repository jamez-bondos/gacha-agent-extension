import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Info, Twitter, Github } from 'lucide-react';
import { NumberInput } from './ui/number-input'
import { appSettingsStorage } from '../lib/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskDelayChange: (delay: number) => void;
  taskProcessingDelay: number;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onTaskDelayChange, taskProcessingDelay }) => {
  const [taskDelay, setTaskDelay] = useState(taskProcessingDelay);
  const [activeTab, setActiveTab] = useState<'general' | 'about'>('general');
  const [version, setVersion] = useState<string>('0.0.1');

  useEffect(() => {
    setTaskDelay(taskProcessingDelay);
  }, [taskProcessingDelay, isOpen]);

  useEffect(() => {
    // Get extension version
    const manifestData = chrome.runtime.getManifest();
    setVersion(manifestData.version);
    
    // Load saved settings when modal opens
    if (isOpen) {
      appSettingsStorage.getSettings().then(appSettings => {
        setTaskDelay(appSettings.settings.general.delay);
        onTaskDelayChange(appSettings.settings.general.delay);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTaskDelayChange = async (value: number) => {
    setTaskDelay(value);
    onTaskDelayChange(value);
    await appSettingsStorage.updateGeneralDelay(value);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50 p-4 text-slate-800"
      onClick={onClose}>
      <div
        className="bg-white p-6 rounded-lg shadow-md w-full max-w-md relative transform transition-all duration-300 ease-out scale-100 opacity-100"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">设置</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 p-1 rounded-full hover:bg-slate-100"
            aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex rounded-full bg-gray-100 p-1 mb-6">
          <button
            className={`flex-1 rounded-full py-2 px-4 text-sm font-medium flex items-center justify-center transition-colors ${
              activeTab === 'general' ? 'bg-white text-blue-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('general')}>
            <SettingsIcon size={16} className="mr-2" />
            通用
          </button>
          <button
            className={`flex-1 rounded-full py-2 px-4 text-sm font-medium flex items-center justify-center transition-colors ${
              activeTab === 'about' ? 'bg-white text-blue-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('about')}>
            <Info size={16} className="mr-2" />
            关于
          </button>
        </div>

        {/* Tab Content Container - Fixed height for both tabs */}
        <div className="h-[200px]">
          {/* General Tab */}
          <div className={`h-full ${activeTab === 'general' ? 'block' : 'hidden'}`}>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="taskDelay" className="text-sm font-medium text-slate-700 flex items-center">
                    <span>任务延时 (秒)</span>
                  </label>
                  <div className="w-36">
                    <NumberInput
                      id="taskDelay"
                      value={taskDelay}
                      onChange={handleTaskDelayChange}
                      min={1}
                      max={10}
                      disabled={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* About Tab */}
          <div
            className={`h-full flex flex-col items-center justify-center ${activeTab === 'about' ? 'block' : 'hidden'}`}>
            <p className="text-gray-500">GachaAgent v{version}</p>
            <div className="flex justify-center space-x-6 mt-4">
              <a
                href="https://x.com/AIJamezBondos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700">
                <span className="sr-only">Twitter</span>
                <Twitter size={20} />
              </a>
              <a
                href="https://github.com/jamez-bondos/gacha-agent-extension"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700">
                <span className="sr-only">GitHub</span>
                <Github size={20} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
