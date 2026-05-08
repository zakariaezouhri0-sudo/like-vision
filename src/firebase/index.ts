import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

// Initialisation unique de l'application
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export des instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export des composants et hooks
export * from './provider';
export * from './client-provider';