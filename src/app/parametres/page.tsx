"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Save, Upload, Info, Loader2, Image as ImageIcon, Trash2,
  Database, Zap, Calculator, MessageSquare, Smartphone, Palette, CheckCircle2, Monitor, Settings
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc, writeBatch, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { roundAmount, cn } from "@/lib/utils";
import { useTheme } from "next-themes";

const THEMES_CONFIG = [
  {
    id: "light",
    name: "Standard Pro",
    description: "Le design équilibré et sobre.",
    colors: ["bg-[#1e3a5f]", "bg-[#f4f7fa]", "bg-[#0ea5e9]"]
  },
  {
    id: "luxury-gold",
    name: "Luxury Navy & Gold",
    description: "Identité prestige, arrondis Pill et dorures.",
    colors: ["bg-[#0D1B2A]", "bg-[#F8F9FA]", "bg-[#D4AF37]"]
  },
  {
    id: "elegance",
    name: "Elegance Green",
    description: "Une ambiance naturelle et apaisante.",
    colors: ["bg-[#6a8036]", "bg-[#f4f7ed]", "bg-[#89a644]"]
  },
  {
    id: "olive-pro",
    name: "Olive Pro",
    description: "Palette premium, moderne et contrastée.",
    colors: ["bg-[#A7AF47]", "bg-[#F7F8F2]", "bg-[#2E3A1F]"]
  }
];

export default function SettingsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    setRole(savedRole);
    setLoadingRole(false);
  }, []);

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: fetchLoading } = useDoc(settingsRef);

  const [settings, setSettings] = useState(DEFAULT_SHOP_SETTINGS);

  useEffect(() => {
    if (remoteSettings) {
      setSettings({
        name: remoteSettings.name || DEFAULT_SHOP_SETTINGS.name,
        address: remoteSettings.address || DEFAULT_SHOP_SETTINGS.address,
        phone: remoteSettings.phone || DEFAULT_SHOP_SETTINGS.phone,
        icePatent: remoteSettings.icePatent || DEFAULT_SHOP_SETTINGS.icePatent,
        logoUrl: remoteSettings.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
        theme: remoteSettings.theme || DEFAULT_SHOP_SETTINGS.theme,
        whatsappDarija: remoteSettings.whatsappDarija || DEFAULT_SHOP_SETTINGS.whatsappDarija,
        whatsappFrench: remoteSettings.whatsappFrench || DEFAULT_SHOP_SETTINGS.whatsappFrench,
      });
      setPreviewTheme(remoteSettings.theme || "light");
    }
  }, [remoteSettings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(settingsRef, settings, { merge: true });
      toast({ variant: "success", title: "Paramètres Enregistrés", description: "Mise à jour effectuée pour tout le magasin." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyTheme = async (themeId: string) => {
    setLoading(true);
    try {
      const updatedSettings = { ...settings, theme: themeId };
      setSettings(updatedSettings);
      await setDoc(settingsRef, { theme: themeId }, { merge: true });
      setTheme(themeId);
      setPreviewTheme(themeId);
      toast({ variant: "success", title: "Thème Appliqué", description: `Le style "${themeId}" est maintenant actif pour tous.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de l'application" });
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewTheme = (themeId: string) => {
    setTheme(themeId);
    setPreviewTheme(themeId);
    toast({ title: "Mode Aperçu", description: "Cliquez sur 'Appliquer' pour rendre ce choix permanent." });
  };

  const handleResetToCurrent = () => {
    if (settings.theme) {
      setTheme(settings.theme);
      setPreviewTheme(settings.theme);
    }
  };

  const handleRecalculateBCPrices = async () => {
    setIsMigrating(true);
    try {
      const isDraft = role === 'PREPA';
      const salesQuery = query(collection(db, "sales"), where("isDraft", "==", isDraft));
      const salesSnap = await getDocs(salesQuery);
      const resetBatch = writeBatch(db);
      salesSnap.docs.forEach(d => resetBatch.update(d.ref, { purchasePriceFrame: 0, purchasePriceLenses: 0 }));
      await resetBatch.commit();
      const transQuery = query(collection(db, "transactions"), where("isDraft", "==", isDraft));
      const transSnap = await getDocs(transQuery);
      const pendingUpdates: Record<string, { frame: number, lenses: number }> = {};
      transSnap.docs.forEach(tDoc => {
        const t = tDoc.data();
        if (t.type === "ACHAT VERRES" || t.type === "ACHAT MONTURE") {
          const bcMatch = (t.clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
          if (bcMatch) {
            const bcId = bcMatch[1].padStart(4, '0');
            const targetIds = [`FC-2026-${bcId}`, `RC-2026-${bcId}`];
            const saleDoc = salesSnap.docs.find(sd => targetIds.includes(sd.data().invoiceId));
            if (saleDoc) {
              const saleId = saleDoc.id;
              if (!pendingUpdates[saleId]) pendingUpdates[saleId] = { frame: 0, lenses: 0 };
              const amount = Math.abs(Number(t.montant) || 0);
              if (t.type === "ACHAT MONTURE") pendingUpdates[saleId].frame = roundAmount(pendingUpdates[saleId].frame + amount);
              else pendingUpdates[saleId].lenses = roundAmount(pendingUpdates[saleId].lenses + amount);
            }
          }
        }
      });
      for (const [saleId, costs] of Object.entries(pendingUpdates)) {
        await updateDoc(doc(db, "sales", saleId), { purchasePriceFrame: costs.frame, purchasePriceLenses: costs.lenses, updatedAt: serverTimestamp() });
      }
      toast({ variant: "success", title: "Recalcul Terminé" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsMigrating(false); }
  };

  const handleSyncToReal = async () => {
    setIsSyncing(true);
    try {
      const collectionsToSync = ["sales", "transactions", "clients"];
      for (const collName of collectionsToSync) {
        const q = query(collection(db, collName), where("isDraft", "==", true));
        const snap = await getDocs(q);
        if (snap.empty) continue;
        const chunks = [];
        for (let i = 0; i < snap.docs.length; i += 500) chunks.push(snap.docs.slice(i, i + 500));
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(d => batch.update(d.ref, { isDraft: false }));
          await batch.commit();
        }
      }
      const qSessions = query(collection(db, "cash_sessions"), where("isDraft", "==", true));
      const snapSessions = await getDocs(qSessions);
      for (const d of snapSessions.docs) {
        const data = d.data();
        if (data.date) {
          await setDoc(doc(db, "cash_sessions", data.date), { ...data, isDraft: false });
          await deleteDoc(d.ref);
        }
      }
      toast({ variant: "success", title: "Synchronisation terminée" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsSyncing(false); }
  };

  const handleResetAllData = async () => {
    setIsResetting(true);
    try {
      const collections = ["sales", "transactions", "clients", "cash_sessions"];
      for (const collName of collections) {
        const q = query(collection(db, collName));
        const snap = await getDocs(q);
        if (snap.empty) continue;
        const chunks = [];
        for (let i = 0; i < snap.docs.length; i += 500) chunks.push(snap.docs.slice(i, i + 500));
        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      toast({ variant: "success", title: "Réinitialisation réussie" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsResetting(false); }
  };

  if (loadingRole || fetchLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <AppShell>
      <div className="space-y-8 max-w-5xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter flex items-center gap-4">
              <Settings className="h-8 w-8 text-[#D4AF37]/40" />
              Configuration
            </h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Gérez votre identité et l'apparence du système.</p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={loading} 
            className="h-12 px-10 font-black rounded-full shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all uppercase tracking-widest text-xs"
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "ENREGISTRER TOUT"}
          </Button>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border h-14 w-full md:w-auto flex overflow-x-auto">
            <TabsTrigger value="general" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8">Général</TabsTrigger>
            <TabsTrigger value="themes" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8">Thèmes</TabsTrigger>
            <TabsTrigger value="whatsapp" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8">WhatsApp</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1 space-y-6">
                <Card className="rounded-[60px] overflow-hidden border-none shadow-lg bg-white">
                  <CardHeader className="bg-slate-50/50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Logo</CardTitle></CardHeader>
                  <CardContent className="flex flex-col items-center gap-6 p-8">
                    <div className="relative h-48 w-48 border-2 border-dashed border-primary/10 rounded-[32px] overflow-hidden bg-slate-50 flex items-center justify-center">
                      {settings.logoUrl ? <Image src={settings.logoUrl} alt="Logo" width={192} height={192} className="object-contain p-4" /> : <ImageIcon className="h-12 w-12 text-primary/10" />}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
                        reader.readAsDataURL(file);
                      }
                    }} />
                    <Button variant="outline" className="w-full h-12 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white" onClick={() => fileInputRef.current?.click()}>IMPORTER</Button>
                  </CardContent>
                </Card>

                <Card className="rounded-[60px] overflow-hidden border-none shadow-lg bg-emerald-50 border-emerald-100">
                  <CardHeader className="bg-emerald-100/50 border-b p-6">
                    <CardTitle className="text-[11px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                      <Calculator className="h-4 w-4" /> Analyse des Coûts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Synchronisation Automatique BC</p>
                    <p className="text-[8px] font-bold text-slate-500 leading-tight">Remet à zéro et réaffecte les coûts d'achat à partir de toutes vos opérations de caisse.</p>
                    <Button onClick={handleRecalculateBCPrices} disabled={isMigrating} variant="outline" className="w-full h-12 rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px] uppercase hover:bg-emerald-100">
                      {isMigrating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Recalculer les coûts BC"}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              <div className="md:col-span-2 space-y-6">
                <Card className="rounded-[60px] overflow-hidden border-none shadow-lg bg-white">
                  <CardHeader className="bg-slate-50/50 border-b p-8"><CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Informations Générales</CardTitle></CardHeader>
                  <CardContent className="space-y-8 p-8">
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nom Commercial</Label><Input className="h-14 rounded-2xl font-black bg-slate-50 border-none" value={settings.name} onChange={(e) => setSettings({...settings, name: e.target.value})} /></div>
                    <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Adresse</Label><Input className="h-14 rounded-2xl font-black bg-slate-50 border-none" value={settings.address} onChange={(e) => setSettings({...settings, address: e.target.value})} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Téléphone</Label><Input className="h-14 rounded-2xl font-black bg-slate-50 border-none" value={settings.phone} onChange={(e) => setSettings({...settings, phone: e.target.value})} /></div>
                      <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">ICE</Label><Input className="h-14 rounded-2xl font-black bg-slate-50 border-none" value={settings.icePatent} onChange={(e) => setSettings({...settings, icePatent: e.target.value})} /></div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[60px] overflow-hidden border-none shadow-lg bg-red-50 border-red-100">
                  <CardHeader className="bg-red-100/50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase tracking-widest text-red-700 flex items-center gap-2"><Database className="h-4 w-4" /> Zone de Danger</CardTitle></CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button disabled={isSyncing} className="h-12 rounded-xl bg-blue-600 font-black text-[10px] uppercase shadow-lg">
                            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />} Publier vers le Réel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[32px]">
                          <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">Confirmer la publication ?</AlertDialogTitle><AlertDialogDescription className="text-xs font-bold uppercase">Les données BROUILLON vont écraser le RÉEL.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px]">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleSyncToReal} className="h-12 rounded-xl bg-blue-600 font-black uppercase text-[10px]">Confirmer</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" disabled={isResetting} className="h-12 rounded-xl font-black text-[10px] uppercase shadow-lg">
                            {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Réinitialiser tout
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[32px]">
                          <AlertDialogHeader><AlertDialogTitle className="text-xl font-black uppercase text-primary">Action Irréversible</AlertDialogTitle><AlertDialogDescription className="text-xs font-bold uppercase">Cette opération va tout effacer.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px]">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleResetAllData} className="h-12 rounded-xl bg-destructive font-black uppercase text-[10px]">Confirmer</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="themes" className="mt-6 space-y-6">
            <div className="bg-blue-50 border border-blue-100 p-6 rounded-[32px] flex items-center gap-4">
              <Monitor className="h-8 w-8 text-blue-600 shrink-0" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-900">Personnalisation Visuelle</h3>
                <p className="text-xs font-medium text-blue-700">Choisissez une ambiance pour votre boutique. L'aperçu est instantané, l'application est globale.</p>
              </div>
              {previewTheme !== settings.theme && (
                <Button variant="outline" size="sm" onClick={handleResetToCurrent} className="ml-auto bg-white text-blue-600 border-blue-200 font-black text-[10px] uppercase">Rétablir</Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {THEMES_CONFIG.map((t) => (
                <Card
                  key={t.id}
                  className={cn(
                    "rounded-[40px] border-2 transition-all cursor-pointer group overflow-hidden",
                    previewTheme === t.id ? "border-primary ring-4 ring-primary/10 scale-[1.02]" : "border-transparent hover:border-slate-200"
                  )}
                  onClick={() => handlePreviewTheme(t.id)}
                >
                  <CardContent className="p-0">
                    <div className="h-24 flex items-center justify-center gap-2 p-4 bg-slate-50 border-b group-hover:bg-slate-100 transition-colors">
                      {t.colors.map((c, i) => (
                        <div key={i} className={cn("h-8 w-8 rounded-full shadow-lg border-2 border-white", c)} />
                      ))}
                    </div>
                    <div className="p-6 space-y-2">
                      <div className="flex justify-between items-center">
                        <h4 className="font-black text-xs uppercase tracking-widest">{t.name}</h4>
                        {settings.theme === t.id && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">{t.description}</p>

                      <div className="pt-4 flex gap-2">
                        <Button
                          onClick={(e) => { e.stopPropagation(); handlePreviewTheme(t.id); }}
                          variant="ghost"
                          className="flex-1 h-9 rounded-xl font-black text-[9px] uppercase hover:bg-slate-100"
                        >
                          Aperçu
                        </Button>
                        <Button
                          onClick={(e) => { e.stopPropagation(); handleApplyTheme(t.id); }}
                          disabled={settings.theme === t.id || loading}
                          className={cn(
                            "flex-1 h-9 rounded-xl font-black text-[9px] uppercase shadow-lg",
                            settings.theme === t.id ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-primary text-white"
                          )}
                        >
                          Appliquer
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-6">
            <Card className="rounded-[60px] overflow-hidden border-none shadow-lg bg-white max-w-2xl mx-auto">
              <CardHeader className="bg-slate-50/50 border-b p-8 flex flex-row items-center gap-3">
                <MessageSquare className="h-5 w-5 text-primary/40" />
                <div>
                  <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Message Automatique (Bilingue)</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-8 space-y-4">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Template de Bienvenue</Label>
                <Textarea className="min-h-[300px] rounded-2xl bg-slate-50 border-none font-bold text-sm" value={settings.whatsappDarija} onChange={(e) => setSettings({...settings, whatsappDarija: e.target.value})} />
                <p className="text-[9px] font-bold text-slate-400 italic">Note : Utilisez [Nom] pour insérer automatiquement le nom du client.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}