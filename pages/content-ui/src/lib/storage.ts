const STORAGE_KEY = 'one_more_gen_v1_settings';

export interface AppSettings {
  settings: {
    general: {
      delay: number;
    };
    ui: { 
      sidebarMode: 'floating' | 'embedded';
    };
  };
}

const defaultSettings: AppSettings = {
  settings: {
    general: {
      delay: 2, // default delay in seconds
    },
    ui: {
      sidebarMode: 'floating',
    },
  },
};

class AppSettingsStorage {

  async getSettings(): Promise<AppSettings> {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return data[STORAGE_KEY] || defaultSettings;
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  }

  async updateGeneralDelay(delay: number): Promise<void> {
    const appSettings = await this.getSettings();
    appSettings.settings.general.delay = delay;
    await this.saveSettings(appSettings);
  }

  async updateSidebarMode(mode: 'floating' | 'embedded'): Promise<void> {
    const appSettings = await this.getSettings();
    if (!appSettings.settings.ui) {
      appSettings.settings.ui = { sidebarMode: mode };
    } else {
      appSettings.settings.ui.sidebarMode = mode;
    }
    await this.saveSettings(appSettings);
  }

  async getSidebarMode(): Promise<'floating' | 'embedded'> {
    const appSettings = await this.getSettings();
    return appSettings.settings.ui?.sidebarMode || defaultSettings.settings.ui.sidebarMode;
  }
}

export const appSettingsStorage = new AppSettingsStorage(); 