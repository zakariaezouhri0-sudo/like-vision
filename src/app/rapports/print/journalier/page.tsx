
"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Calendar, Loader2, Glasses, ThumbsUp, Clock, TrendingUp, Landmark, FileText, UserCheck, Layers } from "lucide-react";
import Link from "next/link";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, where, Timestamp, getDocs } from "firebase/firestore";
import { format, startOfDay, endOfDay, isValid } from "date-fns";
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
        if (isValid(date)) return date;
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
    document.title = `Like Vision - ${dateStr}`;
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

  const [salesDetails, setSalesDetails] = useState<Record<string, any>>({});
  const [loadingSales, setLoadingSales] = useState(false);

  useEffect(() => {
    const fetchSalesOfDay = async () => {
      if (!selectedDate) return;
      setLoadingSales(true);
      try {
        const start = startOfDay(selectedDate);
        const end = endOfDay(selectedDate);
        const q = query(
          collection(db, "sales"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end)),
          where("isDraft", "==", isPrepaMode)
        );
        const snap = await getDocs(q);
        const details: Record<string, any> = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.invoiceId) details[data.invoiceId] = data;
        });
        setSalesDetails(details);
      } catch (e) {
        console.error("Erreur chargement ventes jour:", e);
      } finally {
        setLoadingSales(false);
      }
    };
    fetchSalesOfDay();
  }, [db, selectedDate, isPrepaMode]);

  const shop = {
    name: remoteSettings?.name || DEFAULT_SHOP_SETTINGS.name,
    address: remoteSettings?.address || DEFAULT_SHOP_SETTINGS.address,
    phone: remoteSettings?.phone || DEFAULT_SHOP_SETTINGS.phone,
    icePatent: remoteSettings?.icePatent || DEFAULT_SHOP_SETTINGS.icePatent,
    logoUrl: remoteSettings?.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
  };

  const groupTransactionsByBC = (list: any[]) => {
    const grouped: any[] = [];
    const map: Record<string, any> = {};

    list.forEach(t => {
      const bcMatch = (t.clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
      const canGroup = bcMatch && ["ACHAT VERRES", "ACHAT MONTURE", "VENTE"].includes(t.type);
      
      if (canGroup) {
        const bcId = bcMatch[1];
        const key = `${t.type}-${bcId}`;
        if (map[key]) {
          map[key].montant = roundAmount(map[key].montant + t.montant);
          map[key].isGrouped = true;
          map[key].childCount = (map[key].childCount || 1) + 1;
        } else {
          map[key] = { ...t, childCount: 1 };
          grouped.push(map[key]);
        }
      } else {
        grouped.push({ ...t });
      }
    });
    return grouped;
  };

  const reportData = useMemo(() => {
    if (!rawTransactions) return { sales: [], expenses: [], versements: [], initial: 0, fluxOp: 0, totalVersements: 0, final: 0 };
    
    const filteredTransactions = rawTransactions.filter((t: any) => isPrepaMode ? t.isDraft === true : t.isDraft !== true);
    
    const initialBalance = roundAmount(session?.openingBalance || 0);
    const salesListRaw: any[] = [];
    const expensesListRaw: any[] = [];
    const versementsList: any[] = [];
    
    filteredTransactions.forEach((t: any) => {
      if (t.type === "VENTE") {
        salesListRaw.push(t);
      } else if (t.type === "VERSEMENT") {
        versementsList.push(t);
      } else {
        expensesListRaw.push(t);
      }
    });

    const salesList = groupTransactionsByBC(salesListRaw);
    const expensesList = groupTransactionsByBC(expensesListRaw);

    expensesList.sort((a, b) => {
      const priority: Record<string, number> = { "ACHAT VERRES": 1, "ACHAT MONTURE": 2, "VERSEMENT": 3, "DEPENSE": 4 };
      const pA = priority[a.type as string] || 99;
      const pB = priority[b.type as string] || 99;
      if (pA !== pB) return pA - pB;
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeA - timeB;
    });

    const totalSales = roundAmount(salesListRaw.reduce((acc, curr) => acc + Math.abs(curr.montant || 0), 0));
    const totalExpenses = roundAmount(expensesListRaw.reduce((acc, curr) => acc + Math.abs(curr.montant || 0), 0));
    const totalVersements = roundAmount(versementsList.reduce((acc, curr) => acc + Math.abs(curr.montant || 0), 0));
    
    const fluxOp = roundAmount(totalSales - totalExpenses);
    const final = roundAmount(initialBalance + fluxOp - totalVersements);

    return { sales: salesList, expenses: expensesList, versements: versementsList, initial: initialBalance, fluxOp, totalVersements, final };
  }, [rawTransactions, session, isPrepaMode]);

  if (settingsLoading || transLoading || sessionLoading || loadingSales) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center pt-2 pb-6 print:pt-0 print:pb-0 print:bg-white">
      <div className="no-print w-full max-w-[210mm] flex justify-between items-center mb-4 px-4">
        <Button variant="outline" asChild className="bg-white border-slate-200 text-slate-600 h-10 px-4 rounded-xl shadow-sm font-black text-[10px] hover:bg-slate-50"><Link href="/caisse"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR CAISSE</Link></Button>
        <div className="flex items-center gap-3"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-full border shadow-sm">A4 Portrait</span><Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 h-10 px-8 rounded-xl font-black text-xs text-white"><Printer className="mr-2 h-4 w-4" /> IMPRIMER LE RAPPORT</Button></div>
      </div>

      <div className="pdf-a4-portrait shadow-[0_0_60px_rgba(0,0,0,0.05)] bg-white print:shadow-none print:m-0 border border-slate-100 rounded-sm px-[6mm] pb-[6mm] pt-[3mm] print:pt-[3mm] flex flex-col min-h-[297mm]">
        <div className="flex justify-between items-start border-b border-slate-200 pb-2 mb-3">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-100 rounded-xl bg-white shadow-sm">{shop.logoUrl ? (<img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />) : (<div className="relative text-primary"><Glasses className="h-8 w-8" /><ThumbsUp className="h-4 w-4 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" /></div>)}</div>
            <div className="space-y-0"><h1 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name || "---"}</h1><p className="text-[8px] text-slate-500 font-bold leading-tight max-w-[300px]">{shop.address || "---"}</p><div className="flex items-center gap-2 mt-0.5"><span className="text-[8px] font-black text-slate-800 uppercase">ICE: {shop.icePatent || "---"} • Tél: {shop.phone || "---"}</span></div></div>
          </div>
          <div className="text-right"><div className="border-2 border-slate-900 px-3 py-1 rounded-md inline-block mb-1"><h2 className="text-[11px] font-black uppercase tracking-[0.2em] leading-none text-slate-900">Rapport de Caisse</h2></div><div className="space-y-0"><div className="flex items-center justify-end gap-2 text-[12px] font-black text-slate-900 uppercase"><Calendar className="h-4 w-4 text-primary/40" /><span>{format(selectedDate, "dd MMMM yyyy", { locale: fr }).toUpperCase()}</span></div><div className="flex items-center justify-end gap-2 text-[7px] font-bold text-slate-400 italic"><Clock className="h-2.5 w-2.5" /><span>Édité à {printTime}</span></div></div></div>
        </div>

        <div className="grid grid-cols-4 gap-2.5 mb-4">
          <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50/30 text-center"><p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Ouverture</p><p className="text-lg font-black text-slate-900 tabular-nums">{formatCurrency(reportData.initial, false)}</p></div>
          <div className="p-2.5 rounded-lg border border-green-300 bg-green-50/20 text-center"><p className="text-[8px] font-black uppercase tracking-widest text-green-600 mb-0.5">Flux (Op)</p><p className={cn("text-lg font-black tabular-nums", reportData.fluxOp >= 0 ? "text-green-700" : "text-red-700")}>{reportData.fluxOp > 0 ? "+" : ""}{formatCurrency(reportData.fluxOp, false)}</p></div>
          <div className="p-2.5 rounded-lg border border-orange-300 bg-orange-50/20 text-center"><p className="text-[8px] font-black uppercase tracking-widest text-orange-600 mb-0.5">Versements</p><p className="text-lg font-black text-orange-700 tabular-nums">{formatCurrency(reportData.totalVersements, false)}</p></div>
          <div className="p-2.5 rounded-lg border-2 border-slate-900 bg-white text-center"><p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Solde Clôture</p><p className="text-lg font-black text-slate-950 tabular-nums">{formatCurrency(reportData.final, false)}</p></div>
        </div>

        <div className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-900 pb-1 px-1"><h3 className="text-[11px] font-black uppercase text-slate-900 flex items-center gap-2 tracking-widest"><TrendingUp className="h-3.5 w-3.5 text-green-600" />Encaissements</h3><span className="text-[10px] font-black text-green-700 uppercase">+{formatCurrency(reportData.sales.reduce((a, b) => a + Math.abs(b.montant || 0), 0), false)}</span></div>
            <div className="overflow-hidden border border-slate-200 rounded-lg">
              <table className="w-full border-collapse">
                <thead className="bg-[#064e3b] text-white">
                  <tr><th className="p-2 text-left text-[10px] font-black uppercase tracking-widest w-[55%]">Document / Client</th><th className="p-2 text-center text-[10px] font-black uppercase tracking-widest w-20">Net</th><th className="p-2 text-center text-[10px] font-black uppercase tracking-widest text-green-400 w-20">Versé</th><th className="p-2 text-center text-[10px] font-black uppercase tracking-widest text-red-400 w-20">Reste</th><th className="p-2 text-center text-[10px] font-black uppercase tracking-widest w-16">Statut</th><th className="p-2 text-right text-[10px] font-black uppercase tracking-widest w-24">Acompte</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.sales.length > 0 ? reportData.sales.map((t: any) => {
                    let invoiceId = t.relatedId || "";
                    if (!invoiceId && t.label?.includes('VENTE')) {
                      invoiceId = t.label.replace('VENTE ', '').trim();
                    }
                    const sale = salesDetails[invoiceId];
                    const totalNet = sale ? roundAmount(Number(sale.total) - (Number(sale.remise) || 0)) : 0;
                    
                    return (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="p-2 align-middle">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-slate-800 uppercase leading-tight">
                              {t.label || `VENTE ${t.relatedId || "---"}`} {t.isGrouped && " (Σ)"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase truncate">
                              {sale?.clientName || t.clientName || "---"}
                            </span>
                          </div>
                        </td>
                        <td className="p-2 text-center font-bold text-slate-600 tabular-nums text-[10px] whitespace-nowrap">{sale ? formatCurrency(totalNet, false) : "---"}</td>
                        <td className="p-2 text-center font-bold text-green-600 tabular-nums text-[10px] whitespace-nowrap">{sale ? formatCurrency(sale.avance || 0, false) : "---"}</td>
                        <td className="p-2 text-center font-bold text-destructive tabular-nums text-[10px] whitespace-nowrap">{sale ? formatCurrency(sale.reste || 0, false) : "---"}</td>
                        <td className="p-2 text-center"><span className={cn("text-[7px] px-1 py-0.5 rounded font-black uppercase leading-none inline-block whitespace-nowrap", (sale?.statut === "Payé" || sale?.statut === "Payer") ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")}>{sale?.statut || "---"}</span></td>
                        <td className="p-2 text-right font-black text-slate-950 tabular-nums text-[11px] whitespace-nowrap">+{formatCurrency(Math.abs(t.montant), false)}</td>
                      </tr>
                    );
                  }) : (<tr><td colSpan={6} className="p-4 text-center text-slate-300 font-bold italic text-[11px]">Aucune vente.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between border-b border-slate-900 pb-1 px-1"><h3 className="text-[11px] font-black uppercase text-slate-900 flex items-center gap-2 tracking-widest"><FileText className="h-3.5 w-3.5 text-red-600" />Sorties de Caisse</h3><span className="text-[11px] font-black text-red-700 uppercase">-{formatCurrency(Math.abs(reportData.expenses.reduce((a, b) => a + Math.abs(b.montant || 0), 0)), false)}</span></div>
              <div className="overflow-hidden border border-slate-200 rounded-lg bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-[#064e3b] text-white">
                    <tr><th className="p-1.5 text-left text-[10px] font-black uppercase tracking-widest w-[40%]">Nature | Détails</th><th className="p-1.5 text-right text-[10px] font-black uppercase tracking-widest w-36">Montant</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData.expenses.length > 0 ? reportData.expenses.map((e: any) => {
                      const labelPart = e.label || "";
                      const typeStr = e.type || "";
                      const redundantPrefixes = [typeStr, "Achat monture", "Achat verres", "Versement", "Depense"];
                      let cleanedLabel = labelPart;
                      redundantPrefixes.forEach(p => {
                        const reg = new RegExp(`^${p}\\s*[:\\-']?\\s*`, 'i');
                        cleanedLabel = cleanedLabel.replace(reg, '');
                      });
                      cleanedLabel = cleanedLabel.replace(/^['"]|['"]$/g, '').trim();
                      const displayLabel = `${typeStr} | ${cleanedLabel || "---"} ${e.isGrouped ? " (Σ)" : ""}`;

                      return (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="p-1.5">
                            <div className="flex flex-col">
                              <span className="text-[11px] font-black text-slate-800 uppercase leading-tight">
                                {displayLabel}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase">
                                {e.clientName || "---"}
                              </span>
                            </div>
                          </td>
                          <td className="p-1.5 text-right font-black text-slate-950 tabular-nums text-[12px]">-{formatCurrency(Math.abs(e.montant), false)}</td>
                        </tr>
                      );
                    }) : (<tr><td colSpan={2} className="p-3 text-center text-slate-300 font-bold italic text-[11px]">Aucune dépense.</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            {reportData.versements.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-900 pb-1 px-1"><h3 className="text-[11px] font-black uppercase text-slate-900 flex items-center gap-2 tracking-widest"><Landmark className="h-3.5 w-3.5 text-orange-600" />Versements</h3><span className="text-[11px] font-black text-orange-700 uppercase">-{formatCurrency(Math.abs(reportData.totalVersements), false)}</span></div>
                <div className="overflow-hidden border border-slate-200 rounded-lg bg-white">
                  <table className="w-full border-collapse">
                    <thead className="bg-[#064e3b] text-white">
                      <tr><th className="p-1.5 text-left text-[10px] font-black uppercase tracking-widest">Détails</th><th className="p-1.5 text-right text-[10px] font-black uppercase tracking-widest">Montant</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reportData.versements.map((v: any) => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="p-1.5 text-[11px] font-bold text-slate-900 uppercase">
                            VERSEMENT | {v.label && !v.label.includes('VERSEMENT') ? v.label : "BANQUE"}
                          </td>
                          <td className="p-1.5 text-right font-black text-slate-950 tabular-nums text-[12px]">-{formatCurrency(Math.abs(v.montant), false)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-10">
          <div className="space-y-5"><div className="flex items-center gap-2 text-slate-400"><UserCheck className="h-4 w-4" /><p className="text-[9px] font-black uppercase tracking-widest">Visa Responsable</p></div><div className="border-b border-slate-200 w-full opacity-50"></div><p className="text-[11px] font-bold text-slate-900">Signature</p></div>
          <div className="text-right flex flex-col items-end"><p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Authentification</p><div className="w-[45mm] h-[18mm] border border-dashed border-slate-300 rounded-lg flex items-center justify-center bg-slate-50/20 relative"><span className="text-[9px] text-slate-200 font-black rotate-[-12deg] uppercase tracking-[0.3em] opacity-40 select-none px-4">CACHE</span></div></div>
        </div>

        <div className="mt-auto text-center border-t border-slate-50 pt-1.5"><p className="text-[7px] text-slate-400 font-black uppercase tracking-[0.5em] italic opacity-40">{shop.name || "---"} • SYSTÈME LIKE VISION</p></div>
      </div>
    </div>
  );
}

export default function DailyCashReportPage() { return (<Suspense fallback={null}><DailyCashReportContent /></Suspense>); }
