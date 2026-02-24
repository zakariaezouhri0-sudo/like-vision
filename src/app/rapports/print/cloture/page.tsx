"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS, APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, FileText, Calendar, User, Coins, Glasses, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Suspense } from "react";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

function CashClosurePrintContent() {
  const searchParams = useSearchParams();
  const shop = DEFAULT_SHOP_SETTINGS;

  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const initial = Number(searchParams.get("initial")) || 0;
  const ventes = Number(searchParams.get("ventes")) || 0;
  const depenses = Number(searchParams.get("depenses")) || 0;
  const apports = Number(searchParams.get("apports")) || 0;
  const reel = Number(searchParams.get("reel")) || 0;
  
  const theorique = initial + ventes + apports - depenses;
  const ecart = reel - theorique;

  const cashDetail = DENOMINATIONS.map(val => ({
    val,
    qty: Number(searchParams.get(`d${val}`)) || 0
  })).filter(item => item.qty >= 0);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-12">
      {/* Controls Overlay */}
      <div className="no-print w-[210mm] flex justify-between mb-8 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-primary/20 text-primary h-12 px-6 rounded-2xl shadow-sm font-black">
          <Link href="/caisse">
            <ArrowLeft className="mr-3 h-5 w-5" />
            RETOUR
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-black uppercase text-slate-500 bg-white px-5 py-3 rounded-full border shadow-sm tracking-widest">
            A4 Portrait • Rapport Officiel
          </span>
          <Button onClick={() => window.print()} className="bg-primary shadow-2xl hover:bg-primary/90 h-12 px-10 rounded-2xl font-black text-base">
            <Printer className="mr-3 h-5 w-5" />
            IMPRIMER LE RAPPORT
          </Button>
        </div>
      </div>

      {/* Actual A4 Page */}
      <div className="pdf-a4-portrait shadow-[0_0_80px_rgba(0,0,0,0.1)] bg-white print:shadow-none print:m-0 border border-slate-200 rounded-[2mm] p-[15mm]">
        {/* Header with Logo */}
        <div className="flex justify-between items-start border-b-8 border-primary pb-10 mb-12">
          <div className="flex gap-6">
            <div className="h-24 w-24 bg-primary rounded-3xl flex items-center justify-center text-primary-foreground shadow-2xl shrink-0">
               <div className="relative">
                <Glasses className="h-14 w-14" />
                <ThumbsUp className="h-7 w-7 absolute -top-3 -right-3 bg-primary p-1 rounded-full border-2 border-white" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h1 className="text-4xl font-black text-primary uppercase tracking-tighter leading-none">{APP_NAME}</h1>
              <p className="text-[11px] font-black uppercase text-primary/40 tracking-[0.4em] leading-none">Gestion Optique Pro</p>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[12px] text-slate-500 max-w-[300px] font-bold leading-tight italic">{shop.address}</p>
                <p className="text-[13px] font-black text-slate-900 mt-2">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-primary text-white px-6 py-4 rounded-2xl shadow-xl mb-4 inline-block">
              <h2 className="text-2xl font-black uppercase tracking-widest text-center leading-none">Clôture de Caisse</h2>
            </div>
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-end gap-3 text-sm font-black text-slate-700">
                <Calendar className="h-5 w-5 text-primary" />
                <span>Date: {date}</span>
              </div>
              <div className="flex items-center justify-end gap-3 text-sm font-black text-slate-500">
                <User className="h-5 w-5 text-primary/40" />
                <span className="uppercase">Par: Administrateur</span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary Grid */}
        <div className="grid grid-cols-2 gap-12 mb-16">
          <div className="space-y-8">
            <h3 className="text-xs font-black uppercase text-primary/40 border-b-4 border-slate-50 pb-3 tracking-[0.3em] flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary/60" />
              Analyse des Flux
            </h3>
            <div className="space-y-5 bg-slate-50/50 p-8 rounded-3xl border border-slate-100 shadow-inner">
              <div className="flex justify-between text-base font-bold text-slate-600">
                <span>Solde Initial :</span>
                <span className="text-slate-900">{formatCurrency(initial)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-green-600">
                <span>Total Entrées :</span>
                <span>+{formatCurrency(ventes + apports)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-destructive">
                <span>Total Sorties :</span>
                <span>-{formatCurrency(depenses)}</span>
              </div>
              <div className="pt-6 border-t-4 border-dashed border-slate-200 flex justify-between items-center">
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">Solde Théorique</span>
                <span className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(theorique)}</span>
              </div>
            </div>

            {/* Écart de Caisse Visuel */}
            <div className={`p-8 rounded-3xl border-4 text-center shadow-lg transition-all ${ecart === 0 ? 'border-green-100 bg-green-50' : 'border-destructive/10 bg-destructive/5'}`}>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 tracking-[0.3em]">Écart de Caisse Final</p>
              <p className={`text-5xl font-black tracking-tighter ${ecart >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {ecart >= 0 ? '+' : ''}{formatCurrency(ecart)}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-10 rounded-[40px] space-y-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-32 w-32 bg-primary/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
            <h3 className="text-xs font-black uppercase text-white/30 border-b border-white/10 pb-4 flex items-center gap-3 tracking-[0.3em] relative z-10">
              <Coins className="h-5 w-5 text-primary" />
              Détail du Comptage
            </h3>
            <div className="space-y-3 relative z-10">
              {cashDetail.length > 0 ? (
                cashDetail.map(item => (
                  <div key={item.val} className="grid grid-cols-[4fr_1fr_2fr_5fr] gap-3 text-sm border-b border-white/5 py-3 last:border-0 items-center">
                    <span className="font-black text-white/60 text-right pr-2">{item.val} DH</span>
                    <span className="text-white/20 text-center text-[10px] font-black">×</span>
                    <span className="font-black text-primary text-left pl-2">{item.qty}</span>
                    <span className="font-black text-white text-right text-base">{formatCurrency(item.val * item.qty)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/40 italic text-center py-8">Aucun détail saisi.</p>
              )}
              <div className="flex flex-col items-end pt-8 border-t border-white/20 mt-6">
                <span className="text-xs font-black uppercase tracking-widest text-white/30 mb-2">Total Espèces Comptées</span>
                <span className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(reel)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Signatures */}
        <div className="mt-auto pt-16 border-t-8 border-slate-50 grid grid-cols-2 gap-24">
          <div className="space-y-24">
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Signature de l'Opérateur</p>
              <p className="text-xs font-bold text-slate-800">Administrateur</p>
            </div>
            <div className="border-b-4 border-slate-100 w-full"></div>
          </div>
          <div className="space-y-24 text-right flex flex-col items-end">
            <p className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Cachet de la Direction</p>
            <div className="w-[90mm] h-[50mm] border-4 border-dashed border-slate-100 rounded-[30px] flex items-center justify-center bg-slate-50 relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/2 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[11px] text-slate-300 font-black rotate-[-15deg] uppercase tracking-[0.4em] opacity-40 select-none text-center leading-loose">
                Espace Réservé<br/>au Cachet Officiel
              </span>
            </div>
          </div>
        </div>

        <div className="mt-20 text-center border-t border-slate-50 pt-8">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.5em] italic opacity-40 leading-none">
            {APP_NAME} Optique Pro • Généré par Like Vision System v1.2.0
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