
"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, Upload, Info, Loader2, Image as ImageIcon, Trash2, AlertTriangle, RefreshCcw, Database, Eraser, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc, writeBatch, query, where, getDoc } from "firebase/firestore";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCleaningClients, setIsCleaningClients] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);
  const [role, setRole] = useState<string>("OPTICIENNE");

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (!savedRole || (savedRole !== 'ADMIN' && savedRole !== 'PREPA')) {
      router.push('/dashboard');
    } else {
      setRole(savedRole.toUpperCase());
      setLoadingRole(false);
    }
  }, [router]);
  
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
      });
    }
  }, [remoteSettings]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(settingsRef, settings, { merge: true });
      toast({ variant: "success", title: "Paramètres Enregistrés" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToReal = async () => {
    setIsSyncing(true);
    try {
      // 1. Synchronisation des documents simples
      const collectionsToSync = ["sales", "transactions", "clients"];
      for (const collName of collectionsToSync) {
        const q = query(collection(db, collName), where("isDraft", "==", true));
        const snap = await getDocs(q);
        if (snap.empty) continue;
        
        const chunks = [];
        for (let i = 0; i < snap.docs.length; i += 500) {
          chunks.push(snap.docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(d => batch.update(d.ref, { isDraft: false }));
          await batch.commit();
        }
      }

      // 2. Sessions de caisse (changement d'ID car le mode draft utilise un préfixe)
      const qSessions = query(collection(db, "cash_sessions"), where("isDraft", "==", true));
      const snapSessions = await getDocs(qSessions);
      for (const d of snapSessions.docs) {
        const data = d.data();
        const realId = data.date; 
        if (realId) {
          await setDoc(doc(db, "cash_sessions", realId), { ...data, isDraft: false });
          await deleteDoc(d.ref);
        }
      }

      // 3. Synchronisation des compteurs de facturation
      const draftCounterSnap = await getDoc(doc(db, "settings", "counters_draft"));
      if (draftCounterSnap.exists()) {
        await setDoc(doc(db, "settings", "counters"), draftCounterSnap.data(), { merge: true });
      }

      toast({ variant: "success", title: "Synchronisation terminée", description: "Les données sont maintenant en mode réel." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur de synchronisation" });
    } finally {
      setIsSyncing(false);
    }
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
        for (let i = 0; i < snap.docs.length; i += 500) {
          chunks.push(snap.docs.slice(i, i + 500));
        }

        for (const chunk of chunks) {
          const batch = writeBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      await setDoc(doc(db, "settings", "counters"), { fc: 0, rc: 0 });
      await setDoc(doc(db, "settings", "counters_draft"), { fc: 0, rc: 0 });

      toast({ variant: "success", title: "Réinitialisation réussie", description: "Toutes les données ont été supprimées." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de la suppression" });
    } finally {
      setIsResetting(false);
    }
  };

  const handleCleanRealClients = async () => {
    setIsCleaningClients(true);
    try {
      const q = query(collection(db, "clients"));
      const snap = await getDocs(q);
      const realClients = snap.docs.filter(d => d.data().isDraft !== true);

      if (realClients.length === 0) {
        toast({ title: "Info", description: "Aucun client réel trouvé à supprimer." });
        return;
      }

      const chunks = [];
      for (let i = 0; i < realClients.length; i += 500) {
        chunks.push(realClients.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      toast({ variant: "success", title: "Nettoyage réussi", description: `${realClients.length} clients supprimés du mode réel.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de supprimer les clients." });
    } finally {
      setIsCleaningClients(false);
    }
  };

  if (loadingRole || fetchLoading) return null;

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Configuration</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Identité visuelle et coordonnées.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-white">
              <CardHeader className="bg-slate-50/50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Logo</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center gap-6 p-8">
                <div className="relative h-48 w-48 border-2 border-dashed border-primary/10 rounded-[32px] overflow-hidden bg-slate-50 flex items-center justify-center">
                  {settings.logoUrl ? <Image src={settings.logoUrl} alt="Logo" fill className="object-contain p-4" /> : <ImageIcon className="h-12 w-12 text-primary/10" />}
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

            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-blue-50 border-blue-100">
              <CardHeader className="bg-blue-100/50 border-b p-6">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-blue-700 flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" /> Synchronisation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <p className="text-[9px] font-black text-blue-600 uppercase leading-relaxed tracking-wider">
                  Publier les données préparées
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      disabled={isSyncing}
                      className="w-full h-14 rounded-xl bg-blue-600 font-black text-[10px] uppercase shadow-lg shadow-blue-100"
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                      Synchroniser vers le Réel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[32px] p-8">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black text-primary uppercase">Confirmer la publication ?</AlertDialogTitle>
                      <AlertDialogDescription className="text-xs font-bold text-slate-500 uppercase leading-relaxed pt-2">
                        Toutes vos saisies effectuées en compte `prepa` vont être transférées définitivement dans le compte `réel`. Cette action est recommandée après avoir terminé l'importation de l'historique.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-6">
                      <AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px]">Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSyncToReal} className="h-12 rounded-xl bg-blue-600 font-black uppercase text-[10px]">Confirmer la synchro</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            {(role === 'ADMIN' || role === 'PREPA') && (
              <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-red-50 border-red-100">
                <CardHeader className="bg-red-100/50 border-b p-6">
                  <CardTitle className="text-[11px] font-black uppercase tracking-widest text-red-700 flex items-center gap-2">
                    <Database className="h-4 w-4" /> Zone de Danger
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-red-600 uppercase leading-relaxed tracking-wider">
                      Nettoyage du fichier Optique
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline"
                          disabled={isCleaningClients}
                          className="w-full h-12 rounded-xl font-black text-[10px] uppercase border-red-200 text-red-600 hover:bg-red-100"
                        >
                          {isCleaningClients ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
                          Supprimer Clients (Mode Réel)
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[32px] p-8">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-xl font-black text-primary uppercase">Supprimer les clients réels ?</AlertDialogTitle>
                          <AlertDialogDescription className="text-xs font-bold text-slate-500 uppercase leading-relaxed pt-2">
                            Cette action va effacer TOUS les clients qui ne sont pas marqués comme "Brouillon". Vos données importées dans le compte `prepa` resteront intactes.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="pt-6">
                          <AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px]">Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCleanRealClients} className="h-12 rounded-xl bg-destructive font-black uppercase text-[10px]">Confirmer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <Separator className="bg-red-100" />

                  <div className="space-y-3">
                    <p className="text-[9px] font-black text-red-600 uppercase leading-relaxed tracking-wider">
                      Nettoyage Complet
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="destructive"
                          disabled={isResetting}
                          className="w-full h-12 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-red-100"
                        >
                          {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                          Réinitialiser tout
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-[32px] p-8">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-2xl font-black text-primary uppercase tracking-tighter">Action Irréversible</AlertDialogTitle>
                          <AlertDialogDescription className="text-sm font-bold text-slate-500 uppercase leading-relaxed pt-2">
                            Attention ! Cette opération va effacer définitivement tout l'historique des ventes, les fiches clients et les rapports de caisse des deux comptes.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="pt-6">
                          <AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px]">Annuler</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleResetAllData}
                            className="h-12 rounded-xl bg-destructive font-black uppercase text-[10px]"
                          >
                            Confirmer la suppression
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-white">
              <CardHeader className="bg-slate-50/50 border-b p-8"><CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Informations Générales</CardTitle></CardHeader>
              <CardContent className="space-y-8 p-8">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nom Commercial</Label><Input className="h-14 rounded-2xl font-black bg-slate-50 border-none" value={settings.name} onChange={(e) => setSettings({...settings, name: e.target.value})} /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Adresse</Label><Input className="h-14 rounded-2xl font-black bg-slate-50 border-none" value={settings.address} onChange={(e) => setSettings({...settings, address: e.target.value})} /></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Téléphone</Label><Input className="h-14 rounded-2xl font-black bg-slate-50 border-none" value={settings.phone} onChange={(e) => setSettings({...settings, phone: e.target.value})} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">ICE</Label><Input className="h-14 rounded-2xl font-black bg-slate-50 border-none" value={settings.icePatent} onChange={(e) => setSettings({...settings, icePatent: e.target.value})} /></div>
                </div>
                <div className="flex justify-end pt-4"><Button onClick={handleSave} disabled={loading} className="bg-primary h-14 px-10 rounded-2xl font-black text-sm shadow-xl shadow-primary/20">{loading ? <Loader2 className="animate-spin" /> : "ENREGISTRER"}</Button></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
