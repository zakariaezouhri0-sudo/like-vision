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
import { 
  PlusCircle, 
  LogOut, 
  Loader2, 
  Trash2, 
  FileText, 
  Lock, 
  Calendar as CalendarIcon, 
  CalendarDays,
  CalendarCheck,
  Edit2,
  TrendingUp,
  TrendingDown,
  Coins,
  RotateCcw,
  Layers,
  ArrowLeftRight,
  DollarSign,
  Plus
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, updateDoc, doc, serverTimestamp, query, setDoc, where, Timestamp, deleteDoc, orderBy, getDocs, runTransaction, limit, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, format, setHours, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

function CaisseContent() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isClientReady, setIsHydrated] = useState(false);
  const [role, setRole] = useState<string>("");
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [openingVal, setOpeningVal] = useState("0");
  const [isAutoReport, setIsAutoReport] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(true);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    const savedMode = localStorage.getItem('work_mode');
    
    setRole(savedRole);
    setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
    setIsHydrated(true);
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';

  const selectedDate = useMemo(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      try {
        const d = parseISO(dateParam);
        if (isValid(d)) return d;
      } catch (e) {}
    }
    return new Date();
  }, [searchParams]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${dateStr}` : dateStr;
  
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  
  const sessionRef = useMemoFirebase(() => doc(db, "cash_sessions", sessionDocId), [db, sessionDocId]);
  const { data: rawSession, isLoading: sessionLoading } = useDoc(sessionRef);

  const session = useMemo(() => {
    if (!rawSession) return null;
    // On s'assure que la session chargée correspond bien au mode actuel
    if (isPrepaMode !== (rawSession.isDraft === true)) return null;
    return rawSession;
  }, [rawSession, isPrepaMode]);

  const pastSessionsQuery = useMemoFirebase(() => query(
    collection(db, "cash_sessions"),
    orderBy("date", "desc"),
    limit(1000)
  ), [db]);
  
  const { data: allSessions, isLoading: loadingPast } = useCollection(pastSessionsQuery);

  // LOGIQUE DE REPORT DE SOLDE AMÉLIORÉE
  useEffect(() => {
    if (!isClientReady) return;

    if (!session && !sessionLoading) {
      if (!loadingPast) {
        // Recherche de la dernière session clôturée pour le mode actuel
        const previousClosedSession = allSessions?.find((s: any) => {
          const sIsDraft = s.isDraft === true;
          const modeMatch = isPrepaMode ? sIsDraft : !sIsDraft;
          
          // Normalisation de la date pour comparaison string (yyyy-MM-dd)
          let sDate = s.date || "";
          if (sDate.includes('-') && sDate.split('-')[0].length === 2) {
            const [d, m, y] = sDate.split('-');
            sDate = `${y}-${m}-${d}`;
          }
          
          return modeMatch && s.status === "CLOSED" && sDate < dateStr;
        });

        if (previousClosedSession) {
          const prevFinal = roundAmount(previousClosedSession.closingBalanceReal || 0);
          setOpeningVal(prevFinal.toString());
          setIsAutoReport(true);
        } else {
          setOpeningVal("0");
          setIsAutoReport(false);
        }
        setIsLoadingReport(false);
      } else {
        setIsLoadingReport(true);
      }
    } else if (session) {
      setIsLoadingReport(false);
    }
  }, [allSessions, loadingPast, session, sessionLoading, isClientReady, isPrepaMode, dateStr]);

  const transactionsQuery = useMemoFirebase(() => {
    const start = startOfDay(selectedDate);
    const end = endOfDay(selectedDate);
    return query(
      collection(db, "transactions"), 
      where("createdAt", ">=", Timestamp.fromDate(start)), 
      where("createdAt", "<=", Timestamp.fromDate(end))
    );
  }, [db, selectedDate]);
  const { data: rawTransactions, isLoading: loadingTrans } = useCollection(transactionsQuery);

  const transactions = useMemo(() => {
    if (!rawTransactions) return [];
    return rawTransactions
      .filter((t: any) => isPrepaMode ? t.isDraft === true : t.isDraft !== true)
      .sort((a, b) => {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return db - da;
      });
  }, [rawTransactions, isPrepaMode]);

  const salesTransactions = useMemo(() => {
    return transactions.filter(t => t.type === "VENTE");
  }, [transactions]);
  
  const expenseTransactions = useMemo(() => {
    const data = transactions.filter(t => t.type !== "VENTE");
    const priority: Record<string, number> = {
      "ACHAT VERRES": 1,
      "ACHAT MONTURE": 2,
      "VERSEMENT": 3,
      "DEPENSE": 4
    };
    
    return [...data].sort((a, b) => {
      const pA = priority[a.type as string] || 99;
      const pB = priority[b.type as string] || 99;
      if (pA !== pB) return pA - pB;
      const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const db = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return db - da;
    });
  }, [transactions]);

  const [newOp, setNewOp] = useState({ type: "DEPENSE", label: "", clientName: "", montant: "" });
  const [editOp, setEditOp] = useState({ type: "DEPENSE", label: "", clientName: "", montant: "" });
  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
  const [manualCents, setManualCents] = useState("");
  
  const soldeReel = useMemo(() => {
    const sumBills = Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0);
    const centsVal = parseFloat(manualCents) || 0;
    const sumCents = centsVal / 100;
    return roundAmount(sumBills + sumCents);
  }, [denoms, manualCents]);

  const stats = useMemo(() => {
    const results = transactions.reduce((acc: any, t: any) => {
      const amt = Math.abs(Number(t.montant) || 0);
      if (t.type === "VENTE") acc.entrees += amt;
      else if (t.type === "VERSEMENT") acc.versements += amt;
      else acc.depenses += amt;
      return acc;
    }, { entrees: 0, depenses: 0, versements: 0 });
    
    return {
      entrees: roundAmount(results.entrees),
      depenses: roundAmount(results.depenses),
      versements: roundAmount(results.versements)
    };
  }, [transactions]);

  const initialBalance = roundAmount(session?.openingBalance || 0);
  const soldeTheorique = roundAmount(initialBalance + stats.entrees - stats.depenses - stats.versements);
  const ecart = roundAmount(soldeReel - soldeTheorique);

  const handleOpenSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoadingReport) return;

    try {
      setOpLoading(true);
      const finalOpening = parseAmount(openingVal);
      const openedAt = isAdminOrPrepa 
        ? Timestamp.fromDate(setHours(selectedDate, 9)) 
        : serverTimestamp();

      await setDoc(sessionRef, { 
        openingBalance: finalOpening, 
        status: "OPEN", 
        openedAt, 
        date: dateStr, 
        openedBy: user?.displayName || "---", 
        isDraft: isPrepaMode 
      });
      toast({ variant: "success", title: "Caisse Ouverte", description: `Solde initial : ${formatCurrency(finalOpening)} DH` });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleAutoAffectBC = async (clientName: string, type: string, amount: number) => {
    const bcMatch = (clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
    if (bcMatch && (type === "ACHAT VERRES" || type === "ACHAT MONTURE")) {
      const bcId = bcMatch[1].padStart(4, '0');
      try {
        const q = query(
          collection(db, "sales"), 
          where("invoiceId", "in", [`FC-2026-${bcId}`, `RC-2026-${bcId}`])
        );
        const snap = await getDocs(q);
        const saleDoc = snap.docs.find(d => d.data().isDraft === isPrepaMode);
        
        if (saleDoc) {
          const updateField = type === "ACHAT VERRES" ? "purchasePriceLenses" : "purchasePriceFrame";
          await updateDoc(saleDoc.ref, { [updateField]: amount });
          return true;
        }
      } catch (e) {
        console.error("Erreur affectation BC:", e);
      }
    }
    return false;
  };

  const handleAddOperation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newOp.montant) return;
    
    if (session?.status === "CLOSED" && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse est clôturée." });
      return;
    }

    setOpLoading(true);
    const amt = parseAmount(newOp.montant);
    const finalAmount = (newOp.type === "VENTE") ? Math.abs(amt) : -Math.abs(amt);
    const finalLabel = newOp.label || (newOp.type === "VERSEMENT" ? "BANQUE" : newOp.type);
    
    const now = new Date();
    const operationDate = new Date(selectedDate);
    operationDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    const finalCreatedAt = isAdminOrPrepa ? Timestamp.fromDate(operationDate) : serverTimestamp();

    try {
      await runTransaction(db, async (transaction) => {
        const sSnap = await transaction.get(sessionRef);
        if (sSnap.exists() && sSnap.data().status === "CLOSED" && !isAdminOrPrepa) {
          throw new Error("SESSION_CLOSED");
        }

        const transRef = doc(collection(db, "transactions"));
        transaction.set(transRef, { 
          type: newOp.type, 
          label: finalLabel, 
          clientName: newOp.clientName || "---",
          category: "Général", 
          montant: finalAmount, 
          userName: user?.displayName || "---", 
          isDraft: isPrepaMode, 
          createdAt: finalCreatedAt 
        });
      });

      // L'affectation BC est asynchrone mais ne doit pas bloquer l'UI si elle échoue
      handleAutoAffectBC(newOp.clientName, newOp.type, amt).catch(console.error);
      
      toast({ variant: "success", title: "Opération enregistrée" });
      setNewOp(prev => ({ ...prev, label: "", clientName: "", montant: "" }));
      setIsOpDialogOpen(false);
    } catch (e: any) { 
      if (e.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse est clôturée." });
      } else {
        toast({ variant: "destructive", title: "Erreur lors de l'enregistrement" }); 
      }
    } finally { setOpLoading(false); }
  };

  const handleOpenEdit = (t: any) => {
    if (!isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Action Rejetée", description: "Seul l'administrateur peut modifier une opération de caisse." });
      return;
    }
    setSelectedTrans(t);
    setEditOp({
      type: t.type,
      label: t.label || "",
      clientName: t.clientName || "",
      montant: formatCurrency(Math.abs(t.montant))
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateOperation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTrans || !editOp.montant) return;

    setOpLoading(true);
    const amt = parseAmount(editOp.montant);
    const finalAmount = (editOp.type === "VENTE") ? Math.abs(amt) : -Math.abs(amt);
    const finalLabel = editOp.label || (editOp.type === "VERSEMENT" ? "BANQUE" : editOp.type);
    
    try {
      await runTransaction(db, async (transaction) => {
        const transRef = doc(db, "transactions", selectedTrans.id);
        transaction.update(transRef, {
          type: editOp.type,
          label: finalLabel,
          clientName: editOp.clientName || "---",
          montant: finalAmount,
          updatedAt: serverTimestamp()
        });
      });

      handleAutoAffectBC(editOp.clientName, editOp.type, amt).catch(console.error);
      toast({ variant: "success", title: "Opération mise à jour" });
      setIsEditDialogOpen(false);
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Erreur" }); 
    } finally { setOpLoading(false); }
  };

  const handleDeleteOp = async (t: any) => {
    if (!isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Action Rejetée", description: "Seul l'administrateur peut supprimer une opération de caisse." });
      return;
    }
    if (!confirm("Supprimer cette opération ?")) return;
    
    try {
      setOpLoading(true);
      const batch = writeBatch(db);
      batch.delete(doc(db, "transactions", t.id));

      const bcMatch = (t.clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
      if (bcMatch && (t.type === "ACHAT VERRES" || t.type === "ACHAT MONTURE")) {
        const bcId = bcMatch[1].padStart(4, '0');
        const q = query(collection(db, "sales"), where("invoiceId", "in", [`FC-2026-${bcId}`, `RC-2026-${bcId}`]));
        const snap = await getDocs(q);
        const saleDoc = snap.docs.find(d => d.data().isDraft === isPrepaMode);
        if (saleDoc) {
          const updateField = t.type === "ACHAT VERRES" ? "purchasePriceLenses" : "purchasePriceFrame";
          batch.update(saleDoc.ref, { [updateField]: 0 });
        }
      }

      await batch.commit();
      toast({ variant: "success", title: "Opération supprimée" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur lors de la suppression" });
    } finally {
      setOpLoading(false);
    }
  };

  const handleReopenSession = async () => {
    if (!confirm("Voulez-vous vraiment ré-ouvrir cette session de caisse ?")) return;
    try {
      setOpLoading(true);
      await updateDoc(sessionRef, {
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        closingBalanceReal: null,
        closingBalanceTheoretical: null,
        discrepancy: null
      });
      toast({ variant: "success", title: "Caisse Ré-ouverte" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de la ré-ouverture" });
    } finally {
      setOpLoading(false);
    }
  };

  const handleFinalizeClosure = async () => {
    try {
      setOpLoading(true);
      const closedAt = isPrepaMode ? Timestamp.fromDate(setHours(selectedDate, 20)) : serverTimestamp();
      await updateDoc(sessionRef, { 
        status: "CLOSED", 
        closedAt, 
        closingBalanceReal: soldeReel, 
        closingBalanceTheoretical: soldeTheorique, 
        discrepancy: ecart, 
        closedBy: user?.displayName || "---", 
        totalSales: stats.entrees, 
        totalExpenses: stats.depenses, 
        totalVersements: stats.versements, 
        isDraft: isPrepaMode 
      });
      router.push(`/rapports/print/cloture?date=${dateStr}&ventes=${stats.entrees}&depenses=${stats.depenses}&versements=${stats.versements}&reel=${soldeReel}&initial=${initialBalance}`);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  if (!isClientReady || sessionLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-lg mx-auto text-center space-y-8">
        <div className={cn("h-24 w-24 rounded-[32px] flex items-center justify-center shadow-2xl transform rotate-3", isPrepaMode ? "bg-[#D4AF37] text-[#0D1B2A]" : "bg-[#0D1B2A] text-[#D4AF37]")}>
          <CalendarCheck className="h-12 w-12" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-[#0D1B2A] uppercase tracking-tighter flex items-center justify-center gap-4">
            Ouverture {isPrepaMode ? "Historique" : "Caisse"}
          </h1>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white px-6 py-3 rounded-full border-2 border-[#D4AF37] shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Date sélectionnée</p>
              <p className="text-xl font-black text-[#D4AF37] uppercase">
                {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
              </p>
            </div>
            {isAdminOrPrepa && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-12 px-8 rounded-full font-black text-xs uppercase shadow-lg border-[#D4AF37] text-[#0D1B2A] hover:bg-[#D4AF37]/10 transition-all">
                    <CalendarIcon className="mr-2 h-4 w-4 text-[#D4AF37]" /> CHOISIR UNE AUTRE DATE
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && router.push(`/caisse?date=${format(d, "yyyy-MM-dd")}`)} locale={fr} initialFocus /></PopoverContent>
              </Popover>
            )}
          </div>
        </div>
        <Card className="w-full bg-white p-10 rounded-[60px] space-y-6 shadow-2xl border-none">
          <form onSubmit={handleOpenSession} className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Solde Initial (DH)</Label>
                {isAutoReport && <Badge variant="outline" className="text-[8px] font-black text-[#D4AF37] uppercase bg-slate-50 px-2 py-1 rounded-md border-[#D4AF37]/20">Report auto</Badge>}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  className={cn("w-full h-20 text-4xl font-black text-center rounded-[32px] border-2 outline-none transition-all tabular-nums", "bg-slate-50 border-[#D4AF37] focus:border-[#D4AF37]", (isLoadingReport) ? "text-slate-300" : "text-[#0D1B2A]")}
                  value={isLoadingReport ? "..." : (isAutoReport ? formatCurrency(openingVal) : openingVal)} 
                  placeholder="0,00"
                  onChange={(e) => !isAutoReport && setOpeningVal(e.target.value)}
                  onBlur={() => !isAutoReport && openingVal && setOpeningVal(formatCurrency(parseAmount(openingVal)))}
                  readOnly={isLoadingReport || isAutoReport}
                  autoFocus
                />
                {isLoadingReport && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37] opacity-40" />
                  </div>
                )}
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={opLoading || isLoadingReport} 
              className={cn("w-full h-16 rounded-full font-black text-lg shadow-xl uppercase bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-[#D4AF37] transition-all")}
            >
              {isLoadingReport ? "RECHERCHE SOLDE..." : "VALIDER L'OUVERTURE"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  const isClosed = session?.status === "CLOSED";

  const renderTransactionTable = (title: string, data: any[], icon: any, colorClass: string) => (
    <Card className="rounded-[60px] overflow-hidden bg-white shadow-xl shadow-slate-200/50 border-none mb-8">
      <CardHeader className="py-6 px-10 border-b bg-slate-50 flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          {icon}
          <CardTitle className="text-xs uppercase font-black text-[#0D1B2A] tracking-[0.2em]">{title}</CardTitle>
        </div>
        <Badge className={cn("text-[10px] font-black uppercase py-1.5 px-4 rounded-full", colorClass)}>
          Total: {formatCurrency(data.reduce((acc, t) => acc + Math.abs(t.montant), 0))}
        </Badge>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-[#0D1B2A]">
            <TableRow>
              <TableHead className="text-[10px] uppercase font-black px-10 py-5 text-[#D4AF37] tracking-widest">Opération & Détails ({data.length})</TableHead>
              <TableHead className="text-right text-[10px] uppercase font-black px-10 py-5 text-[#D4AF37] tracking-widest">Montant</TableHead>
              <TableHead className="text-right text-[10px] uppercase font-black px-10 py-5 text-[#D4AF37] tracking-widest w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingTrans ? (
              <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-12 text-[10px] font-black opacity-20 uppercase tracking-widest">Aucune opération.</TableCell></TableRow>
            ) : (
              data.map((t: any) => {
                const labelPart = t.label || "";
                const typeStr = t.type || "";
                let cleanedLabel = labelPart;
                const prefixes = [typeStr, "Achat monture", "Achat verres", "Versement", "Depense"];
                prefixes.forEach(p => {
                  const reg = new RegExp(`^${p}\\s*[:\\-']?\\s*`, 'i');
                  cleanedLabel = cleanedLabel.replace(reg, '');
                });
                cleanedLabel = cleanedLabel.replace(/^['"]|['"]$/g, '').trim();

                let displayLabel = t.type === "VENTE" ? (t.relatedId ? `VENTE ${t.relatedId}` : labelPart) : `${t.type} | ${cleanedLabel || "---"}`;

                return (
                  <TableRow key={t.id} className="hover:bg-slate-50 transition-all group">
                    <TableCell className="px-10 py-5">
                      <div className="flex items-center gap-6">
                        <span className="text-[10px] font-black text-slate-400 w-12 shrink-0 tabular-nums">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}</span>
                        <div className="flex flex-col">
                          <span className="text-xs font-black uppercase text-[#0D1B2A] leading-tight tracking-tight">{displayLabel}</span>
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mt-1.5">{t.clientName || "---"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right px-10 py-5 font-black text-sm tabular-nums", t.montant >= 0 ? "text-[#D4AF37]" : (t.type === "VERSEMENT" ? "text-orange-600" : "text-red-500"))}>
                      {t.montant >= 0 ? "+" : ""}{formatCurrency(t.montant)}
                    </TableCell>
                    <TableCell className="text-right px-10 py-5">
                      {isAdminOrPrepa && (
                        <div className="flex items-center justify-end gap-3">
                          <Button variant="outline" size="icon" onClick={() => handleOpenEdit(t)} className="h-9 w-9 text-primary border-primary/20 hover:bg-primary/10 rounded-full shadow-sm"><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => handleDeleteOp(t)} className="h-9 w-9 text-red-500 border-red-100 hover:bg-red-50 rounded-full shadow-sm"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  return (
    <div className="space-y-10 pb-20">
      {isClosed && !isAdminOrPrepa && (
        <Alert variant="destructive" className="bg-red-600 text-white border-none rounded-[32px] mb-10 shadow-2xl py-6 animate-in fade-in slide-in-from-top-4">
          <Lock className="h-6 w-6 text-white" />
          <AlertTitle className="font-black uppercase tracking-[0.2em] text-lg">Caisse Clôturée</AlertTitle>
          <AlertDescription className="font-bold opacity-95 text-sm">Session fermée. Toute modification est bloquée.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-5">
          <div className="h-14 w-14 rounded-full bg-white shadow-xl flex items-center justify-center shrink-0">
            <div className={cn("h-4 w-4 rounded-full", isClosed ? "bg-red-500" : "bg-emerald-400 animate-pulse")} />
          </div>
          <div className="flex flex-col text-left">
            <h1 className="text-xl font-black text-[#0D1B2A] uppercase tracking-wider">{isClosed ? "CAISSE CLÔTURÉE" : "CAISSE OUVERTE"}</h1>
            <div className="flex items-center gap-2 mt-0.5 opacity-60">
              <CalendarIcon className="h-3 w-3 text-[#D4AF37]" />
              <span className="text-[10px] text-[#0D1B2A] font-black uppercase">{format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isAdminOrPrepa && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10 px-5 rounded-full font-black text-[9px] uppercase bg-white text-slate-500 shadow-md">
                  <RotateCcw className="mr-2 h-3.5 w-3.5" /> CHANGER DATE
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && router.push(`/caisse?date=${format(d, "yyyy-MM-dd")}`)} locale={fr} /></PopoverContent>
            </Popover>
          )}
          
          {(!isClosed || isAdminOrPrepa) && (
            <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
              <DialogTrigger asChild><Button className="h-10 px-6 rounded-full font-black text-[9px] uppercase shadow-lg bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white"><Plus className="mr-2 h-3.5 w-3.5" /> NOUVELLE OPÉRATION</Button></DialogTrigger>
              <DialogContent className="max-w-md rounded-[40px] p-10">
                <form onSubmit={handleAddOperation}>
                  <DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] tracking-widest text-center">Mouvement de Caisse</DialogTitle></DialogHeader>
                  <div className="space-y-6 py-8">
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Type</Label><select className="w-full h-12 rounded-2xl font-bold bg-slate-50 px-4 outline-none border-none" value={newOp.type} onChange={e => setNewOp({...newOp, type: e.target.value})}><option value="VENTE">Vente (+)</option><option value="DEPENSE">Dépense (-)</option><option value="ACHAT MONTURE">Achat Monture (-)</option><option value="ACHAT VERRES">Achat Verres (-)</option><option value="VERSEMENT">Versement (-)</option></select></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Libellé</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none" value={newOp.label} onChange={e => setNewOp({...newOp, label: e.target.value})} /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Nom Client / BC</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none" value={newOp.clientName} onChange={e => setNewOp({...newOp, clientName: e.target.value})} /></div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black ml-2">Montant (DH)</Label>
                      <Input type="text" className="h-12 rounded-2xl font-black text-lg bg-slate-50 border-none" value={newOp.montant} onChange={e => setNewOp({...newOp, montant: e.target.value})} onBlur={() => newOp.montant && setNewOp({...newOp, montant: formatCurrency(parseAmount(newOp.montant))})} />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={opLoading} className="w-full h-14 font-black rounded-full shadow-xl">VALIDER</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          <Button variant="outline" onClick={() => router.push(`/rapports/print/journalier?date=${dateStr}`)} className="h-10 px-5 rounded-full font-black text-[9px] uppercase border-none bg-white text-slate-500 shadow-md">
            <FileText className="mr-2 h-3.5 w-3.5 text-[#D4AF37]" /> RAPPORT PDF
          </Button>
          
          {!isClosed && (
            <Dialog>
              <DialogTrigger asChild><Button variant="ghost" className="h-10 px-5 rounded-full font-black text-[9px] uppercase text-red-500 hover:bg-red-50">CLÔTURE</Button></DialogTrigger>
              <DialogContent className="max-w-4xl rounded-[60px] p-12 border-none shadow-2xl">
                <DialogHeader><DialogTitle className="font-black uppercase tracking-[0.3em] text-center text-2xl text-[#0D1B2A]">Clôture & Comptage</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-10">
                  <div className="space-y-3">
                    {DENOMINATIONS.map(val => (
                      <div key={val} className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-md">
                        <span className="w-20 text-right font-black text-xs text-slate-400">{val} DH</span>
                        <Input type="number" className="h-10 w-24 text-center font-black bg-white border-none rounded-xl" value={denoms[val] || ""} onChange={(e) => setDenoms({...denoms, [val]: parseFloat(e.target.value) || 0})} />
                        <span className="flex-1 text-right font-black text-[#0D1B2A] text-sm">{formatCurrency(val * (denoms[val] || 0))}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 bg-[#D4AF37]/5 p-4 rounded-2xl border border-[#D4AF37]/20 mt-6">
                      <span className="w-20 text-right font-black text-[10px] text-[#D4AF37] uppercase">Centimes</span>
                      <Input type="number" className="h-10 w-24 text-center font-black bg-white border-none rounded-xl" value={manualCents} onChange={(e) => setManualCents(e.target.value)} />
                      <span className="flex-1 text-right font-black text-[#0D1B2A] text-sm"><Coins className="h-4 w-4 inline mr-1" /> DH</span>
                    </div>
                  </div>
                  <div className="space-y-6 bg-slate-50 p-10 rounded-[40px] border border-slate-100 flex flex-col justify-center">
                    <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Solde Initial</span><span>{formatCurrency(initialBalance)}</span></div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-[#D4AF37]"><span>Ventes (+)</span><span>{formatCurrency(stats.entrees)}</span></div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-red-500"><span>Dépenses (-)</span><span>{formatCurrency(stats.depenses)}</span></div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-orange-600"><span>Versements (-)</span><span>{formatCurrency(stats.versements)}</span></div>
                    </div>
                    <div className="pt-8 border-t border-slate-200 flex justify-between items-center"><span className="text-xs font-black uppercase text-[#0D1B2A]">Total Compté</span><span className="text-3xl font-black text-[#D4AF37]">{formatCurrency(soldeReel)}</span></div>
                    <div className={cn("p-6 rounded-3xl text-center shadow-sm", Math.abs(ecart) < 0.01 ? "bg-[#D4AF37]/10 text-[#D4AF37]" : "bg-red-100 text-red-700")}><p className="text-[10px] font-black uppercase mb-1">Écart Final</p><p className="text-2xl font-black">{formatCurrency(ecart)}</p></div>
                    <Button onClick={handleFinalizeClosure} disabled={opLoading} className="w-full h-16 rounded-full font-black text-base shadow-xl mt-4">VALIDER LA CLÔTURE</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {isClosed && role === 'ADMIN' && (
            <Button variant="outline" onClick={handleReopenSession} disabled={opLoading} className="h-10 px-5 rounded-full font-black text-[9px] uppercase border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white shadow-md">
              <RotateCcw className="mr-2 h-3.5 w-3.5" /> RÉ-OUVRIR LA CAISSE
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
        <Card className="p-6 rounded-[40px] border-none shadow-xl bg-white flex flex-col items-center justify-center text-center h-40">
          <div className="h-10 w-10 bg-blue-50 rounded-2xl flex items-center justify-center mb-3"><Lock className="h-4 w-4 text-blue-400" /></div>
          <p className="text-[9px] uppercase font-black text-slate-400 mb-2">Solde Ouverture</p>
          <p className="text-xl font-black text-[#0D1B2A]">{formatCurrency(initialBalance)}</p>
        </Card>
        <Card className="p-6 rounded-[40px] border-none shadow-xl bg-[#E6F9F3] flex flex-col items-center justify-center text-center h-40">
          <div className="h-10 w-10 bg-white/50 rounded-2xl flex items-center justify-center mb-3"><TrendingUp className="h-4 w-4 text-emerald-500" /></div>
          <p className="text-[9px] uppercase font-black text-emerald-600/60 mb-2">Ventes</p>
          <p className="text-xl font-black text-emerald-600">+{formatCurrency(stats.entrees)}</p>
        </Card>
        <Card className="p-6 rounded-[40px] border-none shadow-xl bg-[#FEF2F2] flex flex-col items-center justify-center text-center h-40">
          <div className="h-10 w-10 bg-white/50 rounded-2xl flex items-center justify-center mb-3"><TrendingDown className="h-4 w-4 text-red-500" /></div>
          <p className="text-[9px] uppercase font-black text-red-400 mb-2">Dépenses</p>
          <p className="text-xl font-black text-red-600">-{formatCurrency(stats.depenses)}</p>
        </Card>
        <Card className="p-6 rounded-[40px] border-none shadow-xl bg-[#FFF7ED] flex flex-col items-center justify-center text-center h-40">
          <div className="h-10 w-10 bg-white/50 rounded-2xl flex items-center justify-center mb-3"><ArrowLeftRight className="h-4 w-4 text-orange-500" /></div>
          <p className="text-[9px] uppercase font-black text-orange-400 mb-2">Versements</p>
          <p className="text-xl font-black text-orange-600">-{formatCurrency(stats.versements)}</p>
        </Card>
        <Card className="p-6 rounded-[40px] border-none shadow-2xl bg-[#0D1B2A] flex flex-col items-center justify-center text-center h-40">
          <div className="h-10 w-10 bg-white/10 rounded-2xl flex items-center justify-center mb-3"><DollarSign className="h-4 w-4 text-[#D4AF37]" /></div>
          <p className="text-[9px] uppercase font-black text-[#D4AF37] mb-2 opacity-80">Solde Théorique</p>
          <p className="text-xl font-black text-white">{formatCurrency(isClosed ? session.closingBalanceReal : soldeTheorique)}</p>
        </Card>
      </div>

      {renderTransactionTable("Encaissements (Ventes)", salesTransactions, <TrendingUp className="h-5 w-5 text-emerald-600" />, "bg-emerald-50 text-emerald-700")}
      {renderTransactionTable("Sorties (Charges & Versements)", expenseTransactions, <TrendingDown className="h-5 w-5 text-red-500" />, "bg-red-100 text-red-700")}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md rounded-[40px] p-10">
          <form onSubmit={handleUpdateOperation}>
            <DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] tracking-widest text-center">Modifier Opération</DialogTitle></DialogHeader>
            <div className="space-y-6 py-8">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Type</Label><select className="w-full h-12 rounded-2xl font-bold bg-slate-50 outline-none border-none px-4" value={editOp.type} onChange={e => setEditOp({...editOp, type: e.target.value})}><option value="VENTE">Vente (+)</option><option value="DEPENSE">Dépense (-)</option><option value="ACHAT MONTURE">Achat Monture (-)</option><option value="ACHAT VERRES">Achat Verres (-)</option><option value="VERSEMENT">Versement (-)</option></select></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Libellé</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none" value={editOp.label} onChange={e => setEditOp({...editOp, label: e.target.value})} /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Nom Client / BC</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none" value={editOp.clientName} onChange={e => setEditOp({...editOp, clientName: e.target.value})} /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Montant (DH)</Label><Input type="text" className="h-12 rounded-2xl font-black text-lg bg-slate-50 border-none" value={editOp.montant} onChange={e => setEditOp({...editOp, montant: e.target.value})} onBlur={() => editOp.montant && setEditOp({...editOp, montant: formatCurrency(parseAmount(editOp.montant))})} /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={opLoading} className="w-full h-14 font-black rounded-full shadow-xl">ENREGISTRER</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CaissePage() { return <AppShell><Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}><CaisseContent /></Suspense></AppShell>; }
