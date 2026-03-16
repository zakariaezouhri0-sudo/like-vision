
"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, Loader2, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatPhoneNumber, roundAmount } from "@/lib/utils";
import { Suspense, useEffect, useState } from "react";
import { useFirestore, useMemoFirebase, useCollection, useDoc } from "@/firebase";
import { doc, collection, query, where } from "firebase/firestore";
import { format, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";

function ReceiptPrintContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const [role, setRole] = useState<string>("OPTICIENNE");

  useEffect(() => {
    setRole(localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE");
  }, []);

  const isPrepaMode = role === "PREPA";

  const getParam = (key: string) => {
    const val = searchParams.get(key);
    if (!val || val === "undefined" || val === "null" || val.trim() === "") return "---";
    return val;
  };

  const receiptNo = params.id as string || "---";
  const rawDate = getParam("date");
  let dateDisplay = "---";
  try {
    const cleanDate = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.split(' ')[0];
    const d = rawDate.includes('-') ? parseISO(cleanDate) : null;
    if (d && isValid(d)) {
      dateDisplay = format(d, "dd MMMM yyyy", { locale: fr });
    } else if (rawDate !== "---") {
      dateDisplay = rawDate;
    }
  } catch (e) {}

  useEffect(() => {
    document.title = `Like Vision - ${receiptNo}`;
    return () => { document.title = "Like Vision"; };
  }, [receiptNo]);

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

  const salesQuery = useMemoFirebase(() => 
    query(collection(db, "sales"), 
    where("invoiceId", "==", params.id),
    where("isDraft", "==", isPrepaMode)
  ), [db, params.id, isPrepaMode]);
  
  const { data: saleDocs, isLoading: saleLoading } = useCollection(salesQuery);
  const saleData = saleDocs?.[0];

  const shop = {
    name: remoteSettings?.name || DEFAULT_SHOP_SETTINGS.name,
    address: remoteSettings?.address || DEFAULT_SHOP_SETTINGS.address,
    phone: remoteSettings?.phone || DEFAULT_SHOP_SETTINGS.phone,
    icePatent: remoteSettings?.icePatent || DEFAULT_SHOP_SETTINGS.icePatent,
    logoUrl: remoteSettings?.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
  };

  const clientName = getParam("client") !== "---" ? getParam("client") : (saleData?.clientName || "---");
  const clientPhone = getParam("phone") !== "---" ? getParam("phone") : (saleData?.clientPhone || "---");
  
  const total = roundAmount(Number(searchParams.get("total")) || saleData?.total || 0);
  const remise = roundAmount(Number(searchParams.get("remise")) || saleData?.remise || 0);
  const avance = roundAmount(Number(searchParams.get("avance")) || saleData?.avance || 0);
  const totalNet = roundAmount(Math.max(0, total - remise));
  const reste = roundAmount(Math.max(0, totalNet - avance));

  const od = {
    sph: getParam("od_sph") !== "---" ? getParam("od_sph") : (saleData?.prescription?.od?.sph || "---"),
    cyl: getParam("od_cyl") !== "---" ? getParam("od_cyl") : (saleData?.prescription?.od?.cyl || "---"),
    axe: getParam("od_axe") !== "---" ? getParam("od_axe") : (saleData?.prescription?.od?.axe || "---"),
    add: getParam("od_add") !== "---" ? getParam("od_add") : (saleData?.prescription?.od?.add || "---")
  };
  const og = {
    sph: getParam("og_sph") !== "---" ? getParam("og_sph") : (saleData?.prescription?.og?.sph || "---"),
    cyl: getParam("og_cyl") !== "---" ? getParam("og_cyl") : (saleData?.prescription?.og?.cyl || "---"),
    axe: getParam("og_axe") !== "---" ? getParam("og_axe") : (saleData?.prescription?.og?.axe || "---"),
    add: getParam("og_add") !== "---" ? getParam("og_add") : (saleData?.prescription?.og?.add || "---")
  };

  const ReceiptCopy = () => (
    <div className="pdf-a5-portrait bg-white flex flex-col p-[8mm] relative h-[210mm] max-h-[210mm] overflow-hidden">
      <div className="flex justify-between items-start mb-8 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 border border-slate-200 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-sm">{shop.logoUrl ? (<img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />) : (<div className="relative text-primary"><Glasses className="h-8 w-8" /><ThumbsUp className="h-3 w-3 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" /></div>)}</div>
          <div className="text-left"><h2 className="text-sm font-black text-slate-900 uppercase leading-tight tracking-tighter">{shop.name || "---"}</h2><p className="text-[7px] font-black text-slate-500 leading-none mt-1 uppercase tracking-widest">{shop.address || "---"}</p><p className="text-[7px] font-black text-slate-500 leading-none mt-1 uppercase tracking-widest">ICE: {shop.icePatent || "---"} • Tél: {shop.phone || "---"}</p></div>
        </div>
        <div className="text-right"><div className="bg-white text-slate-950 border border-slate-950 px-3 py-1.5 rounded-md inline-block mb-1.5"><h1 className="text-[9px] font-black uppercase tracking-[0.2em]">Reçu</h1></div><p className="text-[10px] font-black text-slate-900 leading-none">N°: {receiptNo}</p><p className="text-[8px] text-slate-400 font-bold italic mt-1.5 uppercase">Date: {dateDisplay}</p></div>
      </div>

      <div className="mb-10 bg-slate-50 border border-slate-200 py-4 px-4 flex justify-around items-center rounded-2xl shadow-inner"><div className="text-center px-4"><p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Client</p><p className="text-[10px] font-black text-slate-900 uppercase leading-tight">{clientName}</p></div><div className="h-6 w-px bg-slate-200"></div><div className="text-center px-4"><p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Téléphone</p><p className="text-[10px] font-black text-slate-900 tabular-nums">{clientPhone === "---" ? "---" : formatPhoneNumber(clientPhone)}</p></div></div>

      <div className="mb-10">
        <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-[0.3em] mb-3 text-center border-b border-slate-100 pb-1.5">Prescription Optique</h3>
        <table className="w-full border-collapse table-fixed shadow-sm rounded-lg overflow-hidden border border-slate-200">
          <thead className="bg-[#064e3b] text-white border-b border-slate-900"><tr className="bg-[#064e3b] text-white border-b border-slate-900"><th className="border border-slate-700 p-1.5 text-left w-[24%] uppercase tracking-widest text-[8px]">Oeil</th><th className="border border-slate-700 p-1.5 text-center w-[19%] uppercase text-[8px]">Sph</th><th className="border border-slate-700 p-1.5 text-center w-[19%] uppercase text-[8px]">Cyl</th><th className="border border-slate-700 p-1.5 text-center w-[19%] uppercase text-[8px]">Axe</th><th className="border border-slate-700 p-1.5 text-center w-[19%] uppercase text-[8px]">ADD</th></tr></thead>
          <tbody>
            <tr><td className="border border-slate-100 p-1 font-black text-slate-700 text-[10px]">Droit (OD)</td><td className="border border-slate-100 p-1 text-center font-black tabular-nums text-[10px]">{od.sph}</td><td className="border border-slate-100 p-1 text-center font-black tabular-nums text-[10px]">{od.cyl}</td><td className="border border-slate-100 p-1 text-center font-black tabular-nums text-[10px]">{od.axe}</td><td className="border border-slate-100 p-1 text-center font-black tabular-nums text-[10px]">{od.add}</td></tr>
            <tr className="bg-slate-50/30"><td className="border border-slate-100 p-1 font-black text-slate-700 text-[10px]">Gauche (OG)</td><td className="border border-slate-100 p-1 text-center font-black tabular-nums text-[10px]">{og.sph}</td><td className="border border-slate-100 p-1 text-center font-black tabular-nums text-[10px]">{og.cyl}</td><td className="border border-slate-100 p-1 text-center font-black tabular-nums text-[10px]">{og.axe}</td><td className="border border-slate-100 p-1 text-center font-black tabular-nums text-[10px]">{og.add}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mb-8 flex-1">
        <h3 className="text-[8px] font-black uppercase text-slate-400 mb-2 border-b border-slate-100 pb-1 tracking-widest">Versements</h3>
        <table className="w-full text-[9px]">
          <thead className="bg-[#064e3b] text-white border-b border-slate-900"><tr><th className="p-2 text-left uppercase tracking-widest">Date</th><th className="p-2 text-right uppercase tracking-widest">Montant</th></tr></thead>
          <tbody>
            {saleData?.payments && saleData.payments.length > 0 ? (saleData.payments.map((p: any, i: number) => {
              let pDate = dateDisplay;
              try { const d = p.date ? (typeof p.date === 'string' ? parseISO(p.date.split('T')[0]) : p.date.toDate()) : null; if (d && isValid(d)) pDate = format(d, "dd MMMM yyyy", { locale: fr }); } catch (e) {}
              return (<tr key={i} className="border-b border-slate-50"><td className="p-2 font-bold text-slate-600 uppercase">{pDate}</td><td className="p-2 text-right font-black text-slate-900 tabular-nums">{formatCurrency(p.amount, true)}</td></tr>);
            })) : (<tr className="border-b border-slate-50"><td className="p-2 font-bold text-slate-600 uppercase">{dateDisplay}</td><td className="p-2 text-right font-black text-slate-900 tabular-nums">{formatCurrency(avance, true)}</td></tr>)}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        <div className="w-full space-y-2 border-t border-slate-200 pt-6"><div className="flex justify-between text-[9px] text-slate-500 font-bold uppercase tracking-widest px-2"><span>Commande :</span><span className="tabular-nums font-black">{formatCurrency(totalNet, true)}</span></div><div className="flex justify-between text-[9px] text-green-600 font-black uppercase tracking-widest px-2"><span>Déjà payé :</span><span className="tabular-nums font-black">{formatCurrency(avance, true)}</span></div><div className="flex justify-between items-center pt-4 border border-slate-300 bg-slate-50 text-slate-950 p-4 rounded-2xl mt-2"><span className="text-[10px] font-black uppercase tracking-[0.4em]">Reste à Régler</span><span className="text-xl font-black tracking-tighter tabular-nums">{formatCurrency(reste, true)}</span></div></div>
        <div className="flex justify-between items-end mt-4"><div className="flex-1 pr-8"><div className="border-l-4 border-primary/20 pl-4 py-3 bg-slate-50/50 rounded-r-2xl"><p className="text-[11px] font-black text-primary/80 italic leading-tight">Merci de votre confiance.<br/>Votre vue est notre priorité !</p></div></div><div className="w-48 h-24 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center relative bg-white overflow-hidden shrink-0 shadow-sm"><span className="text-[8px] uppercase text-slate-300 font-black rotate-[-15deg] text-center px-4 leading-none select-none opacity-40">CACHET & SIGNATURE</span></div></div>
      </div>
      <div className="h-[30mm] w-full shrink-0"></div>
    </div>
  );

  if (settingsLoading || saleLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 print:py-0">
      <div className="no-print w-[297mm] flex justify-between mb-6 px-4"><Button variant="outline" asChild className="bg-white rounded-2xl font-black text-sm h-12 px-8 shadow-sm border-slate-200"><Link href="/ventes"><ArrowLeft className="mr-3 h-5 w-5" /> RETOUR</Link></Button><Button onClick={() => window.print()} className="bg-slate-950 px-12 h-12 text-base font-black rounded-2xl text-white shadow-2xl hover:scale-105 transition-transform"><Printer className="mr-3 h-5 w-5" /> IMPRIMER LES COPIES</Button></div>
      <div className="pdf-a4-landscape shadow-2xl overflow-hidden print:shadow-none bg-white print:m-0 border border-slate-200 rounded-sm"><ReceiptCopy /><div className="cutting-line-vertical" /><ReceiptCopy /></div>
    </div>
  );
}

export default function ReceiptPrintPage() { return <Suspense fallback={null}><ReceiptPrintContent /></Suspense>; }
