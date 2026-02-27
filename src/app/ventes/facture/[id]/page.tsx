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
  const monture = searchParams.get("monture") || "";
  const verres = searchParams.get("verres") || "";
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
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <div className="relative text-primary">
                <Glasses className="h-8 w-8" />
                <ThumbsUp className="h-4 w-4 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" />
              </div>
            )}
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tighter">{shop.name}</h2>
            <p className="text-[7px] text-slate-500 max-w-[180px] leading-tight font-bold">{shop.address}</p>
            <p className="text-[7px] font-black text-slate-700">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-slate-950 text-white px-3 py-1 rounded-md inline-block mb-1.5">
            <h1 className="text-[8px] font-black uppercase tracking-[0.2em]">Facture</h1>
          </div>
          <p className="text-[9px] font-black text-slate-900 leading-none">N°: {invoiceNo}</p>
          <p className="text-[7px] text-slate-400 font-bold italic mt-1">Date: {date}</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="mb-6 bg-slate-50 border border-slate-200 py-3 px-2 grid grid-cols-3 gap-2 rounded-xl shadow-inner">
        <div className="px-2">
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Client</p>
          <p className="text-[9px] font-black text-slate-900 uppercase leading-tight truncate">{clientName}</p>
        </div>
        <div className="border-x border-slate-200 px-2">
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Téléphone</p>
          <p className="text-[9px] font-black text-slate-900 tabular-nums">{formatPhoneNumber(clientPhone)}</p>
        </div>
        <div className="px-2">
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Mutuelle</p>
          <p className="text-[9px] font-black text-slate-900 uppercase leading-tight truncate">{mutuelle}</p>
        </div>
      </div>

      {/* Détails Équipement - To fill the middle space */}
      <div className="mb-6">
        <h3 className="text-[7px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 border-b border-slate-100 pb-1">Détails Équipement</h3>
        <div className="grid grid-cols-2 gap-6 bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
          <div className="space-y-1">
            <p className="text-[6px] font-black text-primary/60 uppercase tracking-widest">Monture</p>
            <p className="text-[9px] font-bold text-slate-800 uppercase leading-tight">{monture || "Non spécifiée"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[6px] font-black text-primary/60 uppercase tracking-widest">Verres</p>
            <p className="text-[9px] font-bold text-slate-800 uppercase leading-tight">{verres || "Non spécifiés"}</p>
          </div>
        </div>
      </div>

      {/* Prescription Table */}
      <div className="mb-6">
        <h3 className="text-[7px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 border-b border-slate-100 pb-1">Prescription Optique</h3>
        <table className="w-full text-[8px] border-collapse table-fixed shadow-sm rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="border border-slate-800 p-1.5 text-left w-[24%] uppercase tracking-widest">Oeil</th>
              <th className="border border-slate-800 p-1.5 text-center w-[19%] uppercase">Sph</th>
              <th className="border border-slate-800 p-1.5 text-center w-[19%] uppercase">Cyl</th>
              <th className="border border-slate-800 p-1.5 text-center w-[19%] uppercase">Axe</th>
              <th className="border border-slate-800 p-1.5 text-center w-[19%] uppercase">ADD</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="border border-slate-200 p-2 font-black text-slate-700">Droit (OD)</td>
              <td className="border border-slate-200 p-2 text-center font-black tabular-nums">{od.sph}</td>
              <td className="border border-slate-200 p-2 text-center font-black tabular-nums">{od.cyl}</td>
              <td className="border border-slate-200 p-2 text-center font-black tabular-nums">{od.axe}</td>
              <td className="border border-slate-200 p-2 text-center font-black tabular-nums">{od.add}</td>
            </tr>
            <tr className="bg-slate-50/30">
              <td className="border border-slate-200 p-2 font-black text-slate-700">Gauche (OG)</td>
              <td className="border border-slate-200 p-2 text-center font-black tabular-nums">{og.sph}</td>
              <td className="border border-slate-200 p-2 text-center font-black tabular-nums">{og.cyl}</td>
              <td className="border border-slate-200 p-2 text-center font-black tabular-nums">{og.axe}</td>
              <td className="border border-slate-200 p-2 text-center font-black tabular-nums">{og.add}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals Area */}
      <div className="mt-auto space-y-3">
        <div className="w-full space-y-1.5 border-t border-slate-200 pt-4">
          <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase tracking-widest px-1">
            <span>Total Brut :</span><span className="tabular-nums font-black">{formatCurrency(total)}</span>
          </div>
          {remise > 0 && (
            <div className="flex justify-between text-[8px] text-destructive font-black uppercase tracking-widest px-1">
              <span>Remise {remisePercent === "Fixe" ? "" : `(${remisePercent}%)`} :</span>
              <span className="tabular-nums">-{formatCurrency(remise)}</span>
            </div>
          )}
          <div className="flex justify-between text-[10px] text-slate-900 font-black uppercase tracking-tighter px-1">
            <span>Total Net :</span><span className="tabular-nums text-sm">{formatCurrency(totalNet)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 bg-slate-950 text-white p-3 rounded-xl mt-2 shadow-lg">
            <span className="text-[8px] font-black uppercase tracking-[0.3em]">Total payé (Soldé)</span>
            <span className="text-lg font-black tracking-tighter tabular-nums">{formatCurrency(totalNet)}</span>
          </div>
        </div>
        
        {/* Signature Area */}
        <div className="flex justify-between items-end mt-4">
          <div className="flex-1 pr-6">
            <div className="border-l-4 border-primary/20 pl-3 py-2 bg-slate-50/50 rounded-r-lg">
              <p className="text-[8px] font-black text-primary/80 italic leading-tight">Merci de votre confiance.<br/>Votre vue est notre priorité absolue !</p>
            </div>
          </div>
          <div className="w-40 h-20 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center relative bg-white overflow-hidden shrink-0 shadow-sm">
            <span className="text-[7px] uppercase text-slate-300 font-black rotate-[-15deg] text-center px-4 leading-none select-none opacity-40">CACHET & SIGNATURE</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 pt-3 border-t border-slate-100 text-center">
         <p className="text-[6px] font-black text-slate-200 uppercase tracking-[0.6em] italic">{shop.name} • SYSTÈME LIKE VISION</p>
      </div>
    </div>
  );

  if (settingsLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 print:py-0">
      <div className="no-print w-[297mm] flex justify-between mb-6 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 h-12 px-8 rounded-2xl font-black text-sm shadow-sm border-slate-200">
          <Link href="/ventes"><ArrowLeft className="mr-3 h-5 w-5" /> RETOUR</Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-slate-950 px-12 h-12 text-base font-black rounded-2xl text-white shadow-xl hover:scale-105 transition-transform"><Printer className="mr-3 h-5 w-5" /> IMPRIMER LES COPIES</Button>
      </div>
      <div className="pdf-a4-landscape shadow-2xl overflow-hidden print:shadow-none bg-white print:m-0 border border-slate-200 rounded-sm">
        <InvoiceCopy /><div className="cutting-line-vertical" /><InvoiceCopy />
      </div>
    </div>
  );
}

export default function InvoicePrintPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}><InvoicePrintContent /></Suspense>;
}
