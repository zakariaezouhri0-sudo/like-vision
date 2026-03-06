"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, Upload, Info, Loader2, Image as ImageIcon, Trash2, AlertTriangle, RefreshCcw, Database, Eraser, Users, Zap, Wrench, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc, writeBatch, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { DEFAULT_SHOP_SETTINGS, MUTUELLES } from "@/lib/constants";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { roundAmount } from "@/lib/utils";

export default function SettingsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);
  const [role, setRole] = useState<string>("OPTICIENNE");

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    setRole(savedRole);
    setLoadingRole(false);
  }, [router]);
  
  const isPrepaMode = role === 'PREPA';

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

  const handleRecalculateBCPrices = async () => {
    setIsMigrating(true);
    try {
      const salesQuery = query(collection(db, "sales"), where("isDraft", "==", isPrepaMode));
      const salesSnap = await getDocs(salesQuery);
      
      const resetBatch = writeBatch(db);
      salesSnap.docs.forEach(d => {
        resetBatch.update(d.ref, { purchasePriceFrame: 0, purchasePriceLenses: 0 });
      });
      await resetBatch.commit();

      const transQuery = query(collection(db, "transactions"), where("isDraft", "==", isPrepaMode));
      const transSnap = await getDocs(transQuery);
      
      let updateCount = 0;
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
              updateCount++;
            }
          }
        }
      });

      for (const [saleId, costs] of Object.entries(pendingUpdates)) {
        await updateDoc(doc(db, "sales", saleId), {
          purchasePriceFrame: costs.frame,
          purchasePriceLenses: costs.lenses,
          updatedAt: serverTimestamp()
        });
      }

      toast({ variant: "success", title: "Recalcul Terminé", description: `${updateCount} opérations réaffectées.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur de recalcul" });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleHarmonizeData = async () => {
    setIsMigrating(true);
    try {
      const collections = ["sales", "transactions", "cash_sessions"];
      let count = 0;

      for (const collName of collections) {
        const q = query(collection(db, collName));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        let batchCount = 0;

        snap.docs.forEach(d => {
          const data = d.data();
          let needsUpdate = false;
          const updates: any = {};

          const fieldsToClean = ["openedBy", "closedBy", "userName", "createdBy"];
          fieldsToClean.forEach(f => {
            if (data[f] === "Préparation Historique" || data[f] === "PRÉPARATION HISTORIQUE") {
              updates[f] = "ZAKARIAE";
              needsUpdate = true;
            }
          });

          if (collName === "sales" && data.payments && data.payments.length > 0) {
            const firstPayment = data.payments[0];
            if (firstPayment.date) {
              const pDate = new Date(firstPayment.date);
              const curDate = data.createdAt?.toDate ? data.createdAt.toDate() : null;
              if (curDate && pDate < curDate) {
                updates.updatedAt = serverTimestamp();
                needsUpdate = true;
              }
            }
          }

          if (collName === "sales") {
            if (data.clientPhone === undefined || data.clientPhone === null) { updates.clientPhone = ""; needsUpdate = true; }
            if (data.mutuelle === undefined || data.mutuelle === null) { updates.mutuelle = "Aucun"; needsUpdate = true; }
          }

          if (needsUpdate) {
            batch.update(d.ref, updates);
            batchCount++;
            count++;
          }
        });

        if (batchCount > 0) await batch.commit();
      }

      toast({ variant: "success", title: "Harmonisation réussie", description: `${count} documents mis à jour.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur de migration" });
    } finally {
      setIsMigrating(false);
    }
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
        const realId = data.date; 
        if (realId) {
          await setDoc(doc(db, "cash_sessions", realId), { ...data, isDraft: false });
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
      await setDoc(doc(db, "settings", "counters"), { fc: 0, rc: 0 });
      await setDoc(doc(db, "settings", "counters_draft"), { fc: 0, rc: 0 });
      toast({ variant: "success", title: "Réinitialisation réussie" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsResetting(false); }
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

            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-emerald-50 border-emerald-100">
              <CardHeader className="bg-emerald-100/50 border-b p-6">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-emerald-700 flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> Analyse des Coûts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Synchronisation Automatique BC</p>
                <p className="text-[8px] font-bold text-slate-500 leading-tight">Remet à zéro et réaffecte les coûts d'achat à partir de toutes vos opérations de caisse (Mode {isPrepaMode ? "BROUILLON" : "RÉEL"}).</p>
                <Button onClick={handleRecalculateBCPrices} disabled={isMigrating} variant="outline" className="w-full h-12 rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px] uppercase hover:bg-emerald-100">
                  {isMigrating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />} Recalculer les coûts BC
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-blue-50 border-blue-100">
              <CardHeader className="bg-blue-100/50 border-b p-6">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-blue-700 flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" /> Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-wider">Harmonisation & Dates</p>
                  <Button onClick={handleHarmonizeData} disabled={isMigrating} variant="outline" className="w-full h-12 rounded-xl border-blue-200 text-blue-700 font-black text-[10px] uppercase hover:bg-blue-100">
                    {isMigrating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wrench className="h-4 w-4 mr-2" />} Harmoniser les données
                  </Button>
                </div>
                <Separator className="bg-blue-100" />
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-wider">Publier vers le Réel</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isSyncing} className="w-full h-12 rounded-xl bg-blue-600 font-black text-[10px] uppercase shadow-lg shadow-blue-100">
                        {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />} Synchroniser
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[32px]">
                      <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">Confirmer la publication ?</AlertDialogTitle><AlertDialogDescription className="text-xs font-bold uppercase">Toutes les données du MODE PRÉPARATION vont être transférées définitivement vers le MODE RÉEL.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px]">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleSyncToReal} className="h-12 rounded-xl bg-blue-600 font-black uppercase text-[10px]">Confirmer</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-red-50 border-red-100">
              <CardHeader className="bg-red-100/50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase tracking-widest text-red-700 flex items-center gap-2"><Database className="h-4 w-4" /> Zone de Danger</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isResetting} className="w-full h-12 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-red-100">
                      {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />} Réinitialiser tout
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[32px]">
                    <AlertDialogHeader><AlertDialogTitle className="text-xl font-black uppercase text-primary">Action Irréversible</AlertDialogTitle><AlertDialogDescription className="text-xs font-bold uppercase">Cette opération va effacer TOUT l'historique des ventes, clients et caisses (Mode {isPrepaMode ? "Brouillon" : "Réel"}).</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="h-12 rounded-xl font-black uppercase text-[10px]">Annuler</AlertDialogCancel><AlertDialogAction onClick={handleResetAllData} className="h-12 rounded-xl bg-destructive font-black uppercase text-[10px]">Confirmer</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
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