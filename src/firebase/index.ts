import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

// Initialisation de l'application Firebase (Singleton)
// On s'assure que l'app est initialisée avec la config complète
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export des instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// Ré-exportation des composants et hooks
export * from './provider';
export * from './client-provider';

// Fonction utilitaire pour récupérer les instances
export const initializeFirebase = () => ({
  firebaseApp: app,
  auth,
  firestore: db,
});
