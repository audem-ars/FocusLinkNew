import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // Only import once
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyAEsRR7v1fM_8KC3NmAEs3uO38-DeM5bLY",
  authDomain: "focuslink-b5b00.firebaseapp.com",
  projectId: "focuslink-b5b00",
  storageBucket: "focuslink-b5b00.appspot.com", // Fixed bucket URL
  messagingSenderId: "167264179864",
  appId: "1:167264179864:web:a3b0441a59653bde3f22ed",
  measurementId: "G-J2K72LFL97"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

// Export the Firebase services
export { app, auth, db, storage };