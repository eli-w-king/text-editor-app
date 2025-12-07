import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FloatingMenuProps {
  debugMode: boolean;
  toggleDebug: () => void;
  llmStatus: string;
  onConnectPress: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export default function FloatingMenu({ debugMode, toggleDebug, llmStatus, onConnectPress, theme, toggleTheme }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const isDark = theme === 'dark';
  const bg = isDark ? '#1C1C1E' : 'white';
  const iconColor = isDark ? 'white' : 'black';
  const secondaryBg = isDark ? '#2C2C2E' : '#f0f0f0';
  const labelColor = isDark ? '#8E8E93' : '#666';

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    Animated.timing(animation, {
      toValue,
      duration: 300,
      useNativeDriver: false,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    }).start();
    setIsOpen(!isOpen);
  };

  const containerHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [60, 280],
  });

  const opacity = animation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const menuIconOpacity = animation.interpolate({
    inputRange: [0, 0.5],
    outputRange: [1, 0],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.menuContainer, { height: containerHeight, backgroundColor: bg }]}>
        
        {/* Content when Open */}
        <Animated.View style={[styles.openContent, { opacity }]} pointerEvents={isOpen ? 'auto' : 'none'}>
           <View style={styles.optionsWrapper}>
             {/* Debug Option */}
             <TouchableOpacity onPress={toggleDebug} style={styles.optionItem}>
               <View style={[
                 styles.iconCircle, 
                 { backgroundColor: secondaryBg }, 
                 debugMode && { backgroundColor: isDark ? '#fff' : '#000' }
               ]}>
                  <Ionicons 
                    name="bug-outline" 
                    size={24} 
                    color={debugMode ? (isDark ? 'black' : 'white') : iconColor} 
                  />
               </View>
               <Text style={[styles.label, { color: labelColor }]}>Debug</Text>
             </TouchableOpacity>

             {/* Theme Option */}
             <TouchableOpacity onPress={toggleTheme} style={styles.optionItem}>
               <View style={[styles.iconCircle, { backgroundColor: secondaryBg }]}>
                  <Ionicons name={isDark ? "moon" : "sunny"} size={24} color={iconColor} />
               </View>
               <Text style={[styles.label, { color: labelColor }]}>{isDark ? 'Dark' : 'Light'}</Text>
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

           {/* Close Button at Bottom */}
           <TouchableOpacity onPress={toggleMenu} style={[styles.closeButton, { backgroundColor: secondaryBg }]}>
             <Ionicons name="close" size={24} color={iconColor} />
           </TouchableOpacity>
        </Animated.View>

        {/* Content when Closed (Menu Icon) */}
        <Animated.View style={[styles.closedContent, { opacity: menuIconOpacity }]} pointerEvents={isOpen ? 'none' : 'auto'}>
          <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color={iconColor} />
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
    alignSelf: 'center',
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  menuContainer: {
    width: 60,
    backgroundColor: 'white',
    borderRadius: 30,
    overflow: 'hidden',
    alignItems: 'center',
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
