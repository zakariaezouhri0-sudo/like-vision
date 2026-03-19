"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Loader2, 
  FileText, 
  RotateCcw,
  Clock,
  ChevronRight,
  Trash2,
  MoreVertical,
  Download,
  Calendar,
  ArrowRight,
  Layers
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency, formatMAD, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, updateDoc, doc, query, orderBy, deleteDoc, limit, getDocs, where, getDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, getDay, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";

function SessionsContent() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [isClientReady, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    setRole(savedRole);
    setIsHydrated(true);
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';
  const isPrepaMode = role === 'PREPA';

  const sessionsQuery = useMemoFirebase(() => query(
    collection(db, "cash_sessions"), 
    orderBy("date", "desc"),
    limit(500)
  ), [db]);
  
  const { data: rawSessions, isLoading: loading } = useCollection(sessionsQuery);

  const sessions = useMemo(() => {
    if (!rawSessions) return [];
    return rawSessions
      .filter(s => isPrepaMode ? s.isDraft === true : s.isDraft !== true);
  }, [rawSessions, isPrepaMode]);

  const groupedSessions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    sessions.forEach(s => {
      const d = parseISO(s.date);
      if (isValid(d)) {
        const monthKey = format(d, "yyyy-MM");
        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(s);
      }
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const handleDeleteSession = async (id: string, date: string) => {
    if (!isAdminOrPrepa) return;
    if (!confirm(`Supprimer définitivement la session du ${date} ?`)) return;
    try {
      await deleteDoc(doc(db, "cash_sessions", id));
      toast({ variant: "success", title: "Session supprimée" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const handleReopenSession = async (id: string) => {
    if (!confirm("Ré-ouvrir cette session ?")) return;
    try {
      await updateDoc(doc(db, "cash_sessions", id), {
        status: "OPEN", closedAt: null, closedBy: null, closingBalanceReal: null, closingBalanceTheoretical: null, discrepancy: null
      });
      toast({ variant: "success", title: "Session ré-ouverte" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const handleExportMonthExcel = async (monthKey: string, sessionsOfMonth: any[]) => {
    try {
      const [year, month] = monthKey.split('-').map(Number);
      const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: fr }).toUpperCase();
      
      const rows = sessionsOfMonth.map(s => {
        const d = parseISO(s.date);
        return {
          "Date": isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date,
          "Statut": s.status === "CLOSED" ? "CLÔTURÉE" : "EN COURS",
          "Initial": s.openingBalance || 0,
          "Flux Net": (s.totalSales || 0) - (s.totalExpenses || 0),
          "Versements": s.totalVersements || 0,
          "Final": s.closingBalanceReal || (s.openingBalance + (s.totalSales || 0) - (s.totalExpenses || 0) - (s.totalVersements || 0))
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = 2; C <= 5; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && cell.t === 'n') {
            cell.z = '#,##0.00 "MAD"';
          }
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sessions");
      XLSX.writeFile(wb, `Like Vision - Sessions ${monthName}.xlsx`);
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de l'export mensuel" });
    }
  };

  const handleExportDayExcel = async (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (!isValid(d)) throw new Error("Date invalide");

      const start = startOfDay(d);
      const end = endOfDay(d);
      
      const sessionDocId = isPrepaMode ? `DRAFT-${dateStr}` : dateStr;
      const sessionDocRef = doc(db, "cash_sessions", sessionDocId);
      const sessionSnap = await getDoc(sessionDocRef);
      const sessionData = sessionSnap.exists() ? sessionSnap.data() : null;
      const initialBalance = sessionData?.openingBalance || 0;

      const q = query(
        collection(db, "transactions"),
        where("isDraft", "==", isPrepaMode)
      );
      
      const snap = await getDocs(q);
      const allTrans = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(t => {
          if (!t.createdAt?.toDate) return false;
          const tDate = t.createdAt.toDate();
          return tDate >= start && tDate <= end;
        });

      if (allTrans.length === 0) {
        toast({ title: "Info", description: "Aucune opération enregistrée pour ce jour." });
        return;
      }

      const totalEncaissements = allTrans
        .filter((t: any) => t.type === "VENTE")
        .reduce((acc: number, t: any) => acc + Math.abs(t.montant), 0);
      
      const totalDecaissements = allTrans
        .filter((t: any) => t.type !== "VENTE")
        .reduce((acc: number, t: any) => acc + Math.abs(t.montant), 0);
      
      const finalBalance = initialBalance + totalEncaissements - totalDecaissements;

      const qSales = query(
        collection(db, "sales"),
        where("isDraft", "==", isPrepaMode)
      );
      const salesSnap = await getDocs(qSales);
      const salesMap: Record<string, any> = {};
      salesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.invoiceId) salesMap[data.invoiceId] = data;
      });

      const mapRow = (t: any) => {
        if (!t.id) return ["", "", "", "", "", "", ""];

        let invoiceId = t.relatedId || "";
        if (!invoiceId && t.label?.includes('VENTE')) {
          invoiceId = t.label.replace('VENTE ', '').trim();
        }
        
        const sale = salesMap[invoiceId];
        const isVente = t.type === "VENTE";
        const totalNet = sale ? roundAmount(Number(sale.total) - (Number(sale.remise) || 0)) : null;
        const movement = Math.abs(t.montant);
        const refDisplay = isVente ? (invoiceId ? invoiceId.slice(-4) : "---") : "---";
        
        let displayLabel = isVente ? (sale?.notes || t.label || "") : t.label;
        if (t.type === "VERSEMENT" && !isVente) {
          const clean = (t.label || "").replace(/^VERSEMENT\s*[:\-']?\s*/i, '').trim();
          displayLabel = `VERSEMENT | ${clean || "BANQUE"}`;
        } else if (!isVente) {
          const typeStr = t.type || "";
          const redundantPrefixes = [typeStr, "Achat monture", "Achat verres", "Versement", "Depense"];
          let cleanedLabel = t.label || "";
          redundantPrefixes.forEach(p => {
            const reg = new RegExp(`^${p}\\s*[:\\-']?\\s*`, 'i');
            cleanedLabel = cleanedLabel.replace(reg, '');
          });
          cleanedLabel = cleanedLabel.replace(/^['"]|['"]$/g, '').trim();
          displayLabel = `${typeStr} | ${cleanedLabel || "---"}`;
        }

        return [
          refDisplay,
          t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "--/--/----",
          displayLabel,
          t.clientName || "---",
          isVente && totalNet !== null ? totalNet : null,
          isVente ? movement : null,
          !isVente ? movement : null
        ];
      };

      const nouveauxVentes = allTrans.filter((t: any) => t.type === "VENTE" && t.isBalancePayment !== true);
      
      // Tri des dépenses selon l'ordre : ACHAT VERRES > ACHAT MONTURE > DEPENSE > VERSEMENT
      const sortedSorties = allTrans.filter((t: any) => t.type !== "VENTE").sort((a, b) => {
        const p: Record<string, number> = { "ACHAT VERRES": 1, "ACHAT MONTURE": 2, "DEPENSE": 3, "VERSEMENT": 4 };
        const pA = p[a.type] || 3;
        const pB = p[b.type] || 3;
        if (pA !== pB) return pA - pB;
        return (a.createdAt?.toDate?.().getTime() || 0) - (b.createdAt?.toDate?.().getTime() || 0);
      });

      const reglementsRestes = allTrans.filter((t: any) => t.type === "VENTE" && t.isBalancePayment === true);

      const aoaData = [
        [`JOURNAL DE CAISSE - ${format(d, "dd/MM/yyyy")}`, "", "", "", "", "", ""],
        ["", "", "", "", "", "", ""],
        ["SOLDE INITIAL", initialBalance, "", "", "", "", ""],
        ["(+) Encaissements", totalEncaissements, "", "", "", "", ""],
        ["(-) Décaissements", totalDecaissements, "", "", "", "", ""],
        ["SOLDE FINAL", finalBalance, "", "", "", "", ""],
        ["", "", "", "", "", "", ""],
        ["Réf", "Date", "Libellé", "Nom client", "Montant Tot", "Mouvement", "SORTIE"],
        ...nouveauxVentes.map(mapRow),
        [""],
        ...sortedSorties.map(mapRow),
        [""],
        ...reglementsRestes.map(mapRow),
        [""],
        ["TOTAL GENERAL", "", "", "", "", totalEncaissements, totalDecaissements]
      ];

      const ws = XLSX.utils.aoa_to_sheet(aoaData);
      
      // Fusion et Centrage du Titre (A1:G2)
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 1, c: 6 } }
      ];

      // Styles de base pour le titre fusionné (via l'objet cell si supporté, sinon via formatage simple)
      const titleCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
      if (titleCell) {
        titleCell.s = {
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true, sz: 14 }
        };
      }

      // Formatage des cellules MAD
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:G1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = 0; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell && cell.t === 'n') {
            cell.z = '#,##0.00 "MAD"';
          }
        }
      }

      // Calcul des largeurs de colonnes "Sur Mesure" (Auto-fit)
      const colWidths = aoaData.reduce((acc, row) => {
        row.forEach((cell, i) => {
          const length = cell ? cell.toString().length : 0;
          if (!acc[i] || length > acc[i]) {
            acc[i] = length;
          }
        });
        return acc;
      }, [] as number[]);

      ws['!cols'] = colWidths.map(w => ({ wch: w + 5 })); // +5 pour un peu d'espace de respiration

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Journal");
      XLSX.writeFile(wb, `Like Vision - Journal ${dateStr}.xlsx`);
    } catch (e) {
      console.error("Export error:", e);
      toast({ variant: "destructive", title: "Erreur lors de l'exportation" });
    }
  };

  if (!isClientReady || loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="space-y-10 pb-20 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary/40" />
            Journal des Sessions
          </h1>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] ml-11">Historique complet et analyses mensuelles.</p>
        </div>
        <Button onClick={() => router.push('/caisse')} variant="outline" className="h-12 px-8 rounded-2xl font-black text-[10px] uppercase border-slate-200 bg-white text-slate-600 shadow-xl shadow-slate-200/50 hover:bg-slate-50 hover:scale-105 active:scale-95 transition-all">
          <RotateCcw className="mr-3 h-4 w-4" /> RETOUR CAISSE
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={[groupedSessions[0]?.[0]]} className="space-y-8">
        {groupedSessions.length === 0 ? (
          <Card className="p-24 text-center rounded-[48px] border-dashed border-2 border-slate-100 bg-white">
            <p className="text-[10px] font-black uppercase opacity-20 tracking-[0.5em]">Aucune donnée disponible.</p>
          </Card>
        ) : (
          groupedSessions.map(([monthKey, monthSessions]) => {
            const [year, month] = monthKey.split('-').map(Number);
            const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: fr }).toUpperCase();
            const totalFluxNet = monthSessions.reduce((acc, s) => acc + (s.totalSales || 0) - (s.totalExpenses || 0), 0);

            return (
              <AccordionItem key={monthKey} value={monthKey} className="border-none">
                <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/60 overflow-hidden border border-slate-50 transition-all duration-500 hover:border-primary/10">
                  <div className="grid grid-cols-1 md:grid-cols-3 items-center px-8 md:px-12 py-2">
                    <div className="flex justify-start">
                      <AccordionTrigger className="p-0 hover:no-underline flex items-center gap-6 group">
                        <div className="h-9 w-9 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/10 transition-all duration-300 shadow-inner">
                          <ChevronRight className="h-4 w-4 text-primary/60 transition-transform duration-500 group-data-[state=open]:rotate-90" />
                        </div>
                        <span className="text-[13px] font-black text-slate-800 tracking-[0.2em] uppercase">
                          {monthName}
                        </span>
                      </AccordionTrigger>
                    </div>

                    <div className="flex justify-center my-2 md:my-0">
                      {role === 'OPTICIENNE' ? (
                        <div className="h-px w-8 bg-slate-100 opacity-50" />
                      ) : (
                        <div className="bg-slate-50/80 px-6 py-1.5 rounded-2xl border border-slate-100/50 shadow-inner flex flex-col items-center min-w-[180px]">
                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-[0.4em] mb-0.5">
                            FLUX NET MENSUEL
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-green-600 tracking-tighter tabular-nums leading-none">
                              {formatCurrency(totalFluxNet)}
                            </span>
                            <span className="text-[9px] font-black text-green-600/30 uppercase">DH</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={(e) => { e.stopPropagation(); handleExportMonthExcel(monthKey, monthSessions); }}
                        variant="outline"
                        className="h-9 px-6 rounded-xl font-black text-[9px] uppercase border-slate-100 bg-white text-slate-500 shadow-sm transition-all hover:bg-primary hover:text-white hover:border-primary group"
                      >
                        <Download className="h-3.5 w-3.5 mr-2 transition-transform group-hover:-translate-y-0.5" />
                        EXCEL {month.toString().padStart(2, '0')}
                      </Button>
                    </div>
                  </div>

                  <AccordionContent className="px-6 md:px-10 pb-10 pt-0">
                    <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-inner">
                      <Table>
                        <TableHeader className="bg-slate-50/80">
                          <TableRow className="hover:bg-transparent border-b border-slate-100">
                            <TableHead className="text-[9px] uppercase font-black px-8 py-5 text-slate-400 tracking-widest">Date & Statut</TableHead>
                            <TableHead className="text-center text-[9px] uppercase font-black px-2 py-5 text-slate-400 tracking-widest">Ouverture</TableHead>
                            <TableHead className="text-right text-[9px] uppercase font-black px-2 py-5 text-slate-400 tracking-widest">Initial</TableHead>
                            <TableHead className="text-right text-[9px] uppercase font-black px-2 py-5 text-slate-400 tracking-widest">Flux (Net)</TableHead>
                            <TableHead className="text-right text-[9px] uppercase font-black px-2 py-5 text-slate-400 tracking-widest">Versements</TableHead>
                            <TableHead className="text-right text-[9px] uppercase font-black px-2 py-5 text-slate-400 tracking-widest">Final</TableHead>
                            <TableHead className="text-center text-[9px] uppercase font-black px-2 py-5 text-slate-400 tracking-widest">Clôture</TableHead>
                            <TableHead className="text-right text-[9px] uppercase font-black px-8 py-5 text-slate-400 tracking-widest w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthSessions.map((s: any) => {
                            const d = parseISO(s.date);
                            const isSunday = isValid(d) && getDay(d) === 0;
                            const isClosed = s.status === "CLOSED";
                            const fluxNet = (s.totalSales || 0) - (s.totalExpenses || 0);

                            return (
                              <TableRow key={s.id} className={cn("hover:bg-slate-50/50 transition-all border-b border-slate-50 last:border-0", isSunday && "bg-red-50/40")}>
                                <TableCell className="px-8 py-5">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                                      {isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <div className={cn("h-1.5 w-1.5 rounded-full", isClosed ? "bg-slate-300" : "bg-green-500 animate-pulse")} />
                                      <span className={cn("text-[8px] font-black uppercase tracking-widest", isClosed ? "text-slate-400" : "text-green-600")}>
                                        {isClosed ? "CLÔTURÉE" : "EN COURS"}
                                      </span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center px-2 py-5">
                                  <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-600 font-black text-[10px] tabular-nums border border-green-100/50 shadow-sm">
                                    <Clock className="h-3 w-3" />
                                    {s.openedAt?.toDate ? format(s.openedAt.toDate(), "HH:mm") : "--:--"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right px-2 py-5 font-black text-xs tabular-nums text-slate-500">{formatCurrency(s.openingBalance || 0)}</TableCell>
                                <TableCell className="text-right px-2 py-5 font-black text-xs text-green-600 tabular-nums">
                                  {fluxNet > 0 ? "+" : ""}{formatCurrency(fluxNet)}
                                </TableCell>
                                <TableCell className="text-right px-2 py-5 font-black text-xs text-orange-500 tabular-nums">
                                  -{formatCurrency(s.totalVersements || 0)}
                                </TableCell>
                                <TableCell className="text-right px-2 py-5 font-black text-xs text-slate-900 tabular-nums">
                                  {formatCurrency(s.closingBalanceReal ?? (s.openingBalance + fluxNet - (s.totalVersements || 0)))}
                                </TableCell>
                                <TableCell className="text-center px-2 py-5">
                                  {isClosed ? (
                                    <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-600 font-black text-[10px] tabular-nums border border-red-100/50 shadow-sm">
                                      <Clock className="h-3 w-3" />
                                      {s.closedAt?.toDate ? format(s.closedAt.toDate(), "HH:mm") : "--:--"}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-300 italic font-medium">--:--</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right px-8 py-5">
                                  <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-slate-100">
                                        <MoreVertical className="h-4 w-4 text-slate-400" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-slate-100 min-w-[180px]">
                                      <DropdownMenuItem onClick={() => handleExportDayExcel(s.date)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                                        <FileText className="mr-3 h-4 w-4 text-green-600" /> Détails (Excel)
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => router.push(`/caisse?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                                        <ArrowRight className="mr-3 h-4 w-4 text-primary" /> Voir la session
                                      </DropdownMenuItem>
                                      {isClosed && isAdminOrPrepa && (
                                        <DropdownMenuItem onClick={() => handleReopenSession(s.id)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-orange-600">
                                          <RotateCcw className="mr-3 h-4 w-4" /> Ré-ouvrir Caisse
                                        </DropdownMenuItem>
                                      )}
                                      {isAdminOrPrepa && (
                                        <DropdownMenuItem onClick={() => handleDeleteSession(s.id, s.date)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-destructive">
                                          <Trash2 className="mr-3 h-4 w-4" /> Supprimer Définitivement
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </div>
              </AccordionItem>
            );
          })
        )}
      </Accordion>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}>
        <SessionsContent />
      </Suspense>
    </AppShell>
  );
}
