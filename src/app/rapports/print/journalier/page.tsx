
"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Calendar, Loader2, Glasses, ThumbsUp, Clock, ArrowRightLeft, PiggyBank, Lock, FileText, Download, TrendingUp, Landmark } from "lucide-react";
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

    return () => {
      document.title = "Like Vision";
    };
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

    return { 
      sales: salesList, 
      expenses: expensesList, 
      versements: versementsList, 
      initial: initialBalance, 
      fluxOp: fluxOp,
      totalVersements: totalVersements,
      final: final
    };
  }, [transactions, selectedDate, session]);

  if (settingsLoading || transLoading || sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-4 print:py-0">
      <div className="no-print w-full max-w-[210mm] flex flex-col md:flex-row justify-between items-center mb-6 px-4 gap-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 h-12 px-6 rounded-2xl shadow-sm font-black text-xs w-full md:w-auto">
          <Link href="/caisse">
            <ArrowLeft className="mr-3 h-5 w-5" /> RETOUR
          </Link>
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

      <div className="pdf-a4-portrait shadow-none bg-white print:m-0 border border-slate-100 rounded-sm p-[12mm] pt-[8mm] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 flex items-center justify-center shrink-0 overflow-hidden relative">
              {shop.logoUrl ? (
                <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <div className="relative text-primary">
                  <Glasses className="h-12 w-12" />
                  <ThumbsUp className="h-6 w-6 absolute -top-1.5 -right-1.5 bg-white p-0.5 rounded-full border border-primary" />
                </div>
              )}
            </div>
            <div className="space-y-1 text-left">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name}</h1>
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] leading-none">Gestion Optique Professionnelle</p>
              <div className="mt-2 space-y-0.5">
                <p className="text-[11px] text-slate-500 font-medium leading-tight">{shop.address}</p>
                <p className="text-[11px] font-bold text-slate-700">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-base font-black uppercase tracking-widest leading-none border-2 border-slate-900 px-4 py-2 rounded-lg mb-2">Rapport de Caisse</h2>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-slate-600">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>Date: {format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-xs font-bold text-slate-400">
                <Clock className="h-4 w-4" />
                <span>Imprimé à: {printTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Indicators */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          <div className="p-4 rounded-2xl border border-slate-200 text-center bg-slate-50 shadow-sm">
            <div className="flex items-center justify-center gap-1.5 mb-1.5 opacity-50">
              <PiggyBank className="h-3 w-3" />
              <p className="text-[8px] font-black uppercase tracking-widest">SOLDE INITIAL</p>
            </div>
            <p className="text-sm font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(reportData.initial)}</p>
          </div>
          <div className="p-4 rounded-2xl border border-primary/10 text-center bg-primary/5 shadow-sm">
            <div className="flex items-center justify-center gap-1.5 mb-1.5 opacity-50">
              <TrendingUp className="h-3 w-3 text-primary" />
              <p className="text-[8px] font-black uppercase tracking-widest text-primary">Flux (Op)</p>
            </div>
            <p className={cn("text-sm font-black tracking-tighter tabular-nums", reportData.fluxOp >= 0 ? "text-green-600" : "text-destructive")}>
              {reportData.fluxOp > 0 ? "+" : ""}{formatCurrency(reportData.fluxOp)}
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-orange-100 text-center bg-orange-50/50 shadow-sm">
            <div className="flex items-center justify-center gap-1.5 mb-1.5 opacity-50">
              <Landmark className="h-3 w-3 text-orange-600" />
              <p className="text-[8px] font-black uppercase tracking-widest text-orange-600">Versement</p>
            </div>
            <p className="text-sm font-black text-orange-600 tracking-tighter tabular-nums">{formatCurrency(reportData.totalVersements)}</p>
          </div>
          <div className="p-4 rounded-2xl border border-primary/20 text-center bg-primary/10 shadow-sm">
            <div className="flex items-center justify-center gap-1.5 mb-1.5 opacity-70">
              <Lock className="h-3 w-3 text-primary" />
              <p className="text-[8px] font-black uppercase tracking-widest text-primary">Solde Final</p>
            </div>
            <p className="text-sm font-black text-slate-900 tracking-tighter tabular-nums">{formatCurrency(reportData.final)}</p>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="space-y-10 mb-10">
          <section>
            <h3 className="text-xs font-black uppercase text-slate-400 mb-3 border-b-2 pb-2 flex justify-between items-center tracking-[0.2em]">
              <span>Détail des Encaissements (Ventes)</span>
              <span className="text-green-600 tabular-nums">+{formatCurrency(reportData.sales.reduce((a, b) => a + Math.abs(b.montant || 0), 0))}</span>
            </h3>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px]">
                <tr><th className="p-2 text-left">Libellé</th><th className="p-2 text-left">Client</th><th className="p-2 text-right">Montant</th></tr>
              </thead>
              <tbody>
                {reportData.sales.length > 0 ? reportData.sales.map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="p-2.5 font-bold text-slate-700">{s.label}</td>
                    <td className="p-2.5 font-bold text-slate-700 uppercase">{s.clientName || '---'}</td>
                    <td className="p-2.5 text-right font-black text-green-600 tabular-nums">+{formatCurrency(Math.abs(s.montant))}</td>
                  </tr>
                )) : <tr><td colSpan={3} className="p-4 text-center text-slate-300 italic">Aucune vente enregistrée.</td></tr>}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase text-slate-400 mb-3 border-b-2 pb-2 flex justify-between items-center tracking-[0.2em]">
              <span>Détail des Dépenses (Charges)</span>
              <span className="text-destructive tabular-nums">-{formatCurrency(Math.abs(reportData.expenses.reduce((a, b) => a + Math.abs(b.montant || 0), 0)))}</span>
            </h3>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px]">
                <tr><th className="p-2 text-left">Libellé</th><th className="p-2 text-right">Montant</th></tr>
              </thead>
              <tbody>
                {reportData.expenses.length > 0 ? reportData.expenses.map((e: any) => (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="p-2.5 font-bold text-slate-700">{e.label}</td>
                    <td className="p-2.5 text-right font-black text-destructive tabular-nums">-{formatCurrency(Math.abs(e.montant))}</td>
                  </tr>
                )) : <tr><td colSpan={2} className="p-4 text-center text-slate-300 italic">Aucune dépense enregistrée.</td></tr>}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase text-slate-400 mb-3 border-b-2 pb-2 flex justify-between items-center tracking-[0.2em]">
              <span>Versements en Banque</span>
              <span className="text-orange-600 tabular-nums">-{formatCurrency(Math.abs(reportData.versements.reduce((a, b) => a + Math.abs(b.montant || 0), 0)))}</span>
            </h3>
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[9px]">
                <tr><th className="p-2 text-left">Opération</th><th className="p-2 text-right">Montant</th></tr>
              </thead>
              <tbody>
                {reportData.versements.length > 0 ? reportData.versements.map((v: any) => (
                  <tr key={v.id} className="border-b border-slate-50">
                    <td className="p-2.5 font-bold text-slate-700">{v.label}</td>
                    <td className="p-2.5 text-right font-black text-orange-600 tabular-nums">-{formatCurrency(Math.abs(v.montant))}</td>
                  </tr>
                )) : <tr><td colSpan={2} className="p-4 text-center text-slate-300 italic">Aucun mouvement de banque.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>

        {/* Simplified Signature Area - Lowered */}
        <div className="mt-auto pt-20 flex justify-end">
          <div className="space-y-4 text-right flex flex-col items-end">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mr-2">Cachet et Signature du Magasin</p>
            <div className="w-[80mm] h-[40mm] border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/30 flex items-center justify-center relative">
              <span className="text-[10px] text-slate-300 font-black rotate-[-15deg] uppercase tracking-[0.4em] opacity-40 text-center leading-loose select-none px-10">
                Espace Réservé
              </span>
            </div>
          </div>
        </div>

        {/* Simplified Footer */}
        <div className="mt-12 text-center border-t border-slate-50 pt-6">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.5em] italic leading-none">
            {shop.name} • Système Optique Pro
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DailyCashReportPage() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}><DailyCashReportContent /></Suspense>;
}
