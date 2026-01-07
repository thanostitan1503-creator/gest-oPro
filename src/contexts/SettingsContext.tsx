import React, { createContext, useState, useContext, useMemo, ReactNode } from 'react';

export interface Settings {
  showGasRobot: boolean;
}

interface SettingsContextType extends Settings {
  setShowGasRobot: (show: boolean) => void;
  saveSettings: (newSettings: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'gp_app_settings';

const defaultSettings: Settings = {
  showGasRobot: true,
};

const loadSettings = (): Settings => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load settings from localStorage', error);
  }
  return defaultSettings;
};

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const saveSettings = (newSettings: Partial<Settings>) => {
    setSettings(prevSettings => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updatedSettings));
      } catch (error) {
        console.error('Failed to save settings to localStorage', error);
      }
      return updatedSettings;
    });
  };

  const setShowGasRobot = (show: boolean) => {
    saveSettings({ showGasRobot: show });
  };
  
  const contextValue = useMemo(() => ({
    ...settings,
    setShowGasRobot,
    saveSettings,
  }), [settings]);

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
