'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, DependencyList, useMemo } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  Firestore, 
  onSnapshot, 
  DocumentReference, 
  Query, 
  DocumentData, 
  QuerySnapshot, 
  DocumentSnapshot,
  CollectionReference
} from 'firebase/firestore';
import { auth, db } from './index';

interface FirebaseContextState {
  user: User | null;
  isUserLoading: boolean;
  db: Firestore;
  auth: any;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsUserLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const value = {
    user,
    isUserLoading,
    db,
    auth
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirebase must be used within FirebaseProvider');
  return context;
};

export const useAuth = () => useFirebase().auth;
export const useFirestore = () => useFirebase().db;
export const useUser = () => {
  const { user, isUserLoading } = useFirebase();
  return { user, isUserLoading };
};

// Hook pour mémoïser les références Firebase (évite les boucles infinies dans useEffect)
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const memoized = useMemo(factory, deps);
  if (memoized && typeof memoized === 'object') {
    (memoized as any).__memo = true;
  }
  return memoized;
}

// Hook pour s'abonner à une collection
export function useCollection<T = any>(query: Query<DocumentData> | CollectionReference<DocumentData>) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!query) return;
    setIsLoading(true);
    const unsubscribe = onSnapshot(query, (snapshot: QuerySnapshot<DocumentData>) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      setData(items);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [query]);

  return { data, isLoading };
}

// Hook pour s'abonner à un document
export function useDoc<T = any>(ref: DocumentReference<DocumentData>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ref) return;
    setIsLoading(true);
    const unsubscribe = onSnapshot(ref, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        setData({ id: snapshot.id, ...snapshot.data() } as T);
      } else {
        setData(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [ref]);

  return { data, isLoading };
}
