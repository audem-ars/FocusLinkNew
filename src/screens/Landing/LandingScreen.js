import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import components
import FocusPrinciple from '../../components/FocusPrinciple/FocusPrinciple';

// Import contexts
import { GoalContext } from '../../context/GoalContext';
import { FocusPrincipleContext } from '../../context/FocusPrincipleContext';

// Import suggestions (temporary mock data)
import { goalSuggestions } from '../../constants/goalSuggestions';

const LandingScreen = () => {
  const navigation = useNavigation();
  const { setCurrentGoal } = useContext(GoalContext);
  const { todaysPrinciple } = useContext(FocusPrincipleContext);
  
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [alreadyDoing, setAlreadyDoing] = useState(false);
  
  // Animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];
  
  useEffect(() => {
    // Animate elements on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  }, []);
  
  useEffect(() => {
    // Filter suggestions based on input
    if (inputValue.length > 2) {
      const filtered = goalSuggestions.filter(item =>
        item.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [inputValue]);
  
  const handleSubmit = () => {
    if (inputValue.trim()) {
      setCurrentGoal({
        text: inputValue.trim(),
        isActive: true,
        alreadyDoing: alreadyDoing
      });
      
      Keyboard.dismiss();
      navigation.navigate('Map');
    }
  };
  
  const handleSuggestionSelect = (suggestion) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      
      {/* Focus Principle Card */}
      <FocusPrinciple principle={todaysPrinciple} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formContainer}
      >
        <Animated.Text 
          style={[
            styles.headline, 
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          What do you want to do?
        </Animated.Text>
        
        <Animated.View 
          style={[
            styles.inputContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="I want to..."
            placeholderTextColor="#667"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />
          
          <TouchableOpacity 
            style={[
              styles.submitButton,
              !inputValue.trim() && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!inputValue.trim()}
          >
            <Text style={styles.submitButtonText}>Find Path</Text>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Suggestions list */}
        {showSuggestions && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionItem}
                onPress={() => handleSuggestionSelect(suggestion)}
              >
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {/* Already doing this button */}
        <Animated.View
          style={[
            styles.alreadyDoingContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <TouchableOpacity
            style={[
              styles.alreadyDoingButton,
              alreadyDoing && styles.alreadyDoingButtonActive
            ]}
            onPress={() => setAlreadyDoing(!alreadyDoing)}
          >
            <Text
              style={[
                styles.alreadyDoingText,
                alreadyDoing && styles.alreadyDoingTextActive
              ]}
            >
              I'm already doing this
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  formContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headline: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1D1E',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: '#1A1D1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#A0AEC0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  suggestionsContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    maxHeight: 200,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  suggestionText: {
    fontSize: 16,
    color: '#2D3748',
  },
  alreadyDoingContainer: {
    marginTop: 20,
  },
  alreadyDoingButton: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E0',
  },
  alreadyDoingButtonActive: {
    backgroundColor: '#EBF8FF',
    borderColor: '#4299E1',
  },
  alreadyDoingText: {
    color: '#718096',
    fontSize: 16,
  },
  alreadyDoingTextActive: {
    color: '#2B6CB0',
    fontWeight: '500',
  },
});

export default LandingScreen;