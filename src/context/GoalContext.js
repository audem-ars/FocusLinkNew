import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

export const GoalContext = createContext();

export function useGoals() {
  return useContext(GoalContext);
}

export const GoalProvider = ({ children }) => {
  const { currentUser, userProfile, updateUserProfile } = useAuth();
  const [activeGoals, setActiveGoals] = useState([]); // "I'm already doing this"
  const [planningGoals, setPlanningGoals] = useState([]); // "I'm planning to start"
  const [loading, setLoading] = useState(true);

  // Load goals from user profile on app start or when user changes
  useEffect(() => {
    const loadGoals = async () => {
      try {
        setLoading(true);
        
        if (userProfile && userProfile.goals) {
          // Filter goals based on alreadyDoing flag
          const active = userProfile.goals.filter(goal => goal.alreadyDoing);
          const planning = userProfile.goals.filter(goal => !goal.alreadyDoing);
          
          setActiveGoals(active);
          setPlanningGoals(planning);
        } else {
          // No goals in profile
          setActiveGoals([]);
          setPlanningGoals([]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading goals from profile:', error);
        setLoading(false);
      }
    };
    
    loadGoals();
  }, [userProfile]);

  // Add a new goal (either active or planning)
  const addGoal = async (text, isActive) => {
    if (!currentUser || !text.trim()) return null;
    
    try {
      // Create new goal object
      const newGoal = {
        id: Date.now().toString(),
        text: text.trim(),
        isActive: true, // This is for display in the profile (active vs archived)
        alreadyDoing: isActive, // This is the key field that determines doing vs planning
        createdAt: new Date().toISOString()
      };
      
      // Update local state
      if (isActive) {
        setActiveGoals(prev => [...prev, newGoal]);
      } else {
        setPlanningGoals(prev => [...prev, newGoal]);
      }
      
      // Get all existing goals
      const allGoals = [...activeGoals, ...planningGoals, newGoal];
      
      // Update user profile with all goals
      await updateUserProfile({
        goal: text.trim(), // Set as current main goal
        goals: allGoals,
        isActive: isActive // This is redundant information for backward compatibility
      });
      
      return newGoal;
    } catch (error) {
      console.error("Error adding goal:", error);
      return null;
    }
  };

  // Update a goal
  const updateGoal = async (goalId, updates) => {
    try {
      // Check which list contains the goal
      let updatedGoal = null;
      let isActive = false;
      
      // Check if goal is in active goals
      const activeIndex = activeGoals.findIndex(g => g.id === goalId);
      if (activeIndex >= 0) {
        isActive = true;
        updatedGoal = { ...activeGoals[activeIndex], ...updates };
      } else {
        // Check if goal is in planning goals
        const planningIndex = planningGoals.findIndex(g => g.id === goalId);
        if (planningIndex >= 0) {
          updatedGoal = { ...planningGoals[planningIndex], ...updates };
        }
      }
      
      if (!updatedGoal) return false; // Goal not found
      
      // If alreadyDoing status is changing, move between lists
      if ('alreadyDoing' in updates) {
        if (updates.alreadyDoing) {
          // Moving from planning to active
          setPlanningGoals(prev => prev.filter(g => g.id !== goalId));
          setActiveGoals(prev => [...prev, updatedGoal]);
        } else {
          // Moving from active to planning
          setActiveGoals(prev => prev.filter(g => g.id !== goalId));
          setPlanningGoals(prev => [...prev, updatedGoal]);
        }
      } else {
        // Just updating other properties
        if (isActive) {
          setActiveGoals(prev => 
            prev.map(g => g.id === goalId ? updatedGoal : g)
          );
        } else {
          setPlanningGoals(prev => 
            prev.map(g => g.id === goalId ? updatedGoal : g)
          );
        }
      }
      
      // Get all goals for profile update
      const allGoals = [
        ...activeGoals.filter(g => g.id !== goalId || !isActive),
        ...planningGoals.filter(g => g.id !== goalId || isActive),
        updatedGoal
      ];
      
      // Update user profile
      await updateUserProfile({
        goals: allGoals
      });
      
      return true;
    } catch (error) {
      console.error("Error updating goal:", error);
      return false;
    }
  };

  // Delete a goal
  const deleteGoal = async (goalId) => {
    try {
      // Check which list contains the goal
      let isActive = false;
      
      // Check if goal is in active goals
      const activeIndex = activeGoals.findIndex(g => g.id === goalId);
      if (activeIndex >= 0) {
        isActive = true;
        setActiveGoals(prev => prev.filter(g => g.id !== goalId));
      } else {
        // Check if goal is in planning goals
        const planningIndex = planningGoals.findIndex(g => g.id === goalId);
        if (planningIndex >= 0) {
          setPlanningGoals(prev => prev.filter(g => g.id !== goalId));
        } else {
          return false; // Goal not found
        }
      }
      
      // Get all goals for profile update
      const allGoals = [
        ...activeGoals.filter(g => g.id !== goalId),
        ...planningGoals.filter(g => g.id !== goalId)
      ];
      
      // Update user profile
      await updateUserProfile({
        goals: allGoals
      });
      
      return true;
    } catch (error) {
      console.error("Error deleting goal:", error);
      return false;
    }
  };

  // Set a goal's active status
  const setGoalActive = async (goalId, isActive) => {
    return updateGoal(goalId, { isActive });
  };

  // Find users with the same goal - separated by active/planning
  const findUsersWithSameGoal = async (goalText, alreadyDoing) => {
    // This is just a placeholder - the real implementation would come from AuthContext
    // We're adding the filter for alreadyDoing to make sure we only get users with similar status
    
    // Sample implementation that uses the findUsersWithSameGoal from AuthContext if it exists
    if (typeof useAuth().findUsersWithSameGoal === 'function') {
      // You would need to update the AuthContext.findUsersWithSameGoal to accept an alreadyDoing parameter
      // This is a modification you'd need to make to the AuthContext.js file
      return []; // Replace with actual call once implemented
    }
    
    return []; // Placeholder for now
  };

  return (
    <GoalContext.Provider
      value={{
        activeGoals,
        planningGoals,
        loading,
        addGoal,
        updateGoal,
        deleteGoal,
        setGoalActive,
        findUsersWithSameGoal
      }}
    >
      {children}
    </GoalContext.Provider>
  );
};