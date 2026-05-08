import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

// Initialisation de l'application Firebase (Singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export des instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// Export de la fonction d'initialisation (pour compatibilité si nécessaire)
export const initializeFirebase = () => ({
  firebaseApp: app,
  auth,
  firestore: db,
});

// Ré-exportation de tout ce qui se trouve dans les providers
export * from './provider';
export * from './client-provider';