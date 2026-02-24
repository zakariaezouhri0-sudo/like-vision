
"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, Upload, Info, Loader2, Image as ImageIcon, Trash2, AlertTriangle, RefreshCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc, collection, getDocs, deleteDoc, writeBatch } from "firebase/firestore";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function SettingsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [isReseting, setIsReseting] = useState(false);
  
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Fichier trop volumineux",
          description: "Veuillez choisir une image de moins de 1 Mo.",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setSettings(prev => ({ ...prev, logoUrl: "" }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await setDoc(settingsRef, settings, { merge: true });
      toast({
        variant: "success",
        title: "Paramètres Enregistrés",
        description: "Les informations du magasin ont été mises à jour.",
      });
    } catch (e: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: "settings/shop-info",
        operation: 'write',
        requestResourceData: settings,
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    setIsReseting(true);
    try {
      const collections = ["sales", "clients", "transactions"];
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      toast({
        variant: "success",
        title: "Base de données nettoyée",
        description: "Toutes les données de test ont été supprimées.",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur lors du nettoyage",
        description: "Impossible de supprimer toutes les données.",
      });
    } finally {
      setIsReseting(false);
    }
  };

  if (fetchLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Chargement des paramètres...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Configuration du Magasin</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Gérez l'identité visuelle et les coordonnées.</p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-destructive text-destructive hover:bg-destructive/5">
                <RefreshCcw className="mr-2 h-4 w-4" /> RÉINITIALISER LES DONNÉES
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-3xl max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-black uppercase text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-6 w-6" /> Attention Risque !
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-600 font-bold">
                  Cette action va supprimer **définitivement** toutes les factures, tous les clients et toutes les opérations de caisse. Voulez-vous vraiment vider la base de données de test ?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <AlertDialogCancel className="rounded-xl font-bold">ANNULER</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetData} className="rounded-xl font-black bg-destructive hover:bg-destructive/90">
                  OUI, TOUT SUPPRIMER
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-white">
              <CardHeader className="bg-slate-50/50 border-b p-6">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Logo du Magasin</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 p-8">
                <div className="relative h-48 w-48 border-2 border-dashed border-primary/10 rounded-[32px] overflow-hidden bg-slate-50 flex items-center justify-center shadow-inner group">
                  {settings.logoUrl ? (
                    <>
                      <Image 
                        src={settings.logoUrl} 
                        alt="Shop Logo" 
                        fill 
                        className="object-contain p-4"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button variant="destructive" size="icon" onClick={removeLogo} className="rounded-full">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <ImageIcon className="h-12 w-12 text-primary/10" />
                  )}
                </div>
                
                <div className="w-full">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileChange} 
                  />
                  <Button 
                    variant="outline" 
                    className="w-full h-12 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white hover:bg-slate-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    IMPORTER DEPUIS MON PC
                  </Button>
                  <p className="text-[9px] text-center mt-2 font-bold text-muted-foreground uppercase opacity-60 italic">Format conseillé: Carré, max 1Mo</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg bg-white">
              <CardHeader className="bg-slate-50/50 border-b p-8">
                <CardTitle className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-primary/60">
                  <Building2 className="h-5 w-5 text-accent" />
                  Informations Générales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8 p-8">
                <div className="space-y-2">
                  <Label htmlFor="shopName" className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nom Commercial</Label>
                  <Input 
                    id="shopName" 
                    className="h-14 rounded-2xl font-black text-slate-900 border-none bg-slate-50 shadow-inner px-6"
                    value={settings.name} 
                    onChange={(e) => setSettings({...settings, name: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shopAddress" className="text-[10px] font-black uppercase text-muted-foreground ml-1">Adresse complète</Label>
                  <Input 
                    id="shopAddress" 
                    className="h-14 rounded-2xl font-black text-slate-900 border-none bg-slate-50 shadow-inner px-6"
                    value={settings.address} 
                    onChange={(e) => setSettings({...settings, address: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="shopPhone" className="text-[10px] font-black uppercase text-muted-foreground ml-1">Téléphone Contact</Label>
                    <Input 
                      id="shopPhone" 
                      className="h-14 rounded-2xl font-black text-slate-900 border-none bg-slate-50 shadow-inner px-6"
                      value={settings.phone} 
                      onChange={(e) => setSettings({...settings, phone: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icePatent" className="text-[10px] font-black uppercase text-muted-foreground ml-1">ICE / Patent / RC</Label>
                    <Input 
                      id="icePatent" 
                      className="h-14 rounded-2xl font-black text-slate-900 border-none bg-slate-50 shadow-inner px-6"
                      value={settings.icePatent} 
                      onChange={(e) => setSettings({...settings, icePatent: e.target.value})} 
                    />
                  </div>
                </div>

                <Separator className="opacity-50" />
                
                <div className="flex justify-end pt-4">
                  <Button 
                    onClick={handleSave} 
                    disabled={loading}
                    className="bg-primary hover:bg-primary/90 h-14 px-10 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all active:scale-95"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-5 w-5" />
                    )}
                    ENREGISTRER LES MODIFICATIONS
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] overflow-hidden border-none bg-white shadow-lg border-l-[12px] border-l-destructive">
               <CardHeader className="p-8">
                 <CardTitle className="text-xs font-black uppercase text-destructive tracking-widest flex items-center gap-3">
                   <AlertTriangle className="h-5 w-5" /> Maintenance & Risques
                 </CardTitle>
               </CardHeader>
               <CardContent className="px-8 pb-8 space-y-4">
                 <p className="text-xs font-bold text-slate-600 leading-relaxed">
                   Si vous avez terminé vos tests et que vous souhaitez lancer l'application en production, vous pouvez vider toutes les données d'essai ici. 
                   <br/><br/>
                   <span className="text-destructive font-black underline">Cette opération est irréversible.</span>
                 </p>
               </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
