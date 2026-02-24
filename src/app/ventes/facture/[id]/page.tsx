
"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS, APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, ThumbsUp, Phone, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPhoneNumber } from "@/lib/utils";
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
  const monture = searchRegistry.get("monture") || "";
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
    <div className="pdf-a5-portrait bg-white flex flex-col p-[12mm] relative">
      <div className="flex-1 flex flex-col justify-center">
        {/* Header - No Blue Border */}
        <div className="flex justify-between items-start mb-12 pb-6 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="h-16 w-16 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
              <div className="relative">
                <Glasses className="h-10 w-10" />
                <ThumbsUp className="h-5 w-5 absolute -top-2 -right-2 bg-primary p-0.5 rounded-full" />
              </div>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-primary leading-none uppercase tracking-tighter">{APP_NAME}</h2>
              <p className="text-[10px] text-slate-500 max-w-[200px] leading-tight font-medium">{shop.address}</p>
              <div className="flex flex-col gap-0.5 pt-1">
                <p className="text-[10px] font-bold text-slate-700">Tél: {shop.phone}</p>
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="border-2 border-primary text-primary px-4 py-1.5 rounded-sm inline-block mb-3">
              <h1 className="text-[12px] font-black uppercase tracking-widest">Facture</h1>
            </div>
            <p className="text-[11px] font-black text-slate-900 mt-1">N°: {invoiceNo}</p>
            <p className="text-[10px] text-slate-500 font-bold italic">Date: {date}</p>
          </div>
        </div>

        {/* Client Info - Centered */}
        <div className="grid grid-cols-3 gap-4 mb-12 bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <div className="space-y-1.5 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-1 text-[9px] font-black text-primary uppercase opacity-60 tracking-widest">
              <User className="h-3 w-3" /> Client
            </div>
            <p className="text-[13px] font-black text-slate-900 leading-none uppercase truncate w-full px-2">{clientName}</p>
          </div>
          <div className="space-y-1.5 border-x border-slate-200 px-4 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-1 text-[9px] font-black text-primary uppercase opacity-60 tracking-widest">
              <Phone className="h-3 w-3" /> Téléphone
            </div>
            <p className="text-[13px] font-black text-slate-900 leading-none">{formatPhoneNumber(clientPhone)}</p>
          </div>
          <div className="space-y-1.5 flex flex-col items-center text-center">
            <div className="flex items-center justify-center gap-1 text-[9px] font-black text-primary uppercase opacity-60 tracking-widest">
              <ShieldCheck className="h-3 w-3" /> Mutuelle
            </div>
            <p className="text-[13px] font-black text-primary leading-none uppercase">{mutuelle}</p>
          </div>
        </div>

        {/* Prescription */}
        <div className="mb-14">
          <h3 className="text-[10px] font-black uppercase mb-4 text-primary tracking-[0.2em] flex items-center gap-3 justify-center">
            <div className="h-0.5 w-6 bg-primary/30 rounded-full" />
            Ordonnance Optique
            <div className="h-0.5 w-6 bg-primary/30 rounded-full" />
          </h3>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-primary text-white">
                <th className="border border-primary p-3 text-left text-[9px] uppercase font-black tracking-widest">Oeil</th>
                <th className="border border-primary p-3 text-center text-[9px] uppercase font-black tracking-widest">Sphère</th>
                <th className="border border-primary p-3 text-center text-[9px] uppercase font-black tracking-widest">Cylindre</th>
                <th className="border border-primary p-3 text-center text-[9px] uppercase font-black tracking-widest">Axe</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                <td className="border border-slate-200 p-3 font-black text-slate-700 bg-slate-50/50">Oeil Droit (OD)</td>
                <td className="border border-slate-200 p-3 text-center font-bold text-sm">{od.sph}</td>
                <td className="border border-slate-200 p-3 text-center font-bold text-sm">{od.cyl}</td>
                <td className="border border-slate-200 p-3 text-center font-bold text-sm">{od.axe}</td>
              </tr>
              <tr className="bg-white">
                <td className="border border-slate-200 p-3 font-black text-slate-700 bg-slate-50/50">Oeil Gauche (OG)</td>
                <td className="border border-slate-200 p-3 text-center font-bold text-sm">{og.sph}</td>
                <td className="border border-slate-200 p-3 text-center font-bold text-sm">{og.cyl}</td>
                <td className="border border-slate-200 p-3 text-center font-bold text-sm">{og.axe}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Details */}
        <div className="mb-14 grid grid-cols-2 gap-8">
          {searchParams.get("monture") && (
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex flex-col gap-1.5">
              <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Monture</p>
              <p className="text-[12px] font-bold text-slate-800 uppercase">{searchParams.get("monture")}</p>
            </div>
          )}
          {searchParams.get("verres") && (
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex flex-col gap-1.5">
              <p className="text-[9px] font-black uppercase text-primary/60 tracking-widest">Verres</p>
              <p className="text-[12px] font-bold text-slate-800 uppercase">{searchParams.get("verres")}</p>
            </div>
          )}
        </div>

        {/* Totals & Stamp */}
        <div className="flex justify-between items-end gap-12 pt-8">
          <div className="flex-1 space-y-3.5 bg-slate-50 p-6 rounded-[24px] border border-slate-100">
            <div className="flex justify-between text-[11px] text-slate-500 font-medium">
              <span>Total Brut :</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {remise > 0 && (
              <div className="flex justify-between text-[11px] text-destructive font-black italic">
                <span>Remise {remisePercent === "Fixe" ? "" : `(${remisePercent}%)`} :</span>
                <span>-{formatCurrency(remise)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px] text-slate-900 font-black border-t border-slate-200 pt-3">
              <span>Total Net :</span>
              <span>{formatCurrency(totalNet)}</span>
            </div>
            <div className="flex justify-between text-[13px] text-green-700 font-black">
              <span>Avance payée :</span>
              <span>{formatCurrency(avance)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t-4 border-primary mt-4">
              <span className="text-[11px] font-black uppercase text-primary tracking-tighter">Reste à régler</span>
              <span className="text-3xl font-black text-primary tracking-tighter">
                {formatCurrency(reste)}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center w-48 mb-2">
            <div className="w-full h-32 border-2 border-dashed border-primary/20 rounded-2xl flex items-center justify-center relative bg-primary/5 overflow-hidden mb-4">
              <span className="text-[9px] uppercase text-primary/30 font-black rotate-[-15deg] text-center px-4 leading-relaxed select-none">
                CACHET & SIGNATURE<br/>OFFICIELS DU MAGASIN
              </span>
            </div>
            <p className="text-[9px] font-black text-slate-400 uppercase italic tracking-widest">Validé par Direction</p>
          </div>
        </div>
      </div>

      {/* Footer Logo */}
      <div className="flex justify-center items-center mt-12 pt-6 border-t border-slate-50">
         <div className="flex items-center gap-3 opacity-30">
           <div className="relative">
            <Glasses className="h-5 w-5" />
            <ThumbsUp className="h-2 w-2 absolute -top-1.5 -right-1.5" />
          </div>
           <p className="text-[10px] font-black uppercase tracking-[0.5em]">{APP_NAME} Optique Pro</p>
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
    <Suspense fallback={<div className="flex items-center justify-center min- shores-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}>
      <InvoicePrintContent />
    </Suspense>
  );
}
