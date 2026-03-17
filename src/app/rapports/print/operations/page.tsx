"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Calendar, Loader2, Glasses, ThumbsUp, Clock, Download, Layers } from "lucide-react";
import Link from "next/link";
import { formatCurrency, cn, roundAmount, formatMAD } from "@/lib/utils";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { format, startOfDay, endOfDay, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";

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

  const urlDraft = searchParams.get("draft");
  const isPrepaMode = urlDraft !== null ? urlDraft === "true" : role === "PREPA";

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

  const transQuery = useMemoFirebase(() => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, "transactions"), 
      where("isDraft", "==", isPrepaMode),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end))
    );
  }, [db, isPrepaMode, selectedDate]);
  const { data: rawTransactions, isLoading: transLoading } = useCollection(transQuery);

  const [salesDetails, setSalesDetails] = useState<Record<string, any>>({});
  const [loadingSales, setLoadingSales] = useState(false);

  useEffect(() => {
    const fetchSalesForMatching = async () => {
      if (!selectedDate) return;
      setLoadingSales(true);
      
      try {
        const qSales = query(
          collection(db, "sales"), 
          where("isDraft", "==", isPrepaMode)
        );
        const snap = await getDocs(qSales);
        const details: Record<string, any> = {};
        snap.docs.forEach(doc => {
          const data = doc.data();
          if (data.invoiceId) details[data.invoiceId] = data;
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

  const groupedTransactions = useMemo(() => {
    if (!rawTransactions) return { nouvellesVentes: [], sorties: [], reglements: [] };
    
    const sorted = [...rawTransactions].sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeA - timeB;
    });

    const vNew = sorted.filter((t: any) => t.type === "VENTE" && t.isBalancePayment !== true);
    const vSorties = sorted.filter((t: any) => t.type !== "VENTE");
    const vRegl = sorted.filter((t: any) => t.type === "VENTE" && t.isBalancePayment === true);

    return {
      nouvellesVentes: groupTransactionsByBC(vNew),
      sorties: groupTransactionsByBC(vSorties),
      reglements: groupTransactionsByBC(vRegl)
    };
  }, [rawTransactions]);

  const mapToExcelRow = (t: any) => {
    if (!t.id) return {};

    let invoiceId = t.relatedId || "";
    if (!invoiceId && t.label?.includes('VENTE')) {
      invoiceId = t.label.replace('VENTE ', '').trim();
    }
    
    const sale = salesDetails[invoiceId];
    const isVente = t.type === "VENTE";
    const totalNet = sale ? roundAmount(Number(sale.total) - (Number(sale.remise) || 0)) : null;
    const movement = Math.abs(t.montant);
    const refDisplay = isVente ? (invoiceId ? invoiceId.slice(-4) : "---") : "---";
    
    let displayLabel = isVente ? (sale?.notes || t.label || "") : t.label;
    if (t.type === "VERSEMENT" && !isVente) {
      const clean = (t.label || "").replace(/^VERSEMENT\s*[:\-']?\s*/i, '').trim();
      displayLabel = `VERSEMENT | ${clean || "BANQUE"}`;
    }

    return {
      "Réf": refDisplay,
      "Date": t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "--/--/----",
      "Libellé": displayLabel,
      "Nom client": t.clientName || "---",
      "Montant Tot": formatMAD(isVente && totalNet !== null ? totalNet : ""),
      "Mouvement": formatMAD(isVente ? movement : ""),
      "SORTIE": formatMAD(!isVente ? movement : "")
    };
  };

  const handleExportExcel = () => {
    const excelRows = [
      ...groupedTransactions.nouvellesVentes.map(mapToExcelRow),
      {}, 
      ...groupedTransactions.sorties.map(mapToExcelRow),
      {}, 
      ...groupedTransactions.reglements.map(mapToExcelRow)
    ];

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    
    // Ajustement des largeurs pour Excel
    worksheet['!cols'] = [
      { wch: 10 }, // Réf
      { wch: 12 }, // Date
      { wch: 35 }, // Libellé
      { wch: 25 }, // Nom client
      { wch: 18 }, // Montant Tot
      { wch: 18 }, // Mouvement
      { wch: 18 }, // SORTIE
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Opérations");
    XLSX.writeFile(workbook, `Like Vision - Opérations ${format(selectedDate, "dd-MM-yyyy")}.xlsx`);
  };

  const renderTableRows = (title: string, data: any[]) => {
    if (data.length === 0) return null;
    return (
      <>
        <tr className="bg-slate-50"><td colSpan={7} className="p-2 text-center text-[10px] font-black uppercase text-primary border-y-2 border-slate-950">{title}</td></tr>
        {data.map((t: any) => {
          let invoiceId = t.relatedId || "";
          if (!invoiceId && t.label?.includes('VENTE')) {
            invoiceId = t.label.replace('VENTE ', '').trim();
          }
          const sale = salesDetails[invoiceId];
          const isVente = t.type === "VENTE";
          const totalNet = sale ? roundAmount(Number(sale.total) - (Number(sale.remise) || 0)) : null;
          const movement = Math.abs(t.montant);
          const refDisplay = isVente ? (invoiceId ? invoiceId.slice(-4) : "---") : "---";
          
          let cleanedLabel = t.label || "";
          if (!isVente) {
            const typeStr = t.type || "";
            const redundantPrefixes = [typeStr, "Achat monture", "Achat verres", "Versement", "Depense"];
            redundantPrefixes.forEach(p => {
              const reg = new RegExp(`^${p}\\s*[:\\-']?\\s*`, 'i');
              cleanedLabel = cleanedLabel.replace(reg, '');
            });
            cleanedLabel = cleanedLabel.replace(/^['"]|['"]$/g, '').trim();
          }

          let displayLabel = isVente 
            ? (sale?.notes || "") 
            : (t.type === "VERSEMENT" ? `VERSEMENT | ${cleanedLabel || "BANQUE"}` : `${t.type} | ${cleanedLabel || "---"}`);

          return (
            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
              <td className="p-3 text-[11px] font-black text-primary border-r-2 border-slate-950 tabular-nums">{refDisplay}</td>
              <td className="p-3 text-center text-[10px] font-bold text-slate-500 border-r-2 border-slate-950 tabular-nums">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "--/--/----"}</td>
              <td className="p-3 text-[11px] font-black text-slate-800 uppercase border-r-2 border-slate-950">
                <div className="flex items-center gap-2">
                  {displayLabel}
                  {t.isGrouped && <Badge variant="outline" className="text-[7px] font-black h-3 px-1 border-slate-900 text-slate-900 uppercase">Σ {t.childCount}</Badge>}
                </div>
              </td>
              <td className="p-3 text-[11px] font-bold text-slate-600 uppercase border-r-2 border-slate-950 truncate">{t.clientName || "---"}</td>
              <td className="p-3 text-right text-[11px] font-black text-slate-900 border-r-2 border-slate-950 tabular-nums">{isVente && totalNet !== null ? formatCurrency(totalNet, false) : ""}</td>
              <td className="p-3 text-right text-[11px] font-black border-r-2 border-slate-950 tabular-nums">{isVente ? (<span className="text-green-600">+{formatCurrency(movement, false)}</span>) : ""}</td>
              <td className="p-3 text-right text-[11px] font-black text-red-600 tabular-nums">{!isVente ? `-${formatCurrency(movement, false)}` : ""}</td>
            </tr>
          );
        })}
      </>
    );
  };

  if (settingsLoading || transLoading || loadingSales) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-4 pb-10 print:pt-0 print:pb-0 print:bg-white">
      <div className="no-print w-full max-w-[297mm] flex justify-between items-center mb-6 px-4">
        <Button variant="outline" asChild className="bg-white border-slate-200 text-slate-600 h-11 px-6 rounded-xl shadow-sm font-black text-xs hover:bg-slate-50">
          <Link href="/caisse/sessions"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR SESSIONS</Link>
        </Button>
        <div className="flex items-center gap-3">
          <Button onClick={handleExportExcel} variant="outline" className="bg-white border-green-200 text-green-600 h-11 px-6 rounded-xl shadow-sm font-black text-xs hover:bg-green-50">
            <Download className="mr-2 h-4 w-4" /> TÉLÉCHARGER EXCEL
          </Button>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-5 py-2.5 rounded-full border shadow-sm">Format Paysage A4</span>
          <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 h-11 px-10 rounded-xl font-black text-sm text-white">
            <Printer className="mr-2 h-4 w-4" /> IMPRIMER LA LISTE
          </Button>
        </div>
      </div>

      <div className="pdf-a4-landscape shadow-2xl bg-white print:shadow-none print:m-0 border border-slate-100 rounded-sm p-[10mm] flex flex-col min-h-[210mm] w-[297mm]">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-100 rounded-2xl bg-white shadow-sm">
              {shop.logoUrl ? (<img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />) : (<div className="relative text-primary"><Glasses className="h-10 w-10" /><ThumbsUp className="h-5 w-5 absolute -top-1 -right-1 bg-white p-0.5 rounded-full border border-primary" /></div>)}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name || "---"}</h1>
              <p className="text-[10px] text-slate-500 font-bold leading-tight mt-1 uppercase tracking-widest">{shop.address || "---"}</p>
              <p className="text-[10px] font-black text-slate-800 uppercase mt-1">ICE: {shop.icePatent || "---"} • Tél: {shop.phone || "---"}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-slate-900 text-white px-5 py-2 rounded-xl inline-block mb-2 shadow-lg">
              <h2 className="text-base font-black uppercase tracking-[0.2em] leading-none">Détail des Opérations</h2>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-end gap-2 text-lg font-black text-slate-900 uppercase">
                <Calendar className="h-5 w-5 text-primary" />
                <span>{format(selectedDate, "dd MMMM yyyy", { locale: fr }).toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-end gap-2 text-[9px] font-bold text-slate-400 italic">
                <Clock className="h-3 w-3" />
                <span>Généré le {format(new Date(), "dd/MM/yyyy")} à {printTime}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden border-2 border-slate-950 rounded-xl bg-white shadow-sm">
          <table className="w-full border-collapse">
            <thead className="bg-[#6a8036] text-white border-b-2 border-slate-950">
              <tr>
                <th className="p-3 text-left text-[11px] font-black uppercase tracking-widest border-r-2 border-slate-950 w-24">Réf</th>
                <th className="p-3 text-center text-[11px] font-black uppercase tracking-widest border-r-2 border-slate-950 w-24">Date</th>
                <th className="p-3 text-left text-[11px] font-black uppercase tracking-widest border-r-2 border-slate-950">Libellé</th>
                <th className="p-3 text-left text-[11px] font-black uppercase tracking-widest border-r-2 border-slate-950">Nom client</th>
                <th className="p-3 text-right text-[11px] font-black uppercase tracking-widest border-r-2 border-slate-950 w-32">Montant Tot</th>
                <th className="p-3 text-right text-[11px] font-black uppercase tracking-widest border-r-2 border-slate-950 w-44">Mouvement</th>
                <th className="p-3 text-right text-[11px] font-black uppercase tracking-widest w-32">SORTIE</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-950">
              {renderTableRows("NOUVELLES VENTES", groupedTransactions.nouvellesVentes)}
              {renderTableRows("SORTIES (ACHATS & CHARGES)", groupedTransactions.sorties)}
              {renderTableRows("RÈGLEMENTS DES RESTES", groupedTransactions.reglements)}
              {(groupedTransactions.nouvellesVentes.length === 0 && groupedTransactions.sorties.length === 0 && groupedTransactions.reglements.length === 0) && (
                <tr><td colSpan={7} className="p-10 text-center text-slate-300 font-black italic uppercase tracking-widest">Aucune opération enregistrée pour ce jour.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex justify-between items-end border-t border-slate-100 pt-4">
          <div className="flex gap-10">
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Visa Responsable</p>
              <div className="w-40 border-b-2 border-slate-950 pt-10"></div>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Cachet Magasin</p>
              <div className="w-40 h-20 border-2 border-dashed border-slate-950 rounded-xl flex items-center justify-center bg-slate-50/50">
                <span className="text-[8px] text-slate-200 font-black rotate-[-12deg] uppercase opacity-40">Authentification</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] text-slate-300 font-black uppercase tracking-[0.5em] italic">SYSTÈME LIKE VISION • RAPPORT DÉTAILLÉ</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OperationsReportPage() { return <Suspense fallback={null}><OperationsReportContent /></Suspense>; }