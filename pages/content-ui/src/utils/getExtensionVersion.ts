export const getExtensionVersion = async (): Promise<string> => {
  try {
    const manifest = chrome.runtime.getManifest();
    return manifest.version;
  } catch (error) {
    console.error('Error getting extension version:', error);
    return '0.0.1'; // fallback version
  }
};
