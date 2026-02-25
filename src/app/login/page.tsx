"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Glasses, ThumbsUp, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { useFirestore, useAuth, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import { signInAnonymously, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings } = useDoc(settingsRef);

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
        toast({ 
          variant: "success",
          title: "Connexion réussie", 
          description: "Bienvenue (Mode Admin)." 
        });
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
          localStorage.setItem('user_role', (userData.role || 'OPTICIENNE').toUpperCase());
        }
        
        toast({
          variant: "success",
          title: "Bienvenue",
          description: `Ravi de vous revoir, ${userData.name}.`,
        });
        router.push("/dashboard");
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-10">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="h-32 w-32 bg-white rounded-[40px] flex items-center justify-center shadow-2xl border border-slate-100 overflow-hidden">
            {settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
            ) : (
              <div className="h-full w-full bg-primary flex items-center justify-center text-white">
                <div className="relative">
                  <Glasses className="h-16 w-16" />
                  <ThumbsUp className="h-8 w-8 absolute -top-3 -right-3 bg-primary p-1 rounded-full border-2 border-white" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-4xl font-black text-primary tracking-tighter uppercase">{settings?.name || APP_NAME}</h1>
            <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-60">Gestion Optique Professionnelle</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl bg-white rounded-[32px] overflow-hidden">
          <CardHeader className="space-y-1 pt-8 text-center border-b bg-slate-50/50 pb-6">
            <CardTitle className="text-2xl font-black text-primary uppercase tracking-tight">Connexion</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase opacity-60 tracking-widest">
              Saisissez vos identifiants
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-5 pt-8">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Identifiant</Label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-3.5 h-4 w-4 text-primary/40" />
                  <Input 
                    placeholder="ex: admin" 
                    className="pl-12 h-12 font-bold rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 tracking-widest">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 h-4 w-4 text-primary/40" />
                  <Input 
                    type="password" 
                    placeholder="••••••••"
                    className="pl-12 h-12 font-bold rounded-xl border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-primary/10 transition-all" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-10 pt-4">
              <Button className="w-full h-14 text-sm font-black shadow-xl rounded-2xl bg-primary hover:scale-[1.02] transition-transform" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "ACCÉDER AU SYSTÈME"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
