"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User as UserIcon, Loader2, Glasses, ThumbsUp } from "lucide-react";
import { useFirestore, useAuth, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import { signInAnonymously, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsRef);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (username.toLowerCase() === "admin" && password === "admin123") {
      try {
        const userCredential = await signInAnonymously(auth);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: "Administrateur" });
          localStorage.setItem('user_role', 'ADMIN');
        }
        toast({ variant: "success", title: "Connexion réussie", description: "Bienvenue (Mode Admin)." });
        router.push("/dashboard");
      } catch (err) {
        toast({ variant: "destructive", title: "Erreur Auth" });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (username.toLowerCase() === "prepa" && password === "prepa123") {
      try {
        const userCredential = await signInAnonymously(auth);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: "ZAKARIAE" });
          localStorage.setItem('user_role', 'PREPA');
        }
        toast({ variant: "success", title: "Mode Préparation Actif", description: "Vous travaillez sur un espace brouillon isolé." });
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
      const q = query(usersRef, where("username", "==", username.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Utilisateur non trouvé.");
      }

      const userData = querySnapshot.docs[0].data();

      if (userData.password === password) {
        if (userData.status === "Suspendu") {
          throw new Error("Compte suspendu.");
        }
        
        const userCredential = await signInAnonymously(auth);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: userData.name });
          const role = (userData.role || 'OPTICIENNE').toUpperCase();
          localStorage.setItem('user_role', role);
          
          toast({
            variant: "success",
            title: "Bienvenue",
            description: `Ravi de vous revoir, ${userData.name}.`,
          });

          if (role === "OPTICIENNE") {
            router.push("/caisse");
          } else {
            router.push("/dashboard");
          }
        }
      } else {
        throw new Error("Mot de passe incorrect.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: error.message || "Identifiants incorrects.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] px-4 py-8">
      <div className="w-full max-w-xl space-y-8 flex flex-col items-center">
        {/* Logo Section */}
        <div className="w-full flex flex-col items-center text-center pb-2">
          {settingsLoading ? (
            <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
          ) : (
            <div className="flex flex-col items-center">
              {settings?.logoUrl ? (
                <div className="w-32 h-32 mb-6 p-2 rounded-3xl bg-white shadow-xl shadow-slate-200/50">
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="mb-4">
                  <div className="relative">
                    <Glasses className="h-20 w-20 text-[#0D1B2A]" />
                    <ThumbsUp className="h-8 w-8 absolute -top-2 -right-2 text-[#D4AF37] bg-white p-1 rounded-full shadow-lg" />
                  </div>
                </div>
              )}
              
              <div className="flex flex-col items-center space-y-2">
                <h1 className="text-3xl md:text-5xl font-black text-[#0D1B2A] uppercase tracking-tighter leading-none">
                  {settings?.name || "LIKE VISION OPTIQUE"}
                </h1>
                <p className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.4em] text-[#D4AF37] whitespace-nowrap opacity-80">
                  GESTION OPTIQUE PROFESSIONNELLE
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Login Card */}
        <Card className="border-none shadow-2xl shadow-slate-200/60 bg-[#0D1B2A] rounded-[60px] overflow-hidden max-w-md mx-auto w-full relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-[#D4AF37]" />
          <CardHeader className="space-y-2 pt-12 text-center border-b border-white/5 pb-8">
            <CardTitle className="text-2xl font-black text-[#D4AF37] uppercase tracking-widest">Connexion</CardTitle>
            <CardDescription className="text-[10px] font-black uppercase text-[#D4AF37]/60 tracking-[0.3em]">
              Registre de Prestige
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-8 pt-12 px-10">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-[#D4AF37] ml-2 tracking-[0.2em]">Identifiant</Label>
                <div className="relative">
                  <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0D1B2A] z-10" />
                  <Input 
                    placeholder="ex: admin" 
                    className="pl-16 h-16 text-base font-bold rounded-[24px] border-none bg-[#D4AF37] text-[#0D1B2A] placeholder:text-[#0D1B2A]/40 focus:ring-2 focus:ring-white/20 transition-all shadow-inner" 
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
            <CardFooter className="pb-16 pt-8 px-10">
              <Button className="w-full h-16 text-base font-black shadow-xl rounded-full bg-white text-[#0D1B2A] hover:bg-[#D4AF37] hover:text-[#0D1B2A] transition-all transform active:scale-95 uppercase tracking-widest" disabled={loading}>
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "ACCÉDER AU SYSTÈME"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.5em] mt-4">
          Powered by Like Vision System
        </p>
      </div>
    </div>
  );
}
