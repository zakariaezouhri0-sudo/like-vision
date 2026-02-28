
"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Calendar, Loader2, Glasses, ThumbsUp, Clock, TrendingUp, Landmark, FileText, UserCheck } from "lucide-react";
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
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center py-10 print:py-0 print:bg-white">
      <div className="no-print w-full max-w-[210mm] flex justify-between items-center mb-8 px-4">
        <Button variant="outline" asChild className="bg-white border-slate-200 text-slate-600 h-11 px-5 rounded-xl shadow-sm font-black text-[10px] hover:bg-slate-50">
          <Link href="/caisse"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR CAISSE</Link>
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border shadow-sm">Format A4 Portrait</span>
          <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 h-11 px-10 rounded-xl font-black text-xs text-white">
            <Printer className="mr-2 h-4 w-4" /> IMPRIMER LE RAPPORT
          </Button>
        </div>
      </div>

      <div className="pdf-a4-portrait shadow-[0_0_60px_rgba(0,0,0,0.05)] bg-white print:shadow-none print:m-0 border border-slate-100 rounded-sm p-[12mm] flex flex-col min-h-[297mm]">
        
        {/* Header Élégant & Aéré */}
        <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-8">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-100 rounded-2xl bg-white shadow-sm">
              {shop.logoUrl ? (
                <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />
              ) : (
                <div className="relative text-primary">
                  <Glasses className="h-12 w-12" />
                  <ThumbsUp className="h-6 w-6 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name}</h1>
              <p className="text-[10px] text-slate-500 font-bold leading-tight max-w-[320px]">{shop.address}</p>
              <div className="flex items-center gap-3 pt-1">
                <span className="text-[10px] font-black text-slate-800">Tél: {shop.phone}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="text-[10px] font-black text-slate-800">ICE: {shop.icePatent}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="border border-slate-900 px-4 py-2 rounded-lg inline-block mb-3">
              <h2 className="text-[11px] font-black uppercase tracking-[0.25em] leading-none text-slate-900">Rapport de Caisse</h2>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-end gap-2 text-[12px] font-black text-slate-900">
                <Calendar className="h-4 w-4 text-primary/40" />
                <span>{format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-[9px] font-bold text-slate-400 italic">
                <Clock className="h-3 w-3" />
                <span>Édité à {printTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Indicateurs Financiers Modernes (Sans fond noir) */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/30 text-center shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Solde Ouverture</p>
            <p className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(reportData.initial)}</p>
          </div>
          <div className="p-4 rounded-2xl border border-green-100 bg-green-50/20 text-center shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-green-600 mb-2">Flux (Entrées - Sorties)</p>
            <p className={cn("text-xl font-black tabular-nums", reportData.fluxOp >= 0 ? "text-green-700" : "text-red-700")}>
              {reportData.fluxOp > 0 ? "+" : ""}{formatCurrency(reportData.fluxOp)}
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-orange-100 bg-orange-50/20 text-center shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-orange-600 mb-2">Versements</p>
            <p className="text-xl font-black text-orange-700 tabular-nums">{formatCurrency(reportData.totalVersements)}</p>
          </div>
          <div className="p-4 rounded-2xl border-2 border-slate-900 bg-white text-center shadow-md">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2">Solde de Clôture</p>
            <p className="text-xl font-black text-slate-950 tabular-nums">{formatCurrency(reportData.final)}</p>
          </div>
        </div>

        {/* Détail des Opérations - Tableaux Élégants */}
        <div className="space-y-8 flex-1">
          
          {/* SECTION ENCAISSEMENTS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-900 pb-2 px-1">
              <h3 className="text-[11px] font-black uppercase text-slate-900 flex items-center gap-2 tracking-widest">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Journal des Encaissements
              </h3>
              <span className="text-[10px] font-black text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-100 shadow-sm">
                Total Ventes : +{formatCurrency(reportData.sales.reduce((a, b) => a + Math.abs(b.montant || 0), 0))}
              </span>
            </div>
            <div className="overflow-hidden border border-slate-200 rounded-xl">
              <table className="w-full">
                <thead className="bg-slate-50 text-slate-900 border-b border-slate-200">
                  <tr>
                    <th className="p-3 text-left text-[9px] font-black uppercase tracking-widest w-20">Heure</th>
                    <th className="p-3 text-left text-[9px] font-black uppercase tracking-widest">Client / Désignation</th>
                    <th className="p-3 text-right text-[9px] font-black uppercase tracking-widest w-36">Encaissement (DH)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.sales.length > 0 ? reportData.sales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-[10px] font-bold text-slate-400 tabular-nums">{s.createdAt?.toDate ? format(s.createdAt.toDate(), "HH:mm") : "--:--"}</td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-900 uppercase leading-tight">{s.label}</span>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{s.clientName || 'CLIENT DIVERS'}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-black text-slate-950 tabular-nums text-[11px]">+{formatCurrency(Math.abs(s.montant))}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="p-6 text-center text-slate-300 font-bold italic text-[10px]">Aucune vente enregistrée.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* SECTION DÉPENSES */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 px-1">
                <h3 className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-2 tracking-widest">
                  <FileText className="h-4 w-4 text-red-600" />
                  Sorties de Caisse
                </h3>
                <span className="text-[10px] font-black text-red-700">-{formatCurrency(Math.abs(reportData.expenses.reduce((a, b) => a + Math.abs(b.montant || 0), 0)))}</span>
              </div>
              <div className="overflow-hidden border border-slate-200 rounded-xl bg-white">
                <table className="w-full">
                  <thead className="bg-slate-50 text-slate-900 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-left text-[8px] font-black uppercase">Libellé</th>
                      <th className="p-3 text-right text-[8px] font-black uppercase w-28">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.expenses.length > 0 ? reportData.expenses.map((e: any) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="p-3 text-[10px] font-bold text-slate-900 uppercase leading-tight">{e.label}</td>
                        <td className="p-3 text-right font-black text-slate-950 tabular-nums text-[10px]">-{formatCurrency(Math.abs(e.montant))}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} className="p-6 text-center text-slate-300 font-bold italic text-[9px]">Aucune dépense.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION VERSEMENTS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-900 pb-2 px-1">
                <h3 className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-2 tracking-widest">
                  <Landmark className="h-4 w-4 text-orange-600" />
                  Versements
                </h3>
                <span className="text-[10px] font-black text-orange-700">-{formatCurrency(Math.abs(reportData.versements.reduce((a, b) => a + Math.abs(b.montant || 0), 0)))}</span>
              </div>
              <div className="overflow-hidden border border-slate-200 rounded-xl bg-white">
                <table className="w-full">
                  <thead className="bg-slate-50 text-slate-900 border-b border-slate-200">
                    <tr>
                      <th className="p-3 text-left text-[8px] font-black uppercase">Désignation</th>
                      <th className="p-3 text-right text-[8px] font-black uppercase w-28">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.versements.length > 0 ? reportData.versements.map((v: any) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="p-3 text-[10px] font-bold text-slate-900 uppercase leading-tight">{v.label}</td>
                        <td className="p-3 text-right font-black text-slate-950 tabular-nums text-[10px]">-{formatCurrency(Math.abs(v.montant))}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={2} className="p-6 text-center text-slate-300 font-bold italic text-[9px]">Aucun versement.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Pied de Page Professionnel */}
        <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-2 gap-16">
          <div className="space-y-10">
            <div className="flex items-center gap-2 text-slate-400">
              <UserCheck className="h-4 w-4" />
              <p className="text-[9px] font-black uppercase tracking-widest">Visa du Responsable</p>
            </div>
            <div className="border-b border-slate-200 w-full opacity-50"></div>
            <p className="text-[10px] font-bold text-slate-900">Cachet & Signature de l'opérateur</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-3">Authentification du Magasin</p>
            <div className="w-[60mm] h-[30mm] border border-dashed border-slate-300 rounded-2xl flex items-center justify-center bg-slate-50/20 relative shadow-inner">
              <span className="text-[9px] text-slate-200 font-black rotate-[-12deg] uppercase tracking-[0.4em] opacity-40 text-center leading-loose select-none px-6">
                ESPACE RÉSERVÉ AU CACHET OFFICIEL
              </span>
            </div>
          </div>
        </div>

        <div className="mt-auto text-center border-t border-slate-50 pt-4">
          <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.5em] italic opacity-40">
            {shop.name} • SYSTÈME DE GESTION OPTIQUE PROFESSIONNELLE • LIKE VISION
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DailyCashReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Génération du rapport en cours...</div>}>
      <DailyCashReportContent />
    </Suspense>
  );
}
