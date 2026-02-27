
"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, Phone, User, Loader2, ThumbsUp } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, formatPhoneNumber } from "@/lib/utils";
import { Suspense } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
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
    <div className="pdf-a5-portrait bg-white flex flex-col p-[10mm] relative">
      <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative bg-white">
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
            <h2 className="text-xs font-black text-slate-900 uppercase leading-tight">{shop.name}</h2>
            <p className="text-[6px] text-slate-500 font-bold leading-tight">ICE: {shop.icePatent}</p>
            <p className="text-[6px] font-bold text-slate-700">Tél: {shop.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-slate-900 text-white px-3 py-1 rounded-lg inline-block mb-1">
            <h1 className="text-[8px] font-black uppercase tracking-widest">Reçu</h1>
          </div>
          <p className="text-[8px] font-black text-slate-900">N°: {receiptNo}</p>
          <p className="text-[6px] text-slate-400 font-bold italic">Date: {date}</p>
        </div>
      </div>

      <div className="mb-6 bg-slate-50 border-y border-slate-200 py-4 px-2 text-center grid grid-cols-2 gap-4 rounded-xl">
        <div>
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Client</p>
          <p className="text-[9px] font-black text-slate-900 uppercase leading-tight">{clientName}</p>
        </div>
        <div>
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Téléphone</p>
          <p className="text-[9px] font-black text-slate-900">{formatPhoneNumber(clientPhone)}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-[7px] font-black uppercase text-slate-400 mb-2 border-b pb-1 tracking-widest">
          Prescription Optique
        </h3>
        <table className="w-full text-[8px] border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="border border-slate-200 p-1 text-left uppercase font-black">Oeil</th>
              <th className="border border-slate-200 p-1 text-center uppercase font-black">Sph</th>
              <th className="border border-slate-200 p-1 text-center uppercase font-black">Cyl</th>
              <th className="border border-slate-200 p-1 text-center uppercase font-black">Axe</th>
              <th className="border border-slate-200 p-1 text-center uppercase font-black">ADD</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-100 p-1.5 font-bold">Droit (OD)</td>
              <td className="border border-slate-100 p-1.5 text-center font-black">{od.sph}</td>
              <td className="border border-slate-100 p-1.5 text-center font-black">{od.cyl}</td>
              <td className="border border-slate-100 p-1.5 text-center font-black">{od.axe}</td>
              <td className="border border-slate-100 p-1.5 text-center font-black">{od.add}</td>
            </tr>
            <tr>
              <td className="border border-slate-100 p-1.5 font-bold">Gauche (OG)</td>
              <td className="border border-slate-100 p-1.5 text-center font-black">{og.sph}</td>
              <td className="border border-slate-100 p-1.5 text-center font-black">{og.cyl}</td>
              <td className="border border-slate-100 p-1.5 text-center font-black">{og.axe}</td>
              <td className="border border-slate-100 p-1.5 text-center font-black">{og.add}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-6">
        <h3 className="text-[7px] font-black uppercase text-slate-400 mb-2 border-b pb-1 tracking-widest">Historique des Versements</h3>
        <table className="w-full text-[8px]">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="p-1.5 text-left uppercase font-black">Date</th>
              <th className="p-1.5 text-right uppercase font-black">Montant</th>
            </tr>
          </thead>
          <tbody>
            {saleData?.payments && saleData.payments.length > 0 ? (
              saleData.payments.map((p: any, i: number) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="p-1.5 font-bold text-slate-600">
                    {p.date ? (typeof p.date === 'string' ? new Date(p.date).toLocaleDateString("fr-FR") : p.date.toDate().toLocaleDateString("fr-FR")) : date}
                  </td>
                  <td className="p-1.5 text-right font-black text-slate-900">{formatCurrency(p.amount)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-slate-50">
                <td className="p-1.5 font-bold text-slate-600">{date}</td>
                <td className="p-1.5 text-right font-black text-slate-900">{formatCurrency(avance)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-auto space-y-4">
        <div className="w-full space-y-1.5 border-t pt-3">
          <div className="flex justify-between text-[8px] text-slate-500 font-bold uppercase">
            <span>Total Commande :</span>
            <span>{formatCurrency(totalNet)}</span>
          </div>
          <div className="flex justify-between text-[8px] text-green-600 font-black uppercase">
            <span>Total déjà payé :</span>
            <span>{formatCurrency(avance)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900 bg-slate-950 text-white p-3 rounded-xl mt-1">
            <span className="text-[8px] font-black uppercase tracking-widest">Reste à Régler</span>
            <span className="text-lg font-black tracking-tighter">{formatCurrency(reste)}</span>
          </div>
        </div>

        <div className="flex justify-between items-end pr-2 mt-4">
          <div className="flex-1 pr-6 animate-in fade-in slide-in-from-left-4 duration-1000">
            <div className="border-l-4 border-primary/20 pl-4 py-1.5">
              <p className="text-[9px] font-medium text-primary/80 italic leading-relaxed">
                "Merci de votre confiance.<br/>
                Votre vue est notre priorité.<br/>
                À bientôt chez Like Vision !"
              </p>
            </div>
          </div>
          <div className="w-40 h-24 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-white shrink-0">
            <span className="text-[6px] uppercase font-black text-slate-300 rotate-[-15deg] opacity-50 text-center px-4 leading-tight">CACHET & SIGNATURE<br/>OFFICIELS</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center items-center mt-12 mb-24 pt-4 border-t border-slate-50 text-center">
        <p className="text-[6px] font-black text-slate-200 uppercase tracking-[0.5em] italic">{shop.name}</p>
      </div>
    </div>
  );

  if (settingsLoading || saleLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-8">
      <div className="no-print w-[297mm] flex justify-between mb-8 px-4">
        <Button variant="outline" asChild className="bg-white rounded-xl font-black text-xs h-12 px-8 shadow-sm border-slate-200"><Link href="/ventes"><ArrowLeft className="mr-3 h-5 w-5" />RETOUR HISTORIQUE</Link></Button>
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-black uppercase text-slate-500 bg-white px-6 py-3 rounded-full border shadow-sm tracking-widest">
            A4 Paysage • 2 Copies A5
          </span>
          <Button onClick={() => window.print()} className="bg-slate-900 px-12 h-12 font-black rounded-xl text-white shadow-2xl"><Printer className="mr-3 h-5 w-5" />IMPRIMER</Button>
        </div>
      </div>
      <div className="pdf-a4-landscape shadow-2xl overflow-hidden print:shadow-none bg-white print:m-0 border border-slate-200">
        <ReceiptCopy />
        <div className="cutting-line-vertical" />
        <ReceiptCopy />
      </div>
    </div>
  );
}

export default function ReceiptPrintPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}><ReceiptPrintContent /></Suspense>;
}
