import '@src/Popup.css';
import { withErrorBoundary, withSuspense } from '@extension/shared';
import { t } from '@extension/i18n';
import React, { useEffect, useState } from 'react';
import { Twitter, Github } from 'lucide-react';

// Simple version display component
const VersionInfo = () => {
  const [version, setVersion] = useState("1.0.0");
  
  useEffect(() => {
    // Get extension version
    const manifestData = chrome.runtime.getManifest();
    setVersion(manifestData.version);
  }, []);
  
  return (
    <div className="flex flex-col items-center">
      <div className="text-xs text-gray-500">
        GachaAgent v{version}
      </div>
      <div className="flex justify-center space-x-6 mt-2">
        <a
          href="https://x.com/AIJamezBondos"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-700"
          onClick={(e) => {
            e.preventDefault();
            chrome.tabs.create({ url: 'https://x.com/AIJamezBondos' });
          }}>
          <span className="sr-only">Twitter</span>
          <Twitter size={18} />
        </a>
        <a
          href="https://github.com/jamez-bondos/gacha-agent-extension"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-gray-700"
          onClick={(e) => {
            e.preventDefault();
            chrome.tabs.create({ url: 'https://github.com/jamez-bondos/gacha-agent-extension' });
          }}>
          <span className="sr-only">GitHub</span>
          <Github size={18} />
        </a>
      </div>
    </div>
  );
};

const Popup = () => {
  const openSoraWebsite = () => {
    chrome.tabs.create({ url: 'https://sora.chatgpt.com/library' });
  };

  return (
    <div className="w-full bg-white text-slate-800 p-4 font-sans flex flex-col items-center">
      <header className="flex flex-col items-center pb-3 w-full border-b border-gray-200">
        <div className="flex items-center gap-3">
          <img 
            src={chrome.runtime.getURL('icon-128.png')} 
            className="w-10 h-10" 
            alt="GachaAgent" 
          />
          <h1 className="text-xl font-semibold">{t('extensionName')}</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          批量发送 Sora 图像生成任务
        </p>
      </header>

      <div className="py-4 w-full">
        <div className="text-center mb-2 font-medium">使用方法</div>
        <p className="text-sm text-center text-gray-600">
          访问 <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              openSoraWebsite();
            }}
            className="text-blue-500 hover:text-blue-600 underline"
          >
            Sora 官网
          </a>，打开右侧的 GachaAgent 浮窗按钮
        </p>
      </div>
      
      <footer className="border-t border-gray-200 pt-3 w-full flex justify-center">
        <VersionInfo />
      </footer>
    </div>
  );
};

export default withErrorBoundary(
  withSuspense(
    Popup, 
    <div className="p-4 text-center">加载中...</div>
  ), 
  <div className="p-4 text-center text-red-500">加载失败</div>
);