import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FloatingMenuProps {
  debugMode: boolean;
  toggleDebug: () => void;
  llmStatus: string;
  onConnectPress: () => void;
  theme: 'light' | 'dark' | 'ultramarine' | 'orange';
  setTheme: (theme: 'light' | 'dark' | 'ultramarine' | 'orange') => void;
  toggleTheme: () => void;
}

export default function FloatingMenu({ debugMode, toggleDebug, llmStatus, onConnectPress, theme, setTheme, toggleTheme }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showThemeOptions, setShowThemeOptions] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;
  const expansionAnim = useRef(new Animated.Value(0)).current;

  const getThemeColors = () => {
    switch (theme) {
      case 'light': return { bg: 'white', icon: 'black', secondary: 'white', label: '#666', itemBorder: 'transparent' };
      case 'dark': return { bg: '#1C1C1E', icon: 'white', secondary: '#1C1C1E', label: '#8E8E93', itemBorder: 'transparent' };
      case 'ultramarine': return { bg: '#002080', icon: 'white', secondary: '#002080', label: '#B3C6FF', itemBorder: 'transparent' };
      case 'orange': return { bg: '#B34700', icon: 'white', secondary: '#B34700', label: '#FFCCB3', itemBorder: 'transparent' };
      default: return { bg: 'white', icon: 'black', secondary: 'white', label: '#666', itemBorder: 'transparent' };
    }
  };

  const { bg, icon: iconColor, secondary: secondaryBg, label: labelColor, itemBorder } = getThemeColors();

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.timing(animation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    }).start();
    setIsOpen(!isOpen);
    
    if (isOpen && showThemeOptions) {
        setShowThemeOptions(false);
        Animated.timing(expansionAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
            easing: Easing.bezier(0.4, 0.0, 0.2, 1),
        }).start();
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
    outputRange: [60, 280],
  });
  
  const extraHeight = expansionAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 180] // 240 - 60
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
      outputRange: [60, 240]
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
      <Animated.View style={[styles.menuContainer, { height: containerHeight, backgroundColor: bg }]}>
        
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
                 <Animated.View style={{ position: 'absolute', opacity: themeListOpacity, height: 240, justifyContent: 'space-between', paddingVertical: 10 }} pointerEvents={showThemeOptions ? 'auto' : 'none'}>
                    <TouchableOpacity onPress={() => handleThemeSelect('light')} style={[styles.colorOption, { backgroundColor: 'white' }]} />
                    <TouchableOpacity onPress={() => handleThemeSelect('dark')} style={[styles.colorOption, { backgroundColor: '#1C1C1E' }]} />
                    <TouchableOpacity onPress={() => handleThemeSelect('ultramarine')} style={[styles.colorOption, { backgroundColor: '#002080' }]} />
                    <TouchableOpacity onPress={() => handleThemeSelect('orange')} style={[styles.colorOption, { backgroundColor: '#B34700' }]} />
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
                 { backgroundColor: secondaryBg },
                 llmStatus === 'connected' && styles.activeConnect
               ]}>
                  <Ionicons 
                    name={llmStatus === 'connected' ? "cloud-done-outline" : "cloud-offline-outline"} 
                    size={24} 
                    color={llmStatus === 'connected' ? "white" : iconColor} 
                  />
               </View>
               <Text style={[styles.label, { color: labelColor }]}>API</Text>
             </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  menuContainer: {
    width: 60,
    backgroundColor: 'white',
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
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
    paddingVertical: 10,
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
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  activeDebug: {
    backgroundColor: '#000',
  },
  activeConnect: {
    backgroundColor: '#34C759',
  },
  label: {
    fontSize: 10,
    color: '#666',
    fontWeight: '600',
  }
});
