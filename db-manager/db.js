import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, remove, update } from 'firebase/database';
import 'dotenv/config';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY ?? 'AIzaSyDQ29cAjHgA3jnQMl5fB6nqg7SZcUFC6zk',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN ?? 'package-b9c2d.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID ?? 'package-b9c2d',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? 'package-b9c2d.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID ?? '102591548743',
  appId: process.env.FIREBASE_APP_ID ?? '1:102591548743:web:94a36adad6d3e4cfc05062',
  databaseURL: process.env.FIREBASE_DATABASE_URL ?? 'https://package-b9c2d-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, get, set, remove, update };
