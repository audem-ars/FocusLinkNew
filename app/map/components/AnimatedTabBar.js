import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import Reanimated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  withSequence, 
  withRepeat, 
  Easing 
} from 'react-native-reanimated';

// Starry background component for tab bar 
const StarryBackground = () => {
  // Create stars with random positions
  const stars = Array.from({ length: 50 }, (_, i) => {
    const size = Math.random() * 1.5 + 0.5;
    const opacity = useSharedValue(Math.random() * 0.5 + 0.3);
    
    // Animate star twinkling
    React.useEffect(() => {
      opacity.value = withRepeat(
        withTiming(Math.random() * 0.3 + 0.7, {
          duration: 1000 + Math.random() * 2000,
          easing: Easing.inOut(Easing.ease),
        }),
        -1, // infinite repeat
        true // reverse
      );
    }, []);
    
    const animatedStyle = useAnimatedStyle(() => {
      return {
        opacity: opacity.value,
      };
    });
    
    return (
      <Reanimated.View
        key={i}
        style={[
          {
            position: 'absolute',
            width: size,
            height: size,
            backgroundColor: i % 5 === 0 ? '#8BE8FF' : i % 7 === 0 ? '#FFDA9E' : '#FFFFFF',
            borderRadius: size,
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
          },
          animatedStyle,
        ]}
      />
    );
  });
  
  return stars;
};

// Electric effect component
const ElectricEffect = ({ visible }) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  
  useEffect(() => {
    if (visible) {
      // Trigger electric animation
      opacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0.8, { duration: 100 }),
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 250 })
      );
      
      scale.value = withSequence(
        withTiming(1.05, { duration: 150 }),
        withTiming(1, { duration: 100 }),
        withTiming(1.03, { duration: 100 }),
        withTiming(1, { duration: 250 })
      );
    }
  }, [visible]);
  
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scaleX: scale.value }]
    };
  });
  
  return (
    <>
      {/* Top electric effect */}
      <Reanimated.View style={[styles.electricEffect, styles.topElectricEffect, animatedStyle]}>
        <LinearGradient
          colors={['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.electricGradient}
        />
      </Reanimated.View>
      
      {/* Bottom electric effect */}
      <Reanimated.View style={[styles.electricEffect, styles.bottomElectricEffect, animatedStyle]}>
        <LinearGradient
          colors={['rgba(59, 130, 246, 0)', 'rgba(59, 130, 246, 0.8)', 'rgba(59, 130, 246, 0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.electricGradient}
        />
      </Reanimated.View>
    </>
  );
};

// Main AnimatedTabBar component
const AnimatedTabBar = () => {
  const tabBarTranslateY = useRef(new Animated.Value(0)).current;
  const [showElectric, setShowElectric] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [lastY, setLastY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const showTabBar = () => {
    if (!isVisible) {
      console.log("Showing tab bar");
      setIsVisible(true);
      setShowElectric(true);
      
      Animated.spring(tabBarTranslateY, {
        toValue: 0,
        friction: 7,
        tension: 40,
        useNativeDriver: true
      }).start();
      
      // Reset electric effect after a delay
      setTimeout(() => {
        setShowElectric(false);
      }, 600);
    }
  };
  
  const hideTabBar = () => {
    if (isVisible) {
      console.log("Hiding tab bar");
      setIsVisible(false);
      
      Animated.timing(tabBarTranslateY, {
        toValue: 100, // Move below screen
        duration: 300,
        useNativeDriver: true
      }).start();
    }
  };
  
  // Create pan responder for drag interactions with limited activation area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to touches near the very bottom of the screen
        // or specifically on the drag handle
        const { locationY, pageY } = evt.nativeEvent;
        const windowHeight = Dimensions.get('window').height;
        
        // Check if touch is in the drag handle area (when tab is visible)
        const isDragHandleTouch = isVisible && locationY < 30;
        
        // Check if touch is at the very bottom edge of screen (when tab is hidden)
        // Only the bottom 20 pixels will activate the tab bar
        const isBottomEdgeTouch = !isVisible && (pageY > windowHeight - 20);
        
        return isDragHandleTouch || isBottomEdgeTouch;
      },
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only respond to significant vertical movements
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        setIsDragging(true);
      },
      onPanResponderMove: (evt, gestureState) => {
        const { dy } = gestureState;
        
        // Only respond to up/down movements
        if (Math.abs(dy) > 10) {
          if (dy < 0 && !isVisible) {
            // Dragging up - show the tab bar
            showTabBar();
          } else if (dy > 10 && isVisible) {
            // Dragging down - hide the tab bar
            hideTabBar();
          }
        }
        
        setLastY(evt.nativeEvent.pageY);
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
      }
    })
  ).current;
  
  // Auto-hide after a timeout if not interacting
  useEffect(() => {
    // Show initially
    showTabBar();
    
    // Create auto-hide timer
    const timer = setTimeout(() => {
      if (!isDragging) {
        hideTabBar();
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [isDragging]); // Added isDragging as dependency
  
  return (
    <View style={styles.tabBarContainer} {...panResponder.panHandlers}>
      <ElectricEffect visible={showElectric} />
      
      <Animated.View 
        style={[
          styles.tabBarWrapper, 
          { transform: [{ translateY: tabBarTranslateY }] }
        ]}
      >
        <LinearGradient
          colors={['#0f1729', '#1c2741', '#121a2c']}
          style={styles.tabBarGradient}
        >
          <StarryBackground />
          
          {/* Drag handle */}
          <View style={styles.dragHandle} />
          
          <View style={styles.tabBar}>
            <TouchableOpacity 
              style={styles.tabButton}
              onPress={() => router.replace('/')}
            >
              <View style={styles.tabButtonInner}>
                <Text style={styles.tabText}>Home</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.tabButton}
              onPress={() => {}}
            >
              <View style={[styles.tabButtonInner, styles.activeTabButton]}>
                <Text style={styles.activeTabText}>Map</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.tabButton}
              onPress={() => router.push('circles')}
            >
              <View style={styles.tabButtonInner}>
                <Text style={styles.tabText}>Circles</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.tabButton}
              onPress={() => router.push('profile')}
            >
              <View style={styles.tabButtonInner}>
                <Text style={styles.tabText}>Profile</Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    zIndex: 1000, // Ensure it's above other content
  },
  tabBarWrapper: {
    overflow: 'hidden',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  tabBarGradient: {
    overflow: 'hidden',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 4,
    paddingBottom: 24, // Extra padding for bottom safe area
  },
  dragHandle: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 4,
  },
  tabButton: {
    flex: 0,
    width: 85, // Fixed width
    alignItems: 'center',
  },
  tabButtonInner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    minWidth: 75,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(99, 179, 237, 0.4)',
  },
  tabText: {
    fontSize: 13,
    color: '#A0AEC0',
    textAlign: 'center',
    fontWeight: '500',
  },
  activeTabText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  electricEffect: {
    position: 'absolute',
    height: 4, // Slightly thicker for better visibility
    width: '100%',
    zIndex: 10,
  },
  topElectricEffect: {
    top: 0,
  },
  bottomElectricEffect: {
    bottom: 0,
  },
  electricGradient: {
    height: '100%',
    width: '100%',
  }
});

export default AnimatedTabBar;