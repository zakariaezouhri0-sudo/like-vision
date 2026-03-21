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
  Layers
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, updateDoc, doc, serverTimestamp, query, setDoc, where, Timestamp, deleteDoc, orderBy, getDocs, runTransaction } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, format, setHours, parseISO, isValid } from "date-fns";
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
  const [role, setRole] = useState<string>("");
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [openingVal, setOpeningVal] = useState("");
  const [isAutoReport, setIsAutoReport] = useState(false);

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
    if (isPrepaMode !== (rawSession.isDraft === true)) return null;
    return rawSession;
  }, [rawSession, isPrepaMode]);

  const allSessionsQuery = useMemoFirebase(() => query(collection(db, "cash_sessions")), [db]);
  const { data: allSessions } = useCollection(allSessionsQuery);

  useEffect(() => {
    if (!session && allSessions && allSessions.length > 0) {
      const filtered = allSessions.filter(s => (isPrepaMode ? s.isDraft === true : s.isDraft !== true));
      const pastSessions = filtered
        .filter(s => s.date < dateStr && s.status === "CLOSED")
        .sort((a, b) => b.date.localeCompare(a.date));
      
      if (pastSessions.length > 0) {
        const lastClosing = pastSessions[0].closingBalanceReal;
        if (lastClosing !== undefined) {
          setOpeningVal(roundAmount(lastClosing).toString());
          setIsAutoReport(true);
        }
      }
    } else if (!session) {
      setOpeningVal("");
      setIsAutoReport(false);
    }
  }, [allSessions, session, dateStr, isPrepaMode]);

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

  const salesTransactions = useMemo(() => {
    const raw = transactions.filter(t => t.type === "VENTE");
    return groupTransactionsByBC(raw);
  }, [transactions]);
  
  const expenseTransactions = useMemo(() => {
    const data = transactions.filter(t => t.type !== "VENTE");
    const grouped = groupTransactionsByBC(data);
    const priority: Record<string, number> = {
      "ACHAT VERRES": 1,
      "ACHAT MONTURE": 2,
      "VERSEMENT": 3,
      "DEPENSE": 4
    };
    
    return [...grouped].sort((a, b) => {
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
    try {
      setOpLoading(true);
      const openedAt = isAdminOrPrepa 
        ? Timestamp.fromDate(setHours(selectedDate, 9)) 
        : serverTimestamp();

      await setDoc(sessionRef, { 
        openingBalance: parseAmount(openingVal) || 0, 
        status: "OPEN", 
        openedAt, 
        date: dateStr, 
        openedBy: user?.displayName || "---", 
        isDraft: isPrepaMode 
      });
      toast({ variant: "success", title: "Caisse Ouverte" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleAutoAffectBC = async (clientName: string, type: string, amount: number) => {
    const bcMatch = (clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
    if (bcMatch && (type === "ACHAT VERRES" || type === "ACHAT MONTURE")) {
      const bcId = bcMatch[1].padStart(4, '0');
      try {
        const q = query(
          collection(db, "sales"), 
          where("isDraft", "==", isPrepaMode),
          where("invoiceId", "in", [`FC-2026-${bcId}`, `RC-2026-${bcId}`])
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const saleDoc = snap.docs[0];
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
      toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse est clôturée. Ré-ouvrez la caisse pour ajouter une opération." });
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

      await handleAutoAffectBC(newOp.clientName, newOp.type, amt);
      
      toast({ 
        variant: "success", 
        title: "Opération enregistrée", 
        description: newOp.clientName.match(/(\d+)/) ? `Coût affecté au BC ${newOp.clientName.match(/(\d+)/)?.[0]}` : undefined 
      });

      setNewOp(prev => ({ ...prev, label: "", clientName: "", montant: "" }));
      setIsOpDialogOpen(false);
    } catch (e: any) { 
      if (e.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse est clôturée." });
      } else {
        toast({ variant: "destructive", title: "Erreur" }); 
      }
    } finally { setOpLoading(false); }
  };

  const handleOpenEdit = (t: any) => {
    if (session?.status === "CLOSED" && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Action Rejetée", description: "Ré-ouvrez la caisse pour modifier une opération." });
      return;
    }
    if (t.isGrouped) {
      toast({ variant: "destructive", title: "Action Impossible", description: "Cette ligne est un cumul de plusieurs opérations. Modifiez-les individuellement via l'historique." });
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

    if (session?.status === "CLOSED" && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse est clôturée." });
      return;
    }

    setOpLoading(true);
    const amt = parseAmount(editOp.montant);
    const finalAmount = (editOp.type === "VENTE") ? Math.abs(amt) : -Math.abs(amt);
    const finalLabel = editOp.label || (editOp.type === "VERSEMENT" ? "BANQUE" : editOp.type);
    
    try {
      await runTransaction(db, async (transaction) => {
        const sSnap = await transaction.get(sessionRef);
        if (sSnap.exists() && sSnap.data().status === "CLOSED" && !isAdminOrPrepa) {
          throw new Error("SESSION_CLOSED");
        }

        const transRef = doc(db, "transactions", selectedTrans.id);
        transaction.update(transRef, {
          type: editOp.type,
          label: finalLabel,
          clientName: editOp.clientName || "---",
          montant: finalAmount,
          updatedAt: serverTimestamp()
        });
      });

      await handleAutoAffectBC(editOp.clientName, editOp.type, amt);
      toast({ variant: "success", title: "Opération mise à jour" });
      setIsEditDialogOpen(false);
    } catch (e: any) { 
      if (e.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse est clôturée." });
      } else {
        toast({ variant: "destructive", title: "Erreur" }); 
      }
    } finally { setOpLoading(false); }
  };

  const handleDeleteOp = async (t: any) => {
    if (session?.status === "CLOSED" && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Action Rejetée", description: "Ré-ouvrez la caisse pour supprimer une opération." });
      return;
    }
    if (t.isGrouped) {
      toast({ variant: "destructive", title: "Action Impossible", description: "Cette ligne est un cumul. Supprimez les opérations individuellement." });
      return;
    }
    if (!confirm("Supprimer cette opération ?")) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const sSnap = await transaction.get(sessionRef);
        if (sSnap.exists() && sSnap.data().status === "CLOSED" && !isAdminOrPrepa) {
          throw new Error("SESSION_CLOSED");
        }
        transaction.delete(doc(db, "transactions", t.id));
      });
      toast({ variant: "success", title: "Supprimé" });
    } catch (e: any) {
      if (e.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse est clôturée." });
      } else {
        toast({ variant: "destructive", title: "Erreur" });
      }
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
      toast({ variant: "success", title: "Caisse Ré-ouverte", description: "Les modifications sont de nouveau possibles." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de la ré-ouverture" });
    } finally {
      setOpLoading(false);
    }
  };

  if (!isClientReady || sessionLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-lg mx-auto text-center space-y-8">
        <div className={cn("h-24 w-24 rounded-[32px] flex items-center justify-center text-white shadow-2xl transform rotate-3", isPrepaMode ? "bg-[#D4AF37]" : "bg-[#0D1B2A]")}>
          <CalendarCheck className="h-12 w-12" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-[#0D1B2A] uppercase tracking-tighter">Ouverture {isPrepaMode ? "Historique" : "Caisse"}</h1>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white px-6 py-3 rounded-full border-2 border-primary/10 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Date sélectionnée</p>
              <p className="text-xl font-black text-primary uppercase">
                {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
              </p>
            </div>
            {isAdminOrPrepa && (
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" className="h-12 px-8 rounded-full font-black text-xs uppercase shadow-lg border-primary text-primary hover:bg-[#0D1B2A] hover:text-white transition-all"><CalendarIcon className="mr-2 h-4 w-4" /> CHOISIR UNE AUTRE DATE</Button></PopoverTrigger>
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
                  className={cn("w-full h-20 text-4xl font-black text-center rounded-[32px] border-2 outline-none transition-all tabular-nums", isAutoReport ? "bg-slate-50 border-[#D4AF37]/20 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-primary/5 focus:border-primary/20")}
                  value={isAutoReport ? formatCurrency(openingVal) : openingVal} 
                  placeholder="0,00"
                  onChange={(e) => !isAutoReport && setOpeningVal(e.target.value)}
                  onBlur={() => !isAutoReport && openingVal && setOpeningVal(formatCurrency(parseAmount(openingVal)))}
                  readOnly={isAutoReport}
                  autoFocus
                />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={opLoading} 
              className={cn("w-full h-16 rounded-full font-black text-lg shadow-xl uppercase bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-[#D4AF37] transition-all")}
            >
              VALIDER L'OUVERTURE
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
                const redundantPrefixes = [typeStr, "Achat monture", "Achat verres", "Versement", "Depense"];
                let cleanedLabel = labelPart;
                redundantPrefixes.forEach(p => {
                  const reg = new RegExp(`^${p}\\s*[:\\-']?\\s*`, 'i');
                  cleanedLabel = cleanedLabel.replace(reg, '');
                });
                cleanedLabel = cleanedLabel.replace(/^['"]|['"]$/g, '').trim();

                let displayLabel = "";
                if (t.type === "VENTE") {
                  displayLabel = t.relatedId ? `VENTE ${t.relatedId}` : (labelPart || "VENTE");
                } else if (t.type === "VERSEMENT") {
                  displayLabel = `VERSEMENT | ${cleanedLabel || "BANQUE"}`;
                } else {
                  displayLabel = `${t.type} | ${cleanedLabel || "---"}`;
                }

                return (
                  <TableRow key={t.id} className="hover:bg-slate-50 transition-all group">
                    <TableCell className="px-10 py-5">
                      <div className="flex items-center gap-6">
                        <span className="text-[10px] font-black text-slate-400 w-12 shrink-0 tabular-nums">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}</span>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase text-[#0D1B2A] leading-tight tracking-tight">{displayLabel}</span>
                            {t.isGrouped && (
                              <Badge variant="outline" className="text-[8px] font-black h-4 px-2 border-primary/20 text-primary bg-primary/5 uppercase rounded-full">
                                <Layers className="h-2.5 w-2.5 mr-1" /> Σ {t.childCount}
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mt-1.5">{t.clientName || "---"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right px-10 py-5 font-black text-sm tabular-nums", t.montant >= 0 ? "text-[#D4AF37]" : (t.type === "VERSEMENT" ? "text-orange-600" : "text-red-500"))}>
                      {t.montant >= 0 ? "+" : ""}{formatCurrency(t.montant)}
                    </TableCell>
                    <TableCell className="text-right px-10 py-5">
                      {(!isClosed || isAdminOrPrepa) && (
                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => handleOpenEdit(t)} 
                            disabled={t.isGrouped}
                            className={cn("h-9 w-9 text-primary border-primary/20 hover:bg-primary/10 rounded-full shadow-sm", t.isGrouped && "opacity-30 cursor-not-allowed")}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => handleDeleteOp(t)} 
                            disabled={t.isGrouped}
                            className={cn("h-9 w-9 text-red-500 border-red-100 hover:bg-red-50 rounded-full shadow-sm", t.isGrouped && "opacity-30 cursor-not-allowed")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <div className={cn("h-16 w-16 rounded-[24px] flex items-center justify-center shrink-0 shadow-lg", isClosed ? "bg-red-100 text-red-600" : "bg-[#D4AF37]/10 text-[#D4AF37]")}>
            {isClosed ? <Lock className="h-8 w-8" /> : <div className="h-4 w-4 bg-[#D4AF37] rounded-full animate-pulse" />}
          </div>
          <div>
            <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter leading-none">{isClosed ? "Session Clôturée" : "Caisse Ouverte"}</h1>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border shadow-sm mt-3 w-fit">
              <CalendarDays className="h-4 w-4 text-[#D4AF37]" />
              <span className="text-xs text-[#0D1B2A] font-black tracking-widest uppercase">{format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {isAdminOrPrepa && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-12 px-6 rounded-full font-black text-[10px] uppercase border-[#0D1B2A]/10 bg-white text-[#0D1B2A] shadow-sm hover:bg-slate-50 transition-all">
                  <CalendarIcon className="mr-2 h-4 w-4 text-[#D4AF37]" /> CHANGER DATE
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && router.push(`/caisse?date=${format(d, "yyyy-MM-dd")}`)} locale={fr} initialFocus />
              </PopoverContent>
            </Popover>
          )}
          
          {isClosed && role === 'ADMIN' && (
            <Button variant="outline" onClick={handleReopenSession} disabled={opLoading} className="h-12 px-6 rounded-full font-black text-[10px] uppercase border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white transition-all shadow-sm">
              <RotateCcw className="mr-2 h-4 w-4" /> RÉ-OUVRIR LA CAISSE
            </Button>
          )}
          
          {(!isClosed || isAdminOrPrepa) && (
            <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-12 px-8 rounded-full font-black text-[10px] uppercase shadow-lg bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all">
                  <PlusCircle className="mr-2 h-4 w-4" /> NOUVELLE OPÉRATION
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-[40px] p-10" onKeyDown={(e) => e.key === 'Enter' && handleAddOperation(e)}>
                <form onSubmit={handleAddOperation}>
                  <DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] tracking-widest text-center text-xl">Mouvement de Caisse</DialogTitle></DialogHeader>
                  <div className="space-y-6 py-8">
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Type</Label><select className="w-full h-12 rounded-2xl font-bold bg-slate-50 border-none px-4 outline-none" value={newOp.type} onChange={e => setNewOp({...newOp, type: e.target.value})}><option value="VENTE">Vente (+)</option><option value="DEPENSE">Dépense (-)</option><option value="ACHAT MONTURE">Achat Monture (-)</option><option value="ACHAT VERRES">Achat Verres (-)</option><option value="VERSEMENT">Versement (-)</option></select></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Libellé</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none px-4" placeholder="Désignation..." value={newOp.label} onChange={e => setNewOp({...newOp, label: e.target.value})} /></div>
                    <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Nom Client / BC (ex: BC : 2472)</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none px-4" placeholder="M. Mohamed ou BC : 2472..." value={newOp.clientName} onChange={e => setNewOp({...newOp, clientName: e.target.value})} /></div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-black ml-2">Montant (DH)</Label>
                      <Input 
                        type="text" 
                        className="h-12 rounded-2xl font-black text-lg bg-slate-50 border-none px-4 text-[#0D1B2A] tabular-nums" 
                        placeholder="0,00" 
                        value={newOp.montant} 
                        onChange={e => setNewOp({...newOp, montant: e.target.value})} 
                        onBlur={() => newOp.montant && setNewOp({...newOp, montant: formatCurrency(parseAmount(newOp.montant))})}
                      />
                    </div>
                  </div>
                  <DialogFooter><Button type="submit" disabled={opLoading} className="w-full h-14 font-black rounded-full text-base tracking-widest shadow-xl">VALIDER</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
          
          <Button variant="outline" onClick={() => router.push(`/rapports/print/journalier?date=${dateStr}`)} className="h-12 px-6 rounded-full font-black text-[10px] uppercase border-[#0D1B2A]/10 bg-white text-[#0D1B2A] shadow-sm hover:bg-slate-50">
            <FileText className="mr-2 h-4 w-4 text-[#D4AF37]" /> RAPPORT
          </Button>
          
          {!isClosed && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 px-6 rounded-full font-black text-[10px] uppercase border-red-50 text-red-500 shadow-sm hover:bg-red-50 transition-all">
                  <LogOut className="mr-2 h-4 w-4" /> CLÔTURE
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl rounded-[60px] p-12 border-none shadow-2xl" onKeyDown={(e) => e.key === 'Enter' && handleFinalizeClosure()}>
                <DialogHeader><DialogTitle className="font-black uppercase tracking-[0.3em] text-center text-2xl text-[#0D1B2A]">Clôture & Comptage {isPrepaMode ? "(Brouillon)" : ""}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-10">
                  <div className="space-y-3">
                    {DENOMINATIONS.map(val => (
                      <div key={val} className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                        <span className="w-20 text-right font-black text-xs text-slate-400 group-hover:text-[#D4AF37] transition-colors">{val} DH</span>
                        <Input type="number" step="any" className="h-10 w-24 text-center font-black bg-white border-none rounded-xl shadow-inner" placeholder="---" value={denoms[val] || ""} onChange={(e) => setDenoms({...denoms, [val]: parseFloat(e.target.value) || 0})} />
                        <span className="flex-1 text-right font-black text-[#0D1B2A] text-sm tabular-nums">{formatCurrency(val * (denoms[val] || 0))}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-4 bg-[#D4AF37]/5 p-4 rounded-2xl border border-[#D4AF37]/20 mt-6 shadow-inner">
                      <span className="w-20 text-right font-black text-[10px] text-[#D4AF37] uppercase tracking-widest">Centimes</span>
                      <Input type="number" className="h-10 w-24 text-center font-black bg-white border-none rounded-xl shadow-inner" placeholder="60" value={manualCents} onChange={(e) => setManualCents(e.target.value)} />
                      <span className="flex-1 text-right font-black text-[#0D1B2A] text-sm tabular-nums flex items-center justify-end gap-1"><Coins className="h-4 w-4 text-[#D4AF37]" /> DH</span>
                    </div>
                  </div>
                  <div className="space-y-6 bg-slate-50 p-10 rounded-[40px] border border-slate-100 shadow-inner flex flex-col justify-center">
                    <div className="space-y-4">
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest"><span>Solde Initial</span><span className="tabular-nums">{formatCurrency(initialBalance)}</span></div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-[#D4AF37] tracking-widest"><span>Ventes (+)</span><span className="tabular-nums">{formatCurrency(stats.entrees)}</span></div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-red-500 tracking-widest"><span>Dépenses (-)</span><span className="tabular-nums">{formatCurrency(stats.depenses)}</span></div>
                      <div className="flex justify-between text-[10px] font-black uppercase text-orange-600 tracking-widest"><span>Versements (-)</span><span className="tabular-nums">{formatCurrency(stats.versements)}</span></div>
                    </div>
                    <div className="pt-8 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-black uppercase tracking-[0.2em] text-[#0D1B2A]">Total Compté</span>
                      <span className="text-3xl font-black text-[#D4AF37] tabular-nums tracking-tighter">{formatCurrency(soldeReel)}</span>
                    </div>
                    <div className={cn("p-6 rounded-3xl text-center shadow-sm", Math.abs(ecart) < 0.01 ? "bg-[#D4AF37]/10 text-[#D4AF37]" : "bg-red-100 text-red-700")}>
                      <p className="text-[10px] font-black uppercase mb-1 tracking-widest">Écart Final</p>
                      <p className="text-2xl font-black tabular-nums">{formatCurrency(ecart)}</p>
                    </div>
                    <Button onClick={handleFinalizeClosure} disabled={opLoading} className="w-full h-16 rounded-full font-black text-base tracking-widest shadow-xl mt-4">VALIDER LA CLÔTURE</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="p-8 rounded-[40px] border-none shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1 w-full bg-blue-500 opacity-20" />
          <p className="text-[10px] uppercase font-black text-slate-400 mb-3 tracking-widest">Solde Ouv.</p>
          <p className="text-2xl font-black text-[#0D1B2A] tabular-nums tracking-tighter">{formatCurrency(initialBalance)}</p>
        </Card>
        <Card className="p-8 rounded-[40px] border-none shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1 w-full bg-[#D4AF37] opacity-20" />
          <p className="text-[10px] uppercase font-black text-slate-400 mb-3 tracking-widest">Ventes</p>
          <p className="text-2xl font-black text-[#D4AF37] tabular-nums tracking-tighter">+{formatCurrency(stats.entrees)}</p>
        </Card>
        <Card className="p-8 rounded-[40px] border-none shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1 w-full bg-red-500 opacity-20" />
          <p className="text-[10px] uppercase font-black text-slate-400 mb-3 tracking-widest">Dépenses</p>
          <p className="text-2xl font-black text-red-500 tabular-nums tracking-tighter">-{formatCurrency(stats.depenses)}</p>
        </Card>
        <Card className="p-8 rounded-[40px] border-none shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 h-1 w-full bg-orange-500 opacity-20" />
          <p className="text-[10px] uppercase font-black text-slate-400 mb-3 tracking-widest">Versements</p>
          <p className="text-2xl font-black text-orange-600 tabular-nums tracking-tighter">-{formatCurrency(stats.versements)}</p>
        </Card>
        <Card className="bg-[#0D1B2A] text-white p-8 rounded-[40px] border-none shadow-xl shadow-slate-200/50 relative overflow-hidden">
          <div className="absolute top-0 right-0 h-1 w-full bg-[#D4AF37] opacity-40" />
          <p className="text-[10px] uppercase font-black text-[#D4AF37] mb-3 tracking-widest opacity-80">Solde {isClosed ? "Clôt." : "Théorique"}</p>
          <p className="text-2xl font-black text-white tabular-nums tracking-tighter">{formatCurrency(isClosed ? session.closingBalanceReal : soldeTheorique)}</p>
        </Card>
      </div>

      {renderTransactionTable("Encaissements (Ventes)", salesTransactions, <TrendingUp className="h-5 w-5 text-[#D4AF37]" />, "bg-[#D4AF37]/10 text-[#D4AF37]")}
      {renderTransactionTable("Sorties (Charges & Versements)", expenseTransactions, <TrendingDown className="h-5 w-5 text-red-500" />, "bg-red-100 text-red-700")}

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md rounded-[40px] p-10" onKeyDown={(e) => e.key === 'Enter' && handleUpdateOperation(e)}>
          <form onSubmit={handleUpdateOperation}>
            <DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] tracking-widest text-center text-xl">Modifier Opération</DialogTitle></DialogHeader>
            <div className="space-y-6 py-8">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Type</Label><select className="w-full h-12 rounded-2xl font-bold bg-slate-50 border-none px-4 outline-none" value={editOp.type} onChange={e => setEditOp({...editOp, type: e.target.value})}><option value="VENTE">Vente (+)</option><option value="DEPENSE">Dépense (-)</option><option value="ACHAT MONTURE">Achat Monture (-)</option><option value="ACHAT VERRES">Achat Verres (-)</option><option value="VERSEMENT">Versement (-)</option></select></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Libellé</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none px-4" placeholder="Désignation..." value={editOp.label} onChange={e => setEditOp({...editOp, label: e.target.value})} /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Nom Client / BC</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none px-4" placeholder="M. Mohamed ou BC : 2472..." value={editOp.clientName} onChange={e => setEditOp({...editOp, clientName: e.target.value})} /></div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black ml-2">Montant (DH)</Label>
                <Input 
                  type="text" 
                  className="h-12 rounded-2xl font-black text-lg bg-slate-50 border-none px-4 text-[#0D1B2A] tabular-nums" 
                  placeholder="0,00" 
                  value={editOp.montant} 
                  onChange={e => setEditOp({...editOp, montant: e.target.value})} 
                  onBlur={() => editOp.montant && setEditOp({...editOp, montant: formatCurrency(parseAmount(editOp.montant))})}
                />
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={opLoading} className="w-full h-14 font-black rounded-full text-base tracking-widest shadow-xl">ENREGISTRER</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CaissePage() { return <AppShell><Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}><CaisseContent /></Suspense></AppShell>; }