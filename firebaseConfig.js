// firebaseConfig.js
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEsRR7v1fM_8KC3NmAEs3uO38-DeM5bLY",
  authDomain: "focuslink-b5b00.firebaseapp.com",
  projectId: "focuslink-b5b00",
  storageBucket: "focuslink-b5b00.firebasestorage.app",
  messagingSenderId: "167264179864",
  appId: "1:167264179864:web:a3b0441a59653bde3f22ed",
  measurementId: "G-J2K72LFL97"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);

export { app, auth, db };