
'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

/**
 * Composant invisible qui synchronise le thème de l'application
 * avec la valeur stockée globalement dans Firestore.
 */
export function GlobalThemeSync() {
  const { setTheme } = useTheme();
  const db = useFirestore();
  
  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings } = useDoc(settingsRef);

  useEffect(() => {
    if (settings?.theme) {
      setTheme(settings.theme);
    }
  }, [settings?.theme, setTheme]);

  return null;
}
