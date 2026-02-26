
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
  
  const [isClientReady, setIsHydrated] = useState(false);
  const [todayId, setTodayId] = useState("");
  const [role, setRole] = useState<string>("OPTICIENNE");

  useEffect(() => {
    setIsHydrated(true);
    setTodayId(format(new Date(), "yyyy-MM-dd"));
    setRole(localStorage.getItem('user_role') || "OPTICIENNE");
  }, []);

  const isPrepaMode = role === "PREPA";

  const dateParam = searchParams.get("date");
  const selectedDate = useMemo(() => {
    if (dateParam) {
      const d = new Date(dateParam);
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  }, [dateParam]);

  const sessionDocId = format(selectedDate, "yyyy-MM-dd");
  const isToday = isClientReady && todayId === sessionDocId;
  
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  
  const [isModifying, setIsModifying] = useState(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>("0");
  const [modificationReason, setModificationReason] = useState("");
  
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

  // Filtrage selon le Mode Préparation
  const transactions = useMemo(() => {
    if (!rawTransactions) return [];
    return rawTransactions.filter((t: any) => isPrepaMode ? t.isDraft === true : !t.isDraft);
  }, [rawTransactions, isPrepaMode]);

  const [newOp, setNewOp] = useState({ type: "DEPENSE", label: "", category: "Général", montant: "" });
  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 20, 20: 0, 10: 0, 5: 0, 1: 0 });
  const soldeReel = useMemo(() => Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0), [denoms]);

  const stats = useMemo(() => {
    return transactions.reduce((acc: any, t: any) => {
      if (t.type === "VENTE") { acc.entrees += Math.abs(t.montant); } 
      else if (t.type === "VERSEMENT") { acc.versements += Math.abs(t.montant); } 
      else if (t.type === "DEPENSE") { acc.depenses += Math.abs(t.montant); }
      return acc;
    }, { entrees: 0, depenses: 0, versements: 0 });
  }, [transactions]);

  const initialBalance = session?.openingBalance || 0;
  const soldeTheorique = initialBalance + stats.entrees - stats.depenses - stats.versements;
  const ecart = soldeReel - soldeTheorique;

  const handleOpenCash = async () => {
    const amount = parseFloat(openingBalanceInput) || 0;
    const sessionData = {
      openingBalance: amount, status: "OPEN", openedAt: serverTimestamp(), date: sessionDocId,
      wasModified: isModifying, modificationReason: isModifying ? modificationReason : null,
      openedBy: user?.displayName || "Inconnu",
      isDraft: isPrepaMode
    };
    try {
      setOpLoading(true);
      await setDoc(sessionRef, sessionData);
      toast({ variant: "success", title: "Caisse Ouverte" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleAddOperation = async () => {
    if (!newOp.montant) return;
    setOpLoading(true);
    const finalAmount = newOp.type === "VENTE" ? Math.abs(parseFloat(newOp.montant)) : -Math.abs(parseFloat(newOp.montant));
    const transData = {
      type: newOp.type, label: newOp.label || newOp.type, category: "Général", montant: finalAmount,
      userName: user?.displayName || "Inconnu", isDraft: isPrepaMode, createdAt: serverTimestamp()
    };
    try {
      await addDoc(collection(db, "transactions"), transData);
      toast({ variant: "success", title: "Opération enregistrée" });
      setIsOpDialogOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleUpdateOperation = async () => {
    if (!editingTransaction) return;
    setOpLoading(true);
    const transRef = doc(db, "transactions", editingTransaction.id);
    const finalAmount = editingTransaction.type === "VENTE" ? Math.abs(parseFloat(editingTransaction.montant_raw)) : -Math.abs(parseFloat(editingTransaction.montant_raw));
    try {
      await updateDoc(transRef, { type: editingTransaction.type, label: editingTransaction.label, montant: finalAmount });
      toast({ variant: "success", title: "Mis à jour" });
      setEditingTransaction(null);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleFinalizeClosure = async () => {
    try {
      setOpLoading(true);
      await updateDoc(sessionRef, {
        status: "CLOSED", closedAt: serverTimestamp(), closingBalanceReal: soldeReel, closingBalanceTheoretical: soldeTheorique,
        discrepancy: ecart, closedBy: user?.displayName || "Inconnu", totalSales: stats.entrees, totalExpenses: stats.depenses, totalVersements: stats.versements
      });
      router.push(`/rapports/print/cloture?date=${sessionDocId}&ventes=${stats.entrees}&depenses=${stats.depenses}&versements=${stats.versements}&reel=${soldeReel}&initial=${initialBalance}`);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  if (!isClientReady || sessionLoading) return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  if (session?.status === "CLOSED") {
    return (
      <div className="space-y-8 animate-in fade-in zoom-in duration-500 pb-20">
        <div className="flex flex-col items-center justify-center max-w-4xl mx-auto text-center space-y-8">
          <div className="h-24 w-24 bg-slate-900 rounded-[32px] flex items-center justify-center text-white shadow-2xl"><Lock className="h-10 w-10" /></div>
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Caisse Clôturée {isPrepaMode ? "(Mode PREPA)" : ""}</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <Card className="p-6 rounded-[24px]"><p className="text-[10px] font-black uppercase text-slate-400">Solde Final Réel</p><p className="text-2xl font-black text-primary">{formatCurrency(session.closingBalanceReal)}</p></Card>
            {role === 'ADMIN' && <Card className="p-6 rounded-[24px]"><p className="text-[10px] font-black uppercase text-slate-400">Écart</p><p className={cn("text-2xl font-black", session.discrepancy >= 0 ? "text-green-600" : "text-red-500")}>{formatCurrency(session.discrepancy)}</p></Card>}
          </div>
          <Button onClick={() => router.push("/dashboard")} className="h-14 px-10 rounded-2xl font-black">RETOUR AU TABLEAU DE BORD</Button>
        </div>
      </div>
    );
  }

  if (!session && isToday) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-lg mx-auto text-center space-y-8">
        <div className="h-24 w-24 bg-primary rounded-[32px] flex items-center justify-center text-white shadow-2xl transform rotate-3"><PlayCircle className="h-12 w-12" /></div>
        <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">Ouverture {isPrepaMode ? "Brouillon" : "Caisse"}</h1>
        <Card className="w-full bg-white p-8 rounded-[40px] space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Solde Initial</Label>
            <div className="relative"><input type="number" className="w-full h-20 text-4xl font-black text-center rounded-3xl bg-slate-50 border-2 border-primary/5 outline-none" value={openingBalanceInput} onChange={(e) => setOpeningBalanceInput(e.target.value)} /><span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">DH</span></div>
          </div>
          <Button onClick={handleOpenCash} disabled={opLoading} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-primary/20">OUVRIR LA SESSION</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center shrink-0"><div className="h-3 w-3 bg-green-600 rounded-full animate-pulse" /></div>
          <div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Caisse Ouverte {isPrepaMode ? "(Brouillon)" : ""}</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Journée du {format(selectedDate, "dd/MM/yyyy")}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {isToday && (
            <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
              <DialogTrigger asChild><Button className="h-12 px-6 rounded-xl font-black text-[10px] uppercase flex-1 sm:flex-none"><PlusCircle className="mr-2 h-4 w-4" /> NOUVELLE OPÉRATION</Button></DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader><DialogTitle className="font-black uppercase text-primary">Gestion des flux</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Type</Label><select className="w-full h-11 rounded-xl font-bold bg-white border border-slate-200 px-3 outline-none" value={newOp.type} onChange={e => setNewOp({...newOp, type: e.target.value})}><option value="DEPENSE">Dépense</option><option value="VERSEMENT">Banque</option><option value="VENTE">Vente</option></select></div>
                    <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Montant</Label><Input type="number" className="h-11 rounded-xl font-bold" value={newOp.montant} onChange={e => setNewOp({...newOp, montant: e.target.value})} /></div>
                  </div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Libellé</Label><Input className="h-11 rounded-xl font-bold" value={newOp.label} onChange={e => setNewOp({...newOp, label: e.target.value})} /></div>
                </div>
                <DialogFooter><Button onClick={handleAddOperation} disabled={opLoading} className="w-full h-12 font-black rounded-xl">VALIDER</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog>
            <DialogTrigger asChild><Button variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-red-500 text-red-500 flex-1 sm:flex-none"><LogOut className="mr-2 h-4 w-4" /> CLÔTURE</Button></DialogTrigger>
            <DialogContent className="max-w-3xl rounded-[32px] p-8 border-none shadow-2xl">
              <DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-center">Clôture & Comptage {isPrepaMode ? "(Brouillon)" : ""}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                <div className="space-y-2">
                  {DENOMINATIONS.map(val => (
                    <div key={val} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
                      <span className="w-16 text-right font-black text-xs text-slate-400">{val} DH</span>
                      <Input type="number" className="h-9 w-20 text-center font-bold" value={denoms[val]} onChange={(e) => setDenoms({...denoms, [val]: parseInt(e.target.value) || 0})} />
                      <span className="flex-1 text-right font-black text-primary text-xs">{formatCurrency(val * (denoms[val] || 0))}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Solde Initial</span><span>{formatCurrency(initialBalance)}</span></div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-green-600"><span>Ventes (+)</span><span>{formatCurrency(stats.entrees)}</span></div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-red-500"><span>Dépenses (-)</span><span>{formatCurrency(stats.depenses)}</span></div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-orange-600"><span>Versements (-)</span><span>{formatCurrency(stats.versements)}</span></div>
                  <div className="pt-4 border-t flex justify-between items-center"><span className="text-xs font-black uppercase">Total Compté</span><span className="text-2xl font-black text-primary">{formatCurrency(soldeReel)}</span></div>
                  <div className={cn("p-4 rounded-xl text-center", Math.abs(ecart) < 0.01 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}><p className="text-[8px] font-black uppercase mb-1">Écart constaté</p><p className="text-xl font-black">{formatCurrency(ecart)}</p></div>
                  <Button onClick={handleFinalizeClosure} disabled={opLoading} className="w-full h-12 rounded-xl font-black shadow-xl">VALIDER LA CLÔTURE</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5 rounded-[24px] border-l-4 border-l-blue-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Solde Initial</p><p className="text-xl font-black text-blue-600">{formatCurrency(initialBalance)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-green-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Ventes {isPrepaMode ? "(Mode PREPA)" : ""}</p><p className="text-xl font-black text-green-600">+{formatCurrency(stats.entrees)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-red-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Dépenses {isPrepaMode ? "(Mode PREPA)" : ""}</p><p className="text-xl font-black text-red-500">-{formatCurrency(stats.depenses)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-orange-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Versements {isPrepaMode ? "(Mode PREPA)" : ""}</p><p className="text-xl font-black text-orange-600">-{formatCurrency(stats.versements)}</p></Card>
        <Card className="bg-primary text-primary-foreground p-5 rounded-[24px]"><p className="text-[9px] uppercase font-black opacity-60 mb-2">Solde Théorique</p><p className="text-xl font-black">{formatCurrency(soldeTheorique)}</p></Card>
      </div>

      <Card className="rounded-[32px] overflow-hidden bg-white">
        <CardHeader className="py-4 px-6 bg-slate-50 border-b"><CardTitle className="text-[11px] font-black uppercase text-primary/60">Opérations du Jour {isPrepaMode ? "(Brouillon)" : ""} ({transactions.length})</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow><TableHead className="text-[10px] uppercase font-black px-6 py-4">Heure & Opération</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Montant</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {loadingTrans ? <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> : 
                transactions.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center py-20 text-[10px] font-black opacity-20">Aucune opération {isPrepaMode ? "brouillon" : ""} aujourd'hui.</TableCell></TableRow> :
                transactions.map((t: any) => (
                  <TableRow key={t.id} className="hover:bg-slate-50 border-b">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col"><div className="flex items-center gap-2 mb-1"><span className="text-[9px] font-bold text-slate-400">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}</span><span className="text-[11px] font-black uppercase text-slate-800">{t.label}</span></div><Badge className={cn("text-[8px] font-black border-none px-2 w-fit", t.type === 'VENTE' ? 'bg-green-100 text-green-700' : t.type === 'VERSEMENT' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700')}>{t.type}</Badge></div>
                    </TableCell>
                    <TableCell className={cn("text-right px-6 py-4 font-black text-xs", t.montant >= 0 ? "text-green-600" : "text-red-500")}>{formatCurrency(t.montant)}</TableCell>
                    <TableCell className="text-right px-6 py-4">
                      {role === 'ADMIN' || role === 'PREPA' ? (
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2 min-w-[160px]">
                            <DropdownMenuItem onClick={() => setEditingTransaction({ ...t, montant_raw: Math.abs(t.montant).toString() })} className="py-2.5 font-black text-[10px] uppercase rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier</DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => { if(confirm("Supprimer ?")) await deleteDoc(doc(db, "transactions", t.id)) }} className="text-red-500 py-2.5 font-black text-[10px] uppercase rounded-xl"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : <span className="text-[8px] font-black text-slate-300 uppercase">Verrouillé</span>}
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

export default function CaissePage() { return <AppShell><Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}><CaisseContent /></Suspense></AppShell>; }
