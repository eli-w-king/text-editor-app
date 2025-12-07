import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, Text, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface FloatingMenuProps {
  debugMode: boolean;
  toggleDebug: () => void;
  llmStatus: string;
  onConnectPress: () => void;
}

export default function FloatingMenu({ debugMode, toggleDebug, llmStatus, onConnectPress }: FloatingMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

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
    outputRange: [60, 220],
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
      <Animated.View style={[styles.menuContainer, { height: containerHeight }]}>
        
        {/* Content when Open */}
        <Animated.View style={[styles.openContent, { opacity }]} pointerEvents={isOpen ? 'auto' : 'none'}>
           {/* Close Button at Top */}
           <TouchableOpacity onPress={toggleMenu} style={styles.closeButton}>
             <Ionicons name="close" size={24} color="#666" />
           </TouchableOpacity>

           <View style={styles.optionsWrapper}>
             {/* Debug Option */}
             <TouchableOpacity onPress={toggleDebug} style={styles.optionItem}>
               <View style={[styles.iconCircle, debugMode && styles.activeDebug]}>
                  <Ionicons name="bug-outline" size={24} color={debugMode ? "white" : "black"} />
               </View>
               <Text style={styles.label}>Debug</Text>
             </TouchableOpacity>

             {/* API Option */}
             <TouchableOpacity onPress={onConnectPress} style={styles.optionItem}>
               <View style={[styles.iconCircle, llmStatus === 'connected' && styles.activeConnect]}>
                  <Ionicons name={llmStatus === 'connected' ? "cloud-done-outline" : "cloud-offline-outline"} size={24} color={llmStatus === 'connected' ? "white" : "black"} />
               </View>
               <Text style={styles.label}>API</Text>
             </TouchableOpacity>
           </View>
        </Animated.View>

        {/* Content when Closed (Menu Icon) */}
        <Animated.View style={[styles.closedContent, { opacity: menuIconOpacity }]} pointerEvents={isOpen ? 'none' : 'auto'}>
          <TouchableOpacity onPress={toggleMenu} style={styles.menuButton}>
            <Ionicons name="menu" size={28} color="black" />
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
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
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
