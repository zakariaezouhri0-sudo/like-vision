
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
  Edit2
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, updateDoc, doc, serverTimestamp, query, setDoc, where, Timestamp, deleteDoc, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, format, setHours, parseISO } from "date-fns";
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
  const [openingVal, setOpeningVal] = useState("");
  const [isAutoReport, setIsAutoReport] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    setRole(savedRole);
    setIsHydrated(true);
  }, []);

  const isPrepaMode = role === "PREPA";

  const selectedDate = useMemo(() => {
    const dateParam = searchParams.get("date");
    if (dateParam) {
      try {
        const d = parseISO(dateParam);
        if (!isNaN(d.getTime())) return d;
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

  const allSessionsQuery = useMemoFirebase(() => {
    return query(
      collection(db, "cash_sessions"),
      where("isDraft", "==", isPrepaMode),
      orderBy("date", "desc")
    );
  }, [db, isPrepaMode]);
  const { data: allSessions } = useCollection(allSessionsQuery);

  useEffect(() => {
    if (!session && allSessions && allSessions.length > 0) {
      const pastSessions = [...allSessions]
        .filter(s => s.date < dateStr && s.status === "CLOSED")
        .sort((a, b) => b.date.localeCompare(a.date));
      
      if (pastSessions.length > 0) {
        const lastClosing = pastSessions[0].closingBalanceReal;
        if (lastClosing !== undefined) {
          setOpeningVal(lastClosing.toString());
          setIsAutoReport(true);
        }
      }
    } else if (!session) {
      setOpeningVal("");
      setIsAutoReport(false);
    }
  }, [allSessions, session, dateStr]);

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

  const [newOp, setNewOp] = useState({ type: "DEPENSE", label: "", clientName: "", montant: "" });
  const [editOp, setEditOp] = useState({ type: "DEPENSE", label: "", clientName: "", montant: "" });
  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
  
  const soldeReel = useMemo(() => Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0), [denoms]);

  const stats = useMemo(() => {
    return transactions.reduce((acc: any, t: any) => {
      const amt = Math.abs(Number(t.montant) || 0);
      if (t.type === "VENTE") acc.entrees += amt;
      else if (t.type === "VERSEMENT") acc.versements += amt;
      else acc.depenses += amt;
      return acc;
    }, { entrees: 0, depenses: 0, versements: 0 });
  }, [transactions]);

  const initialBalance = session?.openingBalance || 0;
  const soldeTheorique = initialBalance + stats.entrees - stats.depenses - stats.versements;
  const ecart = soldeReel - soldeTheorique;

  const handleOpenSession = async () => {
    try {
      setOpLoading(true);
      const openedAt = isPrepaMode ? Timestamp.fromDate(setHours(selectedDate, 10)) : serverTimestamp();
      await setDoc(sessionRef, { 
        openingBalance: parseFloat(openingVal) || 0, 
        status: "OPEN", 
        openedAt, 
        date: dateStr, 
        openedBy: user?.displayName || "Inconnu", 
        isDraft: isPrepaMode 
      });
      toast({ variant: "success", title: "Caisse Ouverte" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleAddOperation = async () => {
    if (!newOp.montant) return;
    setOpLoading(true);
    const amt = parseFloat(newOp.montant);
    const finalAmount = (newOp.type === "VENTE") ? Math.abs(amt) : -Math.abs(amt);
    try {
      const transRef = doc(collection(db, "transactions"));
      await setDoc(transRef, { 
        type: newOp.type, 
        label: newOp.label || newOp.type, 
        clientName: newOp.clientName || "",
        category: "Général", 
        montant: finalAmount, 
        userName: user?.displayName || "Inconnu", 
        isDraft: isPrepaMode, 
        createdAt: serverTimestamp() 
      });
      toast({ variant: "success", title: "Opération enregistrée" });
      setIsOpDialogOpen(false);
      setNewOp({ type: "DEPENSE", label: "", clientName: "", montant: "" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
  };

  const handleOpenEdit = (t: any) => {
    setSelectedTrans(t);
    setEditOp({
      type: t.type,
      label: t.label || "",
      clientName: t.clientName || "",
      montant: Math.abs(t.montant).toString()
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateOperation = async () => {
    if (!selectedTrans || !editOp.montant) return;
    setOpLoading(true);
    const amt = parseFloat(editOp.montant);
    const finalAmount = (editOp.type === "VENTE") ? Math.abs(amt) : -Math.abs(amt);
    try {
      await updateDoc(doc(db, "transactions", selectedTrans.id), {
        type: editOp.type,
        label: editOp.label || editOp.type,
        clientName: editOp.clientName || "",
        montant: finalAmount,
        updatedAt: serverTimestamp()
      });
      toast({ variant: "success", title: "Opération mise à jour" });
      setIsEditDialogOpen(false);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setOpLoading(false); }
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
        closedBy: user?.displayName || "Inconnu", 
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
        <div className={cn("h-24 w-24 rounded-[32px] flex items-center justify-center text-white shadow-2xl transform rotate-3", isPrepaMode ? "bg-orange-500" : "bg-primary")}>
          <CalendarCheck className="h-12 w-12" />
        </div>
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">Ouverture {isPrepaMode ? "Historique" : "Caisse"}</h1>
          <div className="flex flex-col items-center gap-4">
            <div className="bg-white px-6 py-3 rounded-2xl border-2 border-primary/10 shadow-sm">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Date sélectionnée</p>
              <p className="text-xl font-black text-primary">
                {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
              </p>
            </div>
            {isPrepaMode && (
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" className="h-12 px-8 rounded-xl font-black text-xs uppercase shadow-lg border-orange-500 text-orange-600 bg-orange-50 hover:bg-orange-500 hover:text-white transition-all"><CalendarIcon className="mr-2 h-4 w-4" /> CHOISIR UNE AUTRE DATE</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl"><Calendar mode="single" selected={selectedDate} onSelect={(d) => d && router.push(`/caisse?date=${format(d, "yyyy-MM-dd")}`)} locale={fr} initialFocus /></PopoverContent>
              </Popover>
            )}
          </div>
        </div>
        <Card className="w-full bg-white p-8 rounded-[40px] space-y-6 shadow-2xl border-none">
          <div className="space-y-3">
            <div className="flex justify-between items-center px-1">
              <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">Solde Initial (DH)</Label>
              {isAutoReport && <Badge variant="outline" className="text-[8px] font-black text-green-600 uppercase bg-green-50 px-2 py-1 rounded-md border-green-100">Report auto</Badge>}
            </div>
            <div className="relative">
              <input 
                type="number" 
                className={cn("w-full h-20 text-4xl font-black text-center rounded-3xl border-2 outline-none transition-all", isAutoReport ? "bg-slate-50 border-green-200 text-slate-500 cursor-not-allowed" : "bg-slate-50 border-primary/5 focus:border-primary/20")}
                value={openingVal === "0" || openingVal === "" ? "" : openingVal} 
                placeholder="---"
                onChange={(e) => !isAutoReport && setOpeningVal(e.target.value)}
                readOnly={isAutoReport}
              />
              <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">DH</span>
            </div>
          </div>
          <Button onClick={handleOpenSession} disabled={opLoading} className={cn("w-full h-16 rounded-2xl font-black text-lg shadow-xl uppercase", isPrepaMode ? "bg-orange-500" : "bg-primary")}>VALIDER L'OUVERTURE</Button>
        </Card>
      </div>
    );
  }

  const isClosed = session?.status === "CLOSED";

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0", isClosed ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600")}>
            {isClosed ? <Lock className="h-6 w-6" /> : <div className="h-3 w-3 bg-green-600 rounded-full animate-pulse" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter leading-none">{isClosed ? "Session Clôturée" : "Caisse Ouverte"}</h1>
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border mt-2">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-700 font-black tracking-widest uppercase">{format(selectedDate, "dd MMMM yyyy", { locale: fr })}</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {!isClosed && (
            <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
              <DialogTrigger asChild><Button className="h-12 px-6 rounded-xl font-black text-[10px] uppercase flex-1 sm:flex-none"><PlusCircle className="mr-2 h-4 w-4" /> NOUVELLE OPÉRATION</Button></DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader><DialogTitle className="font-black uppercase text-primary">Mouvement de Caisse</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Type</Label><select className="w-full h-11 rounded-xl font-bold bg-white border px-3 outline-none" value={newOp.type} onChange={e => setNewOp({...newOp, type: e.target.value})}><option value="VENTE">Vente (+)</option><option value="DEPENSE">Dépense (-)</option><option value="ACHAT MONTURE">Achat Monture (-)</option><option value="ACHAT VERRES">Achat Verres (-)</option><option value="VERSEMENT">Versement (-)</option></select></div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Libellé</Label><Input className="h-11 rounded-xl font-bold" placeholder="Désignation..." value={newOp.label} onChange={e => setNewOp({...newOp, label: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Nom Client (Optionnel)</Label><Input className="h-11 rounded-xl font-bold" placeholder="M. Mohamed..." value={newOp.clientName} onChange={e => setNewOp({...newOp, clientName: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Montant (DH)</Label><Input type="number" className="h-11 rounded-xl font-bold" placeholder="---" value={newOp.montant} onChange={e => setNewOp({...newOp, montant: e.target.value})} /></div>
                </div>
                <DialogFooter><Button onClick={handleAddOperation} disabled={opLoading} className="w-full h-12 font-black rounded-xl">VALIDER</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" onClick={() => router.push(`/rapports/print/journalier?date=${dateStr}`)} className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary flex-1 sm:flex-none shadow-sm"><FileText className="mr-2 h-4 w-4" /> RAPPORT</Button>
          {!isClosed && (
            <Dialog>
              <DialogTrigger asChild><Button variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-red-50 text-red-500 flex-1 shadow-sm"><LogOut className="mr-2 h-4 w-4" /> CLÔTURE</Button></DialogTrigger>
              <DialogContent className="max-w-3xl rounded-[32px] p-8 border-none shadow-2xl">
                <DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-center">Clôture & Comptage {isPrepaMode ? "(Brouillon)" : ""}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                  <div className="space-y-2">
                    {DENOMINATIONS.map(val => (
                      <div key={val} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border">
                        <span className="w-16 text-right font-black text-xs text-slate-400">{val} DH</span>
                        <Input type="number" className="h-9 w-20 text-center font-bold" placeholder="---" value={denoms[val] || ""} onChange={(e) => setDenoms({...denoms, [val]: parseInt(e.target.value) || 0})} />
                        <span className="flex-1 text-right font-black text-primary text-xs">{formatCurrency(val * (denoms[val] || 0))}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-4 bg-slate-50 p-6 rounded-2xl border">
                    <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Solde Initial</span><span>{formatCurrency(initialBalance)}</span></div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-green-600"><span>Ventes (+)</span><span>{formatCurrency(stats.entrees)}</span></div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-red-500"><span>Dépenses (-)</span><span>{formatCurrency(stats.depenses)}</span></div>
                    <div className="flex justify-between text-[10px] font-black uppercase text-orange-600"><span>Versements (-)</span><span>{formatCurrency(stats.versements)}</span></div>
                    <div className="pt-4 border-t flex justify-between items-center"><span className="text-xs font-black uppercase">Compté</span><span className="text-2xl font-black text-primary">{formatCurrency(soldeReel)}</span></div>
                    <div className={cn("p-4 rounded-xl text-center", Math.abs(ecart) < 0.01 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}><p className="text-[8px] font-black uppercase mb-1">Écart</p><p className="text-xl font-black">{formatCurrency(ecart)}</p></div>
                    <Button onClick={handleFinalizeClosure} disabled={opLoading} className="w-full h-12 rounded-xl font-black">VALIDER LA CLÔTURE</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-5 rounded-[24px] border-l-4 border-l-blue-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Solde Initial</p><p className="text-xl font-black text-blue-600">{formatCurrency(initialBalance)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-green-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Ventes</p><p className="text-xl font-black text-green-600">+{formatCurrency(stats.entrees)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-red-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Dépenses</p><p className="text-xl font-black text-red-500">-{formatCurrency(stats.depenses)}</p></Card>
        <Card className="p-5 rounded-[24px] border-l-4 border-l-orange-500"><p className="text-[9px] uppercase font-black text-muted-foreground mb-2">Versements</p><p className="text-xl font-black text-orange-600">-{formatCurrency(stats.versements)}</p></Card>
        <Card className="bg-primary text-primary-foreground p-5 rounded-[24px]"><p className="text-[9px] uppercase font-black opacity-60 mb-2">Solde {isClosed ? "Final Réel" : "Théorique"}</p><p className="text-xl font-black">{formatCurrency(isClosed ? session.closingBalanceReal : soldeTheorique)}</p></Card>
      </div>

      <Card className="rounded-[32px] overflow-hidden bg-white shadow-sm border-none">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow><TableHead className="text-[10px] uppercase font-black px-6 py-4">Opération & Détails</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Montant</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {loadingTrans ? (
                <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : transactions.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-20 text-[10px] font-black opacity-20">Aucune opération enregistrée.</TableCell></TableRow>
              ) : (
                transactions.map((t: any) => (
                  <TableRow key={t.id} className="hover:bg-slate-50 border-b transition-all">
                    <TableCell className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-400 w-10 shrink-0">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--"}</span>
                          <span className="text-[11px] font-black uppercase text-slate-800 leading-tight">
                            {t.type} {t.label ? `| ${t.label}` : ''}
                          </span>
                        </div>
                        {t.clientName && (
                          <div className="ml-12">
                            <span className="text-[9px] font-bold text-primary/60 uppercase tracking-tight leading-none opacity-80">
                              {t.clientName}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={cn("text-right px-6 py-4 font-black text-xs", t.montant >= 0 ? "text-green-600" : "text-red-500")}>{formatCurrency(t.montant)}</TableCell>
                    <TableCell className="text-right px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleOpenEdit(t)} 
                          className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/10 rounded-lg shadow-sm"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={async () => { if(confirm("Supprimer cette opération ?")) await deleteDoc(doc(db, "transactions", t.id)) }} 
                          className="h-8 w-8 text-red-500 border-red-100 hover:bg-red-50 rounded-lg shadow-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle className="font-black uppercase text-primary">Modifier Opération</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Type</Label><select className="w-full h-11 rounded-xl font-bold bg-white border px-3 outline-none" value={editOp.type} onChange={e => setEditOp({...editOp, type: e.target.value})}><option value="VENTE">Vente (+)</option><option value="DEPENSE">Dépense (-)</option><option value="ACHAT MONTURE">Achat Monture (-)</option><option value="ACHAT VERRES">Achat Verres (-)</option><option value="VERSEMENT">Versement (-)</option></select></div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Libellé</Label><Input className="h-11 rounded-xl font-bold" placeholder="Désignation..." value={editOp.label} onChange={e => setEditOp({...editOp, label: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Nom Client (Optionnel)</Label><Input className="h-11 rounded-xl font-bold" placeholder="M. Mohamed..." value={editOp.clientName} onChange={e => setEditOp({...editOp, clientName: e.target.value})} /></div>
            <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Montant (DH)</Label><Input type="number" className="h-11 rounded-xl font-bold" placeholder="---" value={editOp.montant} onChange={e => setEditOp({...editOp, montant: e.target.value})} /></div>
          </div>
          <DialogFooter><Button onClick={handleUpdateOperation} disabled={opLoading} className="w-full h-12 font-black rounded-xl">ENREGISTRER</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CaissePage() { return <AppShell><Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}><CaisseContent /></Suspense></AppShell>; }
