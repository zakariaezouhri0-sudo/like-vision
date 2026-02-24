
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Glasses, ThumbsUp, Lock, User as UserIcon } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { useAuth } from "@/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Bypass de sécurité pour le développement (admin / admin123)
    if (email === "admin" && password === "admin123") {
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur Like Vision (Mode Administrateur).",
      });
      router.push("/dashboard");
      setLoading(false);
      return;
    }

    try {
      // Tentative de connexion réelle via Firebase si l'identifiant est un email
      if (email.includes("@")) {
        await signInWithEmailAndPassword(auth, email, password);
        toast({
          title: "Connexion réussie",
          description: "Bienvenue sur Like Vision.",
        });
        router.push("/dashboard");
      } else {
        throw new Error("Identifiants incorrects.");
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Utilisateur ou mot de passe incorrect.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg transform rotate-3 mb-4">
            <div className="relative">
              <Glasses className="h-10 w-10" />
              <ThumbsUp className="h-5 w-5 absolute -top-2 -right-2 bg-primary p-0.5 rounded-full" />
            </div>
          </div>
          <h1 className="text-4xl font-headline font-bold text-primary tracking-tight">{APP_NAME}</h1>
          <p className="text-muted-foreground font-medium">Gestion Optique & Facturation</p>
        </div>

        <Card className="border-none shadow-xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 pt-8">
            <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
            <CardDescription>
              Utilisez <b>admin</b> et <b>admin123</b> pour tester le système.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Identifiant</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="text"
                    placeholder="admin" 
                    className="pl-10" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    placeholder="••••••••"
                    className="pl-10" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="pb-8">
              <Button className="w-full h-11 text-lg font-semibold" disabled={loading}>
                {loading ? "Vérification..." : "Se connecter"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
