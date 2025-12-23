import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

interface AppContextType {
  theme: 'light' | 'dark' | 'ultramarine' | 'orange' | 'plum';
  setTheme: (theme: 'light' | 'dark' | 'ultramarine' | 'orange' | 'plum') => void;
  toggleTheme: () => void;
  debugMode: boolean;
  toggleDebug: () => void;
  llmStatus: string;
  setLlmStatus: (status: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  showKeyModal: boolean;
  setShowKeyModal: (show: boolean) => void;
  validateConnection: (key: string) => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  resetApp: () => Promise<void>;
  onNotesPress: (() => void) | null;
  setOnNotesPress: (callback: (() => void) | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_API = 'llm_api_key';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'ultramarine' | 'orange' | 'plum'>('light');
  const [debugMode, setDebugMode] = useState(false);
  const [llmStatus, setLlmStatus] = useState('disconnected');
  const [apiKey, setApiKey] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [onNotesPress, setOnNotesPress] = useState<(() => void) | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const storedKey = await AsyncStorage.getItem(STORAGE_KEY_API);
      if (storedKey) {
        setApiKey(storedKey);
        validateConnection(storedKey);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const toggleDebug = () => {
    setDebugMode(prev => !prev);
  };

  const validateConnection = async (key: string) => {
    setLlmStatus('connecting');
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      });
      
      if (response.ok) {
        setLlmStatus('connected');
      } else {
        setLlmStatus('error');
      }
    } catch (error) {
      setLlmStatus('error');
    }
  };

  const saveApiKey = async (key: string) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_API, key);
      setApiKey(key);
      setShowKeyModal(false);
      validateConnection(key);
    } catch (e) {
      Alert.alert('Error', 'Could not save API key');
    }
  };

  const resetApp = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_API);
      setApiKey('');
      setLlmStatus('disconnected');
      Alert.alert('Reset', 'App settings cleared.');
    } catch (error) {
      Alert.alert('Error', 'Could not reset app');
    }
  };

  return (
    <AppContext.Provider value={{
      theme,
      setTheme,
      toggleTheme,
      debugMode,
      toggleDebug,
      llmStatus,
      setLlmStatus,
      apiKey,
      setApiKey,
      showKeyModal,
      setShowKeyModal,
      validateConnection,
      saveApiKey,
      resetApp,
      onNotesPress,
      setOnNotesPress
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
