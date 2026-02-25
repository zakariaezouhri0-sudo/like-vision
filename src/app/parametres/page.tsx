
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
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [isReseting, setIsReseting] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
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
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "settings/shop-info", operation: 'write', requestResourceData: settings }));
    } finally {
      setLoading(false);
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
          <div className="md:col-span-1">
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
