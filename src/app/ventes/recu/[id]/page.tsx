"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, Loader2, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPhoneNumber } from "@/lib/utils";
import { Suspense } from "react";
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";

function ReceiptPrintContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const db = useFirestore();

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

  const salesQuery = useMemoFirebase(() => query(collection(db, "sales"), where("invoiceId", "==", params.id)), [db, params.id]);
  const { data: saleDocs, isLoading: saleLoading } = useCollection(salesQuery);
  const saleData = saleDocs?.[0];

  const shop = {
    name: remoteSettings?.name || DEFAULT_SHOP_SETTINGS.name,
    address: remoteSettings?.address || DEFAULT_SHOP_SETTINGS.address,
    phone: remoteSettings?.phone || DEFAULT_SHOP_SETTINGS.phone,
    icePatent: remoteSettings?.icePatent || DEFAULT_SHOP_SETTINGS.icePatent,
    logoUrl: remoteSettings?.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
  };

  const clientName = searchParams.get("client") || saleData?.clientName || "Client";
  const clientPhone = searchParams.get("phone") || saleData?.clientPhone || "---";
  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const receiptNo = params.id as string;
  const total = Number(searchParams.get("total")) || saleData?.total || 0;
  const remise = Number(searchParams.get("remise")) || saleData?.remise || 0;
  const avance = Number(searchParams.get("avance")) || saleData?.avance || 0;
  const monture = searchParams.get("monture") || saleData?.monture || "";
  const verres = searchParams.get("verres") || saleData?.verres || "";
  const totalNet = Math.max(0, total - remise);
  const reste = Math.max(0, totalNet - avance);

  const od = {
    sph: searchParams.get("od_sph") || saleData?.prescription?.od?.sph || "---",
    cyl: searchParams.get("od_cyl") || saleData?.prescription?.od?.cyl || "---",
    axe: searchParams.get("od_axe") || saleData?.prescription?.od?.axe || "---",
    add: searchParams.get("od_add") || saleData?.prescription?.od?.add || "---"
  };
  const og = {
    sph: searchParams.get("og_sph") || saleData?.prescription?.og?.sph || "---",
    cyl: searchParams.get("og_cyl") || saleData?.prescription?.og?.cyl || "---",
    axe: searchParams.get("og_axe") || saleData?.prescription?.og?.axe || "---",
    add: searchParams.get("og_add") || saleData?.prescription?.og?.add || "---"
  };

  const ReceiptCopy = () => (
    <div className="pdf-a5-portrait bg-white flex flex-col p-[8mm] relative h-[210mm] max-h-[210mm] overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <div className="relative text-primary">
                <Glasses className="h-7 w-7" />
                <ThumbsUp className="h-3 w-3 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" />
              </div>
            )}
          </div>
          <div className="text-left">
            <h2 className="text-xs font-black text-slate-900 uppercase leading-tight tracking-tighter">{shop.name}</h2>
            <p className="text-[6px] font-black text-slate-500 leading-none mt-1 uppercase tracking-widest">ICE: {shop.icePatent} • Tél: {shop.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-slate-950 text-white px-3 py-1 rounded-md inline-block mb-1.5">
            <h1 className="text-[8px] font-black uppercase tracking-[0.2em]">Reçu</h1>
          </div>
          <p className="text-[9px] font-black text-slate-900 leading-none">N°: {receiptNo}</p>
          <p className="text-[7px] text-slate-400 font-bold italic mt-1">Date: {date}</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="mb-6 bg-slate-50 border border-slate-200 py-3 px-2 grid grid-cols-2 gap-4 rounded-xl shadow-inner">
        <div className="px-3">
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Client</p>
          <p className="text-[10px] font-black text-slate-900 uppercase leading-tight truncate">{clientName}</p>
        </div>
        <div className="px-3 border-l border-slate-200">
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Téléphone</p>
          <p className="text-[10px] font-black text-slate-900 tabular-nums">{formatPhoneNumber(clientPhone)}</p>
        </div>
      </div>

      {/* Détails Équipement - NEW SECTION */}
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
            <tr className="bg-slate-100 text-slate-600">
              <th className="border border-slate-200 p-1.5 text-left w-[24%] uppercase tracking-widest">Oeil</th>
              <th className="border border-slate-200 p-1.5 text-center w-[19%] uppercase">Sph</th>
              <th className="border border-slate-200 p-1.5 text-center w-[19%] uppercase">Cyl</th>
              <th className="border border-slate-200 p-1.5 text-center w-[19%] uppercase">Axe</th>
              <th className="border border-slate-200 p-1.5 text-center w-[19%] uppercase">ADD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-100 p-2 font-black text-slate-700">Droit (OD)</td>
              <td className="border border-slate-100 p-2 text-center font-black tabular-nums">{od.sph}</td>
              <td className="border border-slate-100 p-2 text-center font-black tabular-nums">{od.cyl}</td>
              <td className="border border-slate-100 p-2 text-center font-black tabular-nums">{od.axe}</td>
              <td className="border border-slate-100 p-2 text-center font-black tabular-nums">{od.add}</td>
            </tr>
            <tr className="bg-slate-50/30">
              <td className="border border-slate-100 p-2 font-black text-slate-700">Gauche (OG)</td>
              <td className="border border-slate-100 p-2 text-center font-black tabular-nums">{og.sph}</td>
              <td className="border border-slate-100 p-2 text-center font-black tabular-nums">{og.cyl}</td>
              <td className="border border-slate-100 p-2 text-center font-black tabular-nums">{og.axe}</td>
              <td className="border border-slate-100 p-2 text-center font-black tabular-nums">{og.add}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Historique Versements */}
      <div className="mb-6">
        <h3 className="text-[7px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1 tracking-widest">Historique Versements</h3>
        <table className="w-full text-[8px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="p-1.5 text-left uppercase tracking-widest">Date</th><th className="p-1.5 text-right uppercase tracking-widest">Montant</th></tr>
          </thead>
          <tbody>
            {saleData?.payments && saleData.payments.length > 0 ? (
              saleData.payments.map((p: any, i: number) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-1.5 font-bold text-slate-600">
                    {p.date ? (typeof p.date === 'string' ? new Date(p.date).toLocaleDateString("fr-FR") : p.date.toDate().toLocaleDateString("fr-FR")) : date}
                  </td>
                  <td className="p-1.5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(p.amount)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-slate-50">
                <td className="p-1.5 font-bold text-slate-600">{date}</td>
                <td className="p-1.5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(avance)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Area */}
      <div className="mt-auto space-y-3">
        <div className="w-full space-y-1.5 border-t border-slate-200 pt-4">
          <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase tracking-widest px-1">
            <span>Commande :</span><span className="tabular-nums font-black">{formatCurrency(totalNet)}</span>
          </div>
          <div className="flex justify-between text-[8px] text-green-600 font-black uppercase tracking-widest px-1">
            <span>Déjà payé :</span><span className="tabular-nums font-black">{formatCurrency(avance)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 bg-slate-950 text-white p-3 rounded-xl mt-2 shadow-lg">
            <span className="text-[8px] font-black uppercase tracking-[0.3em]">Reste à Régler</span>
            <span className="text-lg font-black tracking-tighter tabular-nums">{formatCurrency(reste)}</span>
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
        <p className="text-[6px] font-black text-slate-200 uppercase tracking-[0.6em] italic leading-none">{shop.name} • SYSTÈME LIKE VISION</p>
      </div>
    </div>
  );

  if (settingsLoading || saleLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 print:py-0">
      <div className="no-print w-[297mm] flex justify-between mb-6 px-4">
        <Button variant="outline" asChild className="bg-white rounded-2xl font-black text-sm h-12 px-8 shadow-sm border-slate-200">
          <Link href="/ventes"><ArrowLeft className="mr-3 h-5 w-5" /> RETOUR</Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-slate-950 px-12 h-12 text-base font-black rounded-2xl text-white shadow-2xl hover:scale-105 transition-transform"><Printer className="mr-3 h-5 w-5" /> IMPRIMER LES COPIES</Button>
      </div>
      <div className="pdf-a4-landscape shadow-2xl overflow-hidden print:shadow-none bg-white print:m-0 border border-slate-200 rounded-sm">
        <ReceiptCopy /><div className="cutting-line-vertical" /><ReceiptCopy />
      </div>
    </div>
  );
}

export default function ReceiptPrintPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}><ReceiptPrintContent /></Suspense>;
}
