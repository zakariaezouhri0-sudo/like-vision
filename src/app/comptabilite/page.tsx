"use client";

import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Loader2, 
  BookOpen, 
  Calculator, 
  RefreshCcw, 
  TrendingUp, 
  Download, 
  ChevronDown, 
  CalendarDays,
  CheckSquare,
  Square,
  FileSpreadsheet,
  FileText
} from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, Timestamp, orderBy } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency, roundAmount, cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const ACCOUNTS = {
  VENTES: "71110000",
  CLIENTS: "34210000",
  CAISSE: "61510000",
  FOURNISSEURS: "44110000",
  ACHATS: "61110000",
  BANQUE: "51410000",
  TRANSFERT: "51150000",
};

const MONTHS_2026 = Array.from({ length: 12 }).map((_, i) => {
  const d = new Date(2026, i, 1);
  return {
    value: format(d, "yyyy-MM"),
    label: format(d, "MMMM yyyy", { locale: fr })
  };
});

export default function AccountingPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  
  const [selectedMonths, setSelectedMonths] = useState<string[]>([format(new Date(), "yyyy-MM")]);
  const [role, setRole] = useState<string | null>(null);
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase();
    const savedMode = localStorage.getItem('work_mode');
    
    if (savedRole && (savedRole === "ADMIN" || savedRole === "PREPA")) {
      setRole(savedRole);
      setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
    } else {
      router.push("/dashboard");
    }
    setIsClientReady(true);
  }, [router]);

  const transQuery = useMemoFirebase(() => query(
    collection(db, "transactions"),
    where("createdAt", ">=", Timestamp.fromDate(new Date(2026, 0, 1))),
    where("createdAt", "<=", Timestamp.fromDate(new Date(2026, 11, 31, 23, 59, 59))),
    orderBy("createdAt", "asc")
  ), [db]);

  const { data: allTrans, isLoading: transLoading } = useCollection(transQuery);

  const entries = useMemo(() => {
    if (!allTrans || !role || selectedMonths.length === 0) return [];

    // OPTIMISATION: Grouper les transactions par date une seule fois (O(N))
    const transByDate: Record<string, any[]> = {};
    allTrans.forEach(t => {
      if (isPrepaMode !== (t.isDraft === true)) return;
      if (!t.createdAt?.toDate) return;
      
      const d = t.createdAt.toDate();
      const dateKey = format(d, "yyyy-MM-dd");
      if (!transByDate[dateKey]) transByDate[dateKey] = [];
      transByDate[dateKey].push(t);
    });

    const allEntries: any[] = [];
    const sortedSelectedMonths = [...selectedMonths].sort();

    sortedSelectedMonths.forEach(monthKey => {
      const [year, month] = monthKey.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const days = eachDayOfInterval({ start, end });

      days.forEach(day => {
        const dateKey = format(day, "yyyy-MM-dd");
        const dateStr = format(day, "dd/MM/yyyy");
        
        // Récupération instantanée via le dictionnaire
        const dayTrans = transByDate[dateKey] || [];

        if (dayTrans.length === 0) return;

        const totalEncaissements = dayTrans
          .filter(t => t.type === "VENTE")
          .reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

        if (totalEncaissements > 0) {
          allEntries.push({
            date: dateStr, journal: "VT", compte: ACCOUNTS.CLIENTS,
            libelle: `VENTES DU ${dateStr}`, debit: roundAmount(totalEncaissements), credit: 0
          });
          allEntries.push({
            date: dateStr, journal: "VT", compte: ACCOUNTS.VENTES,
            libelle: `VENTES DU ${dateStr}`, debit: 0, credit: roundAmount(totalEncaissements)
          });
          allEntries.push({
            date: dateStr, journal: "CS", compte: ACCOUNTS.CAISSE,
            libelle: `ENCAISSEMENTS DU ${dateStr}`, debit: roundAmount(totalEncaissements), credit: 0
          });
          allEntries.push({
            date: dateStr, journal: "CS", compte: ACCOUNTS.CLIENTS,
            libelle: `ENCAISSEMENTS DU ${dateStr}`, debit: 0, credit: roundAmount(totalEncaissements)
          });
        }

        const totalCharges = dayTrans
          .filter(t => ["ACHAT VERRES", "ACHAT MONTURE", "DEPENSE"].includes(t.type))
          .reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

        if (totalCharges > 0) {
          allEntries.push({
            date: dateStr, journal: "OD", compte: ACCOUNTS.ACHATS,
            libelle: `ACHATS/CHARGES DU ${dateStr}`, debit: roundAmount(totalCharges), credit: 0
          });
          allEntries.push({
            date: dateStr, journal: "OD", compte: ACCOUNTS.FOURNISSEURS,
            libelle: `ACHATS/CHARGES DU ${dateStr}`, debit: 0, credit: roundAmount(totalCharges)
          });
          allEntries.push({
            date: dateStr, journal: "CS", compte: ACCOUNTS.FOURNISSEURS,
            libelle: `PAIEMENT CHARGES DU ${dateStr}`, debit: roundAmount(totalCharges), credit: 0
          });
          allEntries.push({
            date: dateStr, journal: "CS", compte: ACCOUNTS.CAISSE,
            libelle: `PAIEMENT CHARGES DU ${dateStr}`, debit: 0, credit: roundAmount(totalCharges)
          });
        }

        const totalVersements = dayTrans
          .filter(t => t.type === "VERSEMENT")
          .reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

        if (totalVersements > 0) {
          allEntries.push({
            date: dateStr, journal: "CS", compte: ACCOUNTS.TRANSFERT,
            libelle: `VERS. BANQUE DU ${dateStr}`, debit: roundAmount(totalVersements), credit: 0
          });
          allEntries.push({
            date: dateStr, journal: "CS", compte: ACCOUNTS.CAISSE,
            libelle: `VERS. BANQUE DU ${dateStr}`, debit: 0, credit: roundAmount(totalVersements)
          });
          allEntries.push({
            date: dateStr, journal: "BQ", compte: ACCOUNTS.BANQUE,
            libelle: `RECP. VERS. DU ${dateStr}`, debit: roundAmount(totalVersements), credit: 0
          });
          allEntries.push({
            date: dateStr, journal: "BQ", compte: ACCOUNTS.TRANSFERT,
            libelle: `RECP. VERS. DU ${dateStr}`, debit: 0, credit: roundAmount(totalVersements)
          });
        }
      });
    });

    return allEntries;
  }, [allTrans, role, isPrepaMode, selectedMonths]);

  const handleToggleMonth = (month: string) => {
    setSelectedMonths(prev => prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]);
  };

  const handleToggleAll = () => {
    if (selectedMonths.length === MONTHS_2026.length) setSelectedMonths([]);
    else setSelectedMonths(MONTHS_2026.map(m => m.value));
  };

  const getFileName = (ext: string) => {
    let base = "Like Vision - Export Sage";
    if (selectedMonths.length === 1) {
      base += ` - ${MONTHS_2026.find(m => m.value === selectedMonths[0])?.label}`;
    } else if (selectedMonths.length > 1) {
      base += ` - Multi-Mois (${selectedMonths.length})`;
    }
    return `${base}.${ext}`;
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Date", "Journal", "Compte", "Libellé", "Débit", "Crédit"],
        ...entries.map(e => [e.date, e.journal, e.compte, e.libelle, e.debit || "", e.credit || ""])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, "Ecritures Sage");
      XLSX.writeFile(wb, getFileName("xlsx"));
      toast({ variant: "success", title: "Export Excel réussi" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur lors de l'export" }); }
  };

  const handleExportCSV = () => {
    try {
      const wsData = [
        ["Date", "Journal", "Compte", "Libellé", "Débit", "Crédit"],
        ...entries.map(e => [e.date, e.journal, e.compte, e.libelle, (e.debit || 0).toFixed(2), (e.credit || 0).toFixed(2)])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", getFileName("csv"));
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ variant: "success", title: "Export CSV réussi" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur lors de l'export CSV" }); }
  };

  const isLoading = !isClientReady || transLoading;

  if (!isClientReady || !role) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[60px] border shadow-xl shadow-slate-200/50">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-[#0D1B2A] rounded-[24px] flex items-center justify-center shadow-lg shadow-[#0D1B2A]/20">
              <BookOpen className="h-7 w-7 text-[#D4AF37]" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter leading-none">Automate des Flux</h1>
              <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">Génération des écritures comptables pour Sage.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-12 w-full sm:w-[240px] rounded-full border-none shadow-inner bg-slate-50 font-black text-[10px] uppercase px-6 text-[#0D1B2A] justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-[#D4AF37]" />
                    <span>{selectedMonths.length > 0 ? `${selectedMonths.length} mois sélectionné(s)` : "Choisir les mois"}</span>
                  </div>
                  <ChevronDown className="h-3 w-3 opacity-20" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 rounded-[32px] p-4 shadow-2xl border-none" align="end">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Périodes 2026</span>
                    <Button variant="ghost" size="sm" onClick={handleToggleAll} className="h-7 px-2 font-black text-[9px] uppercase text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg">
                      {selectedMonths.length === MONTHS_2026.length ? <Square className="mr-1.5 h-3 w-3" /> : <CheckSquare className="mr-1.5 h-3 w-3" />}
                      {selectedMonths.length === MONTHS_2026.length ? "Aucun" : "Tous"}
                    </Button>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                    {MONTHS_2026.map((month) => (
                      <div 
                        key={month.value} 
                        className={cn("flex items-center space-x-3 p-2 rounded-xl transition-all cursor-pointer group", selectedMonths.includes(month.value) ? "bg-[#D4AF37]/5" : "hover:bg-slate-50")}
                        onClick={() => handleToggleMonth(month.value)}
                      >
                        <Checkbox id={month.value} checked={selectedMonths.includes(month.value)} onCheckedChange={() => handleToggleMonth(month.value)} className="data-[state=checked]:bg-[#D4AF37] data-[state=checked]:border-[#D4AF37]" />
                        <label htmlFor={month.value} className={cn("text-[10px] font-bold uppercase cursor-pointer select-none transition-colors", selectedMonths.includes(month.value) ? "text-[#0D1B2A]" : "text-slate-500 group-hover:text-slate-900")}>
                          {month.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button 
                onClick={handleExportExcel} 
                disabled={isLoading || entries.length === 0}
                className="flex-1 sm:flex-none h-12 px-6 rounded-full font-black text-[10px] uppercase shadow-lg bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all"
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> EXCEL
              </Button>
              <Button 
                onClick={handleExportCSV} 
                disabled={isLoading || entries.length === 0}
                variant="outline"
                className="flex-1 sm:flex-none h-12 px-6 rounded-full font-black text-[10px] uppercase shadow-lg border-slate-200 bg-white text-slate-600 hover:bg-[#0D1B2A] hover:text-[#D4AF37] transition-all"
              >
                <FileText className="mr-2 h-4 w-4" /> CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-8 rounded-[60px] border-none shadow-xl bg-white flex items-center gap-6">
            <div className="h-12 w-12 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0">
              <Calculator className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Cumul Débit</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums">
                {formatCurrency(entries.reduce((acc, e) => acc + (e.debit || 0), 0))}
              </p>
            </div>
          </Card>
          <Card className="p-8 rounded-[60px] border-none shadow-xl bg-white flex items-center gap-6">
            <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
              <RefreshCcw className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Lignes d'Écritures</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums">{entries.length}</p>
            </div>
          </Card>
          <Card className="p-8 rounded-[60px] border-none shadow-xl bg-[#0D1B2A] flex items-center gap-6">
            <div className="h-12 w-12 bg-white/5 rounded-2xl flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6 text-[#D4AF37]" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-black text-[#D4AF37]/60 mb-1 tracking-widest">Statut Balance</p>
              <p className="text-xl font-black text-white uppercase tracking-tighter">Équilibré ✅</p>
            </div>
          </Card>
        </div>

        <Card className="shadow-xl shadow-slate-200/50 rounded-[60px] bg-white border-none overflow-hidden">
          <CardHeader className="p-10 border-b bg-slate-50">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-400">
              Prévisualisation des flux {selectedMonths.length > 0 ? "sélectionnés" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest text-center">JAL</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Compte</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Libellé de l'Écriture</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Débit</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Crédit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                  ) : entries.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-24 text-center text-[10px] font-black uppercase text-slate-300 tracking-[0.5em]">Aucun flux sur la sélection.</TableCell></TableRow>
                  ) : entries.map((entry, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50 transition-all group border-b last:border-0">
                      <TableCell className="px-10 py-5 text-[11px] font-bold text-slate-500 tabular-nums">{entry.date}</TableCell>
                      <TableCell className="px-6 py-5 text-center">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[9px] font-black uppercase border-none",
                            entry.journal === "VT" ? "bg-blue-50 text-blue-700" :
                            entry.journal === "CS" ? "bg-emerald-50 text-emerald-700" :
                            entry.journal === "OD" ? "bg-orange-50 text-orange-700" :
                            "bg-slate-50 text-slate-700"
                          )}
                        >
                          {entry.journal}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-5 font-black text-xs text-[#0D1B2A] tracking-wider">{entry.compte}</TableCell>
                      <TableCell className="px-10 py-5 text-xs font-bold text-slate-600 uppercase">{entry.libelle}</TableCell>
                      <TableCell className="text-right px-6 py-5 font-black text-sm tabular-nums text-[#0D1B2A]">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : ""}
                      </TableCell>
                      <TableCell className="text-right px-10 py-5 font-black text-sm tabular-nums text-slate-400">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
