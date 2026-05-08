"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User as UserIcon, Loader2, Glasses, ThumbsUp, RefreshCw } from "lucide-react";
import { useFirestore, useAuth, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc, terminate, clearIndexedDbPersistence } from "firebase/firestore";
import { signInAnonymously, updateProfile, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mounted, setMounted] = useState(false);
  const [hostname, setHostname] = useState("");

  const handleResetStorage = async () => {
    try {
      setLoading(true);
      // Nettoyage complet
      localStorage.clear();
      sessionStorage.clear();
      
      if (auth) await signOut(auth);
      if (db) {
        await terminate(db);
        await clearIndexedDbPersistence(db);
      }
      
      toast({ title: "Synchronisation...", description: "Nettoyage complet effectué. Rechargement..." });
      
      setTimeout(() => {
        window.location.href = window.location.origin + "/login";
      }, 1000);
    } catch (e) {
      window.location.reload();
    }
  };

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      setHostname(window.location.hostname);
    }

    // Vérification de sécurité du projet au chargement
    const checkProjectIntegrity = async () => {
      const expectedId = "studio-8223503245-60ae5";
      const currentId = db.app.options.projectId;
      
      if (currentId !== expectedId) {
        console.warn("Mismatch de projet détecté. Nettoyage forcé...");
        await handleResetStorage();
      }
    };
    checkProjectIntegrity();
  }, [db]);

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsRef);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const cleanUsername = username.toLowerCase().trim();

    // Comptes de secours Hardcoded
    if (cleanUsername === "admin" && password === "admin123") {
      try {
        const userCredential = await signInAnonymously(auth);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: "Administrateur" });
          localStorage.setItem('user_role', 'ADMIN');
        }
        toast({ variant: "success", title: "Connexion réussie", description: "Bienvenue (Mode Admin)." });
        router.push("/dashboard");
      } catch (err) {
        toast({ variant: "destructive", title: "Erreur Auth", description: "Videz le cache si l'erreur persiste." });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (cleanUsername === "prepa" && password === "prepa123") {
      try {
        const userCredential = await signInAnonymously(auth);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: "ZAKARIAE" });
          localStorage.setItem('user_role', 'PREPA');
        }
        toast({ variant: "success", title: "Mode Préparation Actif", description: "Espace brouillon isolé." });
        router.push("/dashboard");
      } catch (err) {
        toast({ variant: "destructive", title: "Erreur Auth" });
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", cleanUsername));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Utilisateur non trouvé. Cliquez sur 'Synchronisation forcée' en bas.");
      }

      const userData = querySnapshot.docs[0].data();

      if (userData.password === password) {
        if (userData.status === "Suspendu") throw new Error("Compte suspendu.");
        
        const userCredential = await signInAnonymously(auth);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: userData.name });
          const role = (userData.role || 'OPTICIENNE').toUpperCase();
          localStorage.setItem('user_role', role);
          
          toast({ variant: "success", title: "Bienvenue", description: `Bonjour, ${userData.name}.` });
          router.push(role === "OPTICIENNE" ? "/caisse" : "/dashboard");
        }
      } else {
        throw new Error("Mot de passe incorrect.");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur de connexion", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0D1B2A] px-4 py-8">
      <div className="w-full max-w-xl space-y-8 flex flex-col items-center">
        <div className="w-full flex flex-col items-center text-center pb-2">
          {settingsLoading ? (
            <Loader2 className="h-12 w-12 animate-spin text-[#D4AF37] opacity-20" />
          ) : (
            <div className="flex flex-col items-center">
              {settings?.logoUrl ? (
                <div className="w-32 h-32 mb-6 p-2 rounded-3xl bg-[#0D1B2A] shadow-2xl border border-white/5">
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="mb-4">
                  <div className="relative">
                    <Glasses className="h-20 w-20 text-[#D4AF37]" />
                    <ThumbsUp className="h-8 w-8 absolute -top-2 -right-2 text-[#0D1B2A] bg-[#D4AF37] p-1 rounded-full shadow-lg" />
                  </div>
                </div>
              )}
              <h1 className="text-3xl md:text-5xl font-black text-[#D4AF37] uppercase tracking-tighter leading-none text-center">
                {settings?.name || "LIKE VISION OPTIQUE"}
              </h1>
              <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] text-[#D4AF37] whitespace-nowrap opacity-80 mt-2">
                GESTION OPTIQUE PROFESSIONNELLE
              </p>
            </div>
          )}
        </div>

        <Card className="border-none shadow-2xl shadow-black/40 bg-[#0D1B2A] rounded-[60px] overflow-hidden max-w-md mx-auto w-full relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#D4AF37]" />
          <CardHeader className="space-y-2 pt-12 text-center border-b border-white/5 pb-8">
            <CardTitle className="text-2xl font-black text-[#D4AF37] uppercase tracking-widest">Connexion</CardTitle>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-8 pt-12 px-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-[#D4AF37] ml-2 tracking-[0.2em]">Identifiant</Label>
                <div className="relative">
                  <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0D1B2A] z-10" />
                  <Input 
                    placeholder="ex: ZAKARIAE" 
                    className="pl-16 h-16 text-base font-bold rounded-[24px] border-none bg-[#D4AF37] text-[#0D1B2A] placeholder:text-[#0D1B2A]/40 focus:ring-2 focus:ring-white/20 transition-all shadow-inner uppercase" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-[#D4AF37] ml-2 tracking-[0.2em]">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0D1B2A] z-10" />
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    className="pl-16 h-16 text-base font-bold rounded-[24px] border-none bg-[#D4AF37] text-[#0D1B2A] placeholder:text-[#0D1B2A]/40 focus:ring-2 focus:ring-white/20 transition-all shadow-inner" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-16 pt-8 px-10">
              <Button className="w-full h-16 text-base font-black shadow-xl rounded-full bg-white text-[#0D1B2A] hover:bg-[#D4AF37] hover:text-[#0D1B2A] transition-all transform active:scale-95 uppercase tracking-widest" disabled={loading}>
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "ACCÉDER AU SYSTÈME"}
              </Button>
              
              <Button 
                type="button" 
                variant="ghost" 
                onClick={handleResetStorage}
                className="text-[9px] font-black text-[#D4AF37]/40 hover:text-[#D4AF37] uppercase tracking-widest"
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Synchronisation forcée (Vider cache)
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <div className="flex flex-col items-center gap-1 opacity-20">
          <p className="text-[8px] font-bold text-white uppercase tracking-widest">
            BASE DE DONNÉES : {db.app.options.projectId}
          </p>
          {mounted && (
            <p className="text-[7px] font-bold text-white uppercase tracking-widest">
              {hostname}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
