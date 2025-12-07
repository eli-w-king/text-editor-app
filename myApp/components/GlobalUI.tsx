import React from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  Platform, 
  KeyboardAvoidingView, 
  ScrollView,
  StyleSheet
} from 'react-native';
import { useAppContext } from '@/context/AppContext';
import FloatingMenu from '@/components/FloatingMenu';
import { styles as appStyles } from '@/styles';

export default function GlobalUI() {
  const { 
    theme, 
    setTheme,
    toggleTheme, 
    debugMode, 
    toggleDebug, 
    llmStatus, 
    showKeyModal, 
    setShowKeyModal, 
    apiKey, 
    saveApiKey, 
    resetApp 
  } = useAppContext();

  const [tempKey, setTempKey] = React.useState('');

  // Sync tempKey when modal opens
  React.useEffect(() => {
    if (showKeyModal) {
      setTempKey(apiKey);
    }
  }, [showKeyModal, apiKey]);

  const handleSaveKey = () => {
    saveApiKey(tempKey);
  };

  return (
    <>
      {/* API Key Modal */}
      <Modal
        visible={showKeyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowKeyModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={appStyles.modalOverlay}>
          <View style={appStyles.modalContent}>
            <Text style={appStyles.modalTitle}>Enter OpenRouter API Key</Text>
            <TextInput
              style={appStyles.modalInput}
              value={tempKey}
              onChangeText={setTempKey}
              placeholder="sk-or-..."
              autoCapitalize="none"
              secureTextEntry
            />
            <View style={appStyles.modalButtons}>
              <TouchableOpacity style={appStyles.cancelButton} onPress={() => setShowKeyModal(false)}>
                <Text style={appStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={appStyles.saveButton} onPress={handleSaveKey}>
                <Text style={[appStyles.buttonText, { color: '#fff' }]}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Debug Overlay */}
      {debugMode && (
        <TouchableOpacity 
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 }} 
          activeOpacity={1} 
          onPress={toggleDebug} 
        />
      )}

      {/* Debug Panel */}
      {debugMode && (
        <View style={appStyles.debugPanel}>
          <View style={appStyles.debugActions}>
            <TouchableOpacity style={appStyles.resetButton} onPress={resetApp}>
              <Text style={appStyles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={appStyles.debugScroll}>
            <Text style={appStyles.debugLabel}>Debug Info:</Text>
            <Text style={appStyles.debugText}>
              LLM Status: {llmStatus}
            </Text>
            <Text style={appStyles.debugText}>
              Theme: {theme}
            </Text>
          </ScrollView>
        </View>
      )}

      <FloatingMenu 
        debugMode={debugMode}
        toggleDebug={toggleDebug}
        llmStatus={llmStatus}
        onConnectPress={() => setShowKeyModal(true)}
        theme={theme}
        setTheme={setTheme}
        toggleTheme={toggleTheme}
      />
    </>
  );
}
