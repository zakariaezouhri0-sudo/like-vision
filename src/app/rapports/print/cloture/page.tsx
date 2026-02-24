
"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, FileText, Calendar, User, Coins, Glasses, ThumbsUp, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency } from "@/lib/utils";
import { Suspense } from "react";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

function CashClosurePrintContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

  const shop = {
    name: remoteSettings?.name || DEFAULT_SHOP_SETTINGS.name,
    address: remoteSettings?.address || DEFAULT_SHOP_SETTINGS.address,
    phone: remoteSettings?.phone || DEFAULT_SHOP_SETTINGS.phone,
    icePatent: remoteSettings?.icePatent || DEFAULT_SHOP_SETTINGS.icePatent,
    logoUrl: remoteSettings?.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
  };

  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const initial = Number(searchParams.get("initial")) || 0;
  const ventes = Number(searchParams.get("ventes")) || 0;
  const depenses = Number(searchParams.get("depenses")) || 0;
  const versements = Number(searchParams.get("versements")) || 0;
  const apports = Number(searchParams.get("apports")) || 0;
  const reel = Number(searchParams.get("reel")) || 0;
  
  const theorique = initial + ventes + apports - depenses - versements;
  const ecart = reel - theorique;

  const cashDetail = DENOMINATIONS.map(val => ({
    val,
    qty: Number(searchParams.get(`d${val}`)) || 0
  })).filter(item => item.qty >= 0);

  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12">
      {/* Controls Overlay */}
      <div className="no-print w-[210mm] flex justify-between mb-8 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 h-12 px-6 rounded-2xl shadow-sm font-black">
          <Link href="/caisse">
            <ArrowLeft className="mr-3 h-5 w-5" />
            RETOUR
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black uppercase text-slate-400 bg-white px-5 py-3 rounded-full border shadow-sm tracking-widest">
            A4 Portrait • Rapport Officiel
          </span>
          <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 h-12 px-10 rounded-2xl font-black text-base">
            <Printer className="mr-3 h-5 w-5" />
            IMPRIMER LE RAPPORT
          </Button>
        </div>
      </div>

      {/* Actual A4 Page */}
      <div className="pdf-a4-portrait shadow-2xl bg-white print:shadow-none print:m-0 border border-slate-100 rounded-sm p-[15mm]">
        {/* Header with Logo Clean */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-10">
          <div className="flex gap-6">
            <div className="h-20 w-20 flex items-center justify-center shrink-0 overflow-hidden relative">
              {shop.logoUrl ? (
                <Image src={shop.logoUrl} alt="Logo" fill className="object-contain" />
              ) : (
                <div className="relative text-primary">
                  <Glasses className="h-12 w-12" />
                  <ThumbsUp className="h-6 w-6 absolute -top-2 -right-2 bg-white p-0.5 rounded-full" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name}</h1>
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] leading-none">Gestion Optique Professionnelle</p>
              <div className="mt-2.5 space-y-0.5">
                <p className="text-[10px] text-slate-500 font-medium leading-tight">{shop.address}</p>
                <p className="text-[10px] font-bold text-slate-700">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-base font-black uppercase tracking-widest text-center leading-none border-2 border-slate-900 px-4 py-2 rounded-lg mb-2">Clôture de Caisse</h2>
            <div className="space-y-1">
              <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-600">
                <Calendar className="h-3 w-3 text-slate-400" />
                <span>Date: {date}</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-400">
                <User className="h-3 w-3" />
                <span className="uppercase">Administrateur</span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary Grid - Lighter and Cleaner */}
        <div className="grid grid-cols-2 gap-10 mb-12">
          <div className="space-y-6">
            <h3 className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-100 pb-2 tracking-[0.2em] flex items-center gap-2">
              <FileText className="h-3.5 w-3.5" />
              Analyse des Flux
            </h3>
            <div className="space-y-3 bg-slate-50/30 p-6 rounded-2xl border border-slate-100">
              <div className="flex justify-between text-xs font-bold text-green-600">
                <span>Total Entrées :</span>
                <span>+{formatCurrency(ventes + apports)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-destructive">
                <span>Dépenses :</span>
                <span>-{formatCurrency(depenses)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-orange-600">
                <span>Versements :</span>
                <span>-{formatCurrency(versements)}</span>
              </div>
              <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Solde Théorique</span>
                <span className="text-lg font-black text-slate-900 tracking-tight">{formatCurrency(theorique)}</span>
              </div>
            </div>

            <div className={`p-6 rounded-2xl border-2 text-center ${ecart === 0 ? 'border-green-100 bg-green-50/50' : 'border-destructive/10 bg-destructive/5'}`}>
              <p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-[0.2em]">Écart Final</p>
              <p className={`text-2xl font-black tracking-tighter ${ecart >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {ecart >= 0 ? '+' : ''}{formatCurrency(ecart)}
              </p>
            </div>
          </div>

          <div className="bg-slate-50/50 p-8 rounded-2xl border border-slate-100 space-y-6">
            <h3 className="text-[9px] font-black uppercase text-slate-400 border-b border-slate-200/50 pb-3 flex items-center gap-2 tracking-[0.2em]">
              <Coins className="h-3.5 w-3.5 text-primary" />
              Détail du Comptage
            </h3>
            <div className="space-y-2">
              {cashDetail.length > 0 ? (
                cashDetail.map(item => (
                  <div key={item.val} className="flex justify-between items-center text-[10px] border-b border-slate-100 pb-2 last:border-0">
                    <div className="flex gap-2 text-slate-400 font-bold">
                      <span className="w-12 text-right text-slate-900">{item.val} DH</span>
                      <span>×</span>
                      <span className="text-primary">{item.qty}</span>
                    </div>
                    <span className="font-black text-slate-700">{formatCurrency(item.val * item.qty)}</span>
                  </div>
                ))
              ) : (
                <p className="text-[10px] text-slate-400 italic text-center py-4">Aucun détail saisi.</p>
              )}
              <div className="flex flex-col items-end pt-6 border-t border-slate-200 mt-4">
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Espèces Comptées</span>
                <span className="text-xl font-black text-primary tracking-tighter">{formatCurrency(reel)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Signatures */}
        <div className="mt-auto pt-12 border-t border-slate-100 grid grid-cols-2 gap-20">
          <div className="space-y-16">
            <div className="space-y-1">
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">Signature de l'Opérateur</p>
              <p className="text-[10px] font-bold text-slate-800">Administrateur</p>
            </div>
            <div className="border-b border-slate-200 w-full opacity-50"></div>
          </div>
          <div className="space-y-16 text-right flex flex-col items-end">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">Cachet du Magasin</p>
            <div className="w-[60mm] h-[35mm] border border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50/30 relative">
              <span className="text-[8px] text-slate-300 font-black rotate-[-10deg] uppercase tracking-[0.3em] opacity-40 text-center leading-loose select-none">
                Espace Réservé
              </span>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center border-t border-slate-50 pt-6">
          <p className="text-[7px] text-slate-300 font-bold uppercase tracking-[0.4em] italic leading-none">
            {shop.name} • Système Like Vision
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CashClosurePrintPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}>
      <CashClosurePrintContent />
    </Suspense>
  );
}
