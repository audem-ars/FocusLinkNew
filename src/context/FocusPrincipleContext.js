import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUCCESS_PRINCIPLES, FOCUS_PRINCIPLES } from '../constants/successPrinciples';

// Combine all principles into one array for easier access
const ALL_PRINCIPLES = [...SUCCESS_PRINCIPLES, ...FOCUS_PRINCIPLES];

export const FocusPrincipleContext = createContext();

export const FocusPrincipleProvider = ({ children }) => {
  const [todaysPrinciple, setTodaysPrinciple] = useState(null);
  const [savedPrinciples, setSavedPrinciples] = useState([]);
  const [customPrinciples, setCustomPrinciples] = useState([]);
  const [principleMode, setPrincipleMode] = useState('random'); // 'random', 'fixed', 'custom', 'silent'
  const [principleCategory, setPrincipleCategory] = useState('all'); // 'all', 'success', 'focus', 'custom'
  const [weeklyPrinciple, setWeeklyPrinciple] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Load saved data from storage on app start
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('principleMode');
        const savedCategory = await AsyncStorage.getItem('principleCategory');
        const saved = await AsyncStorage.getItem('savedPrinciples');
        const custom = await AsyncStorage.getItem('customPrinciples');
        const lastPrincipleId = await AsyncStorage.getItem('lastPrincipleId');
        const lastPrincipleDate = await AsyncStorage.getItem('lastPrincipleDate');
        const weeklySavedPrinciple = await AsyncStorage.getItem('weeklyPrinciple');
        
        // Load mode preference
        if (savedMode) {
          setPrincipleMode(savedMode);
        }
        
        // Load category preference
        if (savedCategory) {
          setPrincipleCategory(savedCategory);
        }
        
        // Load saved principles
        if (saved) {
          setSavedPrinciples(JSON.parse(saved));
        }
        
        // Load custom principles
        if (custom) {
          setCustomPrinciples(JSON.parse(custom));
        }
        
        // Load weekly principle for fixed mode
        if (weeklySavedPrinciple) {
          setWeeklyPrinciple(JSON.parse(weeklySavedPrinciple));
        }
        
        // Check if we need a new principle for today
        const today = new Date().toDateString();
        const isNewDay = !lastPrincipleDate || lastPrincipleDate !== today;
        
        // Determine which principle to show based on mode
        if (savedMode === 'fixed' && weeklySavedPrinciple) {
          // In fixed mode, always show the weekly principle
          setTodaysPrinciple(JSON.parse(weeklySavedPrinciple));
        } 
        else if (savedMode === 'custom' && custom) {
          // In custom mode, use a custom principle
          const customPrinciplesList = JSON.parse(custom);
          if (customPrinciplesList.length > 0) {
            if (isNewDay) {
              const randomCustom = getRandomPrinciple('custom');
              setTodaysPrinciple(randomCustom);
              await AsyncStorage.setItem('lastPrincipleId', randomCustom.id);
              await AsyncStorage.setItem('lastPrincipleDate', today);
            } else if (lastPrincipleId) {
              // Find the last shown principle from custom list
              const lastPrinciple = customPrinciplesList.find(p => p.id === lastPrincipleId);
              if (lastPrinciple) setTodaysPrinciple(lastPrinciple);
              else setTodaysPrinciple(customPrinciplesList[0]);
            } else {
              setTodaysPrinciple(customPrinciplesList[0]);
            }
          } else {
            // Fallback if no custom principles
            const fallback = getRandomPrinciple(principleCategory);
            setTodaysPrinciple(fallback);
          }
        } 
        else if (isNewDay || !lastPrincipleId) {
          // In random mode or if we need a new principle
          const newPrinciple = getRandomPrinciple(savedCategory || 'all');
          setTodaysPrinciple(newPrinciple);
          
          // Save today's principle
          await AsyncStorage.setItem('lastPrincipleId', newPrinciple.id);
          await AsyncStorage.setItem('lastPrincipleDate', today);
        } 
        else {
          // Use the last principle shown
          const lastPrinciple = ALL_PRINCIPLES.find(p => p.id === lastPrincipleId);
          if (lastPrinciple) {
            setTodaysPrinciple(lastPrinciple);
          } else {
            // Fallback if principle not found
            const fallback = getRandomPrinciple(savedCategory || 'all');
            setTodaysPrinciple(fallback);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading focus principle data:', error);
        
        // Fallback to a default principle if something goes wrong
        setTodaysPrinciple(FOCUS_PRINCIPLES[0]);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Get a random principle based on category
  const getRandomPrinciple = (category = 'all') => {
    let availablePrinciples = [];
    
    switch(category) {
      case 'success':
        availablePrinciples = [...SUCCESS_PRINCIPLES];
        break;
      case 'focus':
        availablePrinciples = [...FOCUS_PRINCIPLES];
        break;
      case 'custom':
        availablePrinciples = [...customPrinciples];
        break;
      case 'all':
      default:
        availablePrinciples = [...SUCCESS_PRINCIPLES, ...FOCUS_PRINCIPLES, ...customPrinciples];
        break;
    }
    
    if (availablePrinciples.length === 0) {
      return FOCUS_PRINCIPLES[0]; // Fallback
    }
    
    const randomIndex = Math.floor(Math.random() * availablePrinciples.length);
    return availablePrinciples[randomIndex];
  };
  
  // Save custom principles to storage
  useEffect(() => {
    const saveCustomPrinciples = async () => {
      if (!loading) {
        try {
          await AsyncStorage.setItem('customPrinciples', JSON.stringify(customPrinciples));
        } catch (error) {
          console.error('Error saving custom principles:', error);
        }
      }
    };
    
    saveCustomPrinciples();
  }, [customPrinciples, loading]);
  
  // Save saved principles to storage
  useEffect(() => {
    const saveSavedPrinciples = async () => {
      if (!loading) {
        try {
          await AsyncStorage.setItem('savedPrinciples', JSON.stringify(savedPrinciples));
        } catch (error) {
          console.error('Error saving favorite principles:', error);
        }
      }
    };
    
    saveSavedPrinciples();
  }, [savedPrinciples, loading]);
  
  // Save principle mode to storage
  useEffect(() => {
    const savePrincipleMode = async () => {
      if (!loading) {
        try {
          await AsyncStorage.setItem('principleMode', principleMode);
        } catch (error) {
          console.error('Error saving principle mode:', error);
        }
      }
    };
    
    savePrincipleMode();
  }, [principleMode, loading]);
  
  // Save principle category to storage
  useEffect(() => {
    const savePrincipleCategory = async () => {
      if (!loading) {
        try {
          await AsyncStorage.setItem('principleCategory', principleCategory);
        } catch (error) {
          console.error('Error saving principle category:', error);
        }
      }
    };
    
    savePrincipleCategory();
  }, [principleCategory, loading]);
  
  // Save weekly principle to storage
  useEffect(() => {
    const saveWeeklyPrinciple = async () => {
      if (!loading && weeklyPrinciple) {
        try {
          await AsyncStorage.setItem('weeklyPrinciple', JSON.stringify(weeklyPrinciple));
        } catch (error) {
          console.error('Error saving weekly principle:', error);
        }
      }
    };
    
    saveWeeklyPrinciple();
  }, [weeklyPrinciple, loading]);
  
  // Add a custom principle
  const addCustomPrinciple = (title, description = '') => {
    if (title) {
      const newPrinciple = {
        id: `custom_${Date.now()}`,
        title,
        description,
        category: 'custom'
      };
      
      setCustomPrinciples(prev => [...prev, newPrinciple]);
      return true;
    }
    return false;
  };
  
  // Remove a custom principle
  const removeCustomPrinciple = (principleId) => {
    setCustomPrinciples(prev => prev.filter(p => p.id !== principleId));
  };
  
  // Save a principle as favorite
  const savePrinciple = (principleId) => {
    // Check if principle exists
    const principle = ALL_PRINCIPLES.find(p => p.id === principleId) || 
                     customPrinciples.find(p => p.id === principleId);
    
    if (principle && !savedPrinciples.includes(principleId)) {
      setSavedPrinciples(prev => [...prev, principleId]);
      return true;
    }
    return false;
  };
  
  // Remove a principle from favorites
  const unsavePrinciple = (principleId) => {
    setSavedPrinciples(prev => prev.filter(id => id !== principleId));
  };
  
  // Set a fixed principle for the week
  const setFixedPrinciple = (principle) => {
    setWeeklyPrinciple(principle);
    setTodaysPrinciple(principle);
    setPrincipleMode('fixed');
  };
  
  // Get a new random principle
  const refreshPrinciple = () => {
    if (principleMode !== 'fixed') {
      const newPrinciple = getRandomPrinciple(principleCategory);
      setTodaysPrinciple(newPrinciple);
      
      // Save today's principle
      AsyncStorage.setItem('lastPrincipleId', newPrinciple.id);
      AsyncStorage.setItem('lastPrincipleDate', new Date().toDateString());
    }
  };
  
  // Change the principle category
  const changePrincipleCategory = (category) => {
    setPrincipleCategory(category);
    if (principleMode !== 'fixed') {
      refreshPrinciple();
    }
  };
  
  // Get all principles based on category
  const getPrinciplesByCategory = (category) => {
    switch(category) {
      case 'success':
        return SUCCESS_PRINCIPLES;
      case 'focus':
        return FOCUS_PRINCIPLES;
      case 'custom':
        return customPrinciples;
      case 'saved':
        return ALL_PRINCIPLES.concat(customPrinciples)
          .filter(p => savedPrinciples.includes(p.id));
      default:
        return ALL_PRINCIPLES.concat(customPrinciples);
    }
  };
  
  return (
    <FocusPrincipleContext.Provider
      value={{
        todaysPrinciple,
        savedPrinciples,
        customPrinciples,
        principleMode,
        principleCategory,
        weeklyPrinciple,
        setPrincipleMode,
        changePrincipleCategory,
        addCustomPrinciple,
        removeCustomPrinciple,
        savePrinciple,
        unsavePrinciple,
        setFixedPrinciple,
        refreshPrinciple,
        getPrinciplesByCategory,
        loading,
        SUCCESS_PRINCIPLES,
        FOCUS_PRINCIPLES,
        ALL_PRINCIPLES
      }}
    >
      {children}
    </FocusPrincipleContext.Provider>
  );
};