import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text, Easing, ScrollView, Platform, Dimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

interface FloatingMenuProps {
  debugMode: boolean;
  toggleDebug: () => void;
  llmStatus: string;
  onConnectPress: () => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  resetApp?: () => void;
  debugData?: { sentMessages: any; rawResponse: any };
  onNotesPress?: (() => void) | null;
  notesButtonLabel?: string;
}

export default function FloatingMenu({ debugMode, toggleDebug, llmStatus, onConnectPress, theme, setTheme, toggleTheme, resetApp, debugData, onNotesPress, notesButtonLabel }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showThemeOptions, setShowThemeOptions] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;
  const expansionAnim = useRef(new Animated.Value(0)).current;
  const debugAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;
  const debugPanelWidth = screenWidth - 110; // 20 (left) + 60 (menu) + 10 (gap) + 20 (right margin)

  useEffect(() => {
    Animated.timing(debugAnim, {
      toValue: debugMode ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    }).start();
  }, [debugMode]);

  const getThemeColors = () => {
    switch (theme) {
      case 'light': return { bg: 'rgba(255,255,255,0.8)', icon: '#000', secondary: 'rgba(0,0,0,0.08)', label: '#666', glow: 'rgba(255,255,255,0.9)' };
      case 'dark': return { bg: 'rgba(28,28,30,0.8)', icon: 'white', secondary: 'rgba(255,255,255,0.12)', label: '#8E8E93', glow: 'rgba(255,255,255,0.15)' };
      default: return { bg: 'rgba(255,255,255,0.8)', icon: '#000', secondary: 'rgba(0,0,0,0.08)', label: '#666', glow: 'rgba(255,255,255,0.9)' };
    }
  };

  const { bg, icon: iconColor, secondary: secondaryBg, label: labelColor, glow: glowColor } = getThemeColors();

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.timing(animation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    }).start();
    setIsOpen(!isOpen);
    
    if (isOpen) {
      if (showThemeOptions) {
        setShowThemeOptions(false);
        Animated.timing(expansionAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        }).start();
      }
      if (debugMode) {
        toggleDebug();
      }
    }
  };

  const toggleThemeOptions = () => {
    const toValue = showThemeOptions ? 0 : 1;
    Animated.timing(expansionAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    }).start();
    setShowThemeOptions(!showThemeOptions);
  };

  const handleThemeSelect = (t: any) => {
      setTheme(t);
      toggleThemeOptions();
  }

  const baseHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 330],
  });
  
  const extraHeight = expansionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 30]
  });

  const containerHeight = Animated.add(baseHeight, extraHeight);

  const opacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  // Morphing Button Interpolations
  const buttonRotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg']
  });

  const buttonSize = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 40]
  });

  const buttonRadius = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 20]
  });

  const buttonBottom = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 10]
  });
  
  const buttonBg = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', secondaryBg] 
  });

  // Theme Section Interpolations
  const wrapperHeight = expansionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [60, 90]
  });

  const themeButtonOpacity = expansionAnim.interpolate({
      inputRange: [0, 0.5],
      outputRange: [1, 0]
  });

  const themeListOpacity = expansionAnim.interpolate({
      inputRange: [0.5, 1],
      outputRange: [0, 1]
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.menuContainer, { height: containerHeight, backgroundColor: 'transparent', overflow: 'hidden' }]}>
        {/* Blur Background */}
        <BlurView
          intensity={40}
          tint={theme === 'light' ? 'light' : 'dark'}
          style={[StyleSheet.absoluteFill, { backgroundColor: bg }]}
        />
        
        {/* Content when Open */}
        <Animated.View style={[styles.openContent, { opacity }]} pointerEvents={isOpen ? 'auto' : 'none'}>
           <View style={styles.optionsWrapper}>
             {/* Theme Section */}
             <Animated.View style={{ height: wrapperHeight, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                 
                 {/* Theme Button */}
                 <Animated.View style={{ position: 'absolute', opacity: themeButtonOpacity, alignItems: 'center' }} pointerEvents={showThemeOptions ? 'none' : 'auto'}>
                    <TouchableOpacity onPress={toggleThemeOptions} style={styles.optionItem}>
                        <View style={[styles.iconCircle, { backgroundColor: secondaryBg }]}>
                            <Ionicons name="contrast-outline" size={24} color={iconColor} />
                        </View>
                        <Text style={[styles.label, { color: labelColor }]}>Theme</Text>
                    </TouchableOpacity>
                 </Animated.View>

                 {/* Theme List */}
                 <Animated.View style={{ position: 'absolute', opacity: themeListOpacity, height: 90, justifyContent: 'space-between', paddingVertical: 5 }} pointerEvents={showThemeOptions ? 'auto' : 'none'}>
                    <TouchableOpacity onPress={() => handleThemeSelect('light')} style={[styles.colorOption, { backgroundColor: 'white', borderWidth: StyleSheet.hairlineWidth, borderColor: '#999' }]} />
                    <TouchableOpacity onPress={() => handleThemeSelect('dark')} style={[styles.colorOption, { backgroundColor: '#1C1C1E' }]} />
                 </Animated.View>

             </Animated.View>

             {/* Debug Option */}
             <TouchableOpacity onPress={toggleDebug} style={styles.optionItem}>
               <View style={[
                 styles.iconCircle, 
                 { backgroundColor: secondaryBg }, 
                 debugMode && { backgroundColor: theme === 'light' ? '#000' : '#fff' }
               ]}>
                  <Ionicons 
                    name="code-slash-outline" 
                    size={24} 
                    color={debugMode ? (theme === 'light' ? 'white' : 'black') : iconColor} 
                  />
               </View>
               <Text style={[styles.label, { color: labelColor }]}>Debug</Text>
             </TouchableOpacity>

             {/* API Option */}
             <TouchableOpacity onPress={onConnectPress} style={styles.optionItem}>
               <View style={[
                 styles.iconCircle, 
                 { backgroundColor: secondaryBg }
               ]}>
                  <Ionicons 
                    name={llmStatus === 'connected' ? "cloud-done-outline" : "cloud-offline-outline"} 
                    size={24} 
                    color={iconColor} 
                  />
               </View>
               <Text style={[styles.label, { color: labelColor }]}>API</Text>
             </TouchableOpacity>

             {/* Notes Option */}
             {onNotesPress && (
               <TouchableOpacity onPress={() => { toggleMenu(); onNotesPress(); }} style={styles.optionItem}>
                 <View style={[styles.iconCircle, { backgroundColor: secondaryBg }]}>
                    <Ionicons name={notesButtonLabel === 'New' ? 'add-outline' : 'document-text-outline'} size={24} color={iconColor} />
                 </View>
                 <Text style={[styles.label, { color: labelColor }]}>{notesButtonLabel || 'Notes'}</Text>
               </TouchableOpacity>
             )}
           </View>

           {/* Spacer to preserve layout where close button was */}
           <View style={{ height: 50 }} />
        </Animated.View>

        {/* Shared Morphing Button */}
        <Animated.View style={{
            position: 'absolute',
            bottom: buttonBottom,
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonRadius,
            backgroundColor: buttonBg,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
        }}>
          <TouchableOpacity onPress={toggleMenu} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ transform: [{ rotate: buttonRotation }] }}>
                <Ionicons name="add" size={28} color={iconColor} />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

      </Animated.View>

      {/* Debug Panel - Positioned to the right */}
      <Animated.View style={[
          styles.debugPanel, 
          { 
              backgroundColor: bg,
              opacity: debugAnim,
              height: containerHeight, // Match menu height
              width: debugPanelWidth,
              transform: [
                  { translateX: debugAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) },
                  { scale: debugAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }
              ],
          }
      ]} pointerEvents={debugMode ? 'auto' : 'none'}>
          <View style={styles.debugHeader}>
              <Text style={[styles.debugTitle, { color: labelColor }]}>Debug Info</Text>
              <TouchableOpacity style={styles.resetButton} onPress={resetApp}>
                  <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
          </View>
          <ScrollView style={styles.debugContent} showsVerticalScrollIndicator={false}>
              <View style={styles.debugRow}>
                  <Text style={[styles.debugLabel, { color: labelColor }]}>LLM Status:</Text>
                  <Text style={[styles.debugValue, { color: iconColor }]}>{llmStatus}</Text>
              </View>
              <View style={styles.debugRow}>
                  <Text style={[styles.debugLabel, { color: labelColor }]}>Theme:</Text>
                  <Text style={[styles.debugValue, { color: iconColor }]}>{theme}</Text>
              </View>
              {debugData && (
                <>
                  <View style={styles.debugRow}>
                      <Text style={[styles.debugLabel, { color: labelColor }]}>Sent to Model:</Text>
                      <Text style={[styles.debugValue, { color: iconColor }]} selectable>
                        {debugData.sentMessages ? JSON.stringify(debugData.sentMessages, null, 2) : 'No request yet'}
                      </Text>
                  </View>
                  <View style={styles.debugRow}>
                      <Text style={[styles.debugLabel, { color: labelColor }]}>Raw Response:</Text>
                      <Text style={[styles.debugValue, { color: iconColor }]} selectable>
                        {debugData.rawResponse ? JSON.stringify(debugData.rawResponse, null, 2) : 'No response yet'}
                      </Text>
                  </View>
                </>
              )}
          </ScrollView>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    zIndex: 100,
  },
  menuContainer: {
    width: 60,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 20,
  },
  debugPanel: {
    position: 'absolute',
    left: 70,
    bottom: 0,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    zIndex: 10,
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  debugContent: {
    flex: 1,
  },
  debugRow: {
    marginBottom: 8,
  },
  debugLabel: {
    fontSize: 10,
    marginBottom: 2,
    opacity: 0.7,
  },
  debugValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  closedContent: {
    position: 'absolute',
    bottom: 0,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButton: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openContent: {
    position: 'absolute',
    top: 0,
    width: 60,
    height: '100%',
    alignItems: 'center',
    paddingTop: 5,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderRadius: 20,
  },
  optionsWrapper: {
    flex: 1,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
  },
  optionItem: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activeDebug: {
    backgroundColor: '#000',
  },
  label: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  }
});
