/**
 * firebase.js
 * -----------
 * Initializes Firebase Web SDK with project credentials.
 */

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCH6fpjrfB0HaWUxhQazMr0OzQo2gizglY",
  authDomain: "coimbatore-watershed-monitor.firebaseapp.com",
  projectId: "coimbatore-watershed-monitor",
  storageBucket: "coimbatore-watershed-monitor.firebasestorage.app",
  messagingSenderId: "303583184792",
  appId: "1:303583184792:web:a66c12f974dcc851198ded",
  measurementId: "G-KQ1Q3JX2J8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;
