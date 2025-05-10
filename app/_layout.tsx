import React from 'react';
import { Slot } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';
import { FocusPrincipleProvider } from '../src/context/FocusPrincipleContext';
import { GoalProvider } from '../src/context/GoalContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <GoalProvider>
          <FocusPrincipleProvider>
            <Slot />
          </FocusPrincipleProvider>
        </GoalProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}