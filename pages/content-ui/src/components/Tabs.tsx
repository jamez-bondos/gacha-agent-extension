import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex space-x-1 border-b border-gray-200">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onTabChange(tab.id);
            }}
            className={`
              flex items-center px-4 py-2 rounded-t-lg text-sm font-medium relative
              ${
                isActive
                  ? 'bg-white border-gray-200 border-b-2 border-b-blue-500 z-10'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }
            `}>
            <Icon size={18} className={`mr-2 ${isActive ? 'text-blue-500' : 'text-gray-400'}`} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
