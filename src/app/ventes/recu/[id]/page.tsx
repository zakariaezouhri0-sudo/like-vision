
"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, Phone, User, Loader2 } from "lucide-react";
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
  const { data: saleDocs } = useCollection(salesQuery);
  const saleData = saleDocs?.[0];

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
  const receiptNo = params.id as string;
  const total = Number(searchParams.get("total")) || 0;
  const remise = Number(searchParams.get("remise")) || 0;
  const avance = Number(searchParams.get("avance")) || 0;
  
  const totalNet = Math.max(0, total - remise);
  const reste = Math.max(0, totalNet - avance);

  const ReceiptCopy = () => (
    <div className="pdf-a5-portrait bg-white flex flex-col p-[15mm] relative">
      <div className="flex justify-between items-start mb-8 pb-4 border-b border-slate-100">
        <div className="flex gap-3">
          <div className="h-12 w-12 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden relative">
            {shop.logoUrl ? (
              <Image src={shop.logoUrl} alt="Logo" fill className="object-contain p-1" />
            ) : (
              <div className="text-primary"><Glasses className="h-6 w-6" /></div>
            )}
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase leading-tight">{shop.name}</h2>
            <p className="text-[7px] text-slate-500 font-bold leading-tight">ICE: {shop.icePatent}</p>
            <p className="text-[7px] font-bold text-slate-700">Tél: {shop.phone}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-primary text-white px-3 py-1 rounded-lg inline-block mb-1">
            <h1 className="text-[8px] font-black uppercase tracking-widest">Reçu</h1>
          </div>
          <p className="text-[8px] font-black text-slate-900">N°: {receiptNo}</p>
          <p className="text-[7px] text-slate-400 font-bold italic">Date: {date}</p>
        </div>
      </div>

      <div className="mb-6 bg-slate-50 p-4 rounded-xl text-center grid grid-cols-2 gap-4">
        <div>
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Client</p>
          <p className="text-[10px] font-black text-slate-900 uppercase">{clientName}</p>
        </div>
        <div>
          <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Téléphone</p>
          <p className="text-[10px] font-black text-slate-900">{formatPhoneNumber(clientPhone)}</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-[7px] font-black uppercase text-slate-400 mb-2 border-b pb-1 tracking-widest">Historique des Versements</h3>
        <table className="w-full text-[8px]">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-1.5 text-left uppercase">Date</th>
              <th className="p-1.5 text-right uppercase">Montant</th>
            </tr>
          </thead>
          <tbody>
            {saleData?.payments ? saleData.payments.map((p: any, i: number) => (
              <tr key={i} className="border-b border-slate-50">
                <td className="p-1.5 font-bold text-slate-600">
                  {p.date ? (typeof p.date === 'string' ? new Date(p.date).toLocaleDateString("fr-FR") : p.date.toDate().toLocaleDateString("fr-FR")) : '---'}
                </td>
                <td className="p-1.5 text-right font-black text-slate-900">{formatCurrency(p.amount)}</td>
              </tr>
            )) : (
              <tr>
                <td className="p-1.5 font-bold text-slate-600">{date}</td>
                <td className="p-1.5 text-right font-black text-slate-900">{formatCurrency(avance)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-auto space-y-2 border-t pt-4">
        <div className="flex justify-between text-[8px] text-slate-500 font-bold">
          <span>Total de la commande :</span>
          <span>{formatCurrency(totalNet)}</span>
        </div>
        <div className="flex justify-between text-[8px] text-green-600 font-black">
          <span>Total déjà payé :</span>
          <span>{formatCurrency(avance)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t-2 border-slate-900 bg-slate-950 text-white p-3 rounded-xl">
          <span className="text-[7px] font-black uppercase tracking-widest">Reste à Régler</span>
          <span className="text-sm font-black tracking-tighter">{formatCurrency(reste)}</span>
        </div>
      </div>

      <div className="flex justify-between items-end mt-8">
        <div className="text-[6px] text-slate-400 italic">Cachet du magasin requis pour validation.</div>
        <div className="w-24 h-16 border border-dashed border-slate-200 rounded-lg flex items-center justify-center bg-slate-50/50">
          <span className="text-[5px] uppercase font-black text-slate-300 rotate-[-15deg]">Cachet</span>
        </div>
      </div>
    </div>
  );

  if (settingsLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8">
      <div className="no-print w-[297mm] flex justify-between mb-8 px-4">
        <Button variant="outline" asChild className="bg-white rounded-xl font-black text-xs h-12 px-8"><Link href="/ventes"><ArrowLeft className="mr-3 h-5 w-5" />RETOUR</Link></Button>
        <Button onClick={() => window.print()} className="bg-slate-900 px-12 h-12 font-black rounded-xl text-white"><Printer className="mr-3 h-5 w-5" />IMPRIMER</Button>
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
