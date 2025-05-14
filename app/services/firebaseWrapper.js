// Create a file at: app/services/firebaseWrapper.js

import auth from '@react-native-firebase/auth';
// Import firestore conditionally
let firestore = null;
try {
  firestore = require('@react-native-firebase/firestore').default;
} catch (error) {
  console.warn('Firestore not available, using fallback');
  // Create a mock/fallback implementation if needed
  firestore = {
    collection: () => ({
      doc: () => ({
        get: () => Promise.resolve({ exists: false, data: () => ({}) }),
        set: () => Promise.resolve(),
        update: () => Promise.resolve(),
        onSnapshot: () => () => {}
      }),
      add: () => Promise.resolve({ id: 'mock-id' }),
      where: () => ({ get: () => Promise.resolve({ docs: [] }) }),
      onSnapshot: () => () => {}
    })
  };
}

export { auth, firestore };