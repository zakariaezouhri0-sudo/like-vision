"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS, APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, FileText, Calendar, User, Coins, Glasses, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8">
      {/* Controls Overlay */}
      <div className="no-print w-[210mm] flex justify-between mb-6 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-100 border-primary/20 text-primary h-11 px-6 rounded-xl shadow-sm">
          <Link href="/caisse">
            <ArrowLeft className="mr-2 h-4 w-4" />
            RETOUR CAISSE
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-xs font-black uppercase text-slate-500 bg-white px-4 py-2.5 rounded-full border shadow-sm">
            Format A4 Portrait
          </span>
          <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 h-11 px-10 rounded-xl font-black text-base">
            <Printer className="mr-2 h-5 w-5" />
            IMPRIMER LE RAPPORT
          </Button>
        </div>
      </div>

      {/* Actual A4 Page */}
      <div className="pdf-a4-portrait shadow-2xl bg-white print:shadow-none print:m-0 border border-slate-200">
        {/* Header with Logo */}
        <div className="flex justify-between items-start border-b-4 border-primary pb-8 mb-10">
          <div className="flex gap-4">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shrink-0">
               <div className="relative">
                <Glasses className="h-10 w-10" />
                <ThumbsUp className="h-5 w-5 absolute -top-2 -right-2 bg-primary p-1 rounded-full" />
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-primary uppercase tracking-tighter leading-none">{APP_NAME}</h1>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest opacity-60">Gestion Optique Pro</p>
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-600 max-w-[250px] leading-tight font-medium">{shop.address}</p>
                <p className="text-[11px] font-bold text-slate-900 mt-1">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-primary text-white px-5 py-3 rounded-xl shadow-md mb-3 inline-block">
              <h2 className="text-xl font-black uppercase tracking-widest text-center leading-none">Rapport de Clôture</h2>
            </div>
            <div className="space-y-1 mt-2">
              <div className="flex items-center justify-end gap-2 text-xs font-bold text-slate-600">
                <Calendar className="h-4 w-4 text-primary" />
                <span>Date: {date}</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-xs font-bold text-slate-600">
                <User className="h-4 w-4 text-primary" />
                <span>Édité par: Administrateur</span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary Grid */}
        <div className="grid grid-cols-2 gap-10 mb-12">
          <div className="space-y-6">
            <h3 className="text-xs font-black uppercase text-primary/60 border-b-2 border-slate-50 pb-2 tracking-[0.2em] flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Résumé des Flux
            </h3>
            <div className="space-y-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500">Solde Initial :</span>
                <span className="font-bold">{formatCurrency(initial)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600 font-bold">
                <span>Total Entrées :</span>
                <span>+{formatCurrency(ventes + apports)}</span>
              </div>
              <div className="flex justify-between text-sm text-destructive font-bold">
                <span>Total Sorties :</span>
                <span>-{formatCurrency(depenses)}</span>
              </div>
              <div className="pt-4 border-t-2 border-dashed border-slate-200 flex justify-between font-black text-lg">
                <span className="text-slate-900 uppercase text-xs tracking-tighter self-center">Solde Théorique</span>
                <span className="text-primary">{formatCurrency(theorique)}</span>
              </div>
            </div>

            {/* Écart de Caisse Visuel */}
            <div className={`p-6 rounded-2xl border-2 text-center shadow-sm ${ecart === 0 ? 'border-green-100 bg-green-50' : 'border-destructive/10 bg-destructive/5'}`}>
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">Écart de Caisse Final</p>
              <p className={`text-3xl font-black ${ecart >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {ecart >= 0 ? '+' : ''}{formatCurrency(ecart)}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 text-white p-8 rounded-3xl space-y-6 shadow-xl">
            <h3 className="text-xs font-black uppercase text-white/40 border-b border-white/10 pb-3 flex items-center gap-2 tracking-[0.2em]">
              <Coins className="h-4 w-4" />
              Détail Espèces
            </h3>
            <div className="space-y-2">
              {cashDetail.length > 0 ? (
                cashDetail.map(item => (
                  <div key={item.val} className="grid grid-cols-[3fr_1fr_2fr_3fr] gap-2 text-[12px] border-b border-white/5 py-2 last:border-0 items-center">
                    <span className="font-black text-white/80 text-right pr-2">{item.val} DH</span>
                    <span className="text-white/20 text-center text-[10px] font-black">×</span>
                    <span className="font-black text-primary text-left pl-2">{item.qty}</span>
                    <span className="font-black text-white text-right">{formatCurrency(item.val * item.qty)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/40 italic text-center py-4">Aucun détail saisi.</p>
              )}
              <div className="flex justify-between items-center pt-6 border-t border-white/20 mt-4">
                <span className="text-xs font-black uppercase tracking-widest opacity-60">Total Compté</span>
                <span className="text-2xl font-black text-primary">{formatCurrency(reel)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Signatures */}
        <div className="mt-auto pt-12 border-t-2 border-slate-100 grid grid-cols-2 gap-16">
          <div className="space-y-20">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Signature Opérateur</p>
            <div className="border-b-2 border-slate-200 w-full"></div>
          </div>
          <div className="space-y-20 text-right flex flex-col items-end">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Cachet Direction</p>
            <div className="w-[80mm] h-[45mm] border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center bg-slate-50 relative overflow-hidden">
              <span className="text-[10px] text-slate-300 font-black rotate-[-15deg] uppercase tracking-[0.3em] opacity-40 select-none">Espace Cachet Officiel</span>
            </div>
          </div>
        </div>

        <div className="mt-16 text-center border-t border-slate-50 pt-6">
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em] italic opacity-60">{APP_NAME} Optique Pro • Système Certifié v1.1.0</p>
        </div>
      </div>
    </div>
  );
}

export default function CashClosurePrintPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Chargement du rapport...</div>}>
      <CashClosurePrintContent />
    </Suspense>
  );
}
