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
  const rawDate = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const dateDisplay = rawDate.includes("à") ? rawDate : rawDate.replace(" ", " à ");
  
  const receiptNo = params.id as string;
  const total = Number(searchParams.get("total")) || saleData?.total || 0;
  const remise = Number(searchParams.get("remise")) || saleData?.remise || 0;
  const avance = Number(searchParams.get("avance")) || saleData?.avance || 0;
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
      <div className="flex justify-between items-start mb-8 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <div className="relative text-primary">
                <Glasses className="h-8 w-8" />
                <ThumbsUp className="h-3 w-3 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" />
              </div>
            )}
          </div>
          <div className="text-left">
            <h2 className="text-sm font-black text-slate-900 uppercase leading-tight tracking-tighter">{shop.name}</h2>
            <p className="text-[7px] font-black text-slate-500 leading-none mt-1 uppercase tracking-widest">ICE: {shop.icePatent} • Tél: {shop.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-white text-slate-950 border border-slate-950 px-3 py-1.5 rounded-md inline-block mb-1.5">
            <h1 className="text-[9px] font-black uppercase tracking-[0.2em]">Reçu</h1>
          </div>
          <p className="text-[10px] font-black text-slate-900 leading-none">N°: {receiptNo}</p>
          <p className="text-[8px] text-slate-400 font-bold italic mt-1.5">Date: {dateDisplay}</p>
        </div>
      </div>

      {/* Client Info - Centered */}
      <div className="mb-10 bg-slate-50 border border-slate-200 py-4 px-4 flex justify-around items-center rounded-2xl shadow-inner">
        <div className="text-center px-4">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Client</p>
          <p className="text-[10px] font-black text-slate-900 uppercase leading-tight">{clientName}</p>
        </div>
        <div className="h-6 w-px bg-slate-200"></div>
        <div className="text-center px-4">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Téléphone</p>
          <p className="text-[10px] font-black text-slate-900 tabular-nums">{formatPhoneNumber(clientPhone)}</p>
        </div>
      </div>

      {/* Prescription Table - Centered & Enlarged */}
      <div className="mb-10">
        <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-[0.3em] mb-3 text-center border-b border-slate-100 pb-1.5">Prescription Optique</h3>
        <table className="w-full text-[11px] border-collapse table-fixed shadow-sm rounded-lg overflow-hidden border border-slate-200">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="border border-slate-200 p-2 text-left w-[24%] uppercase tracking-widest">Oeil</th>
              <th className="border border-slate-200 p-2 text-center w-[19%] uppercase">Sph</th>
              <th className="border border-slate-200 p-2 text-center w-[19%] uppercase">Cyl</th>
              <th className="border border-slate-200 p-2 text-center w-[19%] uppercase">Axe</th>
              <th className="border border-slate-200 p-2 text-center w-[19%] uppercase">ADD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-100 p-3 font-black text-slate-700">Droit (OD)</td>
              <td className="border border-slate-100 p-3 text-center font-black tabular-nums text-base">{od.sph}</td>
              <td className="border border-slate-100 p-3 text-center font-black tabular-nums text-base">{od.cyl}</td>
              <td className="border border-slate-100 p-3 text-center font-black tabular-nums text-base">{od.axe}</td>
              <td className="border border-slate-100 p-3 text-center font-black tabular-nums text-base">{od.add}</td>
            </tr>
            <tr className="bg-slate-50/30">
              <td className="border border-slate-100 p-3 font-black text-slate-700">Gauche (OG)</td>
              <td className="border border-slate-100 p-3 text-center font-black tabular-nums text-base">{og.sph}</td>
              <td className="border border-slate-100 p-3 text-center font-black tabular-nums text-base">{og.cyl}</td>
              <td className="border border-slate-100 p-3 text-center font-black tabular-nums text-base">{og.axe}</td>
              <td className="border border-slate-100 p-3 text-center font-black tabular-nums text-base">{og.add}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Historique Versements */}
      <div className="mb-8 flex-1">
        <h3 className="text-[8px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1 tracking-widest">Historique Versements</h3>
        <table className="w-full text-[9px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr><th className="p-2 text-left uppercase tracking-widest">Date</th><th className="p-2 text-right uppercase tracking-widest">Montant</th></tr>
          </thead>
          <tbody>
            {saleData?.payments && saleData.payments.length > 0 ? (
              saleData.payments.map((p: any, i: number) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-2 font-bold text-slate-600">
                    {p.date ? (typeof p.date === 'string' ? p.date.includes("à") ? p.date : p.date.replace(" ", " à ") : p.date.toDate().toLocaleString("fr-FR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(' ', ' à ')) : dateDisplay}
                  </td>
                  <td className="p-2 text-right font-black text-slate-900 tabular-nums">{formatCurrency(p.amount)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-slate-50">
                <td className="p-2 font-bold text-slate-600">{dateDisplay}</td>
                <td className="p-2 text-right font-black text-slate-900 tabular-nums">{formatCurrency(avance)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Area */}
      <div className="space-y-4">
        <div className="w-full space-y-2 border-t border-slate-200 pt-6">
          <div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-widest px-2">
            <span>Commande :</span><span className="tabular-nums font-black">{formatCurrency(totalNet)}</span>
          </div>
          <div className="flex justify-between text-[9px] text-green-600 font-black uppercase tracking-widest px-2">
            <span>Déjà payé :</span><span className="tabular-nums font-black">{formatCurrency(avance)}</span>
          </div>
          <div className="flex justify-between items-center pt-4 border border-slate-300 bg-slate-50 text-slate-950 p-4 rounded-2xl mt-2">
            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Reste à Régler</span>
            <span className="text-xl font-black tracking-tighter tabular-nums">{formatCurrency(reste)}</span>
          </div>
        </div>

        {/* Signature Area */}
        <div className="flex justify-between items-end mt-4">
          <div className="flex-1 pr-8">
            <div className="border-l-4 border-primary/20 pl-4 py-3 bg-slate-50/50 rounded-r-2xl">
              <p className="text-[11px] font-black text-primary/80 italic leading-tight">Merci de votre confiance.<br/>Votre vue est notre priorité absolue !</p>
            </div>
          </div>
          <div className="w-48 h-24 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center relative bg-white overflow-hidden shrink-0 shadow-sm">
            <span className="text-[8px] uppercase text-slate-300 font-black rotate-[-15deg] text-center px-4 leading-none select-none opacity-40">CACHET & SIGNATURE</span>
          </div>
        </div>
      </div>

      {/* Footer Margin: 3cm empty space at the bottom */}
      <div className="h-[30mm] w-full shrink-0"></div>
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
