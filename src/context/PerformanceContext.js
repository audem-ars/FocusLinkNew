// src/context/PerformanceContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const PerformanceContext = createContext();

export function PerformanceProvider({ children }) {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isRouteTransitioning, setIsRouteTransitioning] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, icons, images
        // Fake delay to ensure all resources are loaded
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
        SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  const startRouteTransition = () => setIsRouteTransitioning(true);
  const endRouteTransition = () => setIsRouteTransitioning(false);

  return (
    <PerformanceContext.Provider
      value={{
        appIsReady,
        isRouteTransitioning,
        startRouteTransition,
        endRouteTransition
      }}
    >
      {children}
    </PerformanceContext.Provider>
  );
}

export const usePerformance = () => useContext(PerformanceContext);