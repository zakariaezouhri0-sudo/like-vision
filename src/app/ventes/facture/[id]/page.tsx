
"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, ThumbsUp, Phone, User, ShieldCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
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

  const clientName = searchParams.get("client") || "Client de passage";
  const clientPhone = searchParams.get("phone") || "---";
  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const invoiceNo = params.id as string || "OPT-2024-XXX";
  const mutuelle = searchParams.get("mutuelle") || "Aucune";
  const total = Number(searchParams.get("total")) || 0;
  const remise = Number(searchParams.get("remise")) || 0;
  const remisePercent = searchParams.get("remisePercent") || "0";
  const avance = Number(searchParams.get("avance")) || 0;
  
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
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
        <div className="flex gap-4">
          <div className="h-14 w-14 border border-slate-200 rounded-xl flex items-center justify-center text-primary shrink-0 overflow-hidden relative bg-white">
            {shop.logoUrl ? (
              <Image src={shop.logoUrl} alt="Logo" fill className="object-contain p-1" />
            ) : (
              <div className="relative">
                <Glasses className="h-8 w-8" />
                <ThumbsUp className="h-4 w-4 absolute -top-1.5 -right-1.5 bg-white text-primary p-0.5 rounded-full border border-primary" />
              </div>
            )}
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-black text-slate-900 leading-none uppercase tracking-tighter">{shop.name}</h2>
            <p className="text-[7px] text-slate-500 max-w-[180px] leading-tight font-medium">{shop.address}</p>
            <p className="text-[7px] font-bold text-slate-700">Tél: {shop.phone}</p>
            <p className="text-[7px] font-black text-slate-900 uppercase tracking-widest">ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-slate-900 text-white px-3 py-1 rounded-full inline-block mb-1">
            <h1 className="text-[8px] font-black uppercase tracking-widest">Facture</h1>
          </div>
          <p className="text-[8px] font-black text-slate-900">N°: {invoiceNo}</p>
          <p className="text-[7px] text-slate-400 font-bold italic">Date: {date}</p>
        </div>
      </div>

      {/* Client Info Block */}
      <div className="mb-6 bg-slate-100/80 p-3 rounded-2xl text-center space-y-2">
        <div className="grid grid-cols-3 gap-2 items-center">
          <div className="space-y-1">
            <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Client</p>
            <p className="text-[9px] font-black text-slate-900 uppercase">{clientName}</p>
          </div>
          <div className="space-y-1 border-x border-slate-200">
            <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Téléphone</p>
            <p className="text-[9px] font-black text-slate-900">{formatPhoneNumber(clientPhone)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Mutuelle</p>
            <p className="text-[9px] font-black text-slate-900 uppercase">{mutuelle}</p>
          </div>
        </div>
      </div>

      {/* Prescription Table */}
      <div className="mb-6">
        <h3 className="text-[7px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 border-b pb-1">
          Prescription Optique
        </h3>
        <table className="w-full text-[8px] border-collapse">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="border border-slate-300 p-1 text-left uppercase font-black">Oeil</th>
              <th className="border border-slate-300 p-1 text-center uppercase font-black">Sphère</th>
              <th className="border border-slate-300 p-1 text-center uppercase font-black">Cylindre</th>
              <th className="border border-slate-300 p-1 text-center uppercase font-black">Axe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 p-1.5 font-black text-slate-700">Droit (OD)</td>
              <td className="border border-slate-200 p-1.5 text-center font-bold">{od.sph}</td>
              <td className="border border-slate-200 p-1.5 text-center font-bold">{od.cyl}</td>
              <td className="border border-slate-200 p-1.5 text-center font-bold">{od.axe}</td>
            </tr>
            <tr>
              <td className="border border-slate-200 p-1.5 font-black text-slate-700">Gauche (OG)</td>
              <td className="border border-slate-200 p-1.5 text-center font-bold">{og.sph}</td>
              <td className="border border-slate-200 p-1.5 text-center font-bold">{og.cyl}</td>
              <td className="border border-slate-200 p-1.5 text-center font-bold">{og.axe}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-auto space-y-4">
        {/* Totals Block - Full Width */}
        <div className="w-full space-y-1.5 border-t pt-3">
          <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase">
            <span>Total Brut :</span>
            <span>{formatCurrency(total)}</span>
          </div>
          {remise > 0 && (
            <div className="flex justify-between text-[8px] text-destructive font-black uppercase">
              <span>Remise {remisePercent === "Fixe" ? "" : `(${remisePercent}%)`} :</span>
              <span>-{formatCurrency(remise)}</span>
            </div>
          )}
          <div className="flex justify-between text-[9px] text-slate-900 font-black uppercase">
            <span>Total Net :</span>
            <span>{formatCurrency(totalNet)}</span>
          </div>
          <div className="flex justify-between text-[9px] text-green-600 font-black uppercase">
            <span>Avance payée :</span>
            <span>{formatCurrency(avance)}</span>
          </div>
          
          <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 bg-slate-950 text-white p-3 rounded-xl mt-1">
            <span className="text-[8px] font-black uppercase tracking-widest">Total payé (Soldé)</span>
            <span className="text-lg font-black tracking-tighter">
              {formatCurrency(totalNet)}
            </span>
          </div>
        </div>
        
        {/* Message and Stamp Block */}
        <div className="flex justify-between items-center pr-2 mt-4">
          <div className="flex-1 pr-6 animate-in fade-in slide-in-from-left-4 duration-1000">
            <div className="border-l-4 border-primary/20 pl-4 py-1">
              <p className="text-[10px] font-medium text-primary/80 italic leading-relaxed">
                "Merci de votre confiance.<br/>
                Votre vue est notre priorité.<br/>
                À bientôt chez Like Vision !"
              </p>
            </div>
          </div>
          <div className="w-48 h-28 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center relative bg-slate-50/50 overflow-hidden shrink-0">
            <span className="text-[7px] uppercase text-slate-300 font-black rotate-[-15deg] text-center px-6 leading-relaxed select-none opacity-50">
              CACHET & SIGNATURE<br/>OFFICIELS DU MAGASIN
            </span>
          </div>
        </div>
      </div>

      {/* Footer with Extra Print Space (4cm) */}
      <div className="flex justify-center items-center mt-12 mb-24 pt-4 border-t border-slate-50">
         <p className="text-[6px] font-black text-slate-200 uppercase tracking-[0.5em]">{shop.name}</p>
      </div>
    </div>
  );

  if (settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

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
          <Button onClick={() => window.print()} className="bg-slate-900 shadow-2xl hover:bg-slate-800 px-12 h-12 text-base font-black rounded-xl text-white">
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
