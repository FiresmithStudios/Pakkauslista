import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyDQ29cAjHgA3jnQMl5fB6nqg7SZcUFC6zk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'package-b9c2d.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'package-b9c2d',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'package-b9c2d.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '102591548743',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:102591548743:web:94a36adad6d3e4cfc05062',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-P53TK6V915',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? 'https://package-b9c2d-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
