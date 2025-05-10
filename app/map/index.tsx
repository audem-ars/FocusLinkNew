import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import { useGoals } from '../../src/context/GoalContext';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../src/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import PersonalizationModal from './components/PersonalizationModal';
import { LinearGradient } from 'expo-linear-gradient';
import { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import * as ReanimatedAnimated from 'react-native-reanimated';


// Simplified BottomSheet component - embedded directly to avoid requiring a new file
interface CustomBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: string | number;
}

const CustomBottomSheet = ({ 
  visible, 
  onClose, 
  children, 
  height = '60%' 
}: CustomBottomSheetProps) => {
  const insets = useSafeAreaInsets();
  const bottomSheetHeight = typeof height === 'string' 
    ? Dimensions.get('window').height * (parseInt(height) / 100)
    : height;
  
  const translateY = useRef(new Animated.Value(bottomSheetHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Open the bottom sheet
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Close the bottom sheet
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: bottomSheetHeight,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, bottomSheetHeight]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View 
          style={[
            {
              ...StyleSheet.absoluteFillObject,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 1
            },
            { opacity: backdropOpacity }
          ]}
        />
      </TouchableWithoutFeedback>
      
      <Animated.View 
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 12,
            zIndex: 2,
            elevation: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -3 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
          },
          { 
            height: bottomSheetHeight, 
            transform: [{ translateY }],
            paddingBottom: insets.bottom
          }
        ]}
      >
        <View style={{
          width: 40,
          height: 5,
          backgroundColor: '#DDDDDD',
          borderRadius: 3,
          alignSelf: 'center',
          marginBottom: 8
        }} />
        <View style={{
          flex: 1,
          padding: 16
        }}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

type MapViewType = MapView;

// Goal type definition
interface Goal {
  id: string;
  text: string;
  isActive: boolean;
  alreadyDoing: boolean;
  createdAt?: string;
  isSpotlight?: boolean;
}

// User data type
interface User {
  id: string; // Firestore document ID
  uid: string; // Firebase Auth UID
  name: string;
  goal?: string;
  email: string;
  bio?: string;
  displayLocation?: string;
  photoURL?: string | null;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  spotlightGoal?: {
    id: string;
    text: string;
    alreadyDoing: boolean;
  };
  matchingGoals?: {
    id: string;
    text: string;
    alreadyDoing: boolean;
    isActive: boolean;
  }[];
  goals?: Goal[];
  settings?: {
    shareLocation?: boolean;
  };
  mapEmoji?: string;
}

// Starry background component for header
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

  return stars;
};

export default function Map() {
  const router = useRouter();
  const { currentUser, userProfile, updateUserProfile } = useAuth();
  const { activeGoals, planningGoals } = useGoals();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapViewType | null>(null);
  const scrollViewRef = useRef(new Animated.Value(0)); // Use the React Native Animated
  const scrollY = new Animated.Value(0);

  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchMode, setSearchMode] = useState<'doing' | 'planning' | 'all'>('all');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState<boolean>(false);
  const [spotlightModalVisible, setSpotlightModalVisible] = useState<boolean>(false);
  const [userSpotlightGoal, setUserSpotlightGoal] = useState<Goal | null>(null);
  const [isShowingSearchResults, setIsShowingSearchResults] = useState<boolean>(false);
  const [keywordLabelsVisible, setKeywordLabelsVisible] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connected'|'pending'|'none'>('none');
  const [markerPositions, setMarkerPositions] = useState<{[key: string]: {x: number, y: number}}>({});
  const [mapLayout, setMapLayout] = useState<{width: number, height: number} | null>(null);
  const [isMapMoving, setIsMapMoving] = useState<boolean>(false);
  const [userEmoji, setUserEmoji] = useState<string>('📍'); // Default pin emoji
  const [showPersonalizationModal, setShowPersonalizationModal] = useState<boolean>(false);


  // Effect for location permission and initial load
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === 'granted';
        setLocationPermission(granted);

        let locationCoords = { // Default to Seattle
          latitude: 47.6062,
          longitude: -122.3321
        };

        if (granted) {
          try {
            const location = await Location.getCurrentPositionAsync({});
            locationCoords = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            };

            // Update user location in profile if changed significantly
            if (currentUser) {
              updateUserProfile({
                coordinates: locationCoords,
                lastActive: new Date() // Also update last active timestamp
              });
            }

            // Load nearby users
            loadNearbyUsers(locationCoords.latitude, locationCoords.longitude);

          } catch (error) {
            console.log('Error getting location:', error);
            Alert.alert("Location Error", "Could not get your current location. Using default location.");
            loadNearbyUsers(locationCoords.latitude, locationCoords.longitude);
          }
        } else {
          Alert.alert("Location Permission Denied", "Location permission is needed to show nearby users. Using default location.");
          loadNearbyUsers(locationCoords.latitude, locationCoords.longitude);
        }

        setUserLocation(locationCoords);

      } else {
        // For web, use default location
        setUserLocation({
          latitude: 47.6062,
          longitude: -122.3321
        });
        loadNearbyUsers(47.6062, -122.3321);
      }
    })();
  }, []);

  // Effect for setting the user's spotlight goal display
  useEffect(() => {
    if (userProfile && userProfile.goals) {
      const spotlight = userProfile.goals.find((goal: Goal) => goal.isSpotlight);
      if (spotlight) {
        setUserSpotlightGoal(spotlight);
      } else {
        // Default to first active goal if no spotlight is set
        const firstActiveGoal = userProfile.goals.find((g: Goal) => g.isActive && g.alreadyDoing);
        const firstPlanningGoal = userProfile.goals.find((g: Goal) => g.isActive && !g.alreadyDoing);
        setUserSpotlightGoal(firstActiveGoal || firstPlanningGoal || null);
      }
    }
  }, [userProfile]);

  // Effect to load user emoji if saved
  useEffect(() => {
    if (userProfile && userProfile.mapEmoji) {
      setUserEmoji(userProfile.mapEmoji);
    }
  }, [userProfile]);

  // Add this effect to check connection status when selectedUser changes
  useEffect(() => {
    const checkConnectionStatus = async () => {
      if (!currentUser || !selectedUser) {
        setConnectionStatus('none');
        return;
      }

      try {
        const userIds = [currentUser.uid, selectedUser.uid].sort();
        const connectionId = userIds.join('_');
        const connectionRef = doc(db, 'connections', connectionId);
        const connectionDoc = await getDoc(connectionRef);

        if (connectionDoc.exists()) {
          const connectionData = connectionDoc.data();
          setConnectionStatus(connectionData.status === 'pending' ? 'pending' : 'connected');
        } else {
          setConnectionStatus('none');
        }
      } catch (error) {
        console.error('Error checking connection status:', error);
        setConnectionStatus('none');
      }
    };

    checkConnectionStatus();
  }, [selectedUser, currentUser]);

  // Add this useEffect hook for debugging modal visibility
  useEffect(() => {
    console.log('Spotlight modal visible changed to:', spotlightModalVisible);
  }, [spotlightModalVisible]);


  const extractKeywords = (text: string): string[] => {
    console.log(`Extracting keywords from: "${text}"`);

    if (!text) {
      console.log("No text provided, returning empty array");
      return [];
    }

    // Remove common words and special characters
    const commonWords = ['the', 'and', 'of', 'to', 'a', 'in', 'for', 'is', 'on', 'that', 'by', 'this', 'with', 'i', 'you', 'it', 'test', 'will', 'want', 'going', 'plan', 'focus', 'learn', 'doing'];

    // First pass: remove common words and get potential keywords
    const allWords = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word));

    console.log(`Found ${allWords.length} candidate keywords: ${allWords.join(', ')}`);

    // Prioritize words - longer words are often more meaningful nouns
    const sortedWords = [...allWords].sort((a, b) => {
      // Prioritize longer words first
      if (a.length !== b.length) return b.length - a.length;
      // Then alphabetical if same length
      return a.localeCompare(b);
    });

    const result = sortedWords.slice(0, 2);
    console.log(`Selected keywords: ${result.join(', ')}`);
    // Add this right before the return statement in extractKeywords
    console.log(`Final keywords selected: ${result.join(', ')}`);
    console.log(`Final keywords length: ${result.join(' ').length} characters`);
    return result;
  };

  // Enhanced function to load nearby users from Firestore
  const loadNearbyUsers = async (latitude: number, longitude: number) => {
    if (!currentUser) return;

    setIsLoadingNearby(true);
    try {
      console.log("Loading nearby users at coordinates:", latitude, longitude);
      // Get all users for testing - don't filter by distance yet to see what's available
      const usersRef = collection(db, 'users');
      // Exclude the current user from the nearby list
      const usersQuery = query(usersRef, where("uid", "!=", currentUser.uid));
      const usersSnapshot = await getDocs(usersQuery);

      const nearby: User[] = [];
      console.log(`Found ${usersSnapshot.size} total other users in database`);

      usersSnapshot.forEach(doc => {
        const userData = doc.data() as Omit<User, 'id'>;
        console.log(`Checking user: ${userData.name || 'Unknown'}, has coordinates: ${userData.coordinates ? 'Yes' : 'No'}`);

        // Include users with location and settings allowing shareLocation (if field exists)
        // Default to sharing if setting is not present
        const shouldShareLocation = userData.settings?.shareLocation !== false;

        if (userData.coordinates && shouldShareLocation) {
          // Find their spotlight goal or default to first active
          let userSpotlightGoalData: User['spotlightGoal'] | undefined = undefined;
          if (userData.goals && userData.goals.length > 0) {
            const foundSpotlight = userData.goals.find(g => g.isSpotlight);
            const firstActive = userData.goals.find(g => g.isActive && g.alreadyDoing);
            const firstPlanning = userData.goals.find(g => g.isActive && !g.alreadyDoing);
            const goalToShow = foundSpotlight || firstActive || firstPlanning;

            if (goalToShow) {
              userSpotlightGoalData = {
                id: goalToShow.id,
                text: goalToShow.text,
                alreadyDoing: goalToShow.alreadyDoing
              };
            }
          }

          // Add user to nearby list
          nearby.push({
            id: doc.id,
            ...userData,
            spotlightGoal: userSpotlightGoalData
          });
        } else {
           console.log(`User ${userData.name || doc.id} skipped (No coordinates or location sharing disabled)`);
        }
      });

      console.log(`Added ${nearby.length} users with coordinates & sharing enabled`);
      setNearbyUsers(nearby);
    } catch (error) {
      console.error('Error loading nearby users:', error);
      Alert.alert("Error", "Could not load nearby users.");
    } finally {
      setIsLoadingNearby(false);
    }
  };


  // Helper function to calculate distance between coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in miles
  };

  // Enhanced function to find users with similar goals
  const findUsersWithSameGoal = async (goalText: string, alreadyDoing: boolean | null = null) => {
    if (!currentUser) return [];

    try {
      console.log(`Searching for users with focus area: ${goalText}, status: ${alreadyDoing === null ? 'any' : alreadyDoing ? 'doing' : 'planning'}`);

      // Get all users (we'll filter client-side for better matching)
      const usersRef = collection(db, "users");
      const usersQuery = query(usersRef, where("uid", "!=", currentUser.uid)); // Exclude current user
      const querySnapshot = await getDocs(usersQuery);

      console.log(`Got ${querySnapshot.size} total users to check`);

      let matchingUsers: User[] = [];

      // Normalize the search text for better matching
      const normalizedSearchText = goalText.toLowerCase().trim();

      // Filter users client-side by checking their goals array
      querySnapshot.forEach((doc) => {
        const userData = doc.data() as Omit<User, 'id'>;

        // Filter out users who have disabled location sharing IF they have coordinates
        const shouldShareLocation = userData.settings?.shareLocation !== false;
        if (!shouldShareLocation && userData.coordinates) {
           console.log(`User ${userData.name || doc.id} skipped search (location sharing disabled)`);
           return; // Skip this user
        }

        console.log(`User ${userData.name || userData.email} has ${userData.goals?.length || 0} goals`);

        if (userData.goals && Array.isArray(userData.goals)) {
          // Find matching goals using fuzzy matching
          const matchingGoals = userData.goals.filter(goal => {
            // Skip inactive goals
            if (!goal.isActive) return false;

            const normalizedGoalText = goal.text.toLowerCase().trim();

            // Check if status matches the filter (if filter is applied)
            const statusMatches = (alreadyDoing === null || goal.alreadyDoing === alreadyDoing);
            if (!statusMatches) return false;

            console.log(`Comparing "${normalizedGoalText}" with "${normalizedSearchText}"`);

            // Exact match
            if (normalizedGoalText === normalizedSearchText) {
              console.log("EXACT MATCH FOUND");
              return true;
            }

            // Contains match (more flexible)
            if (normalizedGoalText.includes(normalizedSearchText) ||
                normalizedSearchText.includes(normalizedGoalText)) {
              console.log("CONTAINS MATCH FOUND");
              return true;
            }

            // Word-by-word match (even more flexible)
            const searchWords = normalizedSearchText.split(/\s+/).filter(w => w.length > 1);
            const goalWords = normalizedGoalText.split(/\s+/).filter(w => w.length > 1);

            if (searchWords.length === 0 || goalWords.length === 0) return false;

            // If at least 40% of the words match (more permissive)
            const matchCount = searchWords.filter(word =>
              goalWords.some(goalWord => goalWord.includes(word) || word.includes(goalWord))
            ).length;

            const minWordCount = Math.min(searchWords.length, goalWords.length);
            const matchPercentage = minWordCount > 0 ? matchCount / minWordCount : 0;

            if (matchPercentage > 0) {
              console.log(`Word match percentage: ${matchPercentage * 100}%`);
            }

            return matchPercentage >= 0.4; // Lower threshold for more results
          });

          // If there are matching goals, include this user
          if (matchingGoals.length > 0) {
            console.log(`User ${userData.name || userData.email} has ${matchingGoals.length} matching goals`);

            // Sort matching goals by match quality
            matchingGoals.sort((a, b) => {
              const aIsExact = a.text.toLowerCase().trim() === normalizedSearchText;
              const bIsExact = b.text.toLowerCase().trim() === normalizedSearchText;

              if (aIsExact && !bIsExact) return -1;
              if (!aIsExact && bIsExact) return 1;
              return 0;
            });

            // Find their spotlight goal if any
            let userSpotlightGoalData: User['spotlightGoal'] | undefined = undefined;
            if (userData.goals && userData.goals.length > 0) {
              const foundSpotlight = userData.goals.find(g => g.isSpotlight);
              const firstActive = userData.goals.find(g => g.isActive && g.alreadyDoing);
              const firstPlanning = userData.goals.find(g => g.isActive && !g.alreadyDoing);
              const goalToShow = foundSpotlight || firstActive || firstPlanning;

              if (goalToShow) {
                userSpotlightGoalData = {
                  id: goalToShow.id,
                  text: goalToShow.text,
                  alreadyDoing: goalToShow.alreadyDoing
                };
              }
            }

            const { uid, ...restData } = userData;
            matchingUsers.push({
              id: doc.id,
              uid: uid,
              ...restData,
              matchingGoals,
              spotlightGoal: userSpotlightGoalData
            });
          }
        }
      });

      console.log(`Found ${matchingUsers.length} users with similar focus areas`);

      // Log details of matching users
      matchingUsers.forEach((user, index) => {
        console.log(`Match ${index+1}: ${user.name} with coordinates: ${user.coordinates ? 'YES' : 'NO'}`);
      });

      return matchingUsers;
    } catch (error) {
      console.error("Error finding users:", error);
      Alert.alert("Search Error", "An error occurred while searching for users.");
      return [];
    }
  };


  // Enhanced search handling
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert("Please Enter a Focus Area", "Enter a focus area to search for others with similar interests.");
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setSelectedUser(null);

    try {
      // Determine the status filter based on searchMode
      const searchStatus = (searchMode === 'doing') ? true :
                         (searchMode === 'planning') ? false : null;

      const results = await findUsersWithSameGoal(
        searchQuery.trim(),
        searchStatus
      );

      // Filter results to only include users with coordinates OR those without coordinates
      // If location sharing is off, they shouldn't appear on map but maybe list? For now, filter out
      const displayableResults = results.filter(user => {
         const hasCoords = !!user.coordinates;
         const sharesLocation = user.settings?.shareLocation !== false;
         // Show if they have coords and share location, OR if they don't have coords at all
         return (hasCoords && sharesLocation) || !hasCoords;
      });


      setSearchResults(displayableResults);
      setIsShowingSearchResults(true);

      // If we have results with coordinates, focus the map on those results
      if (displayableResults.length > 0) {
        const usersWithCoordinates = displayableResults.filter((user: User) => user.coordinates && user.settings?.shareLocation !== false);

        if (usersWithCoordinates.length > 0 && Platform.OS !== 'web') {
          // Center map on first result if available
          if (mapRef.current && usersWithCoordinates[0].coordinates) {
            mapRef.current.animateToRegion({
              latitude: usersWithCoordinates[0].coordinates.latitude,
              longitude: usersWithCoordinates[0].coordinates.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05
            }, 1000);
          }
        }
      }

      // Show message if no *displayable* results found
      if (displayableResults.length === 0) {
        Alert.alert(
          "No Matches Found",
          `No users found sharing their location ${searchMode !== 'all' ? `who are ${searchMode === 'doing' ? 'doing' : 'starting'}` : ''} "${searchQuery.trim()}". Try broadening your search.`
        );
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert("Search Error", "Failed to search for users. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Function to search based on one of the user's own goals
  const handleSearchMyGoal = async (goalText: string, alreadyDoing: boolean) => {
    setSearchQuery(goalText);
    setSearchMode(alreadyDoing ? 'doing' : 'planning');
    // Use setTimeout to ensure state updates before triggering search
    setTimeout(() => handleSearch(), 100);
  };

  // Function to clear search results and return to nearby view
  const clearSearch = () => {
    setSearchResults([]);
    setIsShowingSearchResults(false);
    setSearchQuery('');
    setSelectedUser(null); // Also clear selected user

    // Re-center map on user location
    if (mapRef.current && userLocation && Platform.OS !== 'web') {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05
      }, 1000);
      // Also reload nearby users to refresh the map pins
      loadNearbyUsers(userLocation.latitude, userLocation.longitude);
    } else if (Platform.OS === 'web' && userLocation) {
        // For web, just reload nearby users for the list view
        loadNearbyUsers(userLocation.latitude, userLocation.longitude);
    }
  };

  // Function to update the user's spotlight goal
  const setSpotlightGoal = async (goal: Goal) => {
    if (!currentUser || !userProfile || !userProfile.goals) return;

    setIsLoadingNearby(true); // Use loading state for visual feedback
    try {
      // Update all goals to remove previous spotlight and set the new one
      const updatedGoals = userProfile.goals.map((goalItem: Goal) => ({
        ...goalItem,
        isSpotlight: goalItem.id === goal.id
      }));

      // Update user profile in context and Firestore
      await updateUserProfile({
        goals: updatedGoals
      });

      setUserSpotlightGoal(goal); // Update local state immediately
      setSpotlightModalVisible(false);

      Alert.alert("Success", "Your spotlight focus has been updated!");

      // Reload nearby users to reflect changes on map/list
      if (userLocation) {
        loadNearbyUsers(userLocation.latitude, userLocation.longitude);
      }

    } catch (error) {
      console.error('Error setting spotlight goal:', error);
      Alert.alert("Error", "Failed to update spotlight focus. Please try again.");
    } finally {
      setIsLoadingNearby(false);
    }
  };

  // Enhanced function to initiate contact/messaging with another user
  const initiateContact = async (userId: string) => {
    if (!currentUser || !userId) return;

    try {
      console.log("Initiating contact with user:", userId);

      // Check if connection already exists
      const userIds = [currentUser.uid, userId].sort();
      const connectionId = userIds.join('_');
      const connectionRef = doc(db, 'connections', connectionId);
      const connectionDoc = await getDoc(connectionRef);

      // Log connection status for debugging
      console.log("Connection exists:", connectionDoc.exists());

      if (connectionDoc.exists()) {
        console.log("CONNECTION EXISTS - Going to connections tab");
        // Connection exists, go directly to connections tab
        router.push({
          pathname: '/circles',
          params: {
            initialTab: 'connections', // Explicitly set to connections tab
            showConnection: connectionId // Pass the connection ID to highlight
          }
        });
      } else {
        console.log("NO CONNECTION - Creating new connection");
        // If connection doesn't exist, create one
        await setDoc(connectionRef, {
          id: connectionId,
          users: userIds,
          status: 'pending',
          requestedBy: currentUser.uid,
          createdAt: serverTimestamp(),
          lastActivity: serverTimestamp()
        });

        // Navigate to discover tab
        router.push({
          pathname: '/circles',
          params: {
            initialTab: 'discover',
            connectWith: userId
          }
        });
      }

      setSelectedUser(null); // Close the detail modal
    } catch (error) {
      console.error('Error initiating contact:', error);
      Alert.alert("Error", "Failed to connect. Please try again.");
    }
  };

  const toggleKeywordLabels = () => {
    const newValue = !keywordLabelsVisible;
    console.log(`Toggle keywords from ${keywordLabelsVisible} to ${newValue}`);
    setKeywordLabelsVisible(newValue);

    // Log markers that will be affected
    console.log(`Number of nearby users with markers: ${nearbyUsers.filter(u=>u.coordinates).length}`);
    console.log(`Number of search results with markers: ${searchResults.filter(u=>u.coordinates).length}`);
    console.log(`Self marker has keywords: ${userSpotlightGoal ? 'YES' : 'NO'}`);

    // Force update (without changing the original marker code)
    // This is a bit hacky, better ways might exist depending on library versions
    setTimeout(() => {
      console.log("Forcing marker refresh (simulated)");
      if (isShowingSearchResults) {
        const refreshed = [...searchResults];
        setSearchResults(refreshed);
      } else {
        const refreshed = [...nearbyUsers];
        setNearbyUsers(refreshed);
      }
    }, 100);
  };

  // Function to track marker positions
  const trackMarkerPosition = (markerId: string, coordinates: {latitude: number, longitude: number}) => {
    if (mapRef.current && mapLayout && Platform.OS !== 'web') {
      // Use the correct API method: pointForCoordinate
      mapRef.current.pointForCoordinate(coordinates)
        .then((point: {x: number, y: number}) => {
          setMarkerPositions(prev => ({
            ...prev,
            [markerId]: {x: point.x, y: point.y}
          }));
        })
        .catch((err: Error) => {
          console.error('Error converting coordinate to point:', err);
        });
    }
  };

  // Add a useEffect hook to update positions when map moves
  useEffect(() => {
    if (!mapRef.current || !mapLayout || Platform.OS === 'web') return;

    // Function to update all marker positions
    const updateAllMarkerPositions = () => {
      // Update self marker position
      if (userLocation) {
        trackMarkerPosition('self', userLocation);
      }

      // Update nearby user markers or search result markers
      const usersToTrack = isShowingSearchResults ? searchResults : nearbyUsers;
      usersToTrack.forEach(user => {
         const markerIdPrefix = isShowingSearchResults ? 'search' : 'user';
         if (user.coordinates && user.settings?.shareLocation !== false) {
           trackMarkerPosition(`${markerIdPrefix}-${user.id}`, user.coordinates);
         }
      });
    };

    // Update positions initially
    updateAllMarkerPositions();

    // No listener needed, updates happen on region change complete

    return () => {
      // No cleanup needed here
    };
  }, [mapRef.current, mapLayout, userLocation, nearbyUsers, searchResults, isShowingSearchResults]); // Dependencies trigger updates


  const renderUserMarker = (user: User, isSearchResult: boolean = false) => {
    if (!user.coordinates || user.uid === currentUser?.uid) return null;
    
    const markerId = isSearchResult ? `search-${user.id}` : `user-${user.id}`;
    
    return (
      <Marker
        key={markerId}
        identifier={markerId}
        coordinate={user.coordinates}
        onPress={() => {
          // Force panel to open immediately with a small timeout
          setTimeout(() => {
            console.log(`--- Marker pressed for user: ${user.name} (ID: ${user.uid}) ---`);
            
            // Create a new object to force state update
            setSelectedUser({...user});
            
            console.log(`--- selectedUser state changed to: ${user.name}`);
            
            // Check connection status
            if (currentUser) {
              console.log(`--- Checking connection status between ${currentUser.uid} and ${user.uid} ---`);
              const userIds = [currentUser.uid, user.uid].sort();
              const connectionId = userIds.join('_');
              const connectionRef = doc(db, 'connections', connectionId);
              getDoc(connectionRef).then(docSnap => {
                if (docSnap.exists()) {
                  const status = docSnap.data().status;
                  console.log(`--- Connection found, status: ${status}`);
                  setConnectionStatus(status === 'pending' ? 'pending' : 'connected');
                } else {
                  console.log('--- No existing connection found ---');
                  setConnectionStatus('none');
                }
              });
            }
          }, 10); // Small 10ms timeout to break the event chain
        }}
        onLayout={() => {
          if (user.coordinates) {
            trackMarkerPosition(markerId, user.coordinates);
          }
        }}
      >
        <View style={{
  width: 40, 
  height: 40, 
  justifyContent: 'center', 
  alignItems: 'center',
}}>
  {user.mapEmoji === 'profile_photo' && user.photoURL ? (
    <Image 
      source={{ uri: user.photoURL }} 
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.5,
      }}
    />
  ) : (
    <Text style={{
      fontSize: 22,
      textAlign: 'center',
      backgroundColor: 'transparent',
    }}>
      {user.mapEmoji || '📍'}
    </Text>
  )}
</View>
      </Marker>
    );
  };

  // Improved self marker with proper emoji sizing AND labels
  const renderSelfMarker = () => {
    if (!userLocation || !currentUser) return null;

    const markerId = 'self';

    return (
      <Marker
        key={markerId}
        identifier={markerId}
        coordinate={userLocation}
        anchor={{x: 0.5, y: 0.5}} // Center the emoji properly
        zIndex={10}
        onPress={() => { // Add logging here too
          console.log('Self marker pressed');
          // Optional: Could recenter map or just let callout appear
        }}
        onLayout={() => { // Track position for label
          if (userLocation) {
            trackMarkerPosition('self', userLocation);
          }
        }}
      >
        <View style={{
  justifyContent: 'center',
  alignItems: 'center',
}}>
  {userEmoji === 'profile_photo' && userProfile?.photoURL ? (
    <Image 
      source={{ uri: userProfile.photoURL }} 
      style={{
        width: 32,
        height: 32,
        borderRadius: 15,
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      }}
    />
  ) : (
    <Text style={{
      fontSize: 22,
      textAlign: 'center',
      backgroundColor: 'transparent',
    }}>{userEmoji}</Text>
  )}
</View>
        <Callout tooltip>
          {/* Callout content */}
          <View style={styles.calloutContainer}>
            <Text style={styles.calloutName}>You</Text>
            {userSpotlightGoal ? (
              <View style={[
                styles.calloutGoal,
                userSpotlightGoal.alreadyDoing ? styles.calloutDoingGoal : styles.calloutPlanningGoal
              ]}>
                <Text style={styles.calloutGoalText} numberOfLines={2}>{userSpotlightGoal.text}</Text>
                <Text style={[
                  styles.calloutGoalStatus,
                  userSpotlightGoal.alreadyDoing ? styles.calloutDoingStatus : styles.calloutPlanningStatus
                ]}>
                  Spotlight: {userSpotlightGoal.alreadyDoing ? 'Doing' : 'Starting'}
                </Text>
              </View>
            ) : (
              <Text style={styles.calloutNoGoal}>No spotlight focus set</Text>
            )}
            {/* This button's onPress IS needed as it performs a specific action */}
            <TouchableOpacity
              style={styles.calloutButton}
              onPress={() => setSpotlightModalVisible(true)}
            >
              <Text style={styles.calloutButtonText}>
                {userSpotlightGoal ? 'Change' : 'Set'} Spotlight
              </Text>
            </TouchableOpacity>
          </View>
        </Callout>
      </Marker>
    );
  };


  return (
    <View style={styles.container}>
      <ExpoStatusBar style="dark" />

      {/* Dark Space Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#0f1729', '#1c2741', '#121a2c']}
          style={styles.headerGradient}
        >
          <StarryBackground />

          <View style={styles.headerContent}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Focus Map</Text>

            {/* Show Spotlight Button only if there are goals */}
            {(activeGoals.length > 0 || planningGoals.length > 0) ? (
              <TouchableOpacity
                style={styles.spotlightButton}
                onPress={() => {
                  console.log("Spotlight button pressed");
                  setSpotlightModalVisible(true);
                }}
                disabled={isLoadingNearby}
              >
                {userSpotlightGoal ? (
                  <View style={[
                    styles.spotlightBadge,
                    userSpotlightGoal.alreadyDoing ? styles.doingSpotlight : styles.planningSpotlight
                  ]}>
                    <Text style={styles.spotlightText} numberOfLines={1}>
                      {userSpotlightGoal.text.length > 15
                        ? `${userSpotlightGoal.text.substring(0, 15)}...`
                        : userSpotlightGoal.text}
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.spotlightBadge, styles.noSpotlight]}>
                    <Text style={styles.noSpotlightText}>Set Spotlight</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : <View style={{width: 40}}/> /* Placeholder to keep title centered */}
          </View>
        </LinearGradient>
      </View>

      <Animated.ScrollView
  style={styles.scrollContainer}
  scrollEventThrottle={16}
  onScroll={Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true }
  )}
>
        {/* Search Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search for a focus area..."
              placeholderTextColor="#718096"
              onSubmitEditing={handleSearch}
            />

            <View style={styles.searchFilters}>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  searchMode === 'all' && styles.activeFilterButton
                ]}
                onPress={() => setSearchMode('all')}
              >
                <Text style={[
                  styles.filterButtonText,
                  searchMode === 'all' && styles.activeFilterButtonText
                ]}>
                  All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  searchMode === 'doing' && styles.activeFilterButton
                ]}
                onPress={() => setSearchMode('doing')}
              >
                <Text style={[
                  styles.filterButtonText,
                  searchMode === 'doing' && styles.activeFilterButtonText
                ]}>
                  Doing
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterButton,
                  searchMode === 'planning' && styles.activeFilterButton
                ]}
                onPress={() => setSearchMode('planning')}
              >
                <Text style={[
                  styles.filterButtonText,
                  searchMode === 'planning' && styles.activeFilterButtonText
                ]}>
                  Starting
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* My Goals Quick Search */}
          <View style={styles.myGoalsSection}>
            <Text style={styles.myGoalsTitle}>Search Your Focus Areas:</Text>

            {activeGoals.length > 0 && (
              <View style={styles.goalCategorySection}>
                <Text style={styles.goalCategoryTitle}>Doing:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalsScroll}>
                {activeGoals.map((goal: Goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    style={styles.myGoalChip}
                    onPress={() => handleSearchMyGoal(goal.text, true)}
                    disabled={isSearching}
                  >
                    <Text style={styles.myGoalChipText}>{goal.text}</Text>
                  </TouchableOpacity>
                ))}
                </ScrollView>
              </View>
            )}

            {planningGoals.length > 0 && (
              <View style={styles.goalCategorySection}>
                <Text style={styles.goalCategoryTitle}>Starting:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.goalsScroll}>
                {planningGoals.map((goal: Goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    style={[styles.myGoalChip, styles.planningGoalChip]}
                    onPress={() => handleSearchMyGoal(goal.text, false)}
                    disabled={isSearching}
                  >
                    <Text style={styles.myGoalChipText}>
                      {goal.text}
                    </Text>
                  </TouchableOpacity>
                ))}
                </ScrollView>
              </View>
            )}

            {activeGoals.length === 0 && planningGoals.length === 0 && (
              <View style={styles.emptyGoalsMessage}>
                <Text style={styles.emptyGoalsText}>
                  You haven't added any focus areas yet. Add focus areas from the home screen to search for connections.
                </Text>
              </View>
            )}
          </View>

          {/* Search Results Indicator & Clear Button */}
          {isShowingSearchResults && searchResults.length > 0 && (
            <View style={styles.searchResultsBar}>
              <Text style={styles.searchResultsText}>
                {`Showing ${searchResults.length} result(s) for "${searchQuery}"`}
              </Text>
              <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                <Text style={styles.clearSearchText}>Clear</Text>
              </TouchableOpacity>
            </View>
          )}
          {isShowingSearchResults && searchResults.length === 0 && !isSearching && (
             <View style={styles.searchResultsBar}>
               <Text style={styles.searchResultsText}>
                 {`No results found for "${searchQuery}"`}
               </Text>
               <TouchableOpacity onPress={clearSearch} style={styles.clearSearchButton}>
                 <Text style={styles.clearSearchText}>Clear</Text>
               </TouchableOpacity>
             </View>
           )}
        </View>

        {/* Map/Results Section - with fixed height */}
        <View style={[styles.mapSection, {height: 400}]}>
          {Platform.OS === 'web' ? (
            // Web-friendly display - shows search results as a list
            <ScrollView style={styles.userList}>
              {(isLoadingNearby && nearbyUsers.length === 0 && searchResults.length === 0 && !isShowingSearchResults) && (
                  <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 50 }}/>
              )}
              {isShowingSearchResults && searchResults.length > 0 ? (
                  searchResults.map(user => (
                    <TouchableOpacity
                      key={user.id || user.uid}
                      style={styles.userCard}
                      onPress={() => setSelectedUser(user)} // Open modal on web list item click
                    >
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={styles.userLocation}>{user.displayLocation || 'Location not shared'}</Text>
                      </View>

                      <View style={styles.goalContainer}>
                        {/* Show Spotlight Goal if available */}
                        {user.spotlightGoal && (
                          <View style={[
                            styles.webGoalItem,
                            styles.webSpotlightGoalItem,
                            user.spotlightGoal.alreadyDoing ? styles.doingGoalItem : styles.planningGoalItem
                          ]}>
                            <View style={styles.spotlightBadgeSmall}>
                              <Text style={styles.spotlightBadgeText}>★ Spotlight</Text>
                            </View>
                            <Text style={styles.webGoalText}>{user.spotlightGoal.text}</Text>
                            <Text style={[
                              styles.webGoalStatus,
                              user.spotlightGoal.alreadyDoing ? styles.doingStatusText : styles.planningStatusText
                            ]}>
                              {user.spotlightGoal.alreadyDoing ? 'Doing' : 'Starting'}
                            </Text>
                          </View>
                        )}

                        {/* Show Matching Goals */}
                        {user.matchingGoals && user.matchingGoals
                          .filter(goal => !(user.spotlightGoal && user.spotlightGoal.id === goal.id))
                          .map((goal, idx) => (
                          <View key={`match-${goal.id || idx}`} style={[
                            styles.webGoalItem,
                            goal.alreadyDoing ? styles.doingGoalItem : styles.planningGoalItem
                          ]}>
                            <Text style={styles.webGoalText}>{goal.text}</Text>
                            <View style={[
                              styles.statusBadge,
                              goal.alreadyDoing ? styles.activeBadge : styles.wantingBadge
                            ]}>
                              <Text style={[
                                styles.statusText,
                                goal.alreadyDoing ? styles.doingStatusText : styles.planningStatusText
                              ]}>
                                {goal.alreadyDoing ? 'Doing' : 'Starting'}
                              </Text>
                            </View>
                          </View>
                        ))}

                         {/* Show Other Goals (non-spotlight, non-matching) - for web view */}
                         {user.goals && user.goals
                            .filter(goal => goal.isActive &&
                                           !(user.spotlightGoal && user.spotlightGoal.id === goal.id) &&
                                           !(user.matchingGoals && user.matchingGoals.some(mg => mg.id === goal.id))
                            )
                            .map((goal, idx) => (
                              <View key={`other-web-${goal.id || idx}`} style={[
                                styles.webGoalItem,
                                goal.alreadyDoing ? styles.doingGoalItem : styles.planningGoalItem
                              ]}>
                                <Text style={styles.webGoalText}>{goal.text}</Text>
                                <Text style={[
                                  styles.webGoalStatus,
                                  goal.alreadyDoing ? styles.doingStatusText : styles.planningStatusText
                                ]}>
                                  {goal.alreadyDoing ? 'Doing' : 'Starting'}
                                </Text>
                              </View>
                            ))}

                      </View>
                      <TouchableOpacity
                            style={styles.webConnectButton}
                            onPress={() => initiateContact(user.uid)} // Use initiateContact here too
                        >
                            <Text style={styles.webConnectButtonText}>Connect with {user.name}</Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                  ))
              ) : isShowingSearchResults && searchResults.length === 0 && !isSearching ? (
                  <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>No users found sharing their location for "{searchQuery}".</Text>
                  </View>
              ) : !isShowingSearchResults && !isLoadingNearby ? (
                  <View style={styles.noResultsContainer}>
                      <Text style={styles.noResultsText}>
                      Search for a focus area or use your focus areas above to find others nearby.
                      </Text>
                  </View>
              ) : null // Show nothing if loading or if no search performed yet
            }
            </ScrollView>
          ) : (
            // Real map implementation for native platforms
            userLocation ? (
              <View style={styles.mapContainer}>
                <MapView
                  ref={mapRef}
                  provider={PROVIDER_GOOGLE} // Use Google Maps for better performance/features if configured
                  style={styles.map}
                  initialRegion={{
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    latitudeDelta: 0.05, // Zoom level
                    longitudeDelta: 0.05,
                  }}
                  showsUserLocation={false} // Use custom marker
                  showsMyLocationButton={true}
                  showsCompass={true}
                  showsScale={true}
                  onLayout={(event) => {
                    const {width, height} = event.nativeEvent.layout;
                    setMapLayout({width, height});
                  }}
                  onTouchStart={() => {
                    setIsMapMoving(true); // Hide labels on touch
                  }}
                  onRegionChange={() => {
                    setIsMapMoving(true); // Keep labels hidden during move
                  }}
                  onRegionChangeComplete={() => {
                     // Update marker positions *after* map stops moving
                     if (userLocation) {
                       trackMarkerPosition('self', userLocation);
                     }
                     const usersToTrack = isShowingSearchResults ? searchResults : nearbyUsers;
                     usersToTrack.forEach(user => {
                       const markerIdPrefix = isShowingSearchResults ? 'search' : 'user';
                       if (user.coordinates && user.settings?.shareLocation !== false) {
                         trackMarkerPosition(`${markerIdPrefix}-${user.id}`, user.coordinates);
                       }
                     });

                     // Delay showing labels again
                     setTimeout(() => {
                       setIsMapMoving(false);
                     }, 150);
                  }}
                >
                  {renderSelfMarker()}
                  {!isShowingSearchResults && nearbyUsers.map(user => renderUserMarker(user))}
                  {isShowingSearchResults && searchResults.map(user => renderUserMarker(user, true))}
                </MapView>

                {/* Floating labels overlay */}
                {keywordLabelsVisible && !isMapMoving && mapLayout && (
                  <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    {/* Self marker label */}
                    {userSpotlightGoal && markerPositions['self'] && (
                      <View style={{
                        position: 'absolute',
                        left: markerPositions['self'].x - 50, // Center label horizontally
                        top: markerPositions['self'].y - 50, // Position above marker center
                        width: 100, // Fixed width for label
                        alignItems: 'center',
                      }}>
                        <View style={styles.selfMarkerLabelContainer}>
                          <Text style={{
                            color: 'white',
                            fontSize: 9,
                            fontWeight: 'bold',
                            textAlign: 'center',
                          }}>
                            {extractKeywords(userSpotlightGoal.text).join(' ').toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* User marker labels - nearby or search results */}
                    {(isShowingSearchResults ? searchResults : nearbyUsers).map(user => {
                      const markerIdPrefix = isShowingSearchResults ? 'search' : 'user';
                      const markerId = `${markerIdPrefix}-${user.id}`;
                      // Ensure user has spotlight, position exists, and location sharing is enabled
                      if (!user.spotlightGoal || !markerPositions[markerId] || user.settings?.shareLocation === false) return null;

                      const isActive = user.spotlightGoal.alreadyDoing;
                      const keywords = extractKeywords(user.spotlightGoal.text).join(' ');
                      if (!keywords) return null; // Don't render empty labels

                      return (
                        <View key={`label-${markerId}`} style={{
                          position: 'absolute',
                          left: markerPositions[markerId].x - 50,
                          top: markerPositions[markerId].y - 50,
                          width: 100,
                          alignItems: 'center',
                        }}>
                          <View style={{
                            backgroundColor: isActive ? '#38B2AC' : '#4299E1',
                            paddingVertical: 3,
                            paddingHorizontal: 6,
                            borderRadius: 4,
                          }}>
                            <Text style={{
                              color: 'white',
                              fontSize: 9,
                              fontWeight: 'bold',
                              textAlign: 'center',
                            }}>
                              {keywords.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Map controls overlay */}
                <View style={styles.mapControls}>
                  <TouchableOpacity
                    style={styles.mapControlButton}
                    onPress={toggleKeywordLabels}
                  >
                    <Icon
                      name={keywordLabelsVisible ? "label-off-outline" : "label-outline"}
                      size={28}
                      color="#4299E1"
                    />
                    <Text style={styles.mapControlText}>
                      {keywordLabelsVisible ? "Hide Labels" : "Show Labels"}
                    </Text>
                  </TouchableOpacity>

                  {isShowingSearchResults && (
                    <TouchableOpacity
                      style={[styles.mapControlButton, { borderBottomWidth: 0 }]} // Remove border on last item
                      onPress={clearSearch}
                    >
                      <Icon name="close-circle-outline" size={28} color="#EF4444" />
                      <Text style={[styles.mapControlText, { color: '#EF4444' }]}>Clear Search</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading map & location...</Text>
              </View>
            )
          )}
        </View>

        {/* Personalization Section */}
        <View style={styles.personalizationSection}>
          <Text style={styles.sectionTitle}>Customize Your Map</Text>

          <View style={styles.personalizationCard}>
            <Text style={styles.personalizationTitle}>Your Map Icon</Text>
            <View style={styles.emojiPreview}>
              <Text style={styles.currentEmoji}>{userEmoji}</Text>
            </View>
            <TouchableOpacity
              style={styles.customizeButton}
              onPress={() => setShowPersonalizationModal(true)}
            >
              <Text style={styles.customizeButtonText}>Change Icon</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Animated.ScrollView>

      {/* USER DETAIL BOTTOM SHEET - COMPLETELY REWRITTEN */}
      <CustomBottomSheet 
        visible={selectedUser !== null} 
        onClose={() => setSelectedUser(null)}
        height="70%"
      >
        {selectedUser && (
          <>
            <View style={{
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 15,
  paddingBottom: 10,
  borderBottomWidth: 1,
  borderBottomColor: '#eee'
}}>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    {selectedUser.photoURL ? (
      <Image
        source={{ uri: selectedUser.photoURL }}
        style={{
          width: 28,
          height: 28,
          borderRadius: 16,
          marginRight: 12,
          borderWidth: 1,
          borderColor: '#E2E8F0',
        }}
      />
    ) : (
      <View style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#4A5568',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
      }}>
        <Text style={{
          color: 'white',
          fontSize: 20,
          fontWeight: 'bold',
        }}>
          {selectedUser.name?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>
    )}
    <Text style={{fontSize: 20, fontWeight: 'bold', color: '#333'}}>{selectedUser.name}</Text>
  </View>
  <TouchableOpacity
    style={{padding: 5}}
    onPress={() => setSelectedUser(null)}
  >
    <Text style={{fontSize: 24, color: '#888', fontWeight: 'bold'}}>✕</Text>
  </TouchableOpacity>
</View>
            
            <ScrollView>
              <Text style={styles.userDetailLocation}>
                {selectedUser.displayLocation || 'Location not shared'}
              </Text>

              <Text style={styles.userDetailBio}>
                {selectedUser.bio || 'No bio provided'}
              </Text>

              <View style={styles.userGoalsSection}>
                <Text style={styles.userGoalsSectionTitle}>Focus Areas:</Text>

                {/* Display Spotlight Goal First */}
                {selectedUser.spotlightGoal && (
                  <View style={[
                    styles.userDetailGoalItemBase, 
                    styles.userDetailSpotlightGoalItem,
                    selectedUser.spotlightGoal.alreadyDoing 
                      ? styles.userDetailDoingGoalItem 
                      : styles.userDetailPlanningGoalItem
                  ]}>
                    <View style={styles.spotlightBadgeSmall}>
                      <Text style={styles.spotlightBadgeText}>★ Spotlight</Text>
                    </View>
                    <Text style={styles.userDetailGoal}>{selectedUser.spotlightGoal.text}</Text>
                    <Text style={[
                      styles.userDetailStatus, 
                      selectedUser.spotlightGoal.alreadyDoing 
                        ? styles.userDetailStatusActive 
                        : styles.userDetailStatusPlanning
                    ]}>
                      {selectedUser.spotlightGoal.alreadyDoing ? 'Doing' : 'Starting'}
                    </Text>
                  </View>
                )}
                
                {/* Display Matching Goals */}
                {selectedUser.matchingGoals && 
                  selectedUser.matchingGoals
                    .filter(goal => 
                      !(selectedUser.spotlightGoal && selectedUser.spotlightGoal.id === goal.id))
                    .map((goal, idx) => (
                      <View 
                        key={`match-${goal.id || idx}`} 
                        style={[
                          styles.userDetailGoalItemBase, 
                          styles.userDetailMatchingGoalItem,
                          goal.alreadyDoing 
                            ? styles.userDetailDoingGoalItem 
                            : styles.userDetailPlanningGoalItem
                        ]}
                      >
                        <Text style={styles.userDetailGoal}>{goal.text}</Text>
                        <Text style={[
                          styles.userDetailStatus, 
                          goal.alreadyDoing 
                            ? styles.userDetailStatusActive 
                            : styles.userDetailStatusPlanning
                        ]}>
                          {`${goal.alreadyDoing ? 'Doing' : 'Starting'} (Matches your search)`}
                        </Text>
                      </View>
                    ))}
                
                {/* Display Other Active Goals */}
                {selectedUser.goals && 
                  selectedUser.goals
                    .filter(goal => 
                      goal.isActive && 
                      !(selectedUser.spotlightGoal && selectedUser.spotlightGoal.id === goal.id) && 
                      !(selectedUser.matchingGoals && selectedUser.matchingGoals.some(mg => mg.id === goal.id)))
                    .map((goal, idx) => (
                      <View 
                        key={`other-${goal.id || idx}`} 
                        style={[
                          styles.userDetailGoalItemBase,
                          goal.alreadyDoing 
                            ? styles.userDetailDoingGoalItem 
                            : styles.userDetailPlanningGoalItem
                        ]}
                      >
                        <Text style={styles.userDetailGoal}>{goal.text}</Text>
                        <Text style={[
                          styles.userDetailStatus, 
                          goal.alreadyDoing 
                            ? styles.userDetailStatusActive 
                            : styles.userDetailStatusPlanning
                        ]}>
                          {goal.alreadyDoing ? 'Doing' : 'Starting'}
                        </Text>
                      </View>
                    ))}
                
                {/* Message if no goals */}
                {(!selectedUser.goals || selectedUser.goals.filter(g => g.isActive).length === 0) && (
                  <Text style={styles.noGoalsDetailText}>No active focus areas shared.</Text>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity 
              style={styles.contactButton} 
              onPress={() => initiateContact(selectedUser.uid)}
            >
              <Text style={styles.contactButtonText}>
                {connectionStatus === 'connected' 
                  ? `Message ${selectedUser.name}` 
                  : connectionStatus === 'pending' 
                    ? `Request Pending...` 
                    : `Connect with ${selectedUser.name}`}
              </Text>
            </TouchableOpacity>
            
            {connectionStatus === 'connected' && (
              <TouchableOpacity 
                style={styles.addToGroupButton} 
                onPress={() => { 
                  setSelectedUser(null); 
                  router.push({ 
                    pathname: '/circles', 
                    params: { 
                      initialTab: 'groups', 
                      addUserToGroup: selectedUser.uid, 
                      userName: selectedUser.name 
                    } 
                  }); 
                }}
              >
                <Text style={styles.addToGroupButtonText}>Add to Group</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </CustomBottomSheet>

      {/* SPOTLIGHT GOAL BOTTOM SHEET - COMPLETELY REWRITTEN */}
      <CustomBottomSheet 
        visible={spotlightModalVisible} 
        onClose={() => setSpotlightModalVisible(false)}
        height="65%"
      >
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 15, 
          paddingBottom: 10, 
          borderBottomWidth: 1, 
          borderBottomColor: '#eee' 
        }}>
          <Text style={{fontSize: 20, fontWeight: 'bold', color: '#333'}}>Set Spotlight Focus</Text>
          <TouchableOpacity
            style={{padding: 5}}
            onPress={() => setSpotlightModalVisible(false)}
          >
            <Text style={{fontSize: 24, color: '#888', fontWeight: 'bold'}}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <Text style={styles.modalDescription}>
          Your spotlight focus helps others see your main interest on the map. Choose one of your active focus areas.
        </Text>
        
        <ScrollView style={styles.spotlightGoalsList}>
          {activeGoals.length > 0 && (
            <View style={styles.spotlightCategorySection}>
              <Text style={styles.spotlightCategoryTitle}>Doing</Text>
              {activeGoals.map((goal: Goal) => (
                <TouchableOpacity 
                  key={goal.id} 
                  style={[ 
                    styles.spotlightGoalOptionItem, 
                    userSpotlightGoal?.id === goal.id && styles.selectedSpotlightGoalItem 
                  ]} 
                  onPress={() => setSpotlightGoal(goal)} 
                  disabled={isLoadingNearby} 
                >
                  <Text style={styles.spotlightGoalOptionText}>{goal.text}</Text>
                  {userSpotlightGoal?.id === goal.id && (
                    <View style={styles.currentSpotlightBadge}>
                      <Text style={styles.currentSpotlightText}>Current</Text>
                    </View>
                  )}
                  {isLoadingNearby && userSpotlightGoal?.id !== goal.id && (
                    <ActivityIndicator size="small" color="#ccc" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {planningGoals.length > 0 && (
            <View style={styles.spotlightCategorySection}>
              <Text style={styles.spotlightCategoryTitle}>Starting</Text>
              {planningGoals.map((goal: Goal) => (
                <TouchableOpacity 
                  key={goal.id} 
                  style={[ 
                    styles.spotlightGoalOptionItem, 
                    userSpotlightGoal?.id === goal.id && styles.selectedSpotlightGoalItem 
                  ]} 
                  onPress={() => setSpotlightGoal(goal)} 
                  disabled={isLoadingNearby} 
                >
                  <Text style={styles.spotlightGoalOptionText}>{goal.text}</Text>
                  {userSpotlightGoal?.id === goal.id && (
                    <View style={styles.currentSpotlightBadge}>
                      <Text style={styles.currentSpotlightText}>Current</Text>
                    </View>
                  )}
                  {isLoadingNearby && userSpotlightGoal?.id !== goal.id && (
                    <ActivityIndicator size="small" color="#ccc" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {activeGoals.length === 0 && planningGoals.length === 0 && (
            <Text style={styles.noGoalsForSpotlightText}>Add some focus areas on the Home screen first!</Text>
          )}
        </ScrollView>
        
        <TouchableOpacity 
          style={styles.cancelSpotlightButton} 
          onPress={() => setSpotlightModalVisible(false)} 
          disabled={isLoadingNearby} 
        >
          <Text style={styles.cancelSpotlightButtonText}>Cancel</Text>
        </TouchableOpacity>
      </CustomBottomSheet>

      {/* Personalization Modal */}
      <PersonalizationModal
        visible={showPersonalizationModal}
        onClose={() => setShowPersonalizationModal(false)}
        selectedEmoji={userEmoji}
        onSelectEmoji={(emoji) => {
          setUserEmoji(emoji);
          // Save to user profile in Firestore
          if (currentUser) {
            updateUserProfile({
              mapEmoji: emoji
            });
          }
        }}
      />
    </View>
  );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA', // Light grey background
  },
  scrollContainer: {
    flex: 1,
    paddingBottom: 80,
  },
  // Header Styles remain the same
  headerContainer: {
    overflow: 'hidden',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    backgroundColor: '#0f1729', // Fallback background
  },
  headerGradient: {
    paddingTop: 10, // Adjust as needed based on safe area
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
    zIndex: 2, // Ensure content is above stars
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    zIndex: 20, // Ensure button is tappable
  },
  backButtonText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1, // Allows centering between buttons
    // Text shadow for cosmic effect
    textShadowColor: 'rgba(59, 130, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  spotlightButton: {
    padding: 4,
    minWidth: 40, // Ensure tappable area
    alignItems: 'flex-end', // Align badge to the right
  },
  // Updated spotlight styles with much brighter colors

// EXTREME high-contrast spotlight styles

spotlightBadge: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 16,
  borderWidth: 2, // Thicker border
  maxWidth: 150,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)', // Nearly black background for contrast
},

doingSpotlight: {
  borderColor: '#00FFFF', // Pure cyan border
},

planningSpotlight: {
  borderColor: '#00FFFF', // Pure cyan border
},

noSpotlight: {
  borderColor: '#FFFFFF', // White border
},

spotlightText: {
  fontSize: 14, // Even larger
  fontWeight: '800', // Ultra bold
  letterSpacing: 0.5, // Spaced letters for readability
  color: '#FFFFFF', // Pure white base color
  textShadowColor: '#00FFFF', // Pure cyan glow
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 8, // Very large glow radius
},

doingSpotlightText: {
  color: '#00FFFF', // Pure cyan
},

planningSpotlightText: {
  color: '#00FFFF', // Pure cyan
},

noSpotlightText: {
  fontSize: 14,
  fontWeight: '800',
  color: '#FFFFFF', // Pure white
  textShadowColor: '#FFFFFF',
  textShadowOffset: { width: 0, height: 0 },
  textShadowRadius: 8,
},
  // Search Section Styles
  searchSection: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0', // Light border
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#F7FAFC', // Very light grey input background
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  searchFilters: {
    flexDirection: 'row',
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  filterButton: {
    flex: 1,
    backgroundColor: '#F7FAFC',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#EBF8FF', // Light blue active background
    borderColor: '#4299E1', // Blue border
  },
  filterButtonText: {
    fontSize: 14,
    color: '#718096', // Medium grey text
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: '#2B6CB0', // Dark blue active text
    fontWeight: '600',
  },
  searchButton: {
    backgroundColor: '#3B82F6', // Primary blue button
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  myGoalsSection: {
    marginTop: 8,
  },
  myGoalsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748', // Dark grey title
    marginBottom: 8,
  },
  goalCategorySection: {
    marginBottom: 12,
  },
  goalCategoryTitle: {
    fontSize: 14,
    color: '#4A5568', // Slightly lighter grey subtitle
    marginBottom: 6,
    fontWeight: '500',
  },
  goalsScroll: {
    // Horizontal scroll is implicitly enabled by content width
  },
  myGoalChip: {
    backgroundColor: '#E6FFFA', // Light teal chip
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#B2F5EA', // Lighter teal border
  },
  planningGoalChip: {
    backgroundColor: '#EBF8FF', // Light blue chip
    borderColor: '#BEE3F8', // Lighter blue border
  },
  myGoalChipText: {
    fontSize: 14,
    color: '#2C7A7B', // Dark teal text
    fontWeight: '500',
  },
  emptyGoalsMessage: {
    padding: 12,
    backgroundColor: '#F7FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center', // Center message content
    justifyContent: 'center'
  },
  emptyGoalsText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  searchResultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#EBF8FF', // Light blue background for results bar
    borderRadius: 8,
    marginTop: 12, // Added margin top
  },
  searchResultsText: {
    fontSize: 14,
    color: '#2B6CB0', // Dark blue text
    fontWeight: '500',
    flex: 1, // Allow text to take available space
    marginRight: 8,
  },
  clearSearchButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#E2E8F0', // Light grey button
    borderRadius: 4,
  },
  clearSearchText: {
    fontSize: 12,
    color: '#4A5568', // Medium grey text
    fontWeight: '500',
  },
  // Map/Results Section Styles
  mapSection: {
    flex: 1, // Use flex to manage height relative to other content if needed
    backgroundColor: '#E2E8F0', // Background color while map loads
    minHeight: 400, // Ensure minimum height
  },
  mapContainer: {
    flex: 1, // MapView container should fill its parent
    position: 'relative', // Needed for absolute positioning of controls/labels
  },
  map: {
    ...StyleSheet.absoluteFillObject, // Make map fill container
  },
  mapControls: {
      position: 'absolute',
      bottom: 50, // Higher position
      right: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.9)', // Slightly transparent white
      borderRadius: 8,
      padding: 12, // Larger padding
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3, // More visible shadow
      shadowRadius: 4,
      elevation: 4
  },
  mapControlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, // Larger touchable area
    paddingHorizontal: 5,
    // Add border between buttons if needed
    // borderBottomWidth: 1,
    // borderBottomColor: '#E2E8F0',
  },
  mapControlText: {
      fontSize: 16, // Larger text
      color: '#4A5568',
      marginLeft: 10,
      fontWeight: '500'
  },
  selfMarkerLabelContainer: {
    backgroundColor: '#F97316', // Orange color for self label
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    shadowColor: "#000", // Add shadow for visibility
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#4A5568',
  },
  // Web List Styles
  userList: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F7FAFC', // Background for the list area
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    minHeight: 150, // Ensure it's visible
  },
  noResultsText: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
  },
  userLocation: {
    fontSize: 14,
    color: '#718096',
  },
  goalContainer: {
    marginTop: 8,
  },
  webGoalItem: {
   // No row direction here, stack vertically within the card
    marginBottom: 10, // Space between goal items
    padding: 10,
    borderRadius: 6,
    borderLeftWidth: 4, // Use left border for status color
  },
  webSpotlightGoalItem: {
    borderWidth: 1.5,
    borderColor: '#F6E05E', // Yellow border for spotlight
    paddingTop: 32, // Make space for the badge
    position: 'relative',
    // Remove left border if combining with status border
    borderLeftWidth: 0,
  },
  spotlightBadgeSmall: {
    position: 'absolute',
    top: 6,
    left: 8,
    backgroundColor: '#FEFCBF', // Light yellow badge background
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    zIndex: 1,
  },
  spotlightBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#B7791F', // Dark yellow text
  },
  doingGoalItem: { // Applied to webGoalItem
    backgroundColor: '#F0FFF4', // Light green background
    borderLeftColor: '#38B2AC', // Teal left border
  },
  planningGoalItem: { // Applied to webGoalItem
    backgroundColor: '#EBF8FF', // Light blue background
    borderLeftColor: '#4299E1', // Blue left border
  },
  webGoalText: {
    fontSize: 15,
    color: '#4A5568',
    fontWeight: '500', // Make goal text slightly bolder
    marginBottom: 4, // Space between text and status
  },
  webGoalStatus: {
    fontSize: 13,
    fontWeight: '500',
    alignSelf: 'flex-start', // Align status below text
  },
  statusBadge: { // Not used in the vertical layout
    // paddingVertical: 4,
    // paddingHorizontal: 8,
    // borderRadius: 12,
    // marginLeft: 'auto',
  },
  activeBadge: { // Not used
    // backgroundColor: '#E6FFFA',
  },
  wantingBadge: { // Not used
    // backgroundColor: '#EBF8FF',
  },
  statusText: { // Use webGoalStatus styles directly
    // fontSize: 12,
    // fontWeight: '500',
  },
  doingStatusText: {
    color: '#2C7A7B', // Dark teal status text
  },
  planningStatusText: {
    color: '#2B6CB0', // Dark blue status text
  },
  webConnectButton: {
    backgroundColor: '#4299E1', // Blue connect button
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16, // Space above button
  },
  webConnectButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  // Callout Styles
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    width: 220, // Fixed width for consistency
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calloutName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1A202C', // Very dark grey/black
    marginBottom: 8,
  },
  calloutGoal: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 3, // Use left border for status
  },
  calloutDoingGoal: {
    backgroundColor: '#F0FFF4', // Light green background
    borderColor: '#38B2AC', // Teal border
  },
  calloutPlanningGoal: {
    backgroundColor: '#EBF8FF', // Light blue background
    borderColor: '#4299E1', // Blue border
  },
  calloutGoalText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2D3748', // Dark grey text
    marginBottom: 4,
  },
  calloutGoalStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  calloutDoingStatus: {
    color: '#2F855A', // Dark green status text
  },
  calloutPlanningStatus: {
    color: '#2B6CB0', // Dark blue status text
  },
  calloutNoGoal: {
    fontSize: 14,
    color: '#718096', // Medium grey text
    fontStyle: 'italic',
    marginBottom: 8,
  },
  calloutButton: {
    backgroundColor: '#4299E1', // Blue button
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  calloutButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  // User Detail Modal Styles
  userDetailOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent background
    justifyContent: 'flex-end', // Align modal to bottom
  },
  userDetailContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 30, // Extra padding at bottom for safe area
    maxHeight: '80%', // Limit height
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 }, // Shadow for top edge
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  userDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  userDetailName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#718096',
    padding: 5, // Easier to tap
  },
  userDetailLocation: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 12,
  },
  userDetailBio: {
    fontSize: 16,
    color: '#4A5568',
    marginBottom: 16,
    lineHeight: 22,
  },
  userGoalsSection: {
    marginBottom: 16,
  },
  userGoalsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 10,
  },
  userDetailGoalItemBase: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    overflow: 'hidden', // Clip content to rounded corners
  },
  userDetailSpotlightGoalItem: {
    borderWidth: 1.5,
    borderColor: '#F6E05E', // Yellow border for spotlight
    position: 'relative', // For badge positioning
    paddingTop: 32, // Space for badge
  },
  userDetailMatchingGoalItem: {
    borderWidth: 1,
    borderColor: '#CBD5E0', // Subtle border for matching goals
  },
  userDetailDoingGoalItem: { // Applied to base style
    backgroundColor: '#F0FFF4',
    borderLeftWidth: 4,
    borderLeftColor: '#38B2AC',
  },
  userDetailPlanningGoalItem: { // Applied to base style
    backgroundColor: '#EBF8FF',
    borderLeftWidth: 4,
    borderLeftColor: '#4299E1',
  },
  userDetailGoal: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2D3748',
    marginBottom: 4,
  },
  userDetailStatus: {
    fontSize: 13,
    fontWeight: '500',
  },
  userDetailStatusActive: {
    color: '#2C7A7B', // Dark teal
  },
  userDetailStatusPlanning: {
    color: '#2B6CB0', // Dark blue
  },
  noGoalsDetailText: {
    fontSize: 14,
    color: '#718096',
    fontStyle: 'italic',
    marginTop: 10,
  },
  contactButton: {
    backgroundColor: '#3B82F6', // Primary blue
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  contactButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  addToGroupButton: {
    backgroundColor: '#38A169', // Green color
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addToGroupButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  // Spotlight Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20, // Padding around the modal
  },
  modalContent: {
    backgroundColor: 'white',
    width: '100%', 
    height: 500,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1A202C',
  },
  modalCloseButton: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#718096',
    padding: 5,
  },
  modalDescription: {
    fontSize: 16,
    color: '#4A5568',
    marginBottom: 20,
    lineHeight: 22,
  },
  spotlightGoalsList: {
    maxHeight: 300, // Limit list height for scrollability
    marginBottom: 10,
  },
  spotlightCategorySection: {
    marginBottom: 16,
  },
  spotlightCategoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  spotlightGoalOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginBottom: 10,
  },
  selectedSpotlightGoalItem: {
    borderColor: '#4299E1', // Blue border for selected
    backgroundColor: '#EBF8FF', // Light blue background for selected
  },
  spotlightGoalOptionText: {
    fontSize: 16,
    color: '#2D3748',
    flex: 1, // Allow text to take space
    marginRight: 10,
  },
  currentSpotlightBadge: {
    backgroundColor: '#E6FFFA', // Light teal badge
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  currentSpotlightText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2C7A7B', // Dark teal text
  },
  noGoalsForSpotlightText: {
    textAlign: 'center',
    color: '#718096',
    fontSize: 14,
    marginTop: 20,
    marginBottom: 10,
  },
  cancelSpotlightButton: {
    backgroundColor: '#EDF2F7', // Light grey cancel button
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelSpotlightButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
  },
  // Personalization Section Styles
  personalizationSection: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2D3748',
    marginBottom: 16,
    textAlign: 'center',
  },
  personalizationCard: {
    backgroundColor: '#F7FAFC', // Light background card
    borderRadius: 12,
    padding: 16,
    // marginBottom: 16, // Remove margin if it's the last item
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center', // Center content
  },
  personalizationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 12,
  },
  emojiPreview: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 40, // Make it circular
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  currentEmoji: {
    fontSize: 15, // Large emoji size
  },
  customizeButton: {
    backgroundColor: '#4299E1', // Blue button
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  customizeButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  profileMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  defaultProfileIcon: {
    width: 28,
    height: 28,
    borderRadius: 13,
    backgroundColor: '#4A5568',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileInitial: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
});