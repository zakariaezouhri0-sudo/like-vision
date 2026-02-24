
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
import Image from "next/image";

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
          await updateProfile(userCredential.user, { displayName: "Admin" });
        }
        toast({ 
          variant: "success",
          title: "Connexion réussie", 
          description: "Bienvenue sur Like Vision (Mode Admin)." 
        });
        router.push("/dashboard");
      } catch (err) {
        toast({ variant: "destructive", title: "Erreur Auth", description: "Impossible d'initialiser la session Firebase." });
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
          throw new Error("Votre compte est suspendu.");
        }
        
        const userCredential = await signInAnonymously(auth);
        if (userCredential.user) {
          await updateProfile(userCredential.user, { displayName: userData.name });
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-4">
          
          <div className="h-52 w-52 flex items-center justify-center relative">
            {settings?.logoUrl ? (
              <Image 
                src={settings.logoUrl} 
                alt="Logo" 
                fill 
                className="object-contain"
              />
            ) : (
              <div className="h-40 w-40 bg-primary rounded-[40px] flex items-center justify-center text-primary-foreground shadow-2xl transform rotate-3">
                <div className="relative">
                  <Glasses className="h-20 w-20" />
                  <ThumbsUp className="h-10 w-10 absolute -top-4 -right-4 bg-primary p-1 rounded-full border-2 border-white" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-4xl font-headline font-black text-primary tracking-tighter uppercase">{settings?.name || APP_NAME}</h1>
            <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-60">Gestion Optique Professionnelle</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl bg-card/80 backdrop-blur-sm rounded-3xl overflow-hidden">
          <CardHeader className="space-y-1 pt-8 text-center border-b bg-muted/10 pb-6">
            <CardTitle className="text-2xl font-black text-primary uppercase">Connexion</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase opacity-60">
              Saisissez vos identifiants magasin
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-5 pt-8">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[10px] font-black uppercase text-muted-foreground ml-1">Identifiant / Login</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-primary/40" />
                  <Input 
                    id="username" 
                    type="text"
                    placeholder="admin" 
                    className="pl-10 h-11 font-bold border-muted-foreground/20 focus:border-primary" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase text-muted-foreground ml-1">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-primary/40" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••"
                    className="pl-10 h-11 font-bold border-muted-foreground/20 focus:border-primary" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-8 pt-4">
              <Button className="w-full h-12 text-base font-black shadow-xl rounded-xl" disabled={loading}>
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "ACCÉDER AU SYSTÈME"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
