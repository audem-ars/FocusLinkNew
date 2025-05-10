import React, { useState, useEffect, Suspense } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  StatusBar,
  ActivityIndicator 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { useAuth } from './src/context/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Lazy-loaded components
const AuthNavigator = React.lazy(() => import('./src/navigation/AuthNavigator'));
const MainNavigator = React.lazy(() => import('./src/navigation/MainNavigator'));

// Loading fallback component with stars
const LoadingScreen = () => {
  // Stars background for loading screen
  const StarryBackground = () => {
    const stars = Array.from({ length: 30 }, (_, i) => {
      const size = Math.random() * 1.5 + 0.5;
      const opacity = useSharedValue(Math.random() * 0.5 + 0.3);
      
      useEffect(() => {
        opacity.value = withRepeat(
          withTiming(Math.random() * 0.3 + 0.7, {
            duration: 1000 + Math.random() * 2000,
            easing: Easing.inOut(Easing.ease),
          }),
          -1, 
          true
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
    
    return stars;
  };

  return (
    <LinearGradient
      colors={['#0f1729', '#1c2741', '#121a2c']}
      style={styles.loadingContainer}
    >
      <StarryBackground />
      <ActivityIndicator size="large" color="#FFFFFF" />
      <Text style={styles.loadingText}>Loading FocusLink...</Text>
    </LinearGradient>
  );
};

// Root component
const AppContent = () => {
  const { currentUser, loading } = useAuth();
  const [appIsReady, setAppIsReady] = useState(false);

  // Prepare the app
  useEffect(() => {
    async function prepare() {
      try {
        // Perform any initialization tasks here
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        // Hide splash screen
        setAppIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!appIsReady || loading) {
    return <LoadingScreen />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <NavigationContainer>
        {currentUser ? <MainNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </Suspense>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121a2c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.8,
  },
  focusPrinciple: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  principleText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#FFFFFF',
    fontStyle: 'italic',
  },
  inputContainer: {
    width: '100%',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: 'rgba(160, 174, 192, 0.5)',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  toggleButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(203, 213, 224, 0.3)',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(66, 153, 225, 0.3)',
    borderColor: '#4299E1',
  },
  toggleButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
});