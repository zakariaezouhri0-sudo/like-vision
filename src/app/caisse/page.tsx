
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PlusCircle, Wallet, LogOut, Printer, Coins, Loader2, AlertCircle, CheckCircle2, MoreVertical, Edit2, Trash2, PiggyBank, FileText, PlayCircle, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit, setDoc, where, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { startOfDay, endOfDay, format } from "date-fns";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export default function CaissePage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  
  const [todayDate] = useState(new Date());
  const sessionDocId = format(todayDate, "yyyy-MM-dd");
  
  // State for session management
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>("0");
  
  // Fetch current session
  const sessionRef = useMemoFirebase(() => doc(db, "cash_sessions", sessionDocId), [db, sessionDocId]);
  const { data: session, isLoading: sessionLoading } = useDoc(sessionRef);

  // Fetch today's transactions only
  const transactionsQuery = useMemoFirebase(() => {
    const start = startOfDay(todayDate);
    const end = endOfDay(todayDate);
    return query(
      collection(db, "transactions"), 
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end)),
      orderBy("createdAt", "desc")
    );
  }, [db, todayDate]);
  
  const { data: transactions, isLoading: loadingTrans } = useCollection(transactionsQuery);

  const [newOp, setNewOp] = useState({
    type: "DEPENSE",
    label: "",
    category: "Général",
    montant: ""
  });

  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 5, 1: 0 });
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
    const amount = parseFloat(openingBalanceInput) || 0;
    const sessionData = {
      openingBalance: amount,
      status: "OPEN",
      openedAt: serverTimestamp(),
      date: sessionDocId
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
      category: newOp.category,
      montant: finalAmount,
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
        discrepancy: ecart
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

  if (sessionLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vérification de la caisse...</p>
        </div>
      </AppShell>
    );
  }

  // --- VIEW: CASH CLOSED ---
  if (session?.status === "CLOSED") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-2xl mx-auto text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="h-24 w-24 bg-slate-900 rounded-[32px] flex items-center justify-center text-white shadow-2xl">
            <Lock className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Caisse Clôturée</h1>
            <p className="text-muted-foreground font-bold">La journée du {format(todayDate, "dd MMMM yyyy")} est terminée.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 w-full">
            <Card className="bg-white border-none shadow-md p-6 rounded-[24px]">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Solde Final Réel</p>
              <p className="text-2xl font-black text-primary">{formatCurrency(session.closingBalanceReal)}</p>
            </Card>
            <Card className="bg-white border-none shadow-md p-6 rounded-[24px]">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Écart constaté</p>
              <p className={cn("text-2xl font-black", session.discrepancy >= 0 ? "text-green-600" : "text-destructive")}>
                {session.discrepancy > 0 ? "+" : ""}{formatCurrency(session.discrepancy)}
              </p>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <Button onClick={() => router.push(`/rapports/print/journalier?date=${sessionDocId}`)} variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase text-xs border-primary/20">
              <FileText className="mr-2 h-5 w-5" /> REVOIR LE RAPPORT
            </Button>
            <Button onClick={() => router.push("/dashboard")} className="flex-1 h-14 rounded-2xl font-black uppercase text-xs shadow-xl">
              RETOUR AU TABLEAU DE BORD
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // --- VIEW: CASH NOT OPENED YET ---
  if (!session) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-lg mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="h-24 w-24 bg-primary rounded-[32px] flex items-center justify-center text-white shadow-2xl transform rotate-3">
            <PlayCircle className="h-12 w-12" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">Ouverture de Caisse</h1>
            <p className="text-muted-foreground font-bold">Préparez votre journée du {format(todayDate, "dd MMMM yyyy")}.</p>
          </div>
          
          <Card className="w-full bg-white border-none shadow-2xl p-8 rounded-[40px] space-y-6">
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Saisir le Fond de Caisse (Solde Initial)</Label>
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
            
            <Button 
              onClick={handleOpenCash} 
              disabled={opLoading}
              className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20"
            >
              {opLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "OUVRIR LA SESSION"}
            </Button>
          </Card>
          
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <AlertCircle className="inline-block h-3 w-3 mr-1 mb-0.5" /> 
            L'ouverture enregistre le montant présent physiquement en caisse.
          </p>
        </div>
      </AppShell>
    );
  }

  // --- VIEW: DASHBOARD (CASH OPENED) ---
  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shrink-0">
              <div className="h-3 w-3 bg-green-600 rounded-full animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Caisse Ouverte</h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Journée du {format(todayDate, "dd/MM/yyyy")}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
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

            <Button 
              variant="outline"
              onClick={() => router.push(`/rapports/print/journalier?date=${sessionDocId}`)}
              className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-primary/20 text-primary bg-white hover:bg-primary hover:text-white transition-all shadow-sm flex-1 sm:flex-none"
            >
              <FileText className="mr-2 h-4 w-4" /> RAPPORT JOURNALIER
            </Button>

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
                        <div className="flex justify-between items-center bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border border-slate-100">
                          <span className="text-[9px] sm:text-[10px] font-black uppercase text-primary/40 tracking-widest">Solde Théorique</span>
                          <span className="text-base sm:text-lg font-black text-slate-900">{formatCurrency(soldeTheorique)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center bg-primary/5 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-primary/20">
                          <span className="text-[9px] sm:text-[10px] font-black uppercase text-primary tracking-widest">Total Compté</span>
                          <span className="text-xl sm:text-2xl font-black text-primary tracking-tighter">{formatCurrency(soldeReel)}</span>
                        </div>
                        
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
          </div>
        </div>

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
                  <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Montant</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingTrans ? <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> : 
                  transactions?.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-20 text-[10px] font-black uppercase opacity-20 tracking-widest">Aucune opération aujourd'hui.</TableCell></TableRow> :
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
                      <TableCell className={cn("text-right px-6 py-4 font-black text-xs", t.montant >= 0 ? "text-green-600" : "text-destructive")}>
                        {t.montant > 0 ? "+" : ""}{formatCurrency(t.montant)}
                      </TableCell>
                      <TableCell className="text-right px-6 py-4">
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
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
