import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from "./config";

// Initialisation de l'application Firebase (Singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export des instances pour une utilisation directe
export const auth = getAuth(app);
export const db = getFirestore(app);

// Ré-exportation de tout le contenu des fichiers provider et client-provider
export * from './provider';
export * from './client-provider';
