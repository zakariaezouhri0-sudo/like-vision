
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, Upload, Info, Loader2, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc, setDoc } from "firebase/firestore";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function SettingsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [loading, setLoading] = useState(false);
  
  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: fetchLoading } = useDoc(settingsRef);

  const [settings, setSettings] = useState(DEFAULT_SHOP_SETTINGS);
  const [showLogoInput, setShowLogoInput] = useState(false);

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
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Configuration du Magasin</h1>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Gérez l'identité visuelle et les coordonnées.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg">
              <CardHeader className="bg-slate-50/50 border-b p-6">
                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Logo du Magasin</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 p-8">
                <div className="relative h-48 w-48 border-2 border-dashed border-primary/10 rounded-[32px] overflow-hidden bg-slate-50 flex items-center justify-center shadow-inner">
                  {settings.logoUrl ? (
                    <Image 
                      src={settings.logoUrl} 
                      alt="Shop Logo" 
                      fill 
                      className="object-contain p-4"
                      data-ai-hint="optical logo"
                    />
                  ) : (
                    <Building2 className="h-12 w-12 text-primary/10" />
                  )}
                </div>
                
                <div className="w-full space-y-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-11 rounded-xl font-black text-[10px] uppercase border-primary/20"
                    onClick={() => setShowLogoInput(!showLogoInput)}
                  >
                    <LinkIcon className="mr-2 h-4 w-4" />
                    {showLogoInput ? "MASQUER L'URL" : "CHANGER L'URL DU LOGO"}
                  </Button>

                  {showLogoInput && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Lien direct de l'image</Label>
                      <Input 
                        placeholder="https://exemple.com/logo.png"
                        value={settings.logoUrl}
                        onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                        className="h-10 text-xs font-bold rounded-xl"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <div className="bg-primary/5 p-6 rounded-[24px] flex gap-4 text-xs text-primary border border-primary/10">
              <Info className="h-6 w-6 shrink-0" />
              <p className="font-bold leading-relaxed">Ces informations apparaîtront automatiquement sur l'en-tête de vos factures et rapports officiels.</p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-[32px] overflow-hidden border-none shadow-lg">
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
          </div>
        </div>
      </div>
    </AppShell>
  );
}
