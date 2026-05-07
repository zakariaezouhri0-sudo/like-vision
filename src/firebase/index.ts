
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  Firestore
} from 'firebase/firestore';

export function initializeFirebase() {
  let app: FirebaseApp;
  
  if (!getApps().length) {
    try {
      app = initializeApp(firebaseConfig);
    } catch (e) {
      app = initializeApp(firebaseConfig);
    }
  } else {
    app = getApp();
  }

  let firestore: Firestore;
  const isServer = typeof window === 'undefined';

  try {
    if (isServer) {
      // Version serveur simple sans cache local
      firestore = getFirestore(app);
    } else {
      // Version client avec persistance offline
      try {
        firestore = getFirestore(app);
      } catch (e) {
        firestore = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        });
      }
    }
  } catch (e) {
    firestore = getFirestore(app);
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: firestore
  };
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
