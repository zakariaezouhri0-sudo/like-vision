"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, ThumbsUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPhoneNumber } from "@/lib/utils";
import { Suspense } from "react";
import { useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";

function InvoicePrintContent() {
  const params = useParams();
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

  const clientName = searchParams.get("client") || "Client";
  const clientPhone = searchParams.get("phone") || "---";
  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const invoiceNo = params.id as string || "OPT-2024-XXX";
  const mutuelle = searchParams.get("mutuelle") || "Aucune";
  const total = Number(searchParams.get("total")) || 0;
  const remise = Number(searchParams.get("remise")) || 0;
  const remisePercent = searchParams.get("remisePercent") || "0";
  const avance = Number(searchParams.get("avance")) || 0;
  const totalNet = Math.max(0, total - remise);

  const od = {
    sph: searchParams.get("od_sph") || "---",
    cyl: searchParams.get("od_cyl") || "---",
    axe: searchParams.get("od_axe") || "---",
    add: searchParams.get("od_add") || "---"
  };
  const og = {
    sph: searchParams.get("og_sph") || "---",
    cyl: searchParams.get("og_cyl") || "---",
    axe: searchParams.get("og_axe") || "---",
    add: searchParams.get("og_add") || "---"
  };

  const InvoiceCopy = () => (
    <div className="pdf-a5-portrait bg-white flex flex-col p-[8mm] relative h-[210mm] max-h-[210mm] overflow-hidden">
      {/* Header Compact */}
      <div className="flex justify-between items-start mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <div className="relative text-primary">
                <Glasses className="h-7 w-7" />
                <ThumbsUp className="h-3 w-3 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" />
              </div>
            )}
          </div>
          <div className="space-y-0">
            <h2 className="text-xs font-black text-slate-900 leading-tight uppercase tracking-tighter">{shop.name}</h2>
            <p className="text-[6px] text-slate-500 max-w-[150px] leading-tight font-medium">{shop.address}</p>
            <p className="text-[6px] font-bold text-slate-700">Tél: {shop.phone}</p>
            <p className="text-[6px] font-black text-slate-900 tracking-widest uppercase">ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-slate-900 text-white px-2 py-0.5 rounded-md inline-block mb-1">
            <h1 className="text-[7px] font-black uppercase tracking-widest">Facture</h1>
          </div>
          <p className="text-[7px] font-black text-slate-900 leading-none">N°: {invoiceNo}</p>
          <p className="text-[6px] text-slate-400 font-bold italic">Date: {date}</p>
        </div>
      </div>

      {/* Client Info Compact */}
      <div className="mb-4 bg-slate-50 border-y border-slate-200 py-2 px-1 text-center grid grid-cols-3 gap-1 rounded-lg">
        <div>
          <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest">Client</p>
          <p className="text-[8px] font-black text-slate-900 uppercase leading-tight truncate">{clientName}</p>
        </div>
        <div className="border-x border-slate-200">
          <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest">Téléphone</p>
          <p className="text-[8px] font-black text-slate-900">{formatPhoneNumber(clientPhone)}</p>
        </div>
        <div>
          <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest">Mutuelle</p>
          <p className="text-[8px] font-black text-slate-900 uppercase leading-tight truncate">{mutuelle}</p>
        </div>
      </div>

      {/* Prescription Table Compact */}
      <div className="mb-4">
        <h3 className="text-[6px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1 border-b pb-0.5">Prescription Optique</h3>
        <table className="w-full text-[7px] border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-800 text-white text-[6px]">
              <th className="border border-slate-300 p-0.5 text-left w-[24%] uppercase">Oeil</th>
              <th className="border border-slate-300 p-0.5 text-center w-[19%] uppercase">Sph</th>
              <th className="border border-slate-300 p-0.5 text-center w-[19%] uppercase">Cyl</th>
              <th className="border border-slate-300 p-0.5 text-center w-[19%] uppercase">Axe</th>
              <th className="border border-slate-300 p-0.5 text-center w-[19%] uppercase">ADD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 p-1 font-black">Droit (OD)</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{od.sph}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{od.cyl}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{od.axe}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{od.add}</td>
            </tr>
            <tr>
              <td className="border border-slate-200 p-1 font-black">Gauche (OG)</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{og.sph}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{og.cyl}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{og.axe}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{og.add}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals Area Compact */}
      <div className="mt-auto space-y-2">
        <div className="w-full space-y-1 border-t pt-2">
          <div className="flex justify-between text-[7px] text-slate-500 font-bold uppercase">
            <span>Total Brut :</span><span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
          {remise > 0 && (
            <div className="flex justify-between text-[7px] text-destructive font-black uppercase">
              <span>Remise {remisePercent === "Fixe" ? "" : `(${remisePercent}%)`} :</span>
              <span className="tabular-nums">-{formatCurrency(remise)}</span>
            </div>
          )}
          <div className="flex justify-between text-[8px] text-slate-900 font-black uppercase">
            <span>Total Net :</span><span className="tabular-nums">{formatCurrency(totalNet)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900 bg-slate-950 text-white p-2 rounded-lg mt-1">
            <span className="text-[7px] font-black uppercase tracking-widest">Total payé (Soldé)</span>
            <span className="text-base font-black tracking-tighter tabular-nums">{formatCurrency(totalNet)}</span>
          </div>
        </div>
        
        {/* Signature Area Compact */}
        <div className="flex justify-between items-end mt-2">
          <div className="flex-1 pr-4">
            <div className="border-l-2 border-primary/20 pl-2 py-1">
              <p className="text-[7px] font-medium text-primary/80 italic leading-tight">Merci de votre confiance. Votre vue est notre priorité !</p>
            </div>
          </div>
          <div className="w-32 h-16 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center relative bg-white overflow-hidden shrink-0">
            <span className="text-[6px] uppercase text-slate-200 font-black rotate-[-15deg] text-center px-4 leading-none select-none opacity-50">CACHET & SIGNATURE</span>
          </div>
        </div>
      </div>

      {/* Footer Minimalist */}
      <div className="mt-4 pt-2 border-t border-slate-50 text-center">
         <p className="text-[5px] font-black text-slate-200 uppercase tracking-[0.5em]">{shop.name}</p>
      </div>
    </div>
  );

  if (settingsLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-4">
      <div className="no-print w-[297mm] flex justify-between mb-4 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 h-10 px-6 rounded-xl font-black text-xs">
          <Link href="/ventes"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR</Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-slate-900 px-10 h-10 text-sm font-black rounded-xl text-white"><Printer className="mr-2 h-4 w-4" /> IMPRIMER</Button>
      </div>
      <div className="pdf-a4-landscape shadow-none overflow-hidden print:shadow-none bg-white print:m-0 border border-slate-200">
        <InvoiceCopy /><div className="cutting-line-vertical" /><InvoiceCopy />
      </div>
    </div>
  );
}

export default function InvoicePrintPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}><InvoicePrintContent /></Suspense>;
}
