
"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS, APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, ThumbsUp, Phone, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Suspense } from "react";

function InvoicePrintContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shop = DEFAULT_SHOP_SETTINGS;

  const clientName = searchParams.get("client") || "Client de passage";
  const clientPhone = searchParams.get("phone") || "---";
  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const invoiceNo = params.id as string || "OPT-2024-XXX";
  const mutuelle = searchParams.get("mutuelle") || "Aucune";
  const total = Number(searchParams.get("total")) || 0;
  const remise = Number(searchParams.get("remise")) || 0;
  const remisePercent = searchParams.get("remisePercent") || "0";
  const avance = Number(searchParams.get("avance")) || 0;
  const monture = searchParams.get("monture") || "";
  const verres = searchParams.get("verres") || "";
  
  const totalNet = Math.max(0, total - remise);
  const reste = Math.max(0, totalNet - avance);

  const od = {
    sph: searchParams.get("od_sph") || "---",
    cyl: searchParams.get("od_cyl") || "---",
    axe: searchParams.get("od_axe") || "---"
  };
  const og = {
    sph: searchParams.get("og_sph") || "---",
    cyl: searchParams.get("og_cyl") || "---",
    axe: searchParams.get("og_axe") || "---"
  };

  const InvoiceCopy = () => (
    <div className="pdf-a5-portrait bg-white flex flex-col p-[8mm] relative">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-primary/20">
        <div className="flex gap-4">
          <div className="h-14 w-14 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
            <div className="relative">
              <Glasses className="h-8 w-8" />
              <ThumbsUp className="h-4 w-4 absolute -top-1.5 -right-1.5 bg-primary p-0.5 rounded-full" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-black text-primary leading-none uppercase tracking-tighter">{APP_NAME}</h2>
            <p className="text-[9px] text-slate-500 max-w-[180px] leading-tight font-medium">{shop.address}</p>
            <p className="text-[9px] font-bold text-slate-700">Tél: {shop.phone}</p>
            <p className="text-[9px] font-black text-primary">ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-primary text-white px-3 py-1 rounded-sm inline-block mb-2">
            <h1 className="text-[11px] font-black uppercase tracking-widest">Facture</h1>
          </div>
          <p className="text-[10px] font-black text-slate-900 mt-1">N°: {invoiceNo}</p>
          <p className="text-[9px] text-slate-500 font-bold italic">Date: {date}</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="grid grid-cols-3 gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[8px] font-black text-primary uppercase opacity-60">
            <User className="h-2.5 w-2.5" /> Client
          </div>
          <p className="text-[11px] font-bold text-slate-900 leading-none truncate">{clientName}</p>
        </div>
        <div className="space-y-1 border-x border-slate-200 px-3">
          <div className="flex items-center gap-1 text-[8px] font-black text-primary uppercase opacity-60">
            <Phone className="h-2.5 w-2.5" /> Téléphone
          </div>
          <p className="text-[11px] font-bold text-slate-900 leading-none">{clientPhone}</p>
        </div>
        <div className="space-y-1 text-right">
          <div className="flex items-center justify-end gap-1 text-[8px] font-black text-primary uppercase opacity-60">
            <ShieldCheck className="h-2.5 w-2.5" /> Mutuelle
          </div>
          <p className="text-[11px] font-bold text-primary leading-none">{mutuelle}</p>
        </div>
      </div>

      {/* Prescription */}
      <div className="mb-8">
        <h3 className="text-[9px] font-black uppercase mb-2 text-primary tracking-widest flex items-center gap-2">
          <div className="h-0.5 w-4 bg-primary/30 rounded-full" />
          Prescription Optique
        </h3>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-primary text-white">
              <th className="border border-primary p-2 text-left text-[8px] uppercase font-black">Oeil</th>
              <th className="border border-primary p-2 text-center text-[8px] uppercase font-black">Sphère</th>
              <th className="border border-primary p-2 text-center text-[8px] uppercase font-black">Cylindre</th>
              <th className="border border-primary p-2 text-center text-[8px] uppercase font-black">Axe</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="border border-slate-200 p-2 font-black text-slate-700 bg-slate-50/50">Droit (OD)</td>
              <td className="border border-slate-200 p-2 text-center font-bold">{od.sph}</td>
              <td className="border border-slate-200 p-2 text-center font-bold">{od.cyl}</td>
              <td className="border border-slate-200 p-2 text-center font-bold">{od.axe}</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-slate-200 p-2 font-black text-slate-700 bg-slate-50/50">Gauche (OG)</td>
              <td className="border border-slate-200 p-2 text-center font-bold">{og.sph}</td>
              <td className="border border-slate-200 p-2 text-center font-bold">{og.cyl}</td>
              <td className="border border-slate-200 p-2 text-center font-bold">{og.axe}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Details */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        {monture && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p className="text-[8px] font-black uppercase text-primary/60 mb-1">Monture</p>
            <p className="text-[10px] font-bold text-slate-800">{monture}</p>
          </div>
        )}
        {verres && (
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <p className="text-[8px] font-black uppercase text-primary/60 mb-1">Verres</p>
            <p className="text-[10px] font-bold text-slate-800">{verres}</p>
          </div>
        )}
      </div>

      {/* Totals & Stamp */}
      <div className="mt-auto">
        <div className="flex justify-between items-end gap-6 border-t-2 border-slate-100 pt-6">
          <div className="flex-1 space-y-2 bg-slate-50 p-3 rounded-2xl">
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>Total Brut :</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {remise > 0 && (
              <div className="flex justify-between text-[10px] text-destructive font-black italic">
                <span>Remise {remisePercent === "Fixe" ? "" : `(${remisePercent}%)`} :</span>
                <span>-{formatCurrency(remise)}</span>
              </div>
            )}
            <div className="flex justify-between text-[11px] text-slate-900 font-black border-t border-slate-200 pt-2">
              <span>Total Net :</span>
              <span>{formatCurrency(totalNet)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-green-700 font-black">
              <span>Avance payée :</span>
              <span>{formatCurrency(avance)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-2 border-t-2 border-primary mt-2">
              <span className="text-[10px] font-black uppercase text-primary tracking-tighter">Reste à régler</span>
              <span className="text-xl font-black text-primary tracking-tighter">
                {formatCurrency(reste)}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center w-36">
            <div className="w-full h-24 border-2 border-dashed border-primary/20 rounded-2xl flex items-center justify-center relative bg-primary/5 overflow-hidden mb-2">
              <span className="text-[8px] uppercase text-primary/30 font-black rotate-[-15deg] text-center px-2 leading-tight select-none">
                CACHET & SIGNATURE<br/>OFFICIELS DU MAGASIN
              </span>
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase italic tracking-widest">Validé par Direction</p>
          </div>
        </div>
        
        {/* Footer info only (no signature line) */}
        <div className="flex justify-center items-center mt-6 pt-4 border-t border-slate-50">
           <div className="flex items-center gap-2 opacity-30">
             <div className="relative">
              <Glasses className="h-4 w-4" />
              <ThumbsUp className="h-1.5 w-1.5 absolute -top-1 -right-1" />
            </div>
             <p className="text-[9px] font-black uppercase tracking-[0.3em]">{APP_NAME} Optique Pro</p>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8">
      <div className="no-print w-[297mm] flex justify-between mb-8 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-primary/20 text-primary shadow-sm h-12 px-8 rounded-xl font-black text-xs">
          <Link href="/ventes">
            <ArrowLeft className="mr-3 h-5 w-5" />
            RETOUR HISTORIQUE
          </Link>
        </Button>
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-black uppercase text-slate-500 bg-white px-6 py-3 rounded-full border shadow-sm flex items-center gap-3 tracking-widest">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            Format A4 Paysage • 2 Copies A5
          </span>
          <Button onClick={() => window.print()} className="bg-primary shadow-2xl hover:bg-primary/90 px-12 h-12 text-base font-black rounded-xl">
            <Printer className="mr-3 h-5 w-5" />
            IMPRIMER
          </Button>
        </div>
      </div>

      <div className="pdf-a4-landscape shadow-[0_0_80px_rgba(0,0,0,0.15)] overflow-hidden print:shadow-none bg-white print:m-0 border border-slate-200">
        <InvoiceCopy />
        <div className="cutting-line-vertical" />
        <InvoiceCopy />
      </div>

      <div className="no-print mt-10 text-slate-500 text-[10px] font-black flex items-center gap-4 bg-white/95 px-8 py-4 rounded-full border border-primary/10 shadow-2xl uppercase tracking-widest">
        <div className="relative">
          <Glasses className="h-5 w-5 text-primary" />
          <ThumbsUp className="h-2 w-2 absolute -top-1 -right-1 text-primary" />
        </div>
        Astuce : Réglez les marges sur "Aucune" dans les paramètres d'impression.
      </div>
    </div>
  );
}

export default function InvoicePrintPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}>
      <InvoicePrintContent />
    </Suspense>
  );
}
