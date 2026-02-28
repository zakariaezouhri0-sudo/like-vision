
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  PlusCircle, 
  Wallet, 
  LogOut, 
  Printer, 
  Coins, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  PiggyBank, 
  FileText, 
  PlayCircle, 
  Lock, 
  RefreshCcw, 
  History, 
  AlertTriangle, 
  User as UserIcon, 
  Calendar as CalendarIcon, 
  ArrowLeft, 
  ArrowRightLeft, 
  TrendingUp, 
  TrendingDown, 
  Landmark,
  ChevronDown,
  CalendarDays,
  Trash
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, setDoc, where, Timestamp, limit, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { startOfDay, endOfDay, format, parseISO, setHours, setMinutes, setSeconds, isBefore } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

function CaisseContent() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isClientReady, setIsHydrated] = useState(false);
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [openingVal, setOpeningVal] = useState("0");
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    setRole(localStorage.getItem('user_role') || "OPTICIENNE");
  }, []);

  const isPrepaMode = role === "PREPA";
  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";

  const dateParam = searchParams.get("date");
  const selectedDate = useMemo(() => {
    if (dateParam) {
      const d = parseISO(dateParam);
      if (!isNaN(d.getTime())) return d;
    }
    const today = new Date();
    const startHistory = new Date("2026-01-01");
    if (isPrepaMode && isBefore(today, startHistory)) return startHistory;
    return today;
  }, [dateParam, isPrepaMode]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${dateStr}` : dateStr;
  
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  
  const sessionRef = useMemoFirebase(() => doc(db, "cash_sessions", sessionDocId), [db, sessionDocId]);
  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);

  const transactionsQuery = useMemoFirebase(() => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, "transactions"), 
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
      orderBy("createdAt", "desc")
    );
  }, [db, selectedDate]);
  
  const { data: rawTransactions, isLoading: loadingTrans } = useCollection(transactionsQuery);

  const transactions = useMemo(() => {
    if (!rawTransactions) return [];
    return rawTransactions.filter((t: any) => isPrepaMode ? t.isDraft === true : !t.isDraft);
  }, [rawTransactions, isPrepaMode]);

  const [newOp, setNewOp] = useState({ type: "DEPENSE", label: "", category: "Général", montant: "" });
  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
  
  const soldeReel = useMemo(() => Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0), [denoms]);

  const stats = useMemo(() => {
    return transactions.reduce((acc: any, t: any) => {
      const amt = Math.abs(Number(t.montant) || 0);
      if (t.type === "VENTE") { acc.entrees += amt; } 
      else if (t.type === "VERSEMENT") { acc.versements += amt; } 
      else if (t.type === "DEPENSE" || t.type === "ACHAT VERRES") { acc.depenses += amt; }
      return acc;
    }, { entrees: 0, depenses: 0, versements: 0 });
  }, [transactions]);

  const initialBalance = session?.openingBalance || 0;
  const soldeTheorique = initialBalance + stats.entrees - stats.depenses - stats.versements;
  const ecart = soldeReel - soldeTheorique;

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setIsCalendarOpen(false);
      const newDateStr = format(date, "yyyy-MM-dd");
      router.push(`/caisse?date=${newDateStr}`);
    }
  };

  const handleOpenSession = async () => {
    try {
      setOpLoading(true);
      let openedAt;
      if (isPrepaMode) {
        const d = setSeconds(setMinutes(setHours(selectedDate, 10), 0), 0);
        openedAt = Timestamp.fromDate(d);
      } else {
        openedAt = serverTimestamp();
      }

      await setDoc(sessionRef, { 
        openingBalance: parseFloat(openingVal) || 0, 
        status: "OPEN", 
        openedAt: openedAt, 
        date: dateStr,
        openedBy: user?.displayName || "Inconnu", 
        isDraft: isPrepaMode 
      });
      toast({ variant: "success", title: "Caisse Ouverte" });
    } catch (e) { 
      toast({ variant: "destructive", title: "Erreur" }); 
    } finally { 
      setOpLoading(false); 
    }
  };

  const handleDeleteCurrentSession = async () => {
    if (!confirm("Voulez-vous vraiment supprimer cette session ? Cela réinitialisera la journée comme si elle n'avait jamais été ouverte.")) return;
    setOpLoading(true);
    try {
      await deleteDoc(sessionRef);
      toast({ variant: "success", title: "Session supprimée avec succès" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de la suppression" });
    } finally {
      setOpLoading(false);
    }
  };

  const handleAddOperation = async () => {
    if (!newOp.montant) return;
    setOpLoading(true);
    const finalAmount = newOp.type === "VENTE" ? Math.abs(parseFloat(newOp.montant)) : -Math.abs(parseFloat(newOp.montant));
    
    let finalLabel = newOp.label || newOp.type;
    if (newOp.type === "ACHAT VERRES" && !finalLabel.toUpperCase().startsWith("ACHAT VERRES")) {
      finalLabel = `ACHAT VERRES - ${finalLabel}`;
    }

    const transData = {
      type: newOp.type, 
      label: finalLabel, 
      category: "Général", 
      montant: finalAmount,
      userName: user?.displayName || "Inconnu", 
      isDraft: isPrepaMode, 
      createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, "transactions"), transData);
      toast({ variant: "success", title: "Opération enregistrée" });
      setIsOpDialogOpen(false);
      setNewOp({ type: "DEPENSE", label: "", category: "Général", montant: "" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleUpdateOperation = async () => {
    if (!editingTransaction) return;
    setOpLoading(true);
    const transRef = doc(db, "transactions", editingTransaction.id);
    const finalAmount = editingTransaction.type === "VENTE" ? Math.abs(parseFloat(editingTransaction.montant_raw)) : -Math.abs(parseFloat(editingTransaction.montant_raw));
    
    let finalLabel = editingTransaction.label;
    if (editingTransaction.type === "ACHAT VERRES" && !finalLabel.toUpperCase().startsWith("ACHAT VERRES")) {
      finalLabel = `ACHAT VERRES - ${finalLabel}`;
    }

    try {
      await updateDoc(transRef, { 
        type: editingTransaction.type, 
        label: finalLabel, 
        montant: finalAmount 
      });
      toast({ variant: "success", title: "Mis à jour avec succès" });
      setEditingTransaction(null);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleFinalizeClosure = async () => {
    try {
      setOpLoading(true);
      let closedAt;
      if (isPrepaMode) {
        const d = setSeconds(setMinutes(setHours(selectedDate, 20), 0), 0);
        closedAt = Timestamp.fromDate(d);
      } else {
        closedAt = serverTimestamp();
      }

      await updateDoc(sessionRef, {
        status: "CLOSED", 
        closedAt: closedAt, 
        closingBalanceReal: soldeReel, 
        closingBalanceTheoretical: soldeTheorique,
        discrepancy: ecart, 
        closedBy: user?.displayName || "Inconnu", 
        totalSales: stats.entrees, 
        totalExpenses: stats.depenses, 
        totalVersements: stats.versements
      });
      router.push(`/rapports/print/cloture?date=${dateStr}&ventes=${stats.entrees}&depenses=${stats.depenses}&versements=${stats.versements}&reel=${soldeReel}&initial=${initialBalance}`);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const DateChanger = () => {
    if (!isAdminOrPrepa) return null;
    return (
      <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm hover:bg-primary hover:text-white transition-all">
            <CalendarIcon className="mr-2 h-4 w-4" /> CHANGER DE DATE
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-[24px] border-none shadow-2xl" align="start">
          <Calendar 
            mode="single" 
            selected={selectedDate} 
            onSelect={handleDateSelect} 
            locale={fr} 
            initialFocus 
            disabled={(d) => isPrepaMode ? d < new Date("2026-01-01") : false} 
          />
        </PopoverContent>
      </Popover>
    );
  };

  if (!isClientReady || sessionLoading) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-lg mx-auto text-center space-y-8">
        <div className="h-24 w-24 bg-primary rounded-[32px] flex items-center justify-center text-white shadow-2xl transform rotate-3"><PlayCircle className="h-12 w-12" /></div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">Ouverture {isPrepaMode ? "Historique" : "Caisse"}</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Journée du {format(selectedDate, "dd MMMM yyyy", { locale: fr })}</p>
        </div>
        <Card className="w-full bg-white p-8 rounded-[40px] space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Solde Initial</Label>
            <div className="relative">
              <input 
                type="number" 
                className="w-full h-20 text-4xl font-black text-center rounded-3xl bg-slate-50 border-2 border-primary/5 outline-none tabular-nums" 
                value={openingVal} 
                onChange={(e) => setOpeningVal(e.target.value)} 
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">DH</span>
            </div>
          </div>
          <Button onClick={handleOpenSession} disabled={opLoading} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 uppercase">OUVRIR LA SESSION</Button>
          <DateChanger />
        </Card>
      </div>
    );
  }

  const isClosed = session?.status === "CLOSED";

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            isClosed ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
          )}>
            {isClosed ? <Lock className="h-6 w-6" /> : <div className="h-3 w-3 bg-green-600 rounded-full animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-primary uppercase tracking-tighter leading-none">
                {isClosed ? "Session Clôturée" : "Caisse Ouverte"}
              </h1>
              {isAdminOrPrepa && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleDeleteCurrentSession}
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                  title="Supprimer cette session"
                >
                  <Trash className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg">
                <CalendarDays className="h-3 w-3 text-slate-400" />
                <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest">
                  {format(selectedDate, "dd/MM/yyyy")}
                </span>
              </div>
              <DateChanger />
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {!isClosed && (
            <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
              <DialogTrigger asChild><Button className="h-12 px-6 rounded-xl font-black text-[10px] uppercase flex-1 sm:flex-none"><PlusCircle className="mr-2 h-4 w-4" /> NOUVELLE OPÉRATION</Button></DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader><DialogTitle className="font-black uppercase text-primary">Gestion des flux</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Type d'opération</Label>
                    <select className="w-full h-11 rounded-xl font-bold bg-white border border-slate-200 px-3 outline-none" value={newOp.type} onChange={e => setNewOp({...newOp, type: e.target.value})}>
                      <option value="DEPENSE">Dépense (-)</option>
                      <option value="ACHAT VERRES">Achat Verres (-)</option>
                      <option value="VERSEMENT">Versement (-)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Libellé / Désignation</Label>
                    <Input className="h-11 rounded-xl font-bold" placeholder="Ex: Frais transport, Achat papier..." value={newOp.label} onChange={e => setNewOp({...newOp, label: e.target.value})} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Montant (DH)</Label>
                    <Input type="number" className="h-11 rounded-xl font-bold tabular-nums" placeholder="0.00" value={newOp.montant} onChange={e => setNewOp({...newOp, montant: e.target.value})} />
                  </div>
                </div>
                <DialogFooter><Button onClick={handleAddOperation} disabled={opLoading} className="w-full h-12 font-black rounded-xl">VALIDER L'OPÉRATION</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Button 
            variant="outline" 
            onClick={() => router.push(`/rapports/print/journalier?date=${dateStr}`)}
            className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary flex-1 sm:flex-none shadow-sm"
          >
            <FileText className="mr-2 h-4 w-4" /> RAPPORT JOURNALIER
          </Button>

          {!isClosed && (
            <Dialog>
              <DialogTrigger asChild><Button variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-red-500 text-red-500 flex-1 sm:flex-none"><LogOut className="mr-2 h-4 w-4" /> CLÔTURE</Button></DialogTrigger>
              <DialogContent className="max-w-3xl rounded-[32px] p-8 border-none shadow-2xl">
                <DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-center">Clôture & Comptage {isPrepaMode ? "(Brouillon)" : ""}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                  <div className="space-y-2">
                    {DENOMINATIONS.map(val => (
                      <div key={val} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
                        <span className="w-16 text-right font-black text-xs text-slate-400">{val} DH</span>
                        <Input type="number" className="h-9 w-20 text-center font-bold tabular-nums" value={denoms[val]} onChange={(e) => setDenoms({...denoms, [val]: parseInt(e.target.value) || 0})} />
                        <span className="flex-1 text-right font-black text-primary text-xs tabular-nums">{formatCurrency(val * (denoms[val] || 0))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Solde Initial</span><span className="tabular-nums">{formatCurrency(initialBalance)}</span></div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-green-600"><span>Ventes (+)</span><span className="tabular-nums">{formatCurrency(stats.entrees)}</span></div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-red-500"><span>Dépenses (-)</span><span className="tabular-nums">{formatCurrency(stats.depenses)}</span></div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-orange-600"><span>Versements (-)</span><span className="tabular-nums">{formatCurrency(stats.versements)}</span></div>
                    <div className="pt-4 border-t flex justify-between items-center"><span className="text-xs font-black uppercase">Total Compté</span><span className="text-2xl font-black text-primary tabular-nums">{formatCurrency(soldeReel)}</span></div>
                    <div className={cn("p-4 rounded-xl text-center", Math.abs(ecart) < 0.01 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}><p className="text-[8px] font-black uppercase mb-1">Écart constaté</p><p className="text-xl font-black tabular-nums">{formatCurrency(ecart)}</p></div>
                    <Button onClick={handleFinalizeClosure} disabled={opLoading} className="w-full h-12 rounded-xl font-black shadow-xl">VALIDER LA CLÔTURE</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5 rounded-[24px] border-l-4 border-l-blue-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Solde Initial</p><p className="text-xl font-black text-blue-600 tabular-nums">{formatCurrency(initialBalance)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-green-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Ventes</p><p className="text-xl font-black text-green-600 tabular-nums">+{formatCurrency(stats.entrees)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-red-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Dépenses</p><p className="text-xl font-black text-red-500 tabular-nums">-{formatCurrency(stats.depenses)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-orange-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Versements</p><p className="text-xl font-black text-orange-600 tabular-nums">-{formatCurrency(stats.versements)}</p></Card>
        <Card className="bg-primary text-primary-foreground p-5 rounded-[24px]"><p className="text-[9px] uppercase font-black opacity-60 mb-2">Solde {isClosed ? "Final Réel" : "Théorique"}</p><p className="text-xl font-black tabular-nums">{formatCurrency(isClosed ? session.closingBalanceReal : soldeTheorique)}</p></Card>
      </div>

      {isClosed && (
        <div className="bg-red-50 text-red-900 p-6 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm border border-red-100 border-b-8 border-b-red-200">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-red-100 rounded-2xl flex items-center justify-center"><Lock className="h-6 w-6 text-red-600" /></div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-red-400">Statut de Session</p>
              <h3 className="text-lg font-black uppercase tracking-tight">Caisse Clôturée le {session.closedAt?.toDate ? format(session.closedAt.toDate(), "dd/MM/yyyy à HH:mm") : "--/--"}</h3>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-center md:text-right">
              <p className="text-[8px] font-black uppercase tracking-[0.3em] text-red-400 mb-1">Responsable</p>
              <p className="text-sm font-black uppercase text-red-900">{session.closedBy || "---"}</p>
            </div>
            {isAdminOrPrepa && (
              <div className="text-center md:text-right border-l border-red-200 pl-8">
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-red-400 mb-1">Écart Final</p>
                <p className={cn("text-xl font-black tabular-nums", session.discrepancy >= 0 ? "text-green-600" : "text-red-600")}>
                  {formatCurrency(session.discrepancy)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <Card className="rounded-[32px] overflow-hidden bg-white">
        <CardHeader className="py-4 px-6 bg-slate-50 border-b">
          <CardTitle className="text-[11px] font-black uppercase text-primary/60">
            Détail des Opérations ({transactions.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-black px-6 py-4">Heure & Libellé</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Montant</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTrans ? (
                <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : transactions.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 text-[10px] font-black opacity-20">Aucune opération pour cette journée.</TableCell></TableRow>
              ) : (
                transactions.map((t: any) => (
                  <TableRow key={t.id} className="hover:bg-slate-50 border-b transition-all">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold text-slate-400 tabular-nums">
                            {t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}
                          </span>
                          <span className="text-[11px] font-black uppercase text-slate-800">{t.label}</span>
                        </div>
                        <Badge className={cn(
                          "text-[8px] font-black border-none px-2 w-fit", 
                          t.type === 'VENTE' ? 'bg-green-100 text-green-700' : 
                          t.type === 'VERSEMENT' ? 'bg-orange-100 text-orange-700' : 
                          'bg-red-100 text-red-700'
                        )}>
                          {t.type}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right px-6 py-4 font-black text-xs tabular-nums whitespace-nowrap", t.montant >= 0 ? "text-green-600" : "text-red-500")}>
                      {formatCurrency(t.montant)}
                    </TableCell>
                    <TableCell className="text-right px-6 py-4">
                      {!isClosed && isAdminOrPrepa ? (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2 min-w-[160px]">
                            <DropdownMenuItem onClick={() => setEditingTransaction({ ...t, montant_raw: Math.abs(t.montant).toString() })} className="py-2.5 font-black text-[10px] uppercase rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier</DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => { if(confirm("Supprimer ?")) await deleteDoc(doc(db, "transactions", t.id)) }} className="text-red-500 py-2.5 font-black text-[10px] uppercase rounded-xl"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-[8px] font-black text-slate-300 uppercase">Consultation seule</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={!!editingTransaction} onOpenChange={(o) => !o && setEditingTransaction(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle className="font-black uppercase text-primary">Modifier l'opération</DialogTitle></DialogHeader>
          {editingTransaction && (
            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Type d'opération</Label>
                <select className="w-full h-11 rounded-xl font-bold bg-white border border-slate-200 px-3 outline-none" value={editingTransaction.type} onChange={e => setEditingTransaction({...editingTransaction, type: e.target.value})}>
                  <option value="DEPENSE">Dépense (-)</option>
                  <option value="ACHAT VERRES">Achat Verres (-)</option>
                  <option value="VERSEMENT">Versement (-)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Libellé</Label>
                <Input className="h-11 rounded-xl font-bold" value={editingTransaction.label} onChange={e => setEditingTransaction({...editingTransaction, label: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-muted-foreground">Montant (DH)</Label>
                <Input type="number" className="h-11 rounded-xl font-bold tabular-nums" value={editingTransaction.montant_raw} onChange={e => setEditingTransaction({...editingTransaction, montant_raw: e.target.value})} />
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={handleUpdateOperation} disabled={opLoading} className="w-full h-12 font-black rounded-xl">ENREGISTRER LES MODIFICATIONS</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CaissePage() { return <AppShell><Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}><CaisseContent /></Suspense></AppShell>; }
