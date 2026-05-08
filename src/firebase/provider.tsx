'use client';

import React, { createContext, useContext, ReactNode, useState, useEffect, DependencyList, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
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
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
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
    isUserLoading
  };

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useAuth = () => auth;
export const useFirestore = () => db;

export const useUser = () => {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useUser must be used within FirebaseProvider');
  return context;
};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  const result = useMemo(factory, deps);
  if (result) {
    (result as any).__memo = true;
  }
  return result;
}

export function useCollection<T = any>(query: (Query<DocumentData> | CollectionReference<DocumentData>) & {__memo?: boolean}) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = onSnapshot(query, (snapshot: QuerySnapshot<DocumentData>) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setData(items);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [query]);

  return { data, isLoading };
}

export function useDoc<T = any>(ref: (DocumentReference<DocumentData> & {__memo?: boolean}) | null | undefined) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!ref) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = onSnapshot(ref, (snapshot: DocumentSnapshot<DocumentData>) => {
      if (snapshot.exists()) {
        setData({ id: snapshot.id, ...snapshot.data() } as any);
      } else {
        setData(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [ref]);

  return { data, isLoading };
}