// src/config/firebase-optimization.js
import { initializeFirestore, CACHE_SIZE_UNLIMITED, enableMultiTabIndexedDbPersistence } from "firebase/firestore";
import { app } from './firebase'; // Import your existing Firebase app instance

// Initialize Firestore with settings for better performance
export const optimizedDb = initializeFirestore(app, {
  cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  ignoreUndefinedProperties: true,
});

// Enable offline persistence (carefully, as it increases initial load time)
try {
  enableMultiTabIndexedDbPersistence(optimizedDb);
} catch (error) {
  console.log("Error enabling persistence:", error);
}

// Prefetch common documents
export const prefetchCommonData = async (userId) => {
  if (!userId) return;
  
  try {
    // Example of prefetching user profile
    const userRef = doc(optimizedDb, 'users', userId);
    await getDocFromCache(userRef);
  } catch (error) {
    // Document not in cache, fetch from server
    // This will cache for next time
  }
};