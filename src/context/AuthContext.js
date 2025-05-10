// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  // Note: Removed dbDoc as it's not a standard Firestore function, replaced with doc
} from 'firebase/firestore';
import { getFirestore, initializeFirestore, CACHE_SIZE_UNLIMITED, enableIndexedDbPersistence } from "firebase/firestore";import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db } from '../config/firebase';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get the existing Firestore instance or create an optimized one
const optimizedDb = (() => {
  try {
    // Try to get existing instance first
    return getFirestore(auth.app);
  } catch (error) {
    // If no instance exists, create a new one with optimized settings
    return initializeFirestore(auth.app, {
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
      ignoreUndefinedProperties: true,
    });
  }
})();

// Enable persistence only once
const enablePersistence = async () => {
  try {
    await enableIndexedDbPersistence(optimizedDb);
  } catch (error) {
    if (error.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.log("Persistence unavailable in multiple tabs");
    } else if (error.code === 'unimplemented') {
      // Current browser doesn't support persistence
      console.log("Persistence not supported in this browser");
    } else {
      console.error("Persistence error:", error);
    }
  }
};

// Call it once
enablePersistence();

// Initialize storage with same app instance
const storage = getStorage(auth.app);

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  // Prefetching key data for faster access
  const prefetchUserData = async (userId) => {
    if (!userId || !isConnected) return;
    
    try {
      // Prefetch user profile
      const userRef = doc(optimizedDb, 'users', userId);
      getDoc(userRef).catch(() => {}); // Silent catch

      // Prefetch user's connections
      const connectionsRef = collection(optimizedDb, 'connections');
      const connectionQuery = query(
        connectionsRef,
        where('users', 'array-contains', userId),
        where('status', '==', 'accepted')
      );
      getDocs(connectionQuery).catch(() => {}); // Silent catch
    } catch (error) {
      // Ignore prefetch errors
    }
  };

  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  // Initialize a cache for user profiles to avoid redundant fetches
  const profileCache = {};

  // Check network connectivity
  useEffect(() => {
    const checkConnectivity = async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        setIsConnected(networkState.isConnected);
      } catch (error) {
        console.error("Error checking network:", error);
        setIsConnected(false); // Assume offline if error occurs
      }
    };

    checkConnectivity(); // Initial check

    // Check connectivity periodically
    const interval = setInterval(checkConnectivity, 10000); // Check every 10 seconds
    return () => clearInterval(interval); // Cleanup interval on unmount
  }, []);

  // Sign up function
  async function signup(email, password, name) {
    try {
      console.log("Starting signup process...");

      if (!isConnected) {
        throw new Error("No internet connection. Please check your network settings.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      console.log("User account created successfully");

      // Update the user's display name in Firebase Auth
      try {
        await updateProfile(userCredential.user, {
          displayName: name
        });
        console.log("Display name updated in Firebase Auth");
      } catch (profileError) {
        console.error("Error updating Firebase Auth profile:", profileError);
        // Continue even if profile update fails, Firestore is primary
      }

      // Create an initial user profile document in Firestore
      try {
        console.log("Creating user document in Firestore...");
        const initialUserProfile = {
          uid: userCredential.user.uid,
          email: email,
          name: name,
          goal: '', // Initial empty goal/focus area
          bio: '',
          displayLocation: '',
          isActive: false, // User presence status
          createdAt: new Date(),
          lastActive: new Date(),
          coordinates: null, // User location
          goals: [] // Initialize empty array for detailed goals
        };

        await setDoc(doc(optimizedDb, 'users', userCredential.user.uid), initialUserProfile);
        console.log("User document created in Firestore");

        // Store basic profile data locally for offline access
        await AsyncStorage.setItem('userProfile', JSON.stringify(initialUserProfile));
        // Update state immediately
        setUserProfile(initialUserProfile);

      } catch (firestoreError) {
        console.error("Error creating document in Firestore:", firestoreError);
        // Continue anyway - the authentication part worked
      }

      console.log("Signup completed successfully");
      return userCredential.user;
    } catch (error) {
      console.error("Signup failed:", error);
      // Provide more user-friendly error messages based on error code
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email address is already in use.');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters long.');
      }
      throw error; // Re-throw other errors
    }
  }

  // Sign in function
  async function login(email, password) {
    try {
      console.log("Starting login process...");

      if (!isConnected) {
        // Try to authenticate with cached credentials? (Firebase handles some caching)
        // For now, just throw error if explicitly offline check fails
        throw new Error("No internet connection. Please check your network settings.");
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful for user:", userCredential.user.uid);
      // User profile will be loaded by onAuthStateChanged listener
      return userCredential.user;
    } catch (error) {
      console.error("Login failed:", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        throw new Error('Invalid email or password.');
      }
      throw error; // Re-throw other errors
    }
  }

  // Sign out function
  async function logout() {
    try {
      console.log("Logging out...");
      await signOut(auth);

      // Clear local storage
      await AsyncStorage.removeItem('userProfile');

      // Clear state
      setCurrentUser(null);
      setUserProfile(null);

      console.log("Logout successful");
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }

  // Update profile function (handles both online and offline)
  async function updateUserProfile(profileData) {
    if (!currentUser) {
      console.warn("Attempted to update profile without logged-in user.");
      return;
    }

    // Prepare updated profile data, ensuring lastActive is always updated
    const dataToUpdate = {
      ...profileData,
      lastActive: new Date() // Always update lastActive timestamp
    };

    // Update local state optimistically
    const updatedLocalProfile = {
        ...(userProfile || {}), // Start with current profile or empty object
        ...dataToUpdate        // Apply new data
    };
    setUserProfile(updatedLocalProfile);

    // Try to update AsyncStorage immediately
    try {
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedLocalProfile));
        console.log("Profile updated in local state and AsyncStorage");
    } catch (storageError) {
        console.error("Error saving updated profile to AsyncStorage:", storageError);
    }


    // If offline, we've already updated locally, so we're done for now
    if (!isConnected) {
      console.log("Offline - profile update stored locally. Will sync when online.");
      // Consider adding a mechanism to sync offline changes later
      return updatedLocalProfile;
    }

    // If online, update Firestore
    try {
      console.log("Online - updating profile in Firestore...");
      const userRef = doc(optimizedDb, 'users', currentUser.uid);
      await updateDoc(userRef, dataToUpdate);
      console.log("Profile updated successfully in Firestore");
      return updatedLocalProfile; // Return the locally updated profile
    } catch (error) {
      console.error("Error updating profile in Firestore:", error);
      // Potentially revert local state or notify user? For now, just log error.
      throw error; // Re-throw the error to be handled by the caller
    }
  }

  // Update location (handles both online and offline)
  async function updateLocation(coordinates) {
     if (!currentUser) {
      console.warn("Attempted to update location without logged-in user.");
      return;
    }

    // Prepare updated profile data including coordinates and lastActive
    const dataToUpdate = {
      coordinates,
      lastActive: new Date()
    };

    // Update local state optimistically
    const updatedLocalProfile = {
        ...(userProfile || {}),
        ...dataToUpdate
    };
    setUserProfile(updatedLocalProfile);

    // Try to update AsyncStorage immediately
    try {
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedLocalProfile));
        console.log("Location updated in local state and AsyncStorage");
    } catch (storageError) {
        console.error("Error saving updated location to AsyncStorage:", storageError);
    }

    // If offline, store locally and return
    if (!isConnected) {
      console.log("Offline - location update stored locally.");
      return; // Don't proceed to Firestore update
    }

    // If online, update Firestore
    try {
        console.log("Online - updating location in Firestore...");
        const userRef = doc(optimizedDb, 'users', currentUser.uid);
        await updateDoc(userRef, dataToUpdate);
        console.log("Location updated successfully in Firestore");
    } catch (error) {
        console.error("Error updating location in Firestore:", error);
        // Don't throw error for location updates, maybe less critical
    }
  }

  // Upload profile image and update profile
  const uploadProfileImage = async (imageUri) => {
    if (!currentUser) {
      console.warn("Cannot upload profile image without logged-in user.");
      return null;
    }

    try {
      console.log("Uploading profile image...");

      // Create file path
      const filePath = `profileImages/${currentUser.uid}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filePath);

      // Convert URI to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Set metadata for caching
      const metadata = {
        contentType: 'image/jpeg',
        cacheControl: 'public,max-age=31536000',
      };

      // Upload image
      await uploadBytes(storageRef, blob, metadata);
      const downloadURL = await getDownloadURL(storageRef);

      // Update profile with photoURL
      await updateUserProfile({ photoURL: downloadURL });

      console.log("Profile image uploaded successfully:", downloadURL);
      return downloadURL;
    } catch (error) {
      console.error("Error uploading profile image:", error);
      throw error;
    }
  };

  // Load user profile data (prioritizes Firestore when online, uses cache otherwise)
  async function loadUserProfile(user) {
    if (!user) return null;

    console.log(`Loading profile for user: ${user.uid}`);
    
    // Check if we have a recent cached version
    if (profileCache[user.uid] && Date.now() - profileCache[user.uid].timestamp < 300000) { // 5 minutes cache
      console.log("Using cached profile data");
      const cachedProfile = profileCache[user.uid].data;
      setUserProfile(cachedProfile);
      return cachedProfile;
    }
    
    let profileData = null;
    let loadedFromStorage = false;

    // 1. Try loading from AsyncStorage first (fastest, offline fallback)
    try {
      const storedProfile = await AsyncStorage.getItem('userProfile');
      if (storedProfile) {
        profileData = JSON.parse(storedProfile);
        // Quick check if the stored profile belongs to the current user
        if (profileData.uid === user.uid) {
            console.log("Loaded profile from local storage (AsyncStorage)");
            setUserProfile(profileData); // Update state immediately with cached data
            loadedFromStorage = true;
        } else {
            console.warn("Stored profile UID mismatch. Discarding.");
            profileData = null; // Discard mismatched profile
            await AsyncStorage.removeItem('userProfile'); // Clear bad data
        }
      }
    } catch (storageError) {
      console.error("Error loading profile from AsyncStorage:", storageError);
    }

    // 2. If online, try fetching from Firestore for fresh data
    if (isConnected) {
      try {
        console.log("Online - fetching profile from Firestore...");
        const docRef = doc(optimizedDb, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const firestoreProfile = docSnap.data();
          console.log("Loaded profile from Firestore");
          profileData = firestoreProfile; // Firestore data is the source of truth

          // Update local state and storage with the latest data
          setUserProfile(profileData);
          try {
            await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
            console.log("Updated AsyncStorage with fresh Firestore data");
          } catch (storageError) {
             console.error("Error saving fresh profile to AsyncStorage:", storageError);
          }
        } else {
          console.log("No profile found in Firestore for user:", user.uid);
          // If no Firestore profile exists but user is authenticated, create a basic one
          // This might happen if Firestore creation failed during signup or manual deletion
          if (!profileData) { // Only create if we didn't load anything from storage either
             console.log("Creating basic profile in Firestore as none exists...");
              profileData = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || 'User', // Use display name from Auth if available
                goal: '',
                bio: '',
                displayLocation: '',
                isActive: false,
                createdAt: new Date(), // Or maybe user.metadata.creationTime?
                lastActive: new Date(),
                coordinates: null,
                goals: []
              };

              try {
                await setDoc(doc(optimizedDb, 'users', user.uid), profileData);
                console.log("Successfully created basic profile in Firestore.");
                setUserProfile(profileData);
                await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
              } catch (setError) {
                console.error("Error creating basic profile in Firestore:", setError);
                // If creation fails, we might end up with no profileData
                profileData = null;
              }
          }
        }
      } catch (firestoreError) {
        console.error("Error loading profile from Firestore:", firestoreError);
        // If Firestore fails, rely on the data loaded from storage (if any)
        console.log(`Falling back to profile data loaded from storage: ${loadedFromStorage}`);
        // State `userProfile` already holds the stored data if loaded successfully
      }
    } else {
      // If offline, rely entirely on AsyncStorage data
      console.log("Offline - using cached profile data from AsyncStorage.");
      if (!loadedFromStorage) {
         console.log("Offline and no profile data found in AsyncStorage.");
         // Set profile to null if truly no data available
         setUserProfile(null);
         profileData = null;
      }
      // No need to update state here, it was done when loading from storage
    }

    // Cache the profile data
    if (profileData) {
      profileCache[user.uid] = {
        data: profileData,
        timestamp: Date.now()
      };
    }

    console.log("loadUserProfile finished. Final profile state:", profileData ? `User: ${profileData.name}` : "None");
    return profileData; // Return the determined profile data
  }

  // Find users with similar goals (requires network)
  async function findUsersWithSameGoal(goalText, alreadyDoing = null) {
    if (!isConnected) {
      console.log("Offline - cannot search for users.");
      // Optionally return cached results if implemented, otherwise empty
      return [];
    }
    if (!currentUser) {
        console.warn("Cannot search for users without a logged-in user.");
        return [];
    }

    try {
      console.log(`Searching for users with focus area matching: "${goalText}", status: ${alreadyDoing === null ? 'any' : alreadyDoing ? 'doing' : 'planning'}`);

      // Query all users except the current one
      const usersRef = collection(optimizedDb, "users");
      // Note: Firestore doesn't efficiently support complex text search or 'NOT EQUAL' combined with other filters well.
      // Fetching all users (or a subset based on location/activity) and filtering client-side is often necessary for this type of matching.
      // Be mindful of read costs if the user base grows large. Consider backend functions or dedicated search services (Algolia) for scale.
      const usersQuery = query(
        usersRef,
        where("uid", "!=", currentUser.uid) // Exclude self
        // Potential Optimization: Add where("isActive", "==", true) if only searching active users?
      );

      const querySnapshot = await getDocs(usersQuery);
      let matchingUsers = [];
      const normalizedSearchText = goalText.toLowerCase().trim();

      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        // Ensure user has goals array
        if (userData.goals && Array.isArray(userData.goals)) {
          const matchingGoals = userData.goals.filter(goal => {
            // Basic check: Goal must be active
            if (!goal.isActive) return false;

            // Check status (planning/doing) if specified
            if (alreadyDoing !== null && goal.alreadyDoing !== alreadyDoing) {
                return false;
            }

            // --- Matching Logic ---
            const normalizedGoalText = (goal.text || '').toLowerCase().trim();
            if (!normalizedGoalText) return false; // Skip empty goals

            // 1. Exact Match (Highest Priority)
            if (normalizedGoalText === normalizedSearchText) return true;

            // 2. Contains Match (Good Flexibility)
            if (normalizedGoalText.includes(normalizedSearchText) || normalizedSearchText.includes(normalizedGoalText)) {
              return true;
            }

            // 3. Word Overlap Match (More Fuzzy)
            const searchWords = normalizedSearchText.split(/\s+/).filter(w => w.length > 1); // Ignore single letters
            const goalWords = normalizedGoalText.split(/\s+/).filter(w => w.length > 1);
            if (!searchWords.length || !goalWords.length) return false; // Need words to compare

            const commonWords = searchWords.filter(word => goalWords.includes(word));
            const matchPercentage = Math.max(
                commonWords.length / searchWords.length,
                commonWords.length / goalWords.length // Consider match relative to both texts
            );

            // Adjust threshold as needed (e.g., 0.5 means 50% word overlap)
            return matchPercentage >= 0.5;
          });

          if (matchingGoals.length > 0) {
             // Sort matching goals internally if needed (e.g., exact match first)
             matchingGoals.sort((a, b) => {
               const aIsExact = (a.text || '').toLowerCase().trim() === normalizedSearchText;
               const bIsExact = (b.text || '').toLowerCase().trim() === normalizedSearchText;
               if (aIsExact && !bIsExact) return -1;
               if (!aIsExact && bIsExact) return 1;
               return 0; // Keep original order otherwise
             });

            matchingUsers.push({
              id: doc.id, // Firestore document ID
              ...userData,
              matchingGoals: matchingGoals // Include the specific goals that matched
            });
          }
        }
      });

      console.log(`Found ${matchingUsers.length} users with similar focus areas.`);
      // Optional: Sort matchingUsers by some criteria (e.g., number of matching goals, location proximity if available)
      return matchingUsers;
    } catch (error) {
      console.error("Error finding users with same goal:", error);
      return []; // Return empty array on error
    }
  }


  // --- NEW CONNECTION FUNCTIONS ---

  // Check for incoming connection requests (requires network)
  const getIncomingConnectionRequests = async () => {
    if (!currentUser) return [];
    if (!isConnected) {
      console.log("Offline - cannot fetch incoming connection requests.");
      return [];
    }

    try {
      console.log("Fetching incoming connection requests...");
      const connectionsRef = collection(optimizedDb, 'connections');
      // Query: User is in 'users' array, status is 'pending', and requestedBy is NOT the current user.
      const incomingRequestsQuery = query(
        connectionsRef,
        where('users', 'array-contains', currentUser.uid),
        where('status', '==', 'pending'),
        where('requestedBy', '!=', currentUser.uid)
      );

      const querySnapshot = await getDocs(incomingRequestsQuery);
      const requests = [];

      // Use Promise.all for potentially faster profile fetching
      const profilePromises = querySnapshot.docs.map(async (connDoc) => {
        const data = connDoc.data();
        const requesterId = data.requestedBy;

        try {
            const requesterDocRef = doc(optimizedDb, 'users', requesterId);
            const requesterDocSnap = await getDoc(requesterDocRef);

            if (requesterDocSnap.exists()) {
              return {
                id: connDoc.id, // Connection document ID
                ...data,
                requester: {
                  id: requesterId,
                  ...requesterDocSnap.data() // Requester's profile data
                }
              };
            } else {
              console.warn(`Requester profile not found for ID: ${requesterId}`);
              return null; // Skip if requester profile doesn't exist
            }
        } catch (profileError) {
             console.error(`Error fetching profile for requester ${requesterId}:`, profileError);
             return null; // Skip on error fetching profile
        }
      });

      const resolvedRequests = await Promise.all(profilePromises);
      requests.push(...resolvedRequests.filter(req => req !== null)); // Add valid requests

      console.log(`Found ${requests.length} incoming connection requests.`);
      return requests;
    } catch (error) {
      console.error('Error getting incoming connection requests:', error);
      return [];
    }
  };

  // Accept a connection request (requires network)
  const acceptConnectionRequest = async (connectionId) => {
    if (!currentUser) return false;
     if (!isConnected) {
      console.log("Offline - cannot accept connection request.");
      return false;
    }

    try {
      console.log(`Accepting connection request: ${connectionId}`);
      const connectionRef = doc(optimizedDb, 'connections', connectionId);
      await updateDoc(connectionRef, {
        status: 'accepted',
        acceptedAt: new Date() // Timestamp acceptance
      });
      console.log("Connection request accepted successfully.");
      return true;
    } catch (error) {
      console.error('Error accepting connection request:', error);
      return false;
    }
  };

  // Decline a connection request (requires network)
  const declineConnectionRequest = async (connectionId) => {
    if (!currentUser) return false;
     if (!isConnected) {
      console.log("Offline - cannot decline connection request.");
      return false;
    }

    try {
      console.log(`Declining connection request: ${connectionId}`);
      const connectionRef = doc(optimizedDb, 'connections', connectionId);
      // Option 1: Update status to 'declined' (keeps a record)
      await updateDoc(connectionRef, {
        status: 'declined',
        declinedAt: new Date() // Timestamp decline
      });
       // Option 2: Delete the request document (removes it entirely)
       // await deleteDoc(connectionRef);

      console.log("Connection request declined successfully.");
      return true;
    } catch (error) {
      console.error('Error declining connection request:', error);
      return false;
    }
  };

  // Get all accepted connections (requires network)
  const getAcceptedConnections = async () => {
    if (!currentUser) return [];
     if (!isConnected) {
      console.log("Offline - cannot fetch accepted connections.");
      return [];
    }

    try {
        console.log("Fetching accepted connections...");
        const connectionsRef = collection(optimizedDb, 'connections');
        // Query: User is in 'users' array, status is 'accepted'
        const acceptedConnectionsQuery = query(
            connectionsRef,
            where('users', 'array-contains', currentUser.uid),
            where('status', '==', 'accepted')
        );

        const querySnapshot = await getDocs(acceptedConnectionsQuery);
        const connections = [];

        // Use Promise.all for potentially faster profile fetching
        const profilePromises = querySnapshot.docs.map(async (connDoc) => {
            const data = connDoc.data();
            // Find the ID of the other user in the connection
            const otherUserId = data.users.find(id => id !== currentUser.uid);

            if (otherUserId) {
                 try {
                    // Fetch the other user's profile
                    const userDocRef = doc(optimizedDb, 'users', otherUserId); // Correct usage of doc()
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                         return {
                            id: connDoc.id, // Connection document ID
                            ...data,
                            otherUser: {
                                id: otherUserId,
                                ...userDocSnap.data() // Other user's profile data
                            }
                        };
                    } else {
                         console.warn(`Connected user profile not found for ID: ${otherUserId}`);
                         return null; // Skip if other user profile doesn't exist
                    }
                 } catch (profileError) {
                    console.error(`Error fetching profile for connected user ${otherUserId}:`, profileError);
                    return null; // Skip on error fetching profile
                 }
            } else {
                console.warn(`Connection doc ${connDoc.id} missing other user ID.`);
                return null; // Skip if connection data is malformed
            }
        });

        const resolvedConnections = await Promise.all(profilePromises);
        connections.push(...resolvedConnections.filter(conn => conn !== null)); // Add valid connections

        console.log(`Found ${connections.length} accepted connections.`);
        return connections;
    } catch (error) {
        console.error('Error getting accepted connections:', error);
        return [];
    }
  };

  // --- NEW GOAL & SYNERGY FUNCTIONS ---

  // Set a spotlight goal (updates profile, handles offline via updateUserProfile)
  const setSpotlightGoal = async (goalId) => {
    if (!currentUser || !userProfile || !userProfile.goals) {
        console.warn("Cannot set spotlight goal: Missing user, profile, or goals.");
        return false;
    }

    try {
      console.log(`Setting spotlight goal to ID: ${goalId}`);
      // Create a new goals array where only the target goal has isSpotlight = true
      const updatedGoals = userProfile.goals.map(goal => ({
        ...goal,
        isSpotlight: goal.id === goalId // Set true for the matching goal, false for others
      }));

      // Use the existing updateUserProfile function to save the changes
      // This automatically handles local state, AsyncStorage, and Firestore updates (if online)
      await updateUserProfile({ goals: updatedGoals });

      console.log("Spotlight goal updated successfully.");
      return true;
    } catch (error) {
      console.error('Error setting spotlight goal:', error);
      return false; // updateUserProfile might throw an error
    }
  };

  // Helper function to extract keywords from text (internal use)
  const extractKeywords = (texts) => {
    if (!texts || !Array.isArray(texts) || texts.length === 0) return [];

    const allText = texts.join(' ').toLowerCase();
    // More comprehensive stop words list (can be expanded)
    const commonWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'so', 'if', 'of', 'to', 'in', 'on', 'at', 'by',
        'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
        'after', 'above', 'below', 'from', 'up', 'down', 'out', 'off', 'over', 'under',
        'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
        'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 'll', 'm', 'o', 're', 've', 'y',
        'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 'hasn', 'haven', 'isn', 'ma', 'mightn',
        'mustn', 'needn', 'shan', 'shouldn', 'wasn', 'weren', 'won', 'wouldn',
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
        'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
        'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
        'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
        'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
        'did', 'doing', 'get', 'make', 'go', 'learn', 'improve', 'become', 'start', 'try'
        // Add more domain-specific common words if needed
    ]);

    // Split by non-alphanumeric characters, filter out short words and common words
const words = allText.split(/[^a-z0-9]/)
.map(word => word.trim())
.filter(word =>
  word.length > 2 &&          // Keep words longer than 2 characters
  !commonWords.has(word) &&   // Exclude common stop words
  !/^\d+$/.test(word)        // Exclude words that are only numbers
);

// Return unique keywords
return [...new Set(words)];
};

// Helper function to calculate synergy score (internal use)
const calculateSynergy = (userKeywords, otherKeywords) => {
if (!userKeywords || !otherKeywords || userKeywords.length === 0 || otherKeywords.length === 0) {
return 0; // No synergy if either set is empty
}

const userKeywordSet = new Set(userKeywords);
const otherKeywordSet = new Set(otherKeywords);

// Find intersection (matching keywords)
const intersection = new Set([...userKeywordSet].filter(word => otherKeywordSet.has(word)));
const matchCount = intersection.size;

// Find union (total unique keywords across both)
const union = new Set([...userKeywordSet, ...otherKeywordSet]);
const totalUniqueKeywords = union.size;

// Calculate Jaccard Index (Intersection over Union) - common similarity measure
const score = totalUniqueKeywords > 0 ? (matchCount / totalUniqueKeywords) : 0;

// Return as a percentage (0-100)
return Math.round(score * 100);
};


// Find potential matches based on goal synergy (requires network)
const findSynergyMatches = async () => {
if (!currentUser || !userProfile) {
   console.warn("Cannot find synergy matches without current user or profile.");
   return [];
}
if (!isConnected) {
console.log("Offline - cannot search for synergy matches.");
return [];
}

try {
console.log("Finding synergy matches...");

// 1. Get current user's active goals and extract keywords
const userActiveGoals = (userProfile.goals || []).filter(g => g.isActive && g.text);
if (userActiveGoals.length === 0) {
  console.log("Current user has no active goals to match against.");
  return [];
}
const userKeywords = extractKeywords(userActiveGoals.map(g => g.text));
console.log("Current user keywords:", userKeywords);
if (userKeywords.length === 0) {
  console.log("No usable keywords extracted from current user's goals.");
  return [];
}

// 2. Query other active users
const usersRef = collection(optimizedDb, 'users');
const usersQuery = query(
    usersRef,
    where('uid', '!=', currentUser.uid), // Exclude self
    where('isActive', '==', true) // Optionally focus on currently active users
    // Add location constraints here if needed (e.g., using geohashing)
  );
const usersSnapshot = await getDocs(usersQuery);

const potentialMatches = [];

// 3. Calculate synergy for each other user
usersSnapshot.forEach((doc) => {
  const userData = doc.data();
  const otherUserActiveGoals = (userData.goals || []).filter(g => g.isActive && g.text);

  // Only consider users who also have active goals
  if (otherUserActiveGoals.length > 0) {
    const otherUserKeywords = extractKeywords(otherUserActiveGoals.map(g => g.text));

    if (otherUserKeywords.length > 0) {
       const synergyScore = calculateSynergy(userKeywords, otherUserKeywords);

       // Only include users with some level of synergy (e.g., score > 0)
       if (synergyScore > 5) { // Threshold can be adjusted
          potentialMatches.push({
              id: doc.id,
              ...userData,
              synergy: synergyScore,
              // Optionally include keywords for debugging/display:
              // keywords: otherUserKeywords
          });
       }
    }
  }
});

// 4. Sort matches by synergy score (highest first)
potentialMatches.sort((a, b) => b.synergy - a.synergy);

console.log(`Found ${potentialMatches.length} potential synergy matches.`);
// Return top N matches or all matches based on requirements
return potentialMatches.slice(0, 50); // Example: Return top 50

} catch (error) {
console.error('Error finding synergy matches:', error);
return [];
}
};


// Listen for auth state changes
useEffect(() => {
console.log("Setting up Firebase Auth state listener...");
const unsubscribe = onAuthStateChanged(auth, async (user) => {
console.log("Auth state changed:", user ? `User logged in: ${user.email} (UID: ${user.uid})` : "User logged out");
setLoading(true); // Start loading indicator on auth change

if (user) {
  // User is signed in
  setCurrentUser(user);
  await loadUserProfile(user); // Load or refresh profile data
  prefetchUserData(user.uid); // Add this line to prefetch data
} else {
  // User is signed out
  setCurrentUser(null);
  setUserProfile(null);
  try {
      await AsyncStorage.removeItem('userProfile'); // Ensure local cache is cleared on logout
      console.log("Cleared user profile from AsyncStorage on logout.");
  } catch (e) {
      console.error("Error clearing AsyncStorage on logout:", e);
  }
}

setLoading(false); // Stop loading indicator
});

// Cleanup function: Unsubscribe the listener when the component unmounts
return () => {
  console.log("Cleaning up Firebase Auth state listener.");
  unsubscribe();
};
}, []); // Empty dependency array ensures this runs only once on mount

// Value object provided by the context
const value = {
currentUser,
userProfile,
loading,
isConnected,
// Core Auth & Profile
signup,
login,
logout,
updateUserProfile,
updateLocation,
uploadProfileImage, // Add this new function
// Finding Users
findUsersWithSameGoal,
findSynergyMatches,
// Connections
getIncomingConnectionRequests,
acceptConnectionRequest,
declineConnectionRequest,
getAcceptedConnections,
// Goals
setSpotlightGoal,
};

return (
<AuthContext.Provider value={value}>
  {/* Render children only when not in the initial loading state */}
  {/* We might show a global loading indicator elsewhere based on `loading` */}
  {children}
  {/* Or conditionally render children: {!loading ? children : <SomeLoadingIndicator />} */}
</AuthContext.Provider>
);
}