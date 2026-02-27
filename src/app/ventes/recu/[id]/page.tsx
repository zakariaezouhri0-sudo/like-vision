"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, Loader2, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPhoneNumber } from "@/lib/utils";
import { Suspense } from "react";
import { useFirestore, useMemoFirebase, useCollection } from "@/firebase";
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
      {/* Header Compact */}
      <div className="flex justify-between items-start mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white">
            {shop.logoUrl ? (
              <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <div className="relative text-primary">
                <Glasses className="h-6 w-6" />
                <ThumbsUp className="h-3 w-3 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" />
              </div>
            )}
          </div>
          <div className="text-left">
            <h2 className="text-[10px] font-black text-slate-900 uppercase leading-tight tracking-tighter">{shop.name}</h2>
            <p className="text-[5px] font-bold text-slate-700 leading-none">ICE: {shop.icePatent} • Tél: {shop.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-slate-900 text-white px-2 py-0.5 rounded-md inline-block mb-1">
            <h1 className="text-[7px] font-black uppercase tracking-widest">Reçu</h1>
          </div>
          <p className="text-[7px] font-black text-slate-900 leading-none">N°: {receiptNo}</p>
          <p className="text-[6px] text-slate-400 font-bold italic">Date: {date}</p>
        </div>
      </div>

      {/* Client Info Compact */}
      <div className="mb-4 bg-slate-50 border-y border-slate-200 py-2 px-1 text-center grid grid-cols-2 gap-2 rounded-lg">
        <div>
          <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest">Client</p>
          <p className="text-[8px] font-black text-slate-900 uppercase leading-tight truncate">{clientName}</p>
        </div>
        <div>
          <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest">Téléphone</p>
          <p className="text-[8px] font-black text-slate-900">{formatPhoneNumber(clientPhone)}</p>
        </div>
      </div>

      {/* Prescription Compact */}
      <div className="mb-4">
        <h3 className="text-[6px] font-black uppercase text-slate-400 mb-1 border-b pb-0.5 tracking-widest">Prescription Optique</h3>
        <table className="w-full text-[7px] border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-[6px]">
              <th className="border border-slate-200 p-0.5 text-left w-[24%] uppercase">Oeil</th>
              <th className="border border-slate-200 p-0.5 text-center w-[19%] uppercase">Sph</th>
              <th className="border border-slate-200 p-0.5 text-center w-[19%] uppercase">Cyl</th>
              <th className="border border-slate-200 p-0.5 text-center w-[19%] uppercase">Axe</th>
              <th className="border border-slate-200 p-0.5 text-center w-[19%] uppercase">ADD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-100 p-1 font-bold">Droit (OD)</td>
              <td className="border border-slate-100 p-1 text-center font-black">{od.sph}</td>
              <td className="border border-slate-100 p-1 text-center font-black">{od.cyl}</td>
              <td className="border border-slate-100 p-1 text-center font-black">{od.axe}</td>
              <td className="border border-slate-100 p-1 text-center font-black">{od.add}</td>
            </tr>
            <tr>
              <td className="border border-slate-100 p-1 font-bold">Gauche (OG)</td>
              <td className="border border-slate-100 p-1 text-center font-black">{og.sph}</td>
              <td className="border border-slate-100 p-1 text-center font-black">{og.cyl}</td>
              <td className="border border-slate-100 p-1 text-center font-black">{og.axe}</td>
              <td className="border border-slate-100 p-1 text-center font-black">{og.add}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payments Compact */}
      <div className="mb-4">
        <h3 className="text-[6px] font-black uppercase text-slate-400 mb-1 border-b pb-0.5 tracking-widest">Historique Versements</h3>
        <table className="w-full text-[7px]">
          <thead className="bg-slate-50 text-slate-500 text-[6px]">
            <tr><th className="p-0.5 text-left uppercase">Date</th><th className="p-0.5 text-right uppercase">Montant</th></tr>
          </thead>
          <tbody>
            {saleData?.payments && saleData.payments.length > 0 ? (
              saleData.payments.map((p: any, i: number) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-0.5 font-bold text-slate-600">
                    {p.date ? (typeof p.date === 'string' ? new Date(p.date).toLocaleDateString("fr-FR") : p.date.toDate().toLocaleDateString("fr-FR")) : date}
                  </td>
                  <td className="p-0.5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(p.amount)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-slate-50">
                <td className="p-0.5 font-bold text-slate-600">{date}</td>
                <td className="p-0.5 text-right font-black text-slate-900 tabular-nums">{formatCurrency(avance)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Totals Area Compact */}
      <div className="mt-auto space-y-2">
        <div className="w-full space-y-1 border-t pt-2">
          <div className="flex justify-between text-[7px] text-slate-500 font-bold uppercase">
            <span>Commande :</span><span className="tabular-nums">{formatCurrency(totalNet)}</span>
          </div>
          <div className="flex justify-between text-[7px] text-green-600 font-black uppercase">
            <span>Déjà payé :</span><span className="tabular-nums">{formatCurrency(avance)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900 bg-slate-950 text-white p-2 rounded-lg mt-1">
            <span className="text-[7px] font-black uppercase tracking-widest">Reste à Régler</span>
            <span className="text-base font-black tracking-tighter tabular-nums">{formatCurrency(reste)}</span>
          </div>
        </div>

        {/* Signature Area Compact */}
        <div className="flex justify-between items-end mt-2">
          <div className="flex-1 pr-4">
            <div className="border-l-2 border-primary/20 pl-2 py-1">
              <p className="text-[7px] font-medium text-primary/80 italic leading-tight">Merci de votre confiance. Votre vue est notre priorité !</p>
            </div>
          </div>
          <div className="w-32 h-16 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-white shrink-0">
            <span className="text-[6px] uppercase font-black text-slate-200 rotate-[-15deg] opacity-50 text-center px-4 leading-none">CACHET & SIGNATURE</span>
          </div>
        </div>
      </div>

      {/* Footer Minimalist */}
      <div className="mt-4 pt-2 border-t border-slate-50 text-center">
        <p className="text-[5px] font-black text-slate-200 uppercase tracking-[0.5em] italic">{shop.name}</p>
      </div>
    </div>
  );

  if (settingsLoading || saleLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-4">
      <div className="no-print w-[297mm] flex justify-between mb-4 px-4">
        <Button variant="outline" asChild className="bg-white rounded-xl font-black text-xs h-10 px-6 shadow-sm border-slate-200">
          <Link href="/ventes"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR</Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-slate-900 px-10 h-10 text-sm font-black rounded-xl text-white shadow-2xl"><Printer className="mr-2 h-4 w-4" /> IMPRIMER</Button>
      </div>
      <div className="pdf-a4-landscape shadow-none overflow-hidden print:shadow-none bg-white print:m-0 border border-slate-200">
        <ReceiptCopy /><div className="cutting-line-vertical" /><ReceiptCopy />
      </div>
    </div>
  );
}

export default function ReceiptPrintPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}><ReceiptPrintContent /></Suspense>;
}
