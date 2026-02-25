"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Calendar, Loader2, Glasses, ThumbsUp } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { formatCurrency, cn } from "@/lib/utils";
import { Suspense, useMemo } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy } from "firebase/firestore";
import { format, startOfDay, endOfDay, isBefore, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";

function DailyCashReportContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();

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
    if (!transactions) return { sales: [], expenses: [], versements: [], apports: [], initial: 0, final: 0 };

    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);

    let initialBalance = 0;
    const salesList: any[] = [];
    const expensesList: any[] = [];
    const versementsList: any[] = [];
    const apportsList: any[] = [];

    transactions.forEach((t: any) => {
      const tDate = t.createdAt?.toDate ? t.createdAt.toDate() : null;
      if (!tDate) return;

      if (isBefore(tDate, start)) {
        initialBalance += (t.montant || 0);
      } else if (isWithinInterval(tDate, { start, end })) {
        if (t.type === "VENTE") salesList.push(t);
        else if (t.type === "DEPENSE") expensesList.push(t);
        else if (t.type === "VERSEMENT") versementsList.push(t);
        else if (t.type === "APPORT") apportsList.push(t);
      }
    });

    const dayTotal = [...salesList, ...expensesList, ...versementsList, ...apportsList].reduce((acc, curr) => acc + (curr.montant || 0), 0);

    return { 
      sales: salesList, 
      expenses: expensesList, 
      versements: versementsList, 
      apports: apportsList, 
      initial: initialBalance, 
      final: initialBalance + dayTotal 
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
    <div className="min-h-screen bg-white flex flex-col items-center py-12 print:py-0">
      <div className="no-print w-full max-w-[210mm] flex justify-between mb-8 px-4">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-slate-200 text-slate-600 h-12 px-6 rounded-2xl shadow-sm font-black text-xs">
          <Link href="/rapports">
            <ArrowLeft className="mr-3 h-5 w-5" /> RETOUR
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 h-12 px-10 rounded-2xl font-black text-base text-white">
          <Printer className="mr-3 h-5 w-5" /> IMPRIMER LE RAPPORT
        </Button>
      </div>

      <div className="pdf-a4-portrait shadow-none bg-white print:m-0 border border-slate-100 rounded-sm p-[15mm] flex flex-col">
        <div className="flex justify-between items-start border-b border-slate-100 pb-8 mb-10">
          <div className="flex gap-6">
            <div className="h-20 w-20 flex items-center justify-center shrink-0 overflow-hidden relative">
              {shop.logoUrl ? (
                <Image src={shop.logoUrl} alt="Logo" fill className="object-contain" />
              ) : (
                <div className="relative text-primary">
                  <Glasses className="h-12 w-12" />
                  <ThumbsUp className="h-6 w-6 absolute -top-2 -right-2 bg-white p-0.5 rounded-full" />
                </div>
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name}</h1>
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] leading-none">Gestion Optique Professionnelle</p>
              <div className="mt-2.5 space-y-0.5">
                <p className="text-[10px] text-slate-500 font-medium leading-tight">{shop.address}</p>
                <p className="text-[10px] font-bold text-slate-700">Tél: {shop.phone} • ICE: {shop.icePatent}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-base font-black uppercase tracking-widest leading-none border-2 border-slate-900 px-4 py-2 rounded-lg mb-2">Flux de Caisse</h2>
            <div className="flex items-center justify-end gap-2 text-[10px] font-bold text-slate-600">
              <Calendar className="h-3 w-3 text-slate-400" />
              <span>Date: {format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="p-4 rounded-2xl border border-slate-100 text-center">
            <p className="text-[8px] font-black uppercase text-slate-400 mb-1 tracking-widest">Solde Initial (Ouverture)</p>
            <p className="text-xl font-black text-slate-900 tracking-tighter">{formatCurrency(reportData.initial)}</p>
          </div>
          <div className="p-4 rounded-2xl border-2 border-primary/10 text-center">
            <p className="text-[8px] font-black uppercase text-primary mb-1 tracking-widest">Solde Final (Clôture)</p>
            <p className="text-xl font-black text-primary tracking-tighter">{formatCurrency(reportData.final)}</p>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          <section>
            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 border-b pb-1 flex justify-between items-center tracking-[0.2em]">
              <span>Détail des Ventes (Encaissements)</span>
              <span className="text-green-600">+{formatCurrency(reportData.sales.reduce((a, b) => a + (b.montant || 0), 0))}</span>
            </h3>
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[8px]">
                <tr>
                  <th className="p-2 text-left">Facture / Libellé</th>
                  <th className="p-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {reportData.sales.length > 0 ? reportData.sales.map((s: any) => (
                  <tr key={s.id} className="border-b border-slate-50">
                    <td className="p-2 font-bold text-slate-700">{s.label}</td>
                    <td className="p-2 text-right font-black text-green-600">+{formatCurrency(s.montant)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="p-4 text-center text-slate-300 italic">Aucune vente enregistrée.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 border-b pb-1 flex justify-between items-center tracking-[0.2em]">
              <span>Détail des Dépenses (Charges)</span>
              <span className="text-destructive">{formatCurrency(Math.abs(reportData.expenses.reduce((a, b) => a + (b.montant || 0), 0)))}</span>
            </h3>
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[8px]">
                <tr>
                  <th className="p-2 text-left">Libellé de la Charge</th>
                  <th className="p-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {reportData.expenses.length > 0 ? reportData.expenses.map((e: any) => (
                  <tr key={e.id} className="border-b border-slate-50">
                    <td className="p-2 font-bold text-slate-700">{e.label}</td>
                    <td className="p-2 text-right font-black text-destructive">{formatCurrency(e.montant)}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="p-4 text-center text-slate-300 italic">Aucune dépense enregistrée.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 border-b pb-1 flex justify-between items-center tracking-[0.2em]">
              <span>Versements en Banque / Apports</span>
              <span className="text-orange-600">{formatCurrency(reportData.versements.reduce((a, b) => a + (b.montant || 0), 0) + reportData.apports.reduce((a, b) => a + (b.montant || 0), 0))}</span>
            </h3>
            <table className="w-full text-[10px]">
              <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[8px]">
                <tr>
                  <th className="p-2 text-left">Opération</th>
                  <th className="p-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {[...reportData.versements, ...reportData.apports].length > 0 ? [...reportData.versements, ...reportData.apports].map((v: any) => (
                  <tr key={v.id} className="border-b border-slate-50">
                    <td className="p-2 font-bold text-slate-700">{v.label}</td>
                    <td className={cn("p-2 text-right font-black", v.montant >= 0 ? "text-green-600" : "text-orange-600")}>
                      {formatCurrency(v.montant)}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={2} className="p-4 text-center text-slate-300 italic">Aucun mouvement de banque.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>

        <div className="mt-auto pt-12 border-t border-slate-100 grid grid-cols-2 gap-20">
          <div className="space-y-12">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">Visa Caissier</p>
            <div className="border-b border-slate-200 w-full opacity-50"></div>
          </div>
          <div className="space-y-12 text-right flex flex-col items-end">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-[0.2em]">Visa Direction</p>
            <div className="w-[60mm] h-[25mm] border border-dashed border-slate-200 rounded-xl bg-white"></div>
          </div>
        </div>

        <div className="mt-8 mb-8 text-center border-t border-slate-50 pt-4">
          <p className="text-[7px] text-slate-300 font-bold uppercase tracking-[0.4em] italic">
            {shop.name} • Rapport Généré le {new Date().toLocaleString("fr-FR")}
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