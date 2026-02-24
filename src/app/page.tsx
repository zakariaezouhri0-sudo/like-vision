
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Glasses, ThumbsUp, ShieldCheck, Zap, BarChart3, Users } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-sm">
              <div className="relative">
                <Glasses className="h-5 w-5" />
                <ThumbsUp className="h-2.5 w-2.5 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full" />
              </div>
            </div>
            <span className="font-headline font-bold text-xl tracking-tight text-primary">{APP_NAME}</span>
          </div>
          <Button asChild variant="default" size="sm" className="font-bold">
            <Link href="/login">Accès Professionnel</Link>
          </Button>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center space-y-8 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-widest animate-fade-in">
                <Zap className="h-3 w-3" />
                Solution Optique Intelligente
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                Gérez votre magasin d'optique avec <span className="text-primary">précision</span> et <span className="text-accent">élégance</span>.
              </h1>
              <p className="text-lg text-muted-foreground font-medium">
                La plateforme tout-en-un pour les opticiens modernes au Maroc. Facturation A5, suivi des ordonnances et gestion de caisse en temps réel.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-14 px-8 text-lg font-bold shadow-xl shadow-primary/20">
                  <Link href="/login">Démarrer maintenant</Link>
                </Button>
                <Button variant="outline" size="lg" className="h-14 px-8 text-lg font-bold">
                  En savoir plus
                </Button>
              </div>
            </div>
          </div>
          
          {/* Background Decorative Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 opacity-10">
            <div className="absolute top-20 left-10 w-64 h-64 bg-primary rounded-full blur-3xl" />
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent rounded-full blur-3xl" />
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Facturation Certifiée</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Générez des factures A5 paysage professionnelles en deux clics, prêtes pour les mutuelles (CNSS, CNOPS, etc.).
                </p>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Tableau de Bord</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Suivez votre chiffre d'affaire, vos marges et vos restes à recouvrir en temps réel avec des graphiques clairs.
                </p>
              </div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Dossiers Clients</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Historique complet des prescriptions OD/OG pour chaque client. Ne perdez plus jamais une ordonnance.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-10 border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            &copy; {new Date().getFullYear()} {APP_NAME} Optique Pro. Développé pour l'excellence optique.
          </p>
        </div>
      </footer>
    </div>
  );
}
