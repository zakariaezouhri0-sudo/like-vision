"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Calendar, Loader2, Glasses, ThumbsUp, Clock, ArrowRightLeft, PiggyBank, Lock } from "lucide-react";
import Link from "next/link";
import { formatCurrency, cn } from "@/lib/utils";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { format, startOfDay, endOfDay, isBefore, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";

function DailyCashReportContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const [printTime, setPrintTime] = useState<string>("");
  const [generationTimestamp, setGenerationTimestamp] = useState<string>("");

  useEffect(() => {
    const now = new Date();
    setPrintTime(format(now, "HH:mm"));
    setGenerationTimestamp(now.toLocaleString("fr-FR"));
  }, []);

  const selectedDate = useMemo(() => {
    const d = searchParams.get("date");
    try {
      return d ? new Date(d) : new Date();
    } catch (e) {
      return new Date();
    }
  }, [searchParams]);

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

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
    if (!transactions) return { sales: [], expenses: [], versements: [], initial: 0, final: 0, netFlux: 0 };

    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);

    let initialBalance = 0;
    const salesList: any[] = [];
    const expensesList: any[] = [];
    const versementsList: any[] = [];

    transactions.forEach((t: any) => {
      const tDate = t.createdAt?.toDate ? t.createdAt.toDate() : null;
      if (!tDate) return;

      if (isBefore(tDate, start)) {
        initialBalance += (t.montant || 0);
      } else if (isWithinInterval(tDate, { start, end })) {
        if (t.type === "VENTE") salesList.push(t);
        else if (t.type === "DEPENSE") expensesList.push(t);
        else if (t.type === "VERSEMENT") versementsList.push(t);
      }
    });

    const totalSales = salesList.reduce((acc, curr) => acc + (curr.montant || 0), 0);
    const totalExpenses = expensesList.reduce((acc, curr) => acc + (curr.montant || 0), 0);
    const totalVersements = versementsList.reduce((acc, curr) => acc + (curr.montant || 0), 0);
    
    const netFlux = totalSales + totalExpenses + totalVersements; // totalExpenses and totalVersements are already negative in DB

    return { 
      sales: salesList, 
      expenses: expensesList, 
      versements: versementsList, 
      initial: initialBalance, 
      final: initialBalance + netFlux,
      netFlux: netFlux
    };
  }, [transactions, selectedDate]);

  if (settingsLoading || transLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center py-4 print:py-0">
      <div className="no-print w-full max-w-[210mm] flex justify-between mb-4 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 h-12 px-6 rounded-2xl shadow-sm font-black text-xs">
          <Link href="/rapports">
            <ArrowLeft className="mr-3 h-5 w-5" /> RETOUR
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 h-12 px-10 rounded-2xl font-black text-base text-white">
          <Printer className="mr-3 h-5 w-5" /> IMPRIMER LE RAPPORT
        </Button>
      </div>

      <div className="pdf-a4-portrait shadow-none bg-white print:m-0 border border-slate-100 rounded-sm p-[10mm] pt-[5mm] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 flex items-center justify-center shrink-0 overflow-hidden relative">
              {shop.logoUrl ? (
                <img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <div className="relative text-primary">
                  <Glasses className="h-10 w-10" />
                  <ThumbsUp className="h-5 w-5 absolute -top-1.5 -right-1.5 bg-white p-0.5 rounded-full border border-primary" />
                </div>
              )}
            </div>
            <div className="space-y-0.5 text-left">
              <h1 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name}</h1>
              <p className="text-[7px] font-black uppercase text-slate-400 tracking-[0.2em] leading-none">Gestion Optique Professionnelle</p>
              <div className="mt-1.5 space-y-0.5">
                <p className="text-[9px] text-slate-500 font-medium leading-tight">{shop.address}</p>
                <p className="text-[9px] font-bold text-slate-700">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-black uppercase tracking-widest leading-none border-2 border-slate-900 px-3 py-1.5 rounded-lg mb-1.5">Flux de Caisse</h2>
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-slate-600">
                <Calendar className="h-3 w-3 text-slate-400" />
                <span>Date: {format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
              </div>
              {printTime && (
                <div className="flex items-center justify-end gap-1.5 text-[9px] font-bold text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span>Heure: {printTime}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* INDICATEURS CLES EN LIGNE */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-3 rounded-xl border border-slate-100 text-center bg-slate-50/30">
            <div className="flex items-center justify-center gap-1.5 mb-1 opacity-40">
              <PiggyBank className="h-3 w-3" />
              <p className="text-[7px] font-black uppercase tracking-widest">Ouverture</p>
            </div>
            <p className="text-sm font-black text-slate-900 tracking-tighter">{formatCurrency(reportData.initial)}</p>
          </div>

          <div className="p-3 rounded-xl border border-primary/10 text-center bg-primary/5">
            <div className="flex items-center justify-center gap-1.5 mb-1 opacity-40">
              <ArrowRightLeft className="h-3 w-3 text-primary" />
              <p className="text-[7px] font-black uppercase tracking-widest text-primary">Flux Net Jour</p>
            </div>
            <p className={cn("text-sm font-black tracking-tighter", reportData.netFlux >= 0 ? "text-green-600" : "text-destructive")}>
              {reportData.netFlux > 0 ? "+" : ""}{formatCurrency(reportData.netFlux)}
            </p>
          </div>

          <div className="p-3 rounded-xl border border-primary/20 text-center bg-primary text-white shadow-sm">
            <div className="flex items-center justify-center gap-1.5 mb-1 opacity-80">
              <Lock className="h-3 w-3" />
              <p className="text-[7px] font-black uppercase tracking-widest">Clôture</p>
            </div>
            <p className="text-sm font-black tracking-tighter">{formatCurrency(reportData.final)}</p>
          </div>
        </div>

        {/* DETAILS DES FLUX */}
        <div className="space-y-6 mb-6">
          <section>
            <h3 className="text-[9px] font-black uppercase text-slate-400 mb-2 border-b pb-1 flex justify-between items-center tracking-[0.2em]">
              <span>Détail des Encaissements (Ventes)</span>
              <span className="text-green-600">+{formatCurrency(reportData.sales.reduce((a, b) => a + (b.montant || 0), 0))}</span>
            </h3>
            <table className="w-full text-[9px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[7px]">
                <tr>
                  <th className="p-1.5 text-left">Facture / Libellé</th>
                  <th className="p-1.5 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {reportData.sales.length > 0 ? reportData.sales.map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="p-1.5 font-bold text-slate-700">{s.label}</td>
                    <td className="p-1.5 text-right font-black text-green-600">+{formatCurrency(s.montant)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="p-3 text-center text-slate-300 italic">Aucune vente enregistrée.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase text-slate-400 mb-2 border-b pb-1 flex justify-between items-center tracking-[0.2em]">
              <span>Détail des Dépenses (Charges)</span>
              <span className="text-destructive">{formatCurrency(Math.abs(reportData.expenses.reduce((a, b) => a + (b.montant || 0), 0)))}</span>
            </h3>
            <table className="w-full text-[9px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[7px]">
                <tr>
                  <th className="p-1.5 text-left">Libellé de la Charge</th>
                  <th className="p-1.5 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {reportData.expenses.length > 0 ? reportData.expenses.map((e: any) => (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="p-1.5 font-bold text-slate-700">{e.label}</td>
                    <td className="p-1.5 text-right font-black text-destructive">{formatCurrency(e.montant)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="p-3 text-center text-slate-300 italic">Aucune dépense enregistrée.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-[9px] font-black uppercase text-slate-400 mb-2 border-b pb-1 flex justify-between items-center tracking-[0.2em]">
              <span>Versements en Banque</span>
              <span className="text-orange-600">{formatCurrency(reportData.versements.reduce((a, b) => a + (b.montant || 0), 0))}</span>
            </h3>
            <table className="w-full text-[9px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[7px]">
                <tr>
                  <th className="p-1.5 text-left">Opération</th>
                  <th className="p-1.5 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {reportData.versements.length > 0 ? reportData.versements.map((v: any) => (
                  <tr key={v.id} className="border-b border-slate-50">
                    <td className="p-1.5 font-bold text-slate-700">{v.label}</td>
                    <td className="p-1.5 text-right font-black text-orange-600">{formatCurrency(v.montant)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="p-3 text-center text-slate-300 italic">Aucun mouvement de banque.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>

        {/* Signatures */}
        <div className="mt-auto pt-6 border-t border-slate-100 grid grid-cols-2 gap-20">
          <div className="space-y-10">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">Visa Caissier</p>
            <div className="border-b border-slate-200 w-full opacity-50"></div>
          </div>
          <div className="space-y-10 text-right flex flex-col items-end">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">Visa Direction</p>
            <div className="w-[50mm] h-[20mm] border border-dashed border-slate-200 rounded-xl bg-white"></div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 mb-2 text-center border-t border-slate-50 pt-3">
          <p className="text-[7px] text-slate-300 font-bold uppercase tracking-[0.4em] italic leading-none">
            {shop.name} {generationTimestamp ? `• Rapport Généré le ${generationTimestamp}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DailyCashReportPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 tracking-[0.5em]">Chargement...</div>}>
      <DailyCashReportContent />
    </Suspense>
  );
}
