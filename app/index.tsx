// app/index.tsx - Fixed home page with matching dark headers and theme toggle
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Dimensions,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { useGoals } from '../src/context/GoalContext';
import { useContext } from 'react';
import { FocusPrincipleContext } from '../src/context/FocusPrincipleContext.js';
import FocusPrinciple from '../src/components/FocusPrinciple';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, interpolate } from 'react-native-reanimated';
import Svg, { 
  Path, 
  Defs, 
  LinearGradient as SvgLinearGradient, // Alias to avoid conflict with expo-linear-gradient
  Stop, 
  Filter, 
  FeGaussianBlur,
  FeOffset,
  FeComponentTransfer,
  FeFuncA,
  FeMerge,
  FeMergeNode
} from 'react-native-svg';

const { width, height } = Dimensions.get('window');

// Add Goal interface definition to fix TypeScript errors
interface Goal {
  id: string;
  text: string;
  isActive: boolean;
  alreadyDoing: boolean;
  createdAt?: string;
}

// Starry background component for tab bar and header
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
      <Animated.View
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

  return <>{stars}</>;
};

// Enhanced GoldenBackground with VISIBLE stars and REALISTIC FIERY SUN
const GoldenBackground = () => {
  // Sun animation values
  const sunPulse = useSharedValue(1);
  const coronaRotate = useSharedValue(0);

  // Sun animation effects
  useEffect(() => {
    // Subtle pulsing effect
    sunPulse.value = withRepeat(
      withTiming(1.05, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );

    // Very slow corona rotation
    coronaRotate.value = withRepeat(
      withTiming(360, {
        duration: 120000, // 2 minutes per rotation
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  // Create animated styles for sun
  const sunAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: sunPulse.value }],
    };
  });

  const coronaAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${coronaRotate.value}deg` }],
    };
  });

  // Create visible stars including electric blue ones
  const renderStars = () => {
    const starElements = [];

    // Generate 120 stars with different colors and sizes
    for (let i = 0; i < 120; i++) {
      // Determine star color with better visibility
      let starColor;
      let starSize;

      if (i % 6 === 0) {
        // Electric blue stars - make them larger and more visible
        starColor = '#00BFFF'; // Electric blue
        starSize = Math.random() * 2.5 + 1.5; // 1.5-4px
      } else if (i % 8 === 0) {
        // Green stars
        starColor = '#38B2AC';
        starSize = Math.random() * 2.0 + 1.0; // 1-3px
      } else {
        // White stars
        starColor = '#FFFFFF';
        starSize = Math.random() * 1.5 + 0.8; // 0.8-2.3px
      }

      // Random position
      const top = Math.random() * 100;
      const left = Math.random() * 100;

      starElements.push(
        <View
          key={`star-${i}`}
          style={{
            position: 'absolute',
            width: starSize,
            height: starSize,
            backgroundColor: starColor,
            borderRadius: starSize / 2,
            top: `${top}%`,
            left: `${left}%`,
            // Add a subtle shadow to make stars more visible
            shadowColor: starColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 2,
          }}
        />
      );
    }

    return starElements;
  };

  return (
    <>
      {/* REALISTIC FIERY SUN */}
      <View style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 0, // Container for the sun elements
        height: 0,
        zIndex: 1,
      }}>
        {/* Corona (outer flame layer) */}
        <Animated.View
          style={[{
            position: 'absolute',
            width: 120,
            height: 120,
            marginLeft: -60,
            marginTop: -60,
          }, coronaAnimatedStyle]}
        >
          {/* Create corona flames - 24 separate flame elements */}
          {Array.from({ length: 24 }).map((_, i) => (
            <View
              key={`corona-${i}`}
              style={{
                position: 'absolute',
                top: 60,
                left: 60,
                width: i % 2 === 0 ? 70 : 50, // Alternating lengths
                height: i % 3 === 0 ? 4 : 3,  // Varying thickness
                backgroundColor: i % 3 === 0 ? '#FFAB00' : '#FF9100', // Orange flames
                borderRadius: 2,
                transform: [
                  { translateX: -25 },
                  { rotate: `${i * 15}deg` }, // Evenly spaced around 360°
                  { translateX: 25 }
                ],
                opacity: 0.7,
                shadowColor: '#FF6D00',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 5,
              }}
            />
          ))}
        </Animated.View>

        {/* Secondary corona (middle flame layer) */}
        <Animated.View
          style={[{
            position: 'absolute',
            width: 100,
            height: 100,
            marginLeft: -50,
            marginTop: -50,
            transform: [{ rotate: '12deg' }], // Offset from main corona
          }, coronaAnimatedStyle]}
        >
          {/* Create secondary corona flames */}
          {Array.from({ length: 20 }).map((_, i) => (
            <View
              key={`corona2-${i}`}
              style={{
                position: 'absolute',
                top: 50,
                left: 50,
                width: i % 2 === 0 ? 50 : 40,
                height: i % 3 === 0 ? 3 : 2,
                backgroundColor: i % 3 === 0 ? '#FFCC80' : '#FFB74D',
                borderRadius: 1.5,
                transform: [
                  { translateX: -20 },
                  { rotate: `${i * 18}deg` },
                  { translateX: 20 }
                ],
                opacity: 0.8,
                shadowColor: '#FF9800',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 3,
              }}
            />
          ))}
        </Animated.View>

        {/* Sun core (pulsing) */}
        <Animated.View
          style={[{
            position: 'absolute',
            width: 46,
            height: 46,
            marginLeft: -23,
            marginTop: -23,
            borderRadius: 23,
            backgroundColor: '#FFEB3B', // Yellow core
            shadowColor: '#FFC107',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 15,
          }, sunAnimatedStyle]}
        />

        {/* Inner glow layer */}
        <Animated.View
          style={[{
            position: 'absolute',
            width: 60,
            height: 60,
            marginLeft: -30,
            marginTop: -30,
            borderRadius: 30,
            backgroundColor: 'rgba(255, 193, 7, 0.6)', // Semi-transparent amber
            shadowColor: '#FF9800',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 10,
          }, sunAnimatedStyle]}
        />
      </View>

      {/* White streaks (clouds) */}
      <View style={{
        position: 'absolute',
        width: '200%',
        height: 100,
        left: '-50%',
        top: '45%',
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        borderRadius: 50,
        transform: [{ rotate: '8deg' }],
      }} />

      <View style={{
        position: 'absolute',
        width: '160%',
        height: 80,
        left: '-30%',
        top: '55%',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 40,
        transform: [{ rotate: '-5deg' }],
      }} />

      {/* Render all stars */}
      {renderStars()}
    </>
  );
};

// Enhanced Moon background component for dark theme
const MoonBackground = () => {
  // Moon animation values
  const moonGlow = useSharedValue(1);
  
  // Moon animation effects
  useEffect(() => {
    // Subtle glowing effect
    moonGlow.value = withRepeat(
      withTiming(1.08, {
        duration: 4000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);
  
  // Create animated styles for moon
  const moonAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: moonGlow.value }],
      opacity: 0.9 + (moonGlow.value - 1) * 0.2, // Subtle opacity shift with glow
    };
  });
  
  // Create moon glow halo effect
  const moonHaloAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: moonGlow.value * 1.1 }], // Slightly larger scale for halo
      opacity: 0.2 + (moonGlow.value - 1) * 0.3, // More pronounced opacity shift
    };
  });
  
  return (
    <>
      {/* REALISTIC MOON */}
      <View style={{
        position: 'absolute',
        top: '40%',
        left: '50%',
        width: 0,
        height: 0,
        zIndex: 1,
      }}>
        {/* Outer glow halo */}
        <Animated.View
          style={[{
            position: 'absolute',
            width: 100,
            height: 100,
            marginLeft: -50,
            marginTop: -50,
            borderRadius: 50,
            backgroundColor: 'rgba(226, 232, 240, 0.1)',
            shadowColor: '#90CDF4',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 30,
          }, moonHaloAnimatedStyle]}
        />
        
        {/* Main moon body with gradient overlay */}
        <Animated.View
          style={[{
            position: 'absolute',
            width: 80,
            height: 80,
            marginLeft: -40,
            marginTop: -40,
            borderRadius: 40,
            overflow: 'hidden',
            shadowColor: '#E2E8F0',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 10,
          }, moonAnimatedStyle]}
        >
          {/* Base moon color */}
          <View style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: '#E2E8F0',
          }} />
          
          {/* Subtle gradient overlay for realistic moon texture */}
          <LinearGradient
            colors={['rgba(203, 213, 224, 0.8)', 'rgba(226, 232, 240, 0.4)', 'rgba(247, 250, 252, 0.9)']}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
            }}
          />
          
          {/* Mare (dark areas) on the moon */}
          <View style={{
            position: 'absolute',
            top: 15,
            left: 10,
            width: 25,
            height: 25,
            borderRadius: 12.5,
            backgroundColor: 'rgba(113, 128, 150, 0.2)',
            transform: [{ scaleY: 0.8 }], // Slightly oval
          }} />
          
          <View style={{
            position: 'absolute',
            top: 45,
            left: 25,
            width: 20,
            height: 18,
            borderRadius: 10,
            backgroundColor: 'rgba(113, 128, 150, 0.15)',
            transform: [{ scaleX: 1.2 }], // Slightly oval
          }} />
          
          <View style={{
            position: 'absolute',
            top: 25,
            left: 45,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: 'rgba(113, 128, 150, 0.18)',
          }} />
          
          {/* Detailed craters */}
          <View style={{
            position: 'absolute',
            top: 10,
            left: 40,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(247, 250, 252, 0.9)',
            borderWidth: 1,
            borderColor: 'rgba(203, 213, 224, 0.5)',
          }} />
          
          <View style={{
            position: 'absolute',
            top: 30,
            left: 15,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(247, 250, 252, 0.9)',
            borderWidth: 1,
            borderColor: 'rgba(203, 213, 224, 0.5)',
          }} />
          
          <View style={{
            position: 'absolute',
            top: 50,
            left: 50,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: 'rgba(247, 250, 252, 0.9)',
            borderWidth: 1,
            borderColor: 'rgba(203, 213, 224, 0.5)',
          }} />
          
          {/* Highlight along one edge for 3D effect */}
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.4)', 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.3, y: 0.5 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 30,
              borderTopLeftRadius: 40,
              borderBottomLeftRadius: 40,
            }}
          />
        </Animated.View>
        
        {/* Subtle stars around the moon for added effect */}
        {Array.from({ length: 12 }).map((_, i) => {
          const size = Math.random() * 1.5 + 1;
          const distance = 50 + Math.random() * 20;
          const angle = (i / 12) * Math.PI * 2;
          const x = Math.cos(angle) * distance;
          const y = Math.sin(angle) * distance;
          
          return (
            <View
              key={`moon-star-${i}`}
              style={{
                position: 'absolute',
                width: size,
                height: size,
                marginLeft: x - size/2,
                marginTop: y - size/2,
                borderRadius: size/2,
                backgroundColor: i % 3 === 0 ? '#90CDF4' : '#FFFFFF',
                opacity: 0.7 + Math.random() * 0.3,
              }}
            />
          );
        })}
      </View>
    </>
  );
};

// Realistic Cloud Header Component (Smaller Version)
const CloudHeader = () => {
  // Add subtle animation to the cloud
  const cloudFloat = useSharedValue(0);
  
  useEffect(() => {
    // Gentle floating animation
    cloudFloat.value = withRepeat(
      withTiming(1, {
        duration: 10000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);
  
  const cloudAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: interpolate(cloudFloat.value, [0, 1], [0, -3]) },
      ],
    };
  });

  return (
    <View style={styles.cloudHeaderContainer}>
      <Animated.View style={[styles.cloudBase, cloudAnimatedStyle]}>
        {/* SVG cloud shape for realism - reduced size */}
        <Svg height="55" width="180" viewBox="0 0 220 70">
          <Defs>
            <SvgLinearGradient id="cloudGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#E2E8F0" stopOpacity="1" />
            </SvgLinearGradient>
            <Filter id="cloudShadow" x="-20%" y="-20%" width="140%" height="140%">
              <FeGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <FeOffset dx="0" dy="2" result="offsetblur" />
              <FeComponentTransfer>
                <FeFuncA type="linear" slope="0.2" />
              </FeComponentTransfer>
              <FeMerge> 
                <FeMergeNode />
                <FeMergeNode in="SourceGraphic" /> 
              </FeMerge>
            </Filter>
          </Defs>
          <Path
            d="M25,45 C25,45 18,40 18,30 C18,20 25,15 32,15 C32,5 40,0 50,0 C65,0 70,15 75,15 C85,15 90,10 105,10 C120,10 125,15 135,15 C145,15 150,10 165,10 C180,10 190,25 190,35 C200,35 220,40 220,50 C220,60 200,65 190,65 C190,65 180,70 150,70 C120,70 100,65 90,65 C80,65 70,70 50,70 C35,70 25,65 25,45 Z"

            fill="url(#cloudGradient)"
            filter="url(#cloudShadow)"
          />
        </Svg>
        
        {/* Text container properly centered on the cloud */}
        <View style={styles.cloudTextContainer}>
          <Text style={styles.cloudText}>FOCUS LINK</Text>
        </View>
      </Animated.View>
    </View>
  );
};


// Custom Sync Toggle Component
interface SyncToggleProps {
  value: boolean;
  onValueChange: (newValue: boolean) => void;
}

const SyncToggle = ({ value, onValueChange }: SyncToggleProps) => {
  const thumbPosition = useSharedValue(value ? 22 : 0);

  useEffect(() => {
    thumbPosition.value = withTiming(value ? 22 : 0, {
      duration: 250,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    });
  }, [value]);

  const animatedThumbStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: thumbPosition.value }],
    };
  });


  return (
    <TouchableOpacity
      style={styles.syncToggleContainer}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.8}
    >
      <View style={[
        styles.syncToggleTrack,
        value ? styles.syncToggleTrackActive : styles.syncToggleTrackInactive
      ]}>
        <Animated.View style={[
          styles.syncToggleThumb,
          value ? styles.syncToggleThumbActive : styles.syncToggleThumbInactive,
          animatedThumbStyle 
        ]}>
          {value ? (
            <View style={styles.syncToggleIcon}>
              <View style={styles.sunIcon} />
              <View style={styles.sunRay1} />
              <View style={styles.sunRay2} />
              <View style={styles.sunRay3} />
              <View style={styles.sunRay4} />
            </View>
          ) : (
            <View style={styles.syncToggleIcon}>
              <View style={styles.moonIcon} />
              <View style={styles.moonCrater1} />
              <View style={styles.moonCrater2} />
            </View>
          )}
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
};


export default function Home() {
  const { currentUser, userProfile } = useAuth();
  const { addGoal, activeGoals, planningGoals } = useGoals();
  const focusPrincipleData = useContext(FocusPrincipleContext);
  const { todaysPrinciple } = focusPrincipleData;

  const [goalText, setGoalText] = useState('');
  const [isAlreadyDoing, setIsAlreadyDoing] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);

  // --- THEME STATE MANAGEMENT ---
  const [isSynced, setIsSynced] = useState(true);
  const [appTheme, setAppTheme] = useState('synced'); // Options: 'synced' or 'unsynced'

  const handleSyncToggle = (value: boolean) => {
    setIsSynced(value);
    const newTheme = value ? 'synced' : 'unsynced';
    setAppTheme(newTheme);

    Alert.alert(
      value ? 'Synced Mode Activated' : 'Focus Mode Activated',
      value ? 'You are now available for collaboration and updates.' : 'Notifications paused. You are in solo focus mode.',
      [{ text: 'OK', style: 'cancel' }],
      { cancelable: true }
    );
  };
  // --- END THEME STATE MANAGEMENT ---

  useEffect(() => {
    if (!currentUser) {
      const timer = setTimeout(() => {
        router.replace('login' as any);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentUser]);

  const handleAddGoal = async () => {
    if (!goalText.trim()) {
      Alert.alert('Empty Focus Area', 'Please enter a focus area before saving.');
      return;
    }
    setIsAddingGoal(true);
    try {
      const newGoal = await addGoal(goalText, isAlreadyDoing);
      if (newGoal) {
        Alert.alert(
          'Focus Area Added',
          `"${goalText}" has been added to your ${isAlreadyDoing ? 'Already Doing' : 'Planning to Start'} list.`
        );
        setGoalText('');
      } else {
        Alert.alert('Error', 'Could not add focus area. Please try again.');
      }
    } catch (error) {
      console.error('Add goal error:', error);
      Alert.alert('Error', 'Could not add focus area. Please try again.');
    } finally {
      setIsAddingGoal(false);
    }
  };

  if (!currentUser || !userProfile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={appTheme === 'synced' ? "#3B82F6" : "#90CDF4"} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={appTheme === 'synced'
          ? ['#FFF8E1', '#FFF5E0', '#FFF9F0']
          : ['#0A1128', '#0A1128', '#121A2C']
        }
        style={styles.fullScreenAbsolute}
      >
        {/* Conditionally render GoldenBackground or MoonBackground */}
        {appTheme === 'synced' ? <GoldenBackground /> : <MoonBackground />}
      </LinearGradient>

      <StatusBar style="light" />

      {/* Overlay the cloud on top of the header */}
      <CloudHeader />

      {/* Header with starry background */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={['#0f1729', '#1c2741', '#121a2c']}
          style={styles.headerGradient}
        >
          <StarryBackground />
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Sync Switch</Text>
            <SyncToggle
              value={isSynced}
              onValueChange={handleSyncToggle}
            />
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push('profile' as any)}
            >
              {userProfile.photoURL || currentUser?.photoURL ? (
                <Image
                  source={{ uri: userProfile.photoURL || currentUser?.photoURL || undefined }}
                  style={styles.profileImage}
                />
              ) : (
                <View style={styles.profileIcon}>
                  <Text style={styles.profileIconText}>
                    {userProfile.name ? userProfile.name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>

      <ScrollView style={[styles.content, appTheme === 'unsynced' && styles.contentDark]}>
        <FocusPrinciple
            style={[
                styles.principleCard,
                appTheme === 'unsynced' && styles.principleCardDark
            ]}
        />

        <View style={[
          styles.addGoalSection,
          appTheme === 'unsynced' && styles.addGoalSectionDark
        ]}>
          <Text style={[
            styles.sectionTitle,
            appTheme === 'unsynced' && styles.darkModeText
          ]}>Add New Focus Area</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                appTheme === 'unsynced' && styles.inputDark
              ]}
              value={goalText}
              onChangeText={setGoalText}
              placeholder="Enter your focus area..."
              placeholderTextColor={appTheme === 'synced' ? "#A0AEC0" : "#CBD5E0"}
              multiline
              selectionColor={appTheme === 'synced' ? undefined : '#63B3ED'}
            />
          </View>

          <View style={styles.toggleContainer}>
            <Text style={[
              styles.toggleLabel,
              appTheme === 'unsynced' && styles.darkModeText
            ]}>
              {isAlreadyDoing ? "I'm doing this" : "I'm starting this"}
            </Text>
            <Switch
              value={isAlreadyDoing}
              onValueChange={setIsAlreadyDoing}
              trackColor={{ false: (appTheme === 'synced' ? '#4299E1' : '#2B6CB0'), true: (appTheme === 'synced' ? '#38B2AC' : '#2C7A7B') }}
              thumbColor={isAlreadyDoing ? (appTheme === 'synced' ? '#E6FFFA' : '#B2F5EA') : (appTheme === 'synced' ? '#EBF8FF' : '#C3DAFE')}
              ios_backgroundColor={appTheme === 'synced' ? "#E2E8F0" : "#4A5568"}
            />
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddGoal}
            disabled={isAddingGoal}
          >
            <LinearGradient
              colors={['#0f1729', '#1c2741', '#121a2c']}
              style={styles.buttonGradientBackground}
            >
              <StarryBackground />
            </LinearGradient>
            {isAddingGoal ? (
              <ActivityIndicator size="small" color="#E2F3FF" />
            ) : (
              <Text style={styles.addButtonText}>Save Focus</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[
          styles.yourGoalsSection,
          appTheme === 'unsynced' && styles.yourGoalsSectionDark
        ]}>
          <View style={styles.sectionHeader}>
            <Text style={[
              styles.sectionTitle,
              appTheme === 'unsynced' && styles.darkModeText
            ]}>Your Focus Areas</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('profile' as any)}
            >
              <Text style={[
                styles.viewAllText,
                appTheme === 'unsynced' && styles.viewAllTextDark
              ]}>View All</Text>
            </TouchableOpacity>
          </View>

          {!!(activeGoals.length > 0) && (
            <View style={styles.goalTypeSection}>
              <Text style={[
                styles.goalTypeTitle,
                appTheme === 'unsynced' && styles.darkModeText
              ]}>Already Doing</Text>
              <View style={styles.goalsList}>
                {activeGoals.slice(0, 3).map((goal: Goal) => (
                  <View key={goal.id} style={[
                    styles.goalItem,
                    styles.activeGoalItem,
                    appTheme === 'unsynced' && styles.activeGoalItemDark
                  ]}>
                    <Text style={[
                      styles.goalText,
                      appTheme === 'unsynced' && styles.darkModeText
                    ]}>{goal.text}</Text>
                  </View>
                ))}
                {!!(activeGoals.length > 3) && (
                  <TouchableOpacity
                    style={styles.moreButton}
                    onPress={() => router.push('profile' as any)}
                  >
                    <Text style={[
                      styles.moreButtonText,
                      appTheme === 'unsynced' && styles.moreButtonTextDark
                    ]}>+{activeGoals.length - 3} more</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {!!(planningGoals.length > 0) && (
            <View style={styles.goalTypeSection}>
              <Text style={[
                styles.goalTypeTitle,
                appTheme === 'unsynced' && styles.darkModeText
              ]}>Planning to Start</Text>
              <View style={styles.goalsList}>
                {planningGoals.slice(0, 3).map((goal: Goal) => (
                  <View key={goal.id} style={[
                    styles.goalItem,
                    styles.planningGoalItem,
                    appTheme === 'unsynced' && styles.planningGoalItemDark
                  ]}>
                    <Text style={[
                      styles.goalText,
                      appTheme === 'unsynced' && styles.darkModeText
                    ]}>{goal.text}</Text>
                  </View>
                ))}
                {!!(planningGoals.length > 3) && (
                  <TouchableOpacity
                    style={styles.moreButton}
                    onPress={() => router.push('profile' as any)}
                  >
                    <Text style={[
                      styles.moreButtonText,
                      appTheme === 'unsynced' && styles.moreButtonTextDark
                    ]}>+{planningGoals.length - 3} more</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {!!(activeGoals.length === 0 && planningGoals.length === 0) && (
            <View style={styles.emptyState}>
              <Text style={[
                styles.emptyStateText,
                appTheme === 'unsynced' && styles.darkModeText
              ]}>You haven't added any focus areas yet.</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.findOthersButton}
          onPress={() => router.push('map' as any)}
        >
          <LinearGradient
            colors={['#0f1729', '#1c2741', '#121a2c']}
            style={styles.buttonGradientBackgroundFindOthers}
          >
            <StarryBackground />
          </LinearGradient>
          <Text style={styles.findOthersText}>Find Others With Similar Focus</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.tabBarContainer}>
        <LinearGradient
          colors={['#0f1729', '#1c2741', '#121a2c']}
          style={styles.tabBarGradient}
        >
          <StarryBackground />
          <View style={styles.tabBar}>
            <TouchableOpacity style={styles.tabButton} onPress={() => { }}>
              <View style={[styles.tabButtonInner, styles.activeTabButton]}>
                <Text style={styles.activeTabText}>Home</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton} onPress={() => router.push('map' as any)}>
              <View style={styles.tabButtonInner}><Text style={styles.tabText}>Map</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton} onPress={() => router.push('circles' as any)}>
              <View style={styles.tabButtonInner}><Text style={styles.tabText}>Circles</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabButton} onPress={() => router.push('profile' as any)}>
              <View style={styles.tabButtonInner}><Text style={styles.tabText}>Profile</Text></View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fullScreenAbsolute: { 
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  centered: {
    flex:1, 
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    overflow: 'hidden',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 5, 
  },
  headerGradient: {
    paddingTop: 60, 
    paddingBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    position: 'relative',
    zIndex: 2, 
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    flexShrink: 1,
    marginRight: 8,
  },
  profileButton: {
    padding: 4,
    marginLeft: 8,
  },
  profileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99, 179, 237, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIconText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(99, 179, 237, 0.4)',
  },
  content: {
    flex: 1,
    padding: 16,
    marginBottom: 70, 
    paddingTop: 60, 
  },
  contentDark: {
    backgroundColor: 'transparent',
  },
  darkModeText: {
    color: '#E2E8F0',
  },
  principleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  principleCardDark: {
    backgroundColor: 'rgba(28, 37, 65, 0.85)',
    borderColor: 'rgba(99, 179, 237, 0.3)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  addGoalSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  addGoalSectionDark: {
    backgroundColor: 'rgba(28, 37, 65, 0.85)',
    borderColor: 'rgba(99, 179, 237, 0.3)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 12,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    color: '#2D3748',
  },
  inputDark: {
    backgroundColor: 'rgba(10, 25, 49, 0.7)',
    borderColor: 'rgba(99, 179, 237, 0.4)',
    color: '#E2E8F0',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#4A5568',
  },
  buttonGradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    overflow: 'hidden'
  },
  buttonGradientBackgroundFindOthers: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12, 
    overflow: 'hidden'
  },
  addButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  addButtonText: {
    color: '#E2F3FF',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(100, 200, 255, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    zIndex: 1,
  },
  yourGoalsSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  yourGoalsSectionDark: {
    backgroundColor: 'rgba(28, 37, 65, 0.85)',
    borderColor: 'rgba(99, 179, 237, 0.3)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllButton: {
    padding: 4,
  },
  viewAllText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  viewAllTextDark: {
    color: '#90CDF4',
  },
  goalTypeSection: {
    marginBottom: 16,
  },
  goalTypeTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#4A5568',
    marginBottom: 8,
  },
  goalsList: {
    marginBottom: 8,
  },
  goalItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  activeGoalItem: {
    backgroundColor: '#F0FFF4',
    borderLeftColor: '#38B2AC',
  },
  activeGoalItemDark: {
    backgroundColor: 'rgba(49, 151, 149, 0.3)',
    borderLeftColor: '#81E6D9',
  },
  planningGoalItem: {
    backgroundColor: '#EBF8FF',
    borderLeftColor: '#4299E1',
  },
  planningGoalItemDark: {
    backgroundColor: 'rgba(66, 153, 225, 0.3)',
    borderLeftColor: '#90CDF4',
  },
  goalText: {
    fontSize: 16,
    color: '#2D3748',
  },
  moreButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  moreButtonText: {
    color: '#718096',
    fontSize: 14,
  },
  moreButtonTextDark: {
    color: '#A0AEC0',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#718096',
  },
  findOthersButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  findOthersText: {
    color: '#E2F3FF',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(100, 200, 255, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    zIndex: 2,
  },
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    zIndex: 20, 
  },
  tabBarGradient: {
    overflow: 'hidden',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 4,
    paddingBottom: 24, 
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
    width: 85,
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
  syncToggleContainer: {},
  syncToggleTrack: {
    width: 52,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
    borderWidth: 1,
  },
  syncToggleTrackActive: {
    backgroundColor: 'rgba(255, 160, 0, 0.3)',
    borderColor: 'rgba(255, 160, 0, 0.5)',
  },
  syncToggleTrackInactive: {
    backgroundColor: 'rgba(99, 179, 237, 0.3)',
    borderColor: 'rgba(99, 179, 237, 0.5)',
  },
  syncToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  syncToggleThumbActive: {
    backgroundColor: '#FFB74D',
  },
  syncToggleThumbInactive: {
    backgroundColor: '#90CDF4',
  },
  syncToggleIcon: {
    width: 16,
    height: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFCC80',
    position: 'absolute',
  },
  sunRay1: {
    width: 16,
    height: 2,
    backgroundColor: '#FFCC80',
    position: 'absolute',
    borderRadius: 1,
  },
  sunRay2: {
    width: 2,
    height: 16,
    backgroundColor: '#FFCC80',
    position: 'absolute',
    borderRadius: 1,
  },
  sunRay3: {
    width: 12,
    height: 2,
    backgroundColor: '#FFCC80',
    position: 'absolute',
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  sunRay4: {
    width: 12,
    height: 2,
    backgroundColor: '#FFCC80',
    position: 'absolute',
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  moonIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E2E8F0',
    position: 'absolute',
  },
  moonCrater1: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(100, 120, 160, 0.4)',
    position: 'absolute',
    top: 3,
    left: 3,
  },
  moonCrater2: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(100, 120, 160, 0.4)',
    position: 'absolute',
    top: 8,
    left: 7,
  },
  // Realistic cloud styles
  cloudHeaderContainer: {
    position: 'absolute',
    top: 5, // Higher position above the header
    left: 0,
    right: 3,
    alignItems: 'center',
    zIndex: 10,
  },
  cloudBase: {
    position: 'relative',
    width: 220,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cloudText: {
    fontSize: 17, // Smaller text size
    fontWeight: 'bold',
    color: '#4A5568',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 1.5,
  },
});