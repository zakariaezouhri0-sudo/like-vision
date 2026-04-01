"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { format, startOfDay, endOfDay, isValid } from "date-fns";
import { fr } from "date-fns/locale";

function OperationsReportContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const [printTime, setPrintTime] = useState<string>("");
  const [role, setRole] = useState<string>("OPTICIENNE");

  const selectedDate = useMemo(() => {
    const d = searchParams.get("date");
    try {
      if (d) {
        const parts = d.split('-');
        if (parts.length === 3) {
          const [y, m, d_part] = parts.map(Number);
          const date = new Date(y, m - 1, d_part);
          if (isValid(date)) return date;
        }
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
    document.title = `Opérations - ${dateStr}`;
    setRole(localStorage.getItem('user_role') || "OPTICIENNE");
    return () => { document.title = "Like Vision"; };
  }, [selectedDate]);

  const isPrepaMode = role === "PREPA";

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${dateStr}` : dateStr;
  const sessionRef = useMemoFirebase(() => doc(db, "cash_sessions", sessionDocId), [db, sessionDocId]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);

  const transQuery = useMemoFirebase(() => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, "transactions"), 
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end))
    );
  }, [db, selectedDate]);
  const { data: rawTransactions, isLoading: transLoading } = useCollection(transQuery);

  const [salesDetails, setSalesDetails] = useState<Record<string, any>>({});
  const [loadingSales, setLoadingSales] = useState(false);

  useEffect(() => {
    const fetchSalesForMatching = async () => {
      if (!selectedDate) return;
      setLoadingSales(true);
      try {
        const qSales = query(collection(db, "sales"));
        const snap = await getDocs(qSales);
        const details: Record<string, any> = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (isPrepaMode === (data.isDraft === true)) {
            if (data.invoiceId) details[data.invoiceId] = data;
          }
        });
        setSalesDetails(details);
      } catch (e) {
        console.error("Erreur chargement ventes:", e);
      } finally {
        setLoadingSales(false);
      }
    };
    fetchSalesForMatching();
  }, [db, isPrepaMode, selectedDate]);

  const reportData = useMemo(() => {
    if (!rawTransactions) return { nouvellesVentes: [], sorties: [], reglements: [], summary: { initial: 0, entrees: 0, sorties: 0, final: 0 } };
    
    const filtered = rawTransactions.filter((t: any) => isPrepaMode ? t.isDraft === true : t.isDraft !== true);
    const sorted = [...filtered].sort((a, b) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0));

    const nouvellesVentes = sorted.filter((t: any) => t.type === "VENTE" && t.isBalancePayment !== true);
    const sorties = sorted.filter((t: any) => t.type !== "VENTE");
    const reglements = sorted.filter((t: any) => t.type === "VENTE" && t.isBalancePayment === true);

    const initial = roundAmount(sessionData?.openingBalance || 0);
    const sumEntrees = filtered.filter(t => t.type === "VENTE").reduce((acc, t) => acc + Math.abs(t.montant), 0);
    const sumSorties = filtered.filter(t => t.type !== "VENTE").reduce((acc, t) => acc + Math.abs(t.montant), 0);
    const final = roundAmount(initial + sumEntrees - sumSorties);

    return {
      nouvellesVentes,
      sorties,
      reglements,
      summary: {
        initial,
        entrees: roundAmount(sumEntrees),
        sorties: roundAmount(sumSorties),
        final
      }
    };
  }, [rawTransactions, isPrepaMode, sessionData]);

  if (settingsLoading || transLoading || loadingSales || sessionLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  const renderTableRows = (data: any[]) => {
    return data.map((t: any) => {
      let invoiceId = t.relatedId || "";
      if (!invoiceId && t.label?.includes('VENTE')) invoiceId = t.label.replace('VENTE ', '').trim();
      
      const sale = salesDetails[invoiceId];
      const isVente = t.type === "VENTE";
      const totalNet = sale ? roundAmount(Number(sale.total) - (Number(sale.remise) || 0)) : null;
      const movement = Math.abs(t.montant);
      const refDisplay = isVente ? (invoiceId ? invoiceId.slice(-4) : "---") : "---";
      
      let displayLabel = isVente ? (sale?.notes || t.label || "") : t.label;
      if (t.type === "VERSEMENT" && !isVente) {
        displayLabel = `VERSEMENT | ${(t.label || "").replace(/^VERSEMENT\s*[:\-']?\s*/i, '').trim() || "BANQUE"}`;
      } else if (!isVente) {
        displayLabel = `${t.type} | ${(t.label || "").replace(new RegExp(`^${t.type}\\s*[:\\-']?\s*`, 'i'), '').trim() || "---"}`;
      }

      return (
        <tr key={t.id} className="border-b border-black">
          <td className="p-1 border-r border-black text-center text-[10px] font-bold">{refDisplay}</td>
          <td className="p-1 border-r border-black text-center text-[10px]">{format(t.createdAt?.toDate() || selectedDate, "dd/MM/yyyy")}</td>
          <td className="p-1 border-r border-black text-left text-[10px] uppercase truncate max-w-[200px]">{displayLabel}</td>
          <td className="p-1 border-r border-black text-left text-[10px] uppercase truncate">{t.clientName || "---"}</td>
          <td className="p-1 border-r border-black text-right text-[10px] tabular-nums font-medium">{isVente && totalNet !== null ? formatCurrency(totalNet, true) : ""}</td>
          <td className="p-1 border-r border-black text-right text-[10px] tabular-nums font-bold">{isVente ? formatCurrency(movement, true) : ""}</td>
          <td className="p-1 text-right text-[10px] tabular-nums font-bold">{!isVente ? formatCurrency(movement, true) : ""}</td>
        </tr>
      );
    });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-4 print:p-0">
      <div className="no-print w-full max-w-[297mm] flex justify-between items-center mb-6">
        <Button variant="outline" asChild className="h-10 px-4 rounded-xl font-black text-xs border-slate-200">
          <Link href="/caisse/sessions"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR</Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-slate-900 text-white h-10 px-8 rounded-xl font-black text-xs shadow-xl">
          <Printer className="mr-2 h-4 w-4" /> IMPRIMER (PDF)
        </Button>
      </div>

      <div className="pdf-a4-landscape w-[297mm] bg-white print:m-0 flex flex-col p-[5mm]">
        <h1 className="text-center text-xs font-bold uppercase mb-6 tracking-widest">JOURNAL DE CAISSE - {format(selectedDate, "dd/MM/yyyy")}</h1>

        <div className="mb-8 w-fit border border-black text-[10px]">
          <div className="flex border-b border-black">
            <div className="w-32 p-1 border-r border-black bg-slate-50 font-bold">SOLDE INITIAL</div>
            <div className="w-32 p-1 text-right font-bold tabular-nums">{formatCurrency(reportData.summary.initial, true)}</div>
          </div>
          <div className="flex border-b border-black">
            <div className="w-32 p-1 border-r border-black">(+) Encaissements</div>
            <div className="w-32 p-1 text-right tabular-nums">{formatCurrency(reportData.summary.entrees, true)}</div>
          </div>
          <div className="flex border-b border-black">
            <div className="w-32 p-1 border-r border-black">(-) Décaissements</div>
            <div className="w-32 p-1 text-right tabular-nums">{formatCurrency(reportData.summary.sorties, true)}</div>
          </div>
          <div className="flex font-bold bg-slate-50">
            <div className="w-32 p-1 border-r border-black">SOLDE FINAL</div>
            <div className="w-32 p-1 text-right tabular-nums">{formatCurrency(reportData.summary.final, true)}</div>
          </div>
        </div>

        <table className="w-full border-collapse border border-black table-fixed">
          <thead>
            <tr className="bg-slate-100 border-b border-black">
              <th className="w-[8%] p-1 border-r border-black text-center text-[10px] font-bold">Réf</th>
              <th className="w-[10%] p-1 border-r border-black text-center text-[10px] font-bold">Date</th>
              <th className="w-[25%] p-1 border-r border-black text-center text-[10px] font-bold">Libellé</th>
              <th className="w-[20%] p-1 border-r border-black text-center text-[10px] font-bold">Nom client</th>
              <th className="w-[12%] p-1 border-r border-black text-center text-[10px] font-bold">Montant Tot</th>
              <th className="w-[12%] p-1 border-r border-black text-center text-[10px] font-bold">Mouvement</th>
              <th className="w-[13%] p-1 text-center text-[10px] font-bold">SORTIE</th>
            </tr>
          </thead>
          <tbody>
            {renderTableRows(reportData.nouvellesVentes)}
            {reportData.nouvellesVentes.length > 0 && <tr className="h-4 border-b border-black"><td colSpan={7}></td></tr>}
            {renderTableRows(reportData.sorties)}
            {reportData.sorties.length > 0 && <tr className="h-4 border-b border-black"><td colSpan={7}></td></tr>}
            {renderTableRows(reportData.reglements)}
            
            <tr className="bg-slate-50 font-bold border-t-2 border-black">
              <td colSpan={5} className="p-2 border-r border-black text-center text-[11px] uppercase tracking-widest">TOTAL GÉNÉRAL</td>
              <td className="p-2 border-r border-black text-right text-[11px] tabular-nums">{formatCurrency(reportData.summary.entrees, true)}</td>
              <td className="p-2 text-right text-[11px] tabular-nums">{formatCurrency(reportData.summary.sorties, true)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-auto pt-4 text-center">
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest italic opacity-50">
            LIKE VISION SYSTEM • DOCUMENT GÉNÉRÉ LE {format(new Date(), "dd/MM/yyyy")} À {printTime}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function OperationsReportPage() { return <Suspense fallback={null}><OperationsReportContent /></Suspense>; }
