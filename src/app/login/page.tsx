"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User as UserIcon, Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { useFirestore, useAuth, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import { signInAnonymously, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/ui/logo";

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
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7ed] px-4">
      <div className="w-full max-w-lg space-y-12">
        <div className="flex flex-col items-center text-center space-y-8">
          <div className="h-72 w-72 md:h-80 md:w-80 bg-transparent flex items-center justify-center overflow-hidden">
            {settingsLoading ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary/20" />
            ) : settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <Logo className="w-full h-full" variant="full" color="#6a8036" />
            )}
          </div>

          <div className="space-y-2">
            <p className="text-primary/40 font-black uppercase text-[10px] tracking-[0.4em] opacity-60">Gestion Optique Professionnelle</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl bg-white rounded-[40px] overflow-hidden">
          <CardHeader className="space-y-1 pt-10 text-center border-b bg-slate-50/50 pb-8">
            <CardTitle className="text-3xl font-black text-primary uppercase tracking-tight">Connexion</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase opacity-60 tracking-[0.2em]">
              Saisissez vos identifiants
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6 pt-10">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Identifiant</Label>
                <div className="relative">
                  <UserIcon className="absolute left-5 top-4 h-5 w-5 text-primary/40" />
                  <Input 
                    placeholder="ex: admin" 
                    className="pl-14 h-14 text-base font-bold rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-5 top-4 h-5 w-5 text-primary/40" />
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    className="pl-14 h-14 text-base font-bold rounded-2xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-12 pt-6">
              <Button className="w-full h-16 text-base font-black shadow-xl rounded-2xl bg-primary hover:scale-[1.02] active:scale-95 transition-all" disabled={loading}>
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "ACCÉDER AU SYSTÈME"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
