"use client";

import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BookOpen, Calculator, RefreshCcw, TrendingUp, Download } from "lucide-react";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, Timestamp } from "firebase/firestore";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { formatCurrency, roundAmount } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Configuration des comptes comptables selon les instructions de l'utilisateur
const ACCOUNTS = {
  VENTES: "71110000",
  CLIENTS: "34210000",
  CAISSE: "61510000", // Caisse (CS)
  FOURNISSEURS: "44110000",
  ACHATS: "61110000", // Achats/Charges (OD)
  BANQUE: "51410000",
  TRANSFERT: "51150000", // Compte de liaison pour les versements
};

export default function AccountingPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));
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

  const { start, end, monthDate } = useMemo(() => {
    const date = new Date(selectedMonth + "-01");
    return {
      monthDate: date,
      start: startOfMonth(date),
      end: endOfMonth(date)
    };
  }, [selectedMonth]);

  const transQuery = useMemoFirebase(() => query(
    collection(db, "transactions"),
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<=", Timestamp.fromDate(end))
  ), [db, start, end]);

  const { data: trans, isLoading: transLoading } = useCollection(transQuery);

  const entries = useMemo(() => {
    if (!trans || !role) return [];

    const allEntries: any[] = [];
    const days = eachDayOfInterval({ start, end });

    days.forEach(day => {
      const dateStr = format(day, "dd/MM/yyyy");
      
      const dayTrans = trans.filter(t => {
        if (!t.createdAt?.toDate) return false;
        if (isPrepaMode !== (t.isDraft === true)) return false;
        return isSameDay(t.createdAt.toDate(), day);
      });

      // 1. LES VENTES (VT & CS)
      const totalEncaissements = dayTrans
        .filter(t => t.type === "VENTE")
        .reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

      if (totalEncaissements > 0) {
        // Journal VT : 71110000 Crédit / 34210000 Débit
        allEntries.push({
          date: dateStr,
          journal: "VT",
          compte: ACCOUNTS.CLIENTS,
          libelle: `VENTES DU ${dateStr}`,
          debit: roundAmount(totalEncaissements),
          credit: 0
        });
        allEntries.push({
          date: dateStr,
          journal: "VT",
          compte: ACCOUNTS.VENTES,
          libelle: `VENTES DU ${dateStr}`,
          debit: 0,
          credit: roundAmount(totalEncaissements)
        });

        // Journal CS : 34210000 Crédit / 61510000 Débit
        allEntries.push({
          date: dateStr,
          journal: "CS",
          compte: ACCOUNTS.CAISSE,
          libelle: `ENCAISSEMENTS DU ${dateStr}`,
          debit: roundAmount(totalEncaissements),
          credit: 0
        });
        allEntries.push({
          date: dateStr,
          journal: "CS",
          compte: ACCOUNTS.CLIENTS,
          libelle: `ENCAISSEMENTS DU ${dateStr}`,
          debit: 0,
          credit: roundAmount(totalEncaissements)
        });
      }

      // 2. LES CHARGES (OD & CS) - Exclut les versements banque
      const totalCharges = dayTrans
        .filter(t => ["ACHAT VERRES", "ACHAT MONTURE", "DEPENSE"].includes(t.type))
        .reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

      if (totalCharges > 0) {
        // Journal OD : 44110000 Crédit / 61110000 Débit
        allEntries.push({
          date: dateStr,
          journal: "OD",
          compte: ACCOUNTS.ACHATS,
          libelle: `ACHATS/CHARGES DU ${dateStr}`,
          debit: roundAmount(totalCharges),
          credit: 0
        });
        allEntries.push({
          date: dateStr,
          journal: "OD",
          compte: ACCOUNTS.FOURNISSEURS,
          libelle: `ACHATS/CHARGES DU ${dateStr}`,
          debit: 0,
          credit: roundAmount(totalCharges)
        });

        // Journal CS : 61510000 Crédit / 44110000 Débit
        allEntries.push({
          date: dateStr,
          journal: "CS",
          compte: ACCOUNTS.FOURNISSEURS,
          libelle: `PAIEMENT CHARGES DU ${dateStr}`,
          debit: roundAmount(totalCharges),
          credit: 0
        });
        allEntries.push({
          date: dateStr,
          journal: "CS",
          compte: ACCOUNTS.CAISSE,
          libelle: `PAIEMENT CHARGES DU ${dateStr}`,
          debit: 0,
          credit: roundAmount(totalCharges)
        });
      }

      // 3. LES VERSEMENTS BANQUE (CS & BQ)
      const totalVersements = dayTrans
        .filter(t => t.type === "VERSEMENT")
        .reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

      if (totalVersements > 0) {
        // Sortie Caisse vers Transfert (CS)
        allEntries.push({
          date: dateStr,
          journal: "CS",
          compte: ACCOUNTS.TRANSFERT,
          libelle: `VERS. BANQUE DU ${dateStr}`,
          debit: roundAmount(totalVersements),
          credit: 0
        });
        allEntries.push({
          date: dateStr,
          journal: "CS",
          compte: ACCOUNTS.CAISSE,
          libelle: `VERS. BANQUE DU ${dateStr}`,
          debit: 0,
          credit: roundAmount(totalVersements)
        });
        // Entrée Banque via Transfert (BQ)
        allEntries.push({
          date: dateStr,
          journal: "BQ",
          compte: ACCOUNTS.BANQUE,
          libelle: `RECP. VERS. DU ${dateStr}`,
          debit: roundAmount(totalVersements),
          credit: 0
        });
        allEntries.push({
          date: dateStr,
          journal: "BQ",
          compte: ACCOUNTS.TRANSFERT,
          libelle: `RECP. VERS. DU ${dateStr}`,
          debit: 0,
          credit: roundAmount(totalVersements)
        });
      }
    });

    return allEntries;
  }, [trans, start, end, role, isPrepaMode]);

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData = [
        ["Date", "Journal", "Compte", "Libellé", "Débit", "Crédit"],
        ...entries.map(e => [e.date, e.journal, e.compte, e.libelle, e.debit || "", e.credit || ""])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Formatage des largeurs de colonnes
      ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 35 }, { wch: 15 }, { wch: 15 }];
      
      XLSX.utils.book_append_sheet(wb, ws, "Ecritures Sage");
      const fileName = `Like Vision - Export Sage - ${format(monthDate, "MMMM yyyy", { locale: fr })}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast({ variant: "success", title: "Export réussi" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de l'export" });
    }
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

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-12 w-[200px] rounded-full border-none shadow-inner bg-slate-50 font-black text-[10px] uppercase px-6 text-[#0D1B2A]">
                <SelectValue placeholder="Choisir un mois" />
              </SelectTrigger>
              <SelectContent className="rounded-[24px]">
                {Array.from({ length: 12 }).map((_, i) => {
                  const d = new Date(2026, i, 1);
                  const val = format(d, "yyyy-MM");
                  return (
                    <SelectItem key={val} value={val} className="font-black text-[10px] uppercase">
                      {format(d, "MMMM yyyy", { locale: fr })}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Button 
              onClick={handleExportExcel} 
              disabled={isLoading || entries.length === 0}
              className="h-12 px-8 rounded-full font-black text-[10px] uppercase shadow-lg bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all"
            >
              <Download className="mr-2 h-4 w-4" /> EXPORT SAGE (.XLSX)
            </Button>
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
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-slate-400">Prévisualisation des flux de {format(monthDate, "MMMM yyyy", { locale: fr })}</CardTitle>
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
                    <TableRow><TableCell colSpan={6} className="py-24 text-center text-[10px] font-black uppercase text-slate-300 tracking-[0.5em]">Aucun flux sur ce mois.</TableCell></TableRow>
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
