import React, { useState, useEffect } from 'react';
import { Settings, X, LayoutPanelLeft, LayoutPanelTop } from 'lucide-react';
import { t } from '@extension/i18n';
import { appSettingsStorage } from '../lib/storage';

interface HeaderProps {
  onOpenSettings: () => void;
  onClose?: () => void;
  onToggleSidebarMode: (mode: 'floating' | 'embedded') => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings, onClose, onToggleSidebarMode }) => {
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<'floating' | 'embedded'>('floating');

  useEffect(() => {
    const resolvedIconUrl = chrome.runtime.getURL('icon-128.png');
    if (resolvedIconUrl) {
        setIconUrl(resolvedIconUrl);
    }

    appSettingsStorage.getSidebarMode().then(mode => {
      setSidebarMode(mode);
      // Optionally, inform the content script of the initial mode on load,
      // though content script should also read this on its own init.
    });
  }, []);

  const handleToggleSidebarMode = () => {
    const newMode = sidebarMode === 'floating' ? 'embedded' : 'floating';
    setSidebarMode(newMode);
    onToggleSidebarMode(newMode);
  };

  const ToggleModeIcon = sidebarMode === 'floating' ? LayoutPanelTop : LayoutPanelLeft;

  return (
    <header className="flex justify-between items-center px-4 py-2 border-b border-gray-200">
      <div className="flex items-center space-x-2">
        <img src={iconUrl} alt="GachaAgent Logo" className="w-6 h-6" />
        <h1 className="text-lg font-semibold leading-none">{t('extensionName')}</h1>
      </div>

      <div className="flex items-center space-x-1">
        <button
          onClick={handleToggleSidebarMode}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full"
          aria-label={`Switch to ${sidebarMode === 'floating' ? 'embedded' : 'floating'} mode`}
          title={`Current mode: ${sidebarMode}. Click to switch to ${sidebarMode === 'floating' ? 'embedded' : 'floating'}.`}>
          <ToggleModeIcon size={18} />
        </button>
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full"
          aria-label="Open settings">
          <Settings size={18} />
        </button>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full"
          aria-label="Close">
          <X size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;
