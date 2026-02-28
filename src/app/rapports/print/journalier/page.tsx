"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Calendar, Loader2, Glasses, ThumbsUp, Clock, Download, TrendingUp, Landmark, FileText } from "lucide-react";
import Link from "next/link";
import { formatCurrency, cn } from "@/lib/utils";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, where, Timestamp } from "firebase/firestore";
import { format, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";

function DailyCashReportContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const [printTime, setPrintTime] = useState<string>("");
  const [role, setRole] = useState<string>("OPTICIENNE");

  const selectedDate = useMemo(() => {
    const d = searchParams.get("date");
    try {
      if (d) {
        const [y, m, d_part] = d.split('-').map(Number);
        const date = new Date(y, m - 1, d_part);
        if (!isNaN(date.getTime())) return date;
      }
      return new Date();
    } catch (e) {
      return new Date();
    }
  }, [searchParams]);

  useEffect(() => {
    const now = new Date();
    setPrintTime(format(now, "HH:mm"));
    const dateStr = format(selectedDate, "dd-MM-yyyy");
    document.title = `Rapport Journalier - ${dateStr}`;
    setRole(localStorage.getItem('user_role') || "OPTICIENNE");
    return () => { document.title = "Like Vision"; };
  }, [selectedDate]);

  const isPrepaMode = role === "PREPA";

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${dateStr}` : dateStr;
  const sessionRef = useMemoFirebase(() => doc(db, "cash_sessions", sessionDocId), [db, sessionDocId]);
  const { data: rawSession, isLoading: sessionLoading } = useDoc(sessionRef);

  const session = useMemo(() => {
    if (!rawSession) return null;
    if (isPrepaMode !== (rawSession.isDraft === true)) return null;
    return rawSession;
  }, [rawSession, isPrepaMode]);

  const transQuery = useMemoFirebase(() => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, "transactions"), 
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
      orderBy("createdAt", "asc")
    );
  }, [db, selectedDate]);
  
  const { data: rawTransactions, isLoading: transLoading } = useCollection(transQuery);

  const shop = {
    name: remoteSettings?.name || DEFAULT_SHOP_SETTINGS.name,
    address: remoteSettings?.address || DEFAULT_SHOP_SETTINGS.address,
    phone: remoteSettings?.phone || DEFAULT_SHOP_SETTINGS.phone,
    icePatent: remoteSettings?.icePatent || DEFAULT_SHOP_SETTINGS.icePatent,
    logoUrl: remoteSettings?.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
  };

  const reportData = useMemo(() => {
    if (!rawTransactions) return { sales: [], expenses: [], versements: [], initial: 0, fluxOp: 0, totalVersements: 0, final: 0 };
    
    const filteredTransactions = rawTransactions.filter((t: any) => isPrepaMode ? t.isDraft === true : t.isDraft !== true);
    
    const initialBalance = session?.openingBalance || 0;
    const salesList: any[] = [];
    const expensesList: any[] = [];
    const versementsList: any[] = [];
    
    filteredTransactions.forEach((t: any) => {
      if (t.type === "VENTE") salesList.push(t);
      else if (t.type === "DEPENSE" || t.type === "ACHAT VERRES") expensesList.push(t);
      else if (t.type === "VERSEMENT") versementsList.push(t);
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
      fluxOp, 
      totalVersements, 
      final 
    };
  }, [rawTransactions, session, isPrepaMode]);

  if (settingsLoading || transLoading || sessionLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-6 print:py-0 print:bg-white">
      <div className="no-print w-full max-w-[210mm] flex justify-between items-center mb-6 px-4">
        <Button variant="outline" asChild className="bg-white border-slate-200 text-slate-600 h-10 px-4 rounded-xl shadow-sm font-black text-[10px]">
          <Link href="/caisse"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()} variant="outline" className="bg-white border-primary/20 text-primary h-10 px-4 rounded-xl shadow-sm font-black text-[10px]">
            <Printer className="mr-2 h-4 w-4" /> IMPRIMER
          </Button>
          <Button onClick={() => window.print()} className="bg-primary shadow-lg hover:bg-primary/90 h-10 px-6 rounded-xl font-black text-xs text-white">
            <Download className="mr-2 h-4 w-4" /> EXPORTER PDF
          </Button>
        </div>
      </div>

      <div className="pdf-a4-portrait shadow-2xl bg-white print:shadow-none print:m-0 border border-slate-100 rounded-sm p-[10mm] flex flex-col min-h-[297mm]">
        {/* Header - Plus Compact */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex items-center justify-center shrink-0 overflow-hidden relative border rounded-xl bg-white">
              {shop.logoUrl ? (
                <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />
              ) : (
                <div className="relative text-primary">
                  <Glasses className="h-10 w-10" />
                  <ThumbsUp className="h-5 w-5 absolute -top-1.5 -right-1.5 bg-white p-0.5 rounded-full border border-primary" />
                </div>
              )}
            </div>
            <div className="space-y-0.5 text-left">
              <h1 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name}</h1>
              <p className="text-[9px] text-slate-500 font-medium leading-tight max-w-[250px]">{shop.address}</p>
              <p className="text-[9px] font-bold text-slate-700">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="border-2 border-slate-900 px-3 py-1.5 rounded-md inline-block mb-2">
              <h2 className="text-xs font-black uppercase tracking-[0.1em] leading-none">Rapport Journalier</h2>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-slate-600">
                <Calendar className="h-3 w-3 text-slate-400" />
                <span>Date : {format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5 text-[8px] font-bold text-slate-400 italic">
                <Clock className="h-2.5 w-2.5" />
                <span>Généré à : {printTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Indicateurs Financiers - Plus Compact */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="p-3 rounded-xl border border-slate-200 text-center bg-slate-50/50 shadow-sm">
            <p className="text-[7px] font-black uppercase tracking-widest text-slate-400 mb-1">Solde Initial</p>
            <p className="text-base font-black text-slate-900 tabular-nums">{formatCurrency(reportData.initial)}</p>
          </div>
          <div className="p-3 rounded-xl border border-green-100 text-center bg-green-50/30 shadow-sm">
            <p className="text-[7px] font-black uppercase tracking-widest text-green-600 mb-1">Flux (Ventes - Dép)</p>
            <p className={cn("text-base font-black tabular-nums", reportData.fluxOp >= 0 ? "text-green-600" : "text-destructive")}>
              {reportData.fluxOp > 0 ? "+" : ""}{formatCurrency(reportData.fluxOp)}
            </p>
          </div>
          <div className="p-3 rounded-xl border border-orange-100 text-center bg-orange-50/30 shadow-sm">
            <p className="text-[7px] font-black uppercase tracking-widest text-orange-600 mb-1">Versements</p>
            <p className="text-base font-black text-orange-600 tabular-nums">{formatCurrency(reportData.totalVersements)}</p>
          </div>
          <div className="p-3 rounded-xl border border-primary/20 text-center bg-primary/5 text-primary shadow-sm">
            <p className="text-[7px] font-black uppercase tracking-widest opacity-60 mb-1">Solde Final Réel</p>
            <p className="text-base font-black tabular-nums">{formatCurrency(reportData.final)}</p>
          </div>
        </div>

        {/* Détail des Opérations - Espacements Optimisés */}
        <div className="space-y-6 flex-1">
          {/* ENCAISSEMENTS */}
          <section className="space-y-2">
            <h3 className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 border-b border-slate-100 pb-1.5 tracking-[0.1em]">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              Encaissements (Ventes & Acomptes)
              <span className="ml-auto text-green-600 font-black">{formatCurrency(reportData.sales.reduce((a, b) => a + Math.abs(b.montant || 0), 0))}</span>
            </h3>
            <div className="rounded-lg border border-slate-100 overflow-hidden">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[7px]">
                  <tr>
                    <th className="p-2 text-left w-16">Heure</th>
                    <th className="p-2 text-left">Libellé / Client</th>
                    <th className="p-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.sales.length > 0 ? reportData.sales.map((s: any) => (
                    <tr key={s.id} className="border-b border-slate-50 last:border-0">
                      <td className="p-2 font-bold text-slate-400 tabular-nums">{s.createdAt?.toDate ? format(s.createdAt.toDate(), "HH:mm") : "--:--"}</td>
                      <td className="p-2">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-800 uppercase leading-tight">{s.label}</span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{s.clientName || 'CLIENT DIVERS'}</span>
                        </div>
                      </td>
                      <td className="p-2 text-right font-black text-green-600 tabular-nums">+{formatCurrency(Math.abs(s.montant))}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="p-4 text-center text-slate-300 font-bold italic">Aucun encaissement.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* DÉPENSES */}
            <section className="md:col-span-3 space-y-2">
              <h3 className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 border-b border-slate-100 pb-1.5 tracking-[0.1em]">
                <FileText className="h-3.5 w-3.5 text-destructive" />
                Dépenses & Achats
                <span className="ml-auto text-destructive font-black">-{formatCurrency(Math.abs(reportData.expenses.reduce((a, b) => a + Math.abs(b.montant || 0), 0)))}</span>
              </h3>
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-[9px]">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[7px]">
                    <tr>
                      <th className="p-2 text-left">Désignation</th>
                      <th className="p-2 text-right w-20">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.expenses.length > 0 ? reportData.expenses.map((e: any) => (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0">
                        <td className="p-2 font-bold text-slate-700 uppercase leading-tight">{e.label}</td>
                        <td className="p-2 text-right font-black text-destructive tabular-nums">-{formatCurrency(Math.abs(e.montant))}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} className="p-4 text-center text-slate-300 font-bold italic">Aucune dépense.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* VERSEMENTS */}
            <section className="md:col-span-2 space-y-2">
              <h3 className="text-[9px] font-black uppercase text-slate-400 flex items-center gap-2 border-b border-slate-100 pb-1.5 tracking-[0.1em]">
                <Landmark className="h-3.5 w-3.5 text-orange-500" />
                Versements
                <span className="ml-auto text-orange-600 font-black">-{formatCurrency(Math.abs(reportData.versements.reduce((a, b) => a + Math.abs(b.montant || 0), 0)))}</span>
              </h3>
              <div className="rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-[9px]">
                  <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[7px]">
                    <tr>
                      <th className="p-2 text-left">Opération</th>
                      <th className="p-2 text-right w-20">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.versements.length > 0 ? reportData.versements.map((v: any) => (
                      <tr key={v.id} className="border-b border-slate-50 last:border-0">
                        <td className="p-2 font-bold text-slate-700 uppercase leading-tight">{v.label}</td>
                        <td className="p-2 text-right font-black text-orange-600 tabular-nums">-{formatCurrency(Math.abs(v.montant))}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} className="p-4 text-center text-slate-300 font-bold italic">Aucun versement.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>

        {/* Zone de Signature et Cachet - Compacte */}
        <div className="mt-6 pt-4 border-t-2 border-slate-100 grid grid-cols-2 gap-12">
          <div className="space-y-10">
            <div className="space-y-0.5">
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.1em]">Signature de l'Opérateur</p>
              <p className="text-[10px] font-bold text-slate-800">Administrateur / Caissier</p>
            </div>
            <div className="border-b-2 border-slate-100 w-full opacity-50"></div>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.1em] mb-2">Cachet du Magasin</p>
            <div className="w-[50mm] h-[25mm] border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center bg-slate-50/20 relative">
              <span className="text-[8px] text-slate-300 font-black rotate-[-10deg] uppercase tracking-[0.2em] opacity-40 text-center leading-loose select-none px-2">
                Espace Réservé au Cachet
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center border-t border-slate-50 pt-2 opacity-30">
          <p className="text-[6px] text-slate-400 font-bold uppercase tracking-[0.3em] italic">
            {shop.name} • Système Like Vision
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DailyCashReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement du rapport...</div>}>
      <DailyCashReportContent />
    </Suspense>
  );
}
