
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
    <div className="pdf-a5-portrait bg-white flex flex-col p-[12mm] relative">
      <div className="flex-1 flex flex-col justify-center">
        {/* Header - Clean without blue bar */}
        <div className="flex justify-between items-start mb-12 pb-6 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="h-16 w-16 border-2 border-slate-200 rounded-xl flex items-center justify-center text-primary shadow-sm shrink-0">
              <div className="relative">
                <Glasses className="h-10 w-10" />
                <ThumbsUp className="h-5 w-5 absolute -top-2 -right-2 bg-white text-primary p-0.5 rounded-full border border-primary" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900 leading-none uppercase tracking-tighter">{APP_NAME}</h2>
              <p className="text-[9px] text-slate-500 max-w-[200px] leading-tight font-medium">{shop.address}</p>
              <div className="flex flex-col gap-0.5 pt-1">
                <p className="text-[9px] font-bold text-slate-700">Tél: {shop.phone}</p>
                <p className="text-[9px] font-black text-slate-900 uppercase tracking-widest">ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="border-2 border-slate-900 text-slate-900 px-4 py-1.5 rounded-sm inline-block mb-2">
              <h1 className="text-[11px] font-black uppercase tracking-widest">Facture</h1>
            </div>
            <p className="text-[10px] font-black text-slate-900 mt-1">N°: {invoiceNo}</p>
            <p className="text-[9px] text-slate-500 font-bold italic">Date: {date}</p>
          </div>
        </div>

        {/* Client Info - Centered */}
        <div className="mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-100 text-center space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">
              <User className="h-2.5 w-2.5" /> Nom du Client
            </div>
            <p className="text-base font-black text-slate-900 leading-none uppercase">{clientName}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
            <div className="space-y-1 border-r border-slate-200">
              <div className="flex items-center justify-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                <Phone className="h-2.5 w-2.5" /> Téléphone
              </div>
              <p className="text-xs font-black text-slate-900 leading-none">{formatPhoneNumber(clientPhone)}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                <ShieldCheck className="h-2.5 w-2.5" /> Mutuelle
              </div>
              <p className="text-xs font-black text-slate-900 leading-none uppercase">{mutuelle}</p>
            </div>
          </div>
        </div>

        {/* Prescription - Gray header for ink saving */}
        <div className="mb-10">
          <h3 className="text-[9px] font-black uppercase mb-4 text-slate-400 tracking-[0.2em] flex items-center gap-3 justify-center">
            <div className="h-px w-6 bg-slate-200" />
            Ordonnance Optique
            <div className="h-px w-6 bg-slate-200" />
          </h3>
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-900">
                <th className="border border-slate-200 p-2.5 text-left text-[8px] uppercase font-black tracking-widest">Oeil</th>
                <th className="border border-slate-200 p-2.5 text-center text-[8px] uppercase font-black tracking-widest">Sphère</th>
                <th className="border border-slate-200 p-2.5 text-center text-[8px] uppercase font-black tracking-widest">Cylindre</th>
                <th className="border border-slate-200 p-2.5 text-center text-[8px] uppercase font-black tracking-widest">Axe</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-200 p-2.5 font-black text-slate-700 bg-slate-50/50">Oeil Droit (OD)</td>
                <td className="border border-slate-200 p-2.5 text-center font-bold text-xs">{od.sph}</td>
                <td className="border border-slate-200 p-2.5 text-center font-bold text-xs">{od.cyl}</td>
                <td className="border border-slate-200 p-2.5 text-center font-bold text-xs">{od.axe}</td>
              </tr>
              <tr>
                <td className="border border-slate-200 p-2.5 font-black text-slate-700 bg-slate-50/50">Oeil Gauche (OG)</td>
                <td className="border border-slate-200 p-2.5 text-center font-bold text-xs">{og.sph}</td>
                <td className="border border-slate-200 p-2.5 text-center font-bold text-xs">{og.cyl}</td>
                <td className="border border-slate-200 p-2.5 text-center font-bold text-xs">{og.axe}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Details Monture & Verres - Back in details */}
        <div className="mb-10 grid grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1 text-center">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Monture</p>
            <p className="text-[10px] font-bold text-slate-800 uppercase truncate">{monture || "---"}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1 text-center">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Verres</p>
            <p className="text-[10px] font-bold text-slate-800 uppercase truncate">{verres || "---"}</p>
          </div>
        </div>

        {/* Totals & Stamp - Optimized vertical space */}
        <div className="flex justify-between items-end gap-10">
          <div className="flex-1 space-y-2.5 bg-slate-50 p-5 rounded-[20px] border border-slate-100">
            <div className="flex justify-between text-[10px] text-slate-500 font-medium">
              <span>Total Brut :</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {remise > 0 && (
              <div className="flex justify-between text-[10px] text-destructive font-black">
                <span>Remise {remisePercent === "Fixe" ? "" : `(${remisePercent}%)`} :</span>
                <span>-{formatCurrency(remise)}</span>
              </div>
            )}
            <div className="flex justify-between text-[11px] text-slate-900 font-black border-t border-slate-200 pt-2.5">
              <span>Total Net :</span>
              <span>{formatCurrency(totalNet)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-700 font-black">
              <span>Avance payée :</span>
              <span>{formatCurrency(avance)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 mt-2">
              <span className="text-[10px] font-black uppercase text-slate-900 tracking-tighter">Reste à régler</span>
              <span className="text-2xl font-black text-slate-900 tracking-tighter">
                {formatCurrency(reste)}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center w-40 mb-2">
            <div className="w-full h-24 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative bg-slate-50 overflow-hidden mb-2">
              <span className="text-[8px] uppercase text-slate-300 font-black rotate-[-15deg] text-center px-4 leading-relaxed select-none">
                CACHET & SIGNATURE<br/>OFFICIELS DU MAGASIN
              </span>
            </div>
            <p className="text-[8px] font-black text-slate-400 uppercase italic tracking-widest">Direction {APP_NAME}</p>
          </div>
        </div>
      </div>

      {/* Footer minimal */}
      <div className="flex justify-center items-center mt-8 pt-4 border-t border-slate-50">
         <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.5em]">{APP_NAME} Optique Pro</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8">
      <div className="no-print w-[297mm] flex justify-between mb-8 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 shadow-sm h-12 px-8 rounded-xl font-black text-xs">
          <Link href="/ventes">
            <ArrowLeft className="mr-3 h-5 w-5" />
            RETOUR HISTORIQUE
          </Link>
        </Button>
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-black uppercase text-slate-500 bg-white px-6 py-3 rounded-full border shadow-sm tracking-widest">
            A4 Paysage • 2 Copies A5
          </span>
          <Button onClick={() => window.print()} className="bg-slate-900 shadow-2xl hover:bg-slate-800 px-12 h-12 text-base font-black rounded-xl">
            <Printer className="mr-3 h-5 w-5" />
            IMPRIMER
          </Button>
        </div>
      </div>

      <div className="pdf-a4-landscape shadow-2xl overflow-hidden print:shadow-none bg-white print:m-0 border border-slate-200">
        <InvoiceCopy />
        <div className="cutting-line-vertical" />
        <InvoiceCopy />
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
