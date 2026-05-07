// Configuration Firebase avec sécurité anti-bascule sur projet vide
// Ce fichier garantit que l'application reste connectée au projet contenant les données réelles.

const DATA_PROJECT_ID = "studio-8223503245-60ae5";
const EMPTY_PROJECT_ID = "like-vision-187e1";

const VERCEL_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// LOGIQUE DE DÉCISION DU PROJET :
// Si Vercel nous envoie sur le projet vide (like-vision-187e1), on force le retour sur DATA.
// Sinon on utilise ce qui est configuré dans Vercel, avec DATA par défaut.
const activeProjectId = (VERCEL_PROJECT_ID === EMPTY_PROJECT_ID) ? DATA_PROJECT_ID : (VERCEL_PROJECT_ID || DATA_PROJECT_ID);

export const firebaseConfig = {
  apiKey: activeProjectId === DATA_PROJECT_ID 
    ? "AIzaSyDTVvD1Hr07ypQGuowJE6N5QGHDTMwR6Hg" 
    : (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDTVvD1Hr07ypQGuowJE6N5QGHDTMwR6Hg"),
    
  authDomain: activeProjectId === DATA_PROJECT_ID 
    ? `${DATA_PROJECT_ID}.firebaseapp.com` 
    : (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${DATA_PROJECT_ID}.firebaseapp.com`),
    
  projectId: activeProjectId,
  
  storageBucket: activeProjectId === DATA_PROJECT_ID 
    ? `${DATA_PROJECT_ID}.firebasestorage.app` 
    : (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${DATA_PROJECT_ID}.firebasestorage.app`),
    
  messagingSenderId: activeProjectId === DATA_PROJECT_ID 
    ? "58488072062" 
    : (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "58488072062"),
    
  appId: activeProjectId === DATA_PROJECT_ID 
    ? "1:58488072062:web:45a6910443004a3805b52f" 
    : (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:58488072062:web:45a6910443004a3805b52f")
};
