"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Calendar, Loader2, Glasses, ThumbsUp, Clock, PiggyBank, Lock, Download, TrendingUp, Landmark } from "lucide-react";
import Link from "next/link";
import { formatCurrency, cn } from "@/lib/utils";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";

function DailyCashReportContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const [printTime, setPrintTime] = useState<string>("");

  const selectedDate = useMemo(() => {
    const d = searchParams.get("date");
    try {
      return d ? new Date(d) : new Date();
    } catch (e) {
      return new Date();
    }
  }, [searchParams]);

  useEffect(() => {
    const now = new Date();
    setPrintTime(format(now, "HH:mm"));
    const dateStr = format(selectedDate, "dd-MM-yyyy");
    document.title = `Rapport Journalier - ${dateStr}`;
    return () => { document.title = "Like Vision"; };
  }, [selectedDate]);

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

  const sessionDocId = format(selectedDate, "yyyy-MM-dd");
  const sessionRef = useMemoFirebase(() => doc(db, "cash_sessions", sessionDocId), [db, sessionDocId]);
  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);

  const transQuery = useMemoFirebase(() => query(collection(db, "transactions"), orderBy("createdAt", "asc")), [db]);
  const { data: transactions, isLoading: transLoading } = useCollection(transQuery);

  const shop = {
    name: remoteSettings?.name || DEFAULT_SHOP_SETTINGS.name,
    address: remoteSettings?.address || DEFAULT_SHOP_SETTINGS.address,
    phone: remoteSettings?.phone || DEFAULT_SHOP_SETTINGS.phone,
    icePatent: remoteSettings?.icePatent || DEFAULT_SHOP_SETTINGS.icePatent,
    logoUrl: remoteSettings?.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
  };

  const reportData = useMemo(() => {
    if (!transactions) return { sales: [], expenses: [], versements: [], initial: 0, fluxOp: 0, totalVersements: 0, final: 0 };
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    const initialBalance = session?.openingBalance || 0;
    const salesList: any[] = [];
    const expensesList: any[] = [];
    const versementsList: any[] = [];
    transactions.forEach((t: any) => {
      const tDate = t.createdAt?.toDate ? t.createdAt.toDate() : null;
      if (!tDate) return;
      if (isWithinInterval(tDate, { start, end })) {
        if (t.type === "VENTE") salesList.push(t);
        else if (t.type === "DEPENSE" || t.type === "ACHAT VERRES") expensesList.push(t);
        else if (t.type === "VERSEMENT") versementsList.push(t);
      }
    });
    const totalSales = salesList.reduce((acc, curr) => acc + Math.abs(curr.montant || 0), 0);
    const totalExpenses = expensesList.reduce((acc, curr) => acc + Math.abs(curr.montant || 0), 0);
    const totalVersements = versementsList.reduce((acc, curr) => acc + Math.abs(curr.montant || 0), 0);
    const fluxOp = totalSales - totalExpenses;
    const final = initialBalance + fluxOp - totalVersements;
    return { sales: salesList, expenses: expensesList, versements: versementsList, initial: initialBalance, fluxOp, totalVersements, final };
  }, [transactions, selectedDate, session]);

  if (settingsLoading || transLoading || sessionLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-4 print:py-0">
      <div className="no-print w-full max-w-[210mm] flex flex-col md:flex-row justify-between items-center mb-6 px-4 gap-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 h-12 px-6 rounded-2xl shadow-sm font-black text-xs w-full md:w-auto">
          <Link href="/caisse"><ArrowLeft className="mr-3 h-5 w-5" /> RETOUR</Link>
        </Button>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button onClick={() => window.print()} variant="outline" className="bg-white border-primary/20 text-primary h-12 px-6 rounded-2xl shadow-sm font-black text-xs flex-1 md:flex-none">
            <Printer className="mr-2 h-4 w-4" /> IMPRIMER
          </Button>
          <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 h-12 px-8 rounded-2xl font-black text-sm text-white flex-1 md:flex-none">
            <Download className="mr-2 h-5 w-5" /> TÉLÉCHARGER PDF
          </Button>
        </div>
      </div>

      <div className="pdf-a4-portrait shadow-none bg-white print:m-0 border border-slate-100 rounded-sm p-[6mm] flex flex-col min-h-[290mm]">
        {/* Header - Ultra Compact */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-2 mb-3">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 flex items-center justify-center shrink-0 overflow-hidden relative">
              {shop.logoUrl ? (
                <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <div className="relative text-primary">
                  <Glasses className="h-8 w-8" />
                  <ThumbsUp className="h-4 w-4 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" />
                </div>
              )}
            </div>
            <div className="space-y-0 text-left">
              <h1 className="text-base font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name}</h1>
              <div className="mt-1 flex flex-col">
                <p className="text-[8px] text-slate-500 font-medium leading-tight">{shop.address}</p>
                <p className="text-[8px] font-bold text-slate-700 leading-tight">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xs font-black uppercase tracking-widest leading-none border-2 border-slate-900 px-2 py-1 rounded-md mb-1">Rapport Journalier</h2>
            <div className="flex flex-col items-end gap-0">
              <div className="flex items-center justify-end gap-1 text-[9px] font-bold text-slate-600">
                <Calendar className="h-2.5 w-2.5 text-slate-400" />
                <span>{format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center justify-end gap-1 text-[8px] font-bold text-slate-400">
                <Clock className="h-2 w-2" />
                <span>Imprimé à: {printTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Indicators - Ultra Compact */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="p-2 rounded-lg border border-slate-200 text-center bg-slate-50">
            <p className="text-[6px] font-black uppercase tracking-widest opacity-50 mb-0.5">INITIAL</p>
            <p className="text-[11px] font-black text-slate-900 tabular-nums">{formatCurrency(reportData.initial)}</p>
          </div>
          <div className="p-2 rounded-lg border border-primary/10 text-center bg-primary/5">
            <p className="text-[6px] font-black uppercase tracking-widest text-primary opacity-50 mb-0.5">FLUX (OP)</p>
            <p className={cn("text-[11px] font-black tabular-nums", reportData.fluxOp >= 0 ? "text-green-600" : "text-destructive")}>
              {reportData.fluxOp > 0 ? "+" : ""}{formatCurrency(reportData.fluxOp)}
            </p>
          </div>
          <div className="p-2 rounded-lg border border-orange-100 text-center bg-orange-50/50">
            <p className="text-[6px] font-black uppercase tracking-widest text-orange-600 opacity-50 mb-0.5">VERSEMENT</p>
            <p className="text-[11px] font-black text-orange-600 tabular-nums">{formatCurrency(reportData.totalVersements)}</p>
          </div>
          <div className="p-2 rounded-lg border border-primary/20 text-center bg-primary/10">
            <p className="text-[6px] font-black uppercase tracking-widest text-primary opacity-70 mb-0.5">FINAL</p>
            <p className="text-[11px] font-black text-slate-900 tabular-nums">{formatCurrency(reportData.final)}</p>
          </div>
        </div>

        {/* Detailed Sections - Compressed */}
        <div className="space-y-4 flex-1">
          <section>
            <h3 className="text-[9px] font-black uppercase text-slate-400 mb-1 border-b pb-0.5 flex justify-between items-center tracking-wider">
              <span>Encaissements (Ventes)</span>
              <span className="text-green-600 tabular-nums">+{formatCurrency(reportData.sales.reduce((a, b) => a + Math.abs(b.montant || 0), 0))}</span>
            </h3>
            <table className="w-full text-[9px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[7px]">
                <tr><th className="p-1 text-left">Libellé</th><th className="p-1 text-left">Client</th><th className="p-1 text-right">Montant</th></tr>
              </thead>
              <tbody>
                {reportData.sales.length > 0 ? reportData.sales.map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="p-1 font-bold text-slate-700">{s.label}</td>
                    <td className="p-1 font-bold text-slate-700 uppercase">{s.clientName || '---'}</td>
                    <td className="p-1 text-right font-black text-green-600 tabular-nums">+{formatCurrency(Math.abs(s.montant))}</td>
                  </tr>
                )) : <tr><td colSpan={3} className="p-1 text-center text-slate-300 italic">Aucune vente.</td></tr>}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase text-slate-400 mb-1 border-b pb-0.5 flex justify-between items-center tracking-wider">
              <span>Dépenses (Charges)</span>
              <span className="text-destructive tabular-nums">-{formatCurrency(Math.abs(reportData.expenses.reduce((a, b) => a + Math.abs(b.montant || 0), 0)))}</span>
            </h3>
            <table className="w-full text-[9px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[7px]">
                <tr><th className="p-1 text-left">Libellé</th><th className="p-1 text-right">Montant</th></tr>
              </thead>
              <tbody>
                {reportData.expenses.length > 0 ? reportData.expenses.map((e: any) => (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="p-1 font-bold text-slate-700">{e.label}</td>
                    <td className="p-1 text-right font-black text-destructive tabular-nums">-{formatCurrency(Math.abs(e.montant))}</td>
                  </tr>
                )) : <tr><td colSpan={2} className="p-1 text-center text-slate-300 italic">Aucune dépense.</td></tr>}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase text-slate-400 mb-1 border-b pb-0.5 flex justify-between items-center tracking-wider">
              <span>Versements en Banque</span>
              <span className="text-orange-600 tabular-nums">-{formatCurrency(Math.abs(reportData.versements.reduce((a, b) => a + Math.abs(b.montant || 0), 0)))}</span>
            </h3>
            <table className="w-full text-[9px]">
              <thead className="bg-slate-50 text-slate-500 text-[6px]">
                <tr><th className="p-1 text-left">Opération</th><th className="p-1 text-right">Montant</th></tr>
              </thead>
              <tbody>
                {reportData.versements.length > 0 ? reportData.versements.map((v: any) => (
                  <tr key={v.id} className="border-b border-slate-50">
                    <td className="p-1 font-bold text-slate-700">{v.label}</td>
                    <td className="p-1 text-right font-black text-orange-600 tabular-nums">-{formatCurrency(Math.abs(v.montant))}</td>
                  </tr>
                )) : <tr><td colSpan={2} className="p-1 text-center text-slate-300 italic">Aucun versement.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>

        {/* Signature Area - Minimal Height */}
        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
          <div className="text-right flex flex-col items-end">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1 mr-1">Signature du Magasin</p>
            <div className="w-[50mm] h-[20mm] border border-dashed border-slate-300 rounded-xl bg-slate-50/30 flex items-center justify-center relative">
              <span className="text-[7px] text-slate-300 font-black rotate-[-10deg] uppercase tracking-2em] opacity-40 select-none">
                Espace Réservé
              </span>
            </div>
          </div>
        </div>

        {/* Footer - Discrete */}
        <div className="mt-3 text-center border-t border-slate-50 pt-2">
          <p className="text-[7px] text-slate-200 font-bold uppercase tracking-[0.4em] italic leading-none">
            {shop.name} • Système Like Vision
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DailyCashReportPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}><DailyCashReportContent /></Suspense>;
}
