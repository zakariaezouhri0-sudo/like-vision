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
import { PlusCircle, Wallet, LogOut, Printer, Coins, Loader2, AlertCircle, CheckCircle2, MoreVertical, Edit2, Trash2, PiggyBank, FileText, PlayCircle, Lock, RefreshCcw, History, AlertTriangle, User as UserIcon, Calendar, ArrowLeft, ArrowRightLeft, TrendingUp, TrendingDown, Landmark } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, setDoc, where, Timestamp, limit, deleteDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { startOfDay, endOfDay, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Textarea } from "@/components/ui/textarea";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

function CaisseContent() {
  const { toast } = useToast();
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Date handling: current day or from param
  const dateParam = searchParams.get("date");
  const selectedDate = useMemo(() => {
    if (dateParam) {
      const d = new Date(dateParam);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  }, [dateParam]);

  const sessionDocId = format(selectedDate, "yyyy-MM-dd");
  const isToday = format(new Date(), "yyyy-MM-dd") === sessionDocId;
  const [role, setRole] = useState<string>("OPTICIENNE");

  useEffect(() => {
    setRole(localStorage.getItem('user_role') || "OPTICIENNE");
  }, []);
  
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  
  const [isModifying, setIsModifying] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>("0");
  const [modificationReason, setModificationReason] = useState("");
  
  const sessionRef = useMemoFirebase(() => doc(db, "cash_sessions", sessionDocId), [db, sessionDocId]);
  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);

  const lastSessionQuery = useMemoFirebase(() => {
    return query(
      collection(db, "cash_sessions"),
      orderBy("date", "desc"),
      limit(10)
    );
  }, [db]);
  
  const { data: recentSessions, isLoading: lastSessionLoading } = useCollection(lastSessionQuery);
  
  const lastSession = useMemo(() => {
    if (!recentSessions) return null;
    return recentSessions.find(s => s.status === "CLOSED" && s.id !== sessionDocId);
  }, [recentSessions, sessionDocId]);

  useEffect(() => {
    if (lastSession && !session && isToday) {
      setOpeningBalanceInput(lastSession.closingBalanceReal.toString());
    }
  }, [lastSession, session, isToday]);

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
  
  const { data: transactions, isLoading: loadingTrans } = useCollection(transactionsQuery);

  const [newOp, setNewOp] = useState({
    type: "DEPENSE",
    label: "",
    category: "Général",
    montant: ""
  });

  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
  const soldeReel = useMemo(() => Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0), [denoms]);

  const stats = useMemo(() => {
    if (!transactions) return { entrees: 0, depenses: 0, versements: 0 };
    return transactions.reduce((acc: any, t: any) => {
      if (t.type === "VENTE") {
        acc.entrees += Math.abs(t.montant);
      } else if (t.type === "VERSEMENT") {
        acc.versements += Math.abs(t.montant);
      } else if (t.type === "DEPENSE") {
        acc.depenses += Math.abs(t.montant);
      }
      return acc;
    }, { entrees: 0, depenses: 0, versements: 0 });
  }, [transactions]);

  const initialBalance = session?.openingBalance || 0;
  const soldeTheorique = initialBalance + stats.entrees - stats.depenses - stats.versements;
  const ecart = soldeReel - soldeTheorique;

  const handleOpenCash = async () => {
    if (isModifying && !modificationReason.trim()) {
      toast({ variant: "destructive", title: "Justification requise", description: "Veuillez expliquer pourquoi vous modifiez le solde initial." });
      return;
    }

    const amount = parseFloat(openingBalanceInput) || 0;
    const sessionData = {
      openingBalance: amount,
      status: "OPEN",
      openedAt: serverTimestamp(),
      date: sessionDocId,
      wasModified: isModifying,
      modificationReason: isModifying ? modificationReason : null,
      previousClosingBalance: lastSession?.closingBalanceReal || 0,
      openedBy: user?.displayName || "Inconnu"
    };

    try {
      setOpLoading(true);
      await setDoc(sessionRef, sessionData);
      toast({ variant: "success", title: "Caisse Ouverte", description: `Session démarrée avec ${formatCurrency(amount)}` });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `cash_sessions/${sessionDocId}`, operation: "create", requestResourceData: sessionData }));
    } finally {
      setOpLoading(false);
    }
  };

  const handleReopenCash = async () => {
    if (!confirm("Voulez-vous vraiment ré-ouvrir la caisse ? Cela permettra de modifier les opérations de cette journée.")) return;
    try {
      setOpLoading(true);
      await updateDoc(sessionRef, {
        status: "OPEN",
        closedAt: null,
        closingBalanceReal: null,
        closingBalanceTheoretical: null,
        discrepancy: null
      });
      toast({ variant: "success", title: "Caisse Ré-ouverte", description: "Vous pouvez à nouveau gérer les opérations." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setOpLoading(false);
    }
  };

  const handleAddOperation = async () => {
    if (!newOp.montant) {
      toast({ variant: "destructive", title: "Erreur", description: "Saisissez un montant." });
      return;
    }
    setOpLoading(true);
    const amount = parseFloat(newOp.montant);
    const isOutflow = newOp.type === "DEPENSE" || newOp.type === "VERSEMENT";
    const finalAmount = isOutflow ? -Math.abs(amount) : Math.abs(amount);

    const transData = {
      type: newOp.type,
      label: newOp.label || (newOp.type === "DEPENSE" ? "Dépense" : newOp.type === "VERSEMENT" ? "Versement Banque" : "Vente"),
      category: "Général",
      montant: finalAmount,
      userName: user?.displayName || "Inconnu",
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "transactions"), transData);
      toast({ variant: "success", title: "Opération enregistrée" });
      setNewOp({ type: "DEPENSE", label: "", category: "Général", montant: "" });
      setIsOpDialogOpen(false);
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "transactions", operation: "create", requestResourceData: transData }));
    } finally {
      setOpLoading(false);
    }
  };

  const handleDeleteOperation = async (id: string, label: string) => {
    if (!confirm(`Supprimer l'opération "${label}" ?`)) return;
    const transRef = doc(db, "transactions", id);
    try {
      await deleteDoc(transRef);
      toast({ variant: "success", title: "Opération supprimée" });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: transRef.path, operation: "delete" }));
    }
  };

  const handleUpdateOperation = async () => {
    if (!editingTransaction) return;
    setOpLoading(true);
    const transRef = doc(db, "transactions", editingTransaction.id);
    const amount = parseFloat(editingTransaction.montant_raw);
    const isOutflow = editingTransaction.type === "DEPENSE" || editingTransaction.type === "VERSEMENT";
    const finalAmount = isOutflow ? -Math.abs(amount) : Math.abs(amount);

    const updateData = {
      type: editingTransaction.type,
      label: editingTransaction.label,
      category: editingTransaction.category,
      montant: finalAmount,
    };

    try {
      await updateDoc(transRef, updateData);
      toast({ variant: "success", title: "Opération mise à jour" });
      setEditingTransaction(null);
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: transRef.path, operation: "update", requestResourceData: updateData }));
    } finally {
      setOpLoading(false);
    }
  };

  const handleFinalizeClosure = async () => {
    try {
      setOpLoading(true);
      await updateDoc(sessionRef, {
        status: "CLOSED",
        closedAt: serverTimestamp(),
        closingBalanceReal: soldeReel,
        closingBalanceTheoretical: soldeTheorique,
        discrepancy: ecart,
        closedBy: user?.displayName || "Inconnu"
      });
      
      const params = new URLSearchParams({
        date: sessionDocId,
        ventes: stats.entrees.toString(),
        depenses: stats.depenses.toString(),
        versements: stats.versements.toString(),
        reel: soldeReel.toString(),
        initial: initialBalance.toString()
      });

      Object.entries(denoms).forEach(([val, qty]) => {
        params.append(`d${val}`, qty.toString());
      });

      router.push(`/rapports/print/cloture?${params.toString()}`);
      toast({ variant: "success", title: "Caisse Clôturée" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de la clôture" });
    } finally {
      setOpLoading(false);
    }
  };

  if (sessionLoading || lastSessionLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vérification de la caisse...</p>
      </div>
    );
  }

  // View for past date not opened
  if (!isToday && !session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="h-20 w-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center">
          <Calendar className="h-10 w-10" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black uppercase text-slate-800">Aucune Session</h2>
          <p className="text-muted-foreground font-medium">La caisse n'a pas été ouverte le {format(selectedDate, "dd MMMM yyyy", { locale: fr })}.</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/caisse/sessions')} className="rounded-xl font-black uppercase text-xs">
          <ArrowLeft className="mr-2 h-4 w-4" /> RETOUR AU JOURNAL
        </Button>
      </div>
    );
  }

  // --- VIEW: CASH CLOSED ---
  if (session?.status === "CLOSED") {
    return (
      <div className="space-y-8 animate-in fade-in zoom-in duration-500 pb-20">
        {!isToday && (
          <Button variant="ghost" onClick={() => router.push('/caisse/sessions')} className="font-black text-xs uppercase text-primary mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" /> RETOUR AU JOURNAL
          </Button>
        )}
        
        <div className="flex flex-col items-center justify-center max-w-4xl mx-auto text-center space-y-8">
          <div className="h-24 w-24 bg-slate-900 rounded-[32px] flex items-center justify-center text-white shadow-2xl">
            <Lock className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Caisse Clôturée</h1>
            <p className="text-muted-foreground font-bold">Journée du {format(selectedDate, "dd MMMM yyyy", { locale: fr })}.</p>
          </div>
          
          <div className={cn("grid gap-4 w-full", role === 'ADMIN' ? "grid-cols-2" : "grid-cols-1")}>
            <Card className="bg-white border-none shadow-md p-6 rounded-[24px]">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Solde Final Réel</p>
              <p className="text-2xl font-black text-primary">{formatCurrency(session.closingBalanceReal)}</p>
            </Card>
            {role === 'ADMIN' && (
              <Card className="bg-white border-none shadow-md p-6 rounded-[24px]">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Écart constaté</p>
                <p className={cn("text-2xl font-black", session.discrepancy >= 0 ? "text-green-600" : "text-destructive")}>
                  {session.discrepancy > 0 ? "+" : ""}{formatCurrency(session.discrepancy)}
                </p>
              </Card>
            )}
          </div>

          {/* Grouped Operations Summary like in Report */}
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {/* VENTES */}
            <Card className="bg-white border-none shadow-lg rounded-[24px] overflow-hidden">
              <div className="bg-green-50 px-5 py-4 border-b border-green-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Ventes</span>
                </div>
                <span className="text-xs font-black text-green-700">+{formatCurrency(stats.entrees)}</span>
              </div>
              <div className="p-5 space-y-3 max-h-[300px] overflow-y-auto">
                {transactions?.filter(t => t.type === 'VENTE').length > 0 ? (
                  transactions?.filter(t => t.type === 'VENTE').map(t => (
                    <div key={t.id} className="flex flex-col border-b border-slate-50 pb-2 last:border-0">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-slate-700 uppercase leading-tight flex-1 pr-2">{t.label}</span>
                        <span className="text-[10px] font-black text-green-600 whitespace-nowrap">{formatCurrency(t.montant)}</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                        {t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[9px] text-slate-300 italic text-center py-4 uppercase font-black">Aucune vente</p>
                )}
              </div>
            </Card>

            {/* CHARGES / DEPENSES */}
            <Card className="bg-white border-none shadow-lg rounded-[24px] overflow-hidden">
              <div className="bg-red-50 px-5 py-4 border-b border-red-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Dépenses</span>
                </div>
                <span className="text-xs font-black text-red-700">-{formatCurrency(stats.depenses)}</span>
              </div>
              <div className="p-5 space-y-3 max-h-[300px] overflow-y-auto">
                {transactions?.filter(t => t.type === 'DEPENSE').length > 0 ? (
                  transactions?.filter(t => t.type === 'DEPENSE').map(t => (
                    <div key={t.id} className="flex flex-col border-b border-slate-50 pb-2 last:border-0">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-slate-700 uppercase leading-tight flex-1 pr-2">{t.label}</span>
                        <span className="text-[10px] font-black text-red-600 whitespace-nowrap">{formatCurrency(t.montant)}</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                        {t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[9px] text-slate-300 italic text-center py-4 uppercase font-black">Aucune dépense</p>
                )}
              </div>
            </Card>

            {/* VERSEMENTS */}
            <Card className="bg-white border-none shadow-lg rounded-[24px] overflow-hidden">
              <div className="bg-orange-50 px-5 py-4 border-b border-orange-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-orange-600" />
                  <span className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Banque</span>
                </div>
                <span className="text-xs font-black text-orange-700">-{formatCurrency(stats.versements)}</span>
              </div>
              <div className="p-5 space-y-3 max-h-[300px] overflow-y-auto">
                {transactions?.filter(t => t.type === 'VERSEMENT').length > 0 ? (
                  transactions?.filter(t => t.type === 'VERSEMENT').map(t => (
                    <div key={t.id} className="flex flex-col border-b border-slate-50 pb-2 last:border-0">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-slate-700 uppercase leading-tight flex-1 pr-2">{t.label}</span>
                        <span className="text-[10px] font-black text-orange-600 whitespace-nowrap">{formatCurrency(t.montant)}</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                        {t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[9px] text-slate-300 italic text-center py-4 uppercase font-black">Aucun versement</p>
                )}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <Button onClick={() => router.push(`/rapports/print/journalier?date=${sessionDocId}`)} variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-xs border-primary/20 bg-white">
                <FileText className="mr-2 h-5 w-5" /> REVOIR LE RAPPORT COMPLET
              </Button>
              <Button onClick={() => isToday ? router.push("/dashboard") : router.push("/caisse/sessions")} className="flex-1 h-14 rounded-2xl font-black uppercase text-xs shadow-xl">
                RETOUR {isToday ? "AU TABLEAU DE BORD" : "AU JOURNAL"}
              </Button>
            </div>
            
            {role === 'ADMIN' && isToday && (
              <Button 
                onClick={handleReopenCash} 
                variant="ghost" 
                disabled={opLoading}
                className="w-full h-12 rounded-xl font-black uppercase text-[10px] text-destructive hover:bg-destructive/5"
              >
                {opLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCcw className="mr-2 h-4 w-4" />} 
                RÉ-OUVRIR LA SESSION (ADMIN)
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW: CASH NOT OPENED YET (TODAY ONLY) ---
  if (!session && isToday) {
    const isSubsequentSession = !!lastSession;

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-lg mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="h-24 w-24 bg-primary rounded-[32px] flex items-center justify-center text-white shadow-2xl transform rotate-3">
          <PlayCircle className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">Ouverture de Caisse</h1>
          <p className="text-muted-foreground font-bold">Préparez votre journée du {format(selectedDate, "dd MMMM yyyy", { locale: fr })}.</p>
        </div>
        
        <Card className="w-full bg-white border-none shadow-2xl p-8 rounded-[40px] space-y-6">
          {!isSubsequentSession || isModifying ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
                  {isModifying ? "CORRIGER LE FOND DE CAISSE" : "Saisir le Fond de Caisse (Solde Initial)"}
                </Label>
                <div className="relative">
                  <input 
                    type="number" 
                    autoFocus
                    className="w-full h-20 text-4xl font-black text-center rounded-3xl bg-slate-50 border-2 border-primary/5 outline-none focus:border-primary/20 transition-all text-primary"
                    value={openingBalanceInput}
                    onChange={(e) => setOpeningBalanceInput(e.target.value)}
                  />
                  <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">DH</span>
                </div>
              </div>

              {isModifying && (
                <div className="space-y-3 text-left animate-in fade-in slide-in-from-top-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-destructive ml-1">Motif de la modification (Requis)</Label>
                  <Textarea 
                    placeholder="Pourquoi le montant est différent de la clôture d'hier ?"
                    className="min-h-[100px] rounded-2xl bg-slate-50 border-destructive/20 focus:ring-destructive/10 font-bold text-xs"
                    value={modificationReason}
                    onChange={(e) => setModificationReason(e.target.value)}
                  />
                </div>
              )}
              
              <div className="flex gap-3">
                {isModifying && (
                  <Button 
                    variant="outline" 
                    onClick={() => { setIsModifying(false); setOpeningBalanceInput(lastSession?.closingBalanceReal.toString() || "0"); }}
                    className="h-16 rounded-2xl font-black text-xs px-6 border-slate-200"
                  >
                    ANNULER
                  </Button>
                )}
                <Button 
                  onClick={handleOpenCash} 
                  disabled={opLoading || (isModifying && !modificationReason.trim())}
                  className="flex-1 h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20"
                >
                  {opLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : isModifying ? "VALIDER LA MODIFICATION" : "OUVRIR LA SESSION"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 py-4">
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-primary/40 uppercase font-black text-[10px] tracking-[0.2em]">
                  <History className="h-3 w-3" /> Report de la veille
                </div>
                <div className="bg-slate-50 rounded-[32px] p-8 border-2 border-primary/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Solde de Clôture Attendu</p>
                  <p className="text-5xl font-black text-primary tracking-tighter">{formatCurrency(lastSession.closingBalanceReal)}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleOpenCash} 
                  disabled={opLoading}
                  className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20"
                >
                  {opLoading ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-6 w-6" />}
                  VALIDER CE MONTANT
                </Button>
                
                <Button 
                  variant="ghost"
                  onClick={() => setIsModifying(true)}
                  className="w-full h-12 rounded-xl font-black text-[10px] uppercase text-slate-400 hover:text-primary hover:bg-primary/5"
                >
                  <Edit2 className="mr-2 h-4 w-4" /> MODIFIER LE MONTANT
                </Button>
              </div>
            </div>
          )}
        </Card>
        
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-8">
          <AlertCircle className="inline-block h-3 w-3 mr-1 mb-0.5" /> 
          L'ouverture enregistre le montant présent physiquement en caisse. Toute modification par rapport à hier sera tracée.
        </p>
      </div>
    );
  }

  // --- VIEW: DASHBOARD (CASH OPENED) ---
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <div className="h-3 w-3 bg-green-600 rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Caisse Ouverte</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Journée du {format(selectedDate, "dd/MM/yyyy")}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {isToday && (
            <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary h-12 px-6 rounded-xl font-black text-[10px] uppercase shadow-lg flex-1 sm:flex-none">
                  <PlusCircle className="mr-2 h-4 w-4" /> NOUVELLE OPÉRATION
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl">
                <DialogHeader><DialogTitle className="font-black uppercase text-primary">Gestion des flux</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Type d'opération</Label>
                      <Select value={newOp.type} onValueChange={v => setNewOp({...newOp, type: v})}>
                        <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DEPENSE" className="font-bold text-destructive">Dépense (Charge)</SelectItem>
                          <SelectItem value="VERSEMENT" className="font-bold text-orange-600">Versement (Banque)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Montant (DH)</Label>
                      <Input type="number" className="h-11 rounded-xl font-bold" value={newOp.montant} onChange={e => setNewOp({...newOp, montant: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Libellé (Optionnel)</Label>
                    <Input className="h-11 rounded-xl font-bold" value={newOp.label} onChange={e => setNewOp({...newOp, label: e.target.value})} placeholder="ex: Paiement loyer, Depot BMCE..." />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddOperation} disabled={opLoading} className="w-full h-12 font-black rounded-xl">
                    {opLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "VALIDER L'OPÉRATION"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Button 
            variant="outline"
            onClick={() => router.push(`/rapports/print/journalier?date=${sessionDocId}`)}
            className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-accent/20 text-accent bg-accent/5 hover:bg-accent hover:text-white transition-all shadow-md flex-1 sm:flex-none"
          >
            <FileText className="mr-2 h-4 w-4" /> RAPPORT JOURNALIER
          </Button>

          {isToday && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-destructive text-destructive flex-1 sm:flex-none">
                  <LogOut className="mr-2 h-4 w-4" /> CLÔTURE DE JOURNÉE
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-3xl rounded-[24px] sm:rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                 <DialogHeader className="p-4 sm:p-8 bg-slate-900 text-white">
                    <DialogTitle className="font-black uppercase tracking-widest text-center flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base">
                      <Coins className="h-5 w-5 sm:h-6 text-primary" /> Clôture & Comptage
                    </DialogTitle>
                 </DialogHeader>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    <div className="p-4 sm:p-8 bg-white space-y-3 sm:space-y-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-[9px] sm:text-[10px] font-black uppercase text-slate-400 tracking-widest">Détail par coupure</h4>
                      </div>
                      <div className="space-y-1.5 sm:space-y-2">
                        {DENOMINATIONS.map(val => (
                          <div key={val} className="flex items-center gap-2 sm:gap-3 bg-slate-50 p-1.5 sm:p-2 rounded-xl border border-slate-100">
                            <span className="w-12 sm:w-16 text-right font-black text-[10px] sm:text-[11px] text-slate-400">{val} DH</span>
                            <Input 
                              type="number" 
                              className="h-8 sm:h-9 w-16 sm:w-20 text-center font-bold bg-white border-none shadow-inner p-0" 
                              value={denoms[val]} 
                              onChange={(e) => setDenoms({...denoms, [val]: parseInt(e.target.value) || 0})} 
                            />
                            <span className="flex-1 text-right font-black text-primary text-[10px] sm:text-[11px]">{formatCurrency(val * (denoms[val] || 0))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-4 sm:p-8 border-t md:border-t-0 md:border-l border-slate-200 space-y-4 sm:space-y-6">
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black uppercase text-slate-400">
                          <span>Solde Initial</span>
                          <span className="text-slate-900">{formatCurrency(initialBalance)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black uppercase text-green-600">
                          <span>Total Ventes (+)</span>
                          <span>{formatCurrency(stats.entrees)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black uppercase text-destructive">
                          <span>Dépenses (-)</span>
                          <span>{formatCurrency(stats.depenses)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] sm:text-[10px] font-black uppercase text-orange-600">
                          <span>Versements (-)</span>
                          <span>{formatCurrency(stats.versements)}</span>
                        </div>
                        
                        {role === 'ADMIN' && (
                          <div className="flex justify-between items-center bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100">
                            <span className="text-[9px] sm:text-[10px] font-black uppercase text-primary/40 tracking-widest">Solde Théorique</span>
                            <span className="text-base sm:text-lg font-black text-slate-900">{formatCurrency(soldeTheorique)}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center bg-primary/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-primary/20">
                          <span className="text-[9px] sm:text-[10px] font-black uppercase text-primary tracking-widest">Total Compté</span>
                          <span className="text-xl sm:text-2xl font-black text-primary tracking-tighter">{formatCurrency(soldeReel)}</span>
                        </div>
                        
                        {role === 'ADMIN' && (
                          <div className={cn(
                            "flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 transition-all",
                            Math.abs(ecart) < 0.01 ? "bg-green-50 border-green-200" : "bg-destructive/5 border-destructive/20"
                          )}>
                            <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Écart de Caisse</span>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-2xl sm:text-3xl font-black tracking-tighter", ecart >= 0 ? "text-green-600" : "text-destructive")}>
                                {ecart > 0 ? "+" : ""}{formatCurrency(ecart)}
                              </span>
                              {Math.abs(ecart) < 0.01 ? <CheckCircle2 className="h-4 w-4 sm:h-5 text-green-500" /> : <AlertCircle className="h-4 w-4 sm:h-5 text-destructive" />}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button 
                        onClick={handleFinalizeClosure} 
                        disabled={opLoading}
                        className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm shadow-xl mt-2"
                      >
                        {opLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "VALIDER & CLÔTURER LA JOURNÉE"}
                      </Button>
                    </div>
                 </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {session.wasModified && (
        <Card className="bg-destructive/5 border-2 border-destructive/20 p-4 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase text-destructive tracking-widest">Alerte : Solde d'ouverture modifié manuellement</p>
            <p className="text-xs font-bold text-slate-700 italic">" {session.modificationReason} "</p>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Écart à l'ouverture : {formatCurrency(session.openingBalance - session.previousClosingBalance)}</p>
          </div>
        </Card>
      )}

      {isToday && (
        <Dialog open={!!editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl">
            <DialogHeader><DialogTitle className="font-black uppercase text-primary">Modifier l'Opération</DialogTitle></DialogHeader>
            {editingTransaction && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Type d'opération</Label>
                    <Select value={editingTransaction.type} onValueChange={v => setEditingTransaction({...editingTransaction, type: v})}>
                      <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEPENSE" className="font-bold text-destructive">Dépense (Charge)</SelectItem>
                        <SelectItem value="VERSEMENT" className="font-bold text-orange-600">Versement (Banque)</SelectItem>
                        <SelectItem value="VENTE" className="font-bold text-green-600">Vente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Montant (DH)</Label>
                    <Input type="number" className="h-11 rounded-xl font-bold" value={editingTransaction.montant_raw} onChange={e => setEditingTransaction({...editingTransaction, montant_raw: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Libellé</Label>
                  <Input className="h-11 rounded-xl font-bold" value={editingTransaction.label} onChange={e => setEditingTransaction({...editingTransaction, label: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Catégorie</Label>
                  <Input className="h-11 rounded-xl font-bold" value={editingTransaction.category} onChange={e => setEditingTransaction({...editingTransaction, category: e.target.value})} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleUpdateOperation} disabled={opLoading} className="w-full h-12 font-black rounded-xl">
                {opLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "ENREGISTRER LES MODIFICATIONS"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-white border-none p-5 rounded-[24px] shadow-md border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-2">
            <PiggyBank className="h-3.5 w-3.5 text-blue-500" />
            <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Solde Initial</p>
          </div>
          <div className="bg-slate-50/50 p-2 rounded-xl">
            <p className="text-xl font-black text-blue-600">{formatCurrency(initialBalance).replace(' DH', '')} <span className="text-[10px] opacity-40">DH</span></p>
          </div>
        </Card>
        
        <Card className="bg-white border-none p-5 rounded-[24px] shadow-md border-l-4 border-l-green-500">
          <p className="text-[9px] uppercase font-black text-muted-foreground mb-3 tracking-widest">Ventes du jour</p>
          <p className="text-xl font-black text-green-600">+{formatCurrency(stats.entrees).replace(' DH', '')} <span className="text-[10px] opacity-40">DH</span></p>
        </Card>
        
        <Card className="bg-white border-none p-5 rounded-[24px] shadow-md border-l-4 border-l-destructive">
          <p className="text-[9px] uppercase font-black text-muted-foreground mb-3 tracking-widest">Dépenses (Charges)</p>
          <p className="text-xl font-black text-destructive">-{formatCurrency(stats.depenses).replace(' DH', '')} <span className="text-[10px] opacity-40">DH</span></p>
        </Card>
        
        <Card className="bg-white border-none p-5 rounded-[24px] shadow-md border-l-4 border-l-orange-500">
          <p className="text-[9px] uppercase font-black text-muted-foreground mb-3 tracking-widest">Versements (Banque)</p>
          <p className="text-xl font-black text-orange-600">-{formatCurrency(stats.versements).replace(' DH', '')} <span className="text-[10px] opacity-40">DH</span></p>
        </Card>
        
        <Card className="bg-primary text-primary-foreground p-5 rounded-[24px] shadow-lg flex flex-col justify-center">
          <p className="text-[9px] uppercase font-black opacity-60 mb-2 tracking-widest">Solde Théorique</p>
          <p className="text-xl font-black">{formatCurrency(soldeTheorique).replace(' DH', '')} <span className="text-[10px] opacity-40">DH</span></p>
        </Card>
      </div>

      <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
        <CardHeader className="py-4 px-6 bg-slate-50/50 border-b">
          <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Opérations du Jour ({transactions?.length || 0})</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-black px-6 py-4">Heure & Opération</TableHead>
                {role === 'ADMIN' && <TableHead className="text-[10px] uppercase font-black px-6 py-4 text-center">Utilisateur</TableHead>}
                <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Montant</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingTrans ? <TableRow><TableCell colSpan={role === 'ADMIN' ? 4 : 3} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> : 
                transactions?.length === 0 ? <TableRow><TableCell colSpan={role === 'ADMIN' ? 4 : 3} className="text-center py-20 text-[10px] font-black uppercase opacity-20 tracking-widest">Aucune opération aujourd'hui.</TableCell></TableRow> :
                transactions?.map((t: any) => (
                  <TableRow key={t.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold text-slate-400">
                            {t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}
                          </span>
                          <span className="text-[11px] font-black uppercase text-slate-800">
                            {t.type === 'VENTE' && t.relatedId ? `Vente ${t.relatedId}` : t.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[8px] font-black border-none px-2 py-0", 
                            t.type === 'VENTE' ? 'bg-green-100 text-green-700' : 
                            t.type === 'VERSEMENT' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                          )}>
                            {t.type}
                          </Badge>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {t.category ? `• ${t.category}` : ""}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    {role === 'ADMIN' && (
                      <TableCell className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                          <UserIcon className="h-3 w-3 text-slate-300" />
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-tighter truncate max-w-[100px]">{t.userName || "---"}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className={cn("text-right px-6 py-4 font-black text-xs", t.montant >= 0 ? "text-green-600" : "text-destructive")}>
                      {t.montant > 0 ? "+" : ""}{formatCurrency(t.montant)}
                    </TableCell>
                    <TableCell className="text-right px-6 py-4">
                      {role === 'ADMIN' && isToday ? (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 rounded-xl transition-all">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-primary/10 min-w-[160px]">
                            <DropdownMenuItem onClick={() => setEditingTransaction({ ...t, montant_raw: Math.abs(t.montant).toString() })} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                              <Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteOperation(t.id, t.label)} className="text-destructive py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                              <Trash2 className="mr-3 h-4 w-4" /> Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-[8px] font-black text-slate-300 uppercase">Verrouillé</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export default function CaissePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}>
        <CaisseContent />
      </Suspense>
    </AppShell>
  );
}
