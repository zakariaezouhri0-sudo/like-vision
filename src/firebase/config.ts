// Configuration Firebase ultra-strict pour garantir la connexion aux données du magasin
// Cet ID de projet contient toutes vos ventes, clients et sessions.
const DATA_PROJECT_ID = "studio-8223503245-60ae5";

// On définit le projet actif. On force DATA_PROJECT_ID quoi qu'il arrive, 
// sauf si une variable Vercel différente et VALIDE est explicitement fournie.
const VERCEL_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Sécurité : Si le projet dans Vercel est l'ancien projet vide, on l'ignore.
const activeProjectId = (VERCEL_PROJECT_ID && VERCEL_PROJECT_ID !== "like-vision-187e1") 
  ? VERCEL_PROJECT_ID 
  : DATA_PROJECT_ID;

export const firebaseConfig = {
  // On utilise la clé API fournie par Vercel, ou celle de secours du projet de données
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDTVvD1Hr07ypQGuowJE6N5QGHDTMwR6Hg",
  authDomain: `${activeProjectId}.firebaseapp.com`,
  projectId: activeProjectId,
  storageBucket: `${activeProjectId}.firebasestorage.app`,
  messagingSenderId: "58488072062",
  appId: "1:58488072062:web:45a6910443004a3805b52f"
};
