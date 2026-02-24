
"use client";

import { useState, useMemo } from "react";
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
import { PlusCircle, Wallet, LogOut, ArrowUpRight, ArrowDownRight, Printer, Coins, Loader2, AlertCircle, CheckCircle2, History, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export default function CaissePage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  
  const [newOp, setNewOp] = useState({
    type: "DEPENSE",
    label: "",
    category: "Général",
    montant: ""
  });

  const [soldeInitial, setSoldeInitial] = useState<string>("0");

  const transactionsQuery = useMemoFirebase(() => query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(50)), [db]);
  const { data: transactions, isLoading: loading } = useCollection(transactionsQuery);

  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
  const soldeReel = useMemo(() => Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0), [denoms]);

  const stats = useMemo(() => {
    if (!transactions) return { entrees: 0, depenses: 0, versements: 0 };
    return transactions.reduce((acc: any, t: any) => {
      if (t.montant > 0) {
        acc.entrees += t.montant;
      } else {
        if (t.type === "VERSEMENT") {
          acc.versements += Math.abs(t.montant);
        } else {
          acc.depenses += Math.abs(t.montant);
        }
      }
      return acc;
    }, { entrees: 0, depenses: 0, versements: 0 });
  }, [transactions]);

  const initial = parseFloat(soldeInitial) || 0;
  const soldeTheorique = initial + stats.entrees - stats.depenses - stats.versements;
  const ecart = soldeReel - soldeTheorique;

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
      label: newOp.label || (newOp.type === "DEPENSE" ? "Dépense" : newOp.type === "VERSEMENT" ? "Versement Banque" : newOp.type === "APPORT" ? "Apport" : "Vente"),
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

  const handlePrintClosure = () => {
    const params = new URLSearchParams({
      date: new Date().toLocaleDateString("fr-FR"),
      ventes: stats.entrees.toString(),
      depenses: stats.depenses.toString(),
      versements: stats.versements.toString(),
      apports: "0", 
      reel: soldeReel.toString(),
      initial: initial.toString()
    });

    Object.entries(denoms).forEach(([val, qty]) => {
      params.append(`d${val}`, qty.toString());
    });

    router.push(`/rapports/print/cloture?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Gestion de Caisse</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Suivi des flux réels du magasin.</p>
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Dialog open={isOpDialogOpen} onOpenChange={setIsOpDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary h-12 px-6 rounded-xl font-black text-[10px] uppercase shadow-lg">
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
                          <SelectItem value="APPORT" className="font-bold text-blue-600">Apport (Entrée)</SelectItem>
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

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-destructive text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> CLÔTURE DE JOURNÉE
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-3xl rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
                 <DialogHeader className="p-8 bg-slate-900 text-white">
                    <DialogTitle className="font-black uppercase tracking-widest text-center flex items-center justify-center gap-3">
                      <Coins className="h-6 w-6 text-primary" /> Clôture & Comptage Espèces
                    </DialogTitle>
                 </DialogHeader>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    <div className="p-8 bg-white space-y-4">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Détail par coupure</h4>
                        <div className="space-y-1 text-right">
                           <Label className="text-[8px] font-black uppercase text-slate-400">Solde Initial</Label>
                           <Input type="number" className="h-8 w-24 text-right font-black text-xs" value={soldeInitial} onChange={e => setSoldeInitial(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        {DENOMINATIONS.map(val => (
                          <div key={val} className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="w-16 text-right font-black text-[11px] text-slate-400">{val} DH</span>
                            <Input type="number" className="h-9 w-20 text-center font-bold bg-white border-none shadow-inner" value={denoms[val]} onChange={e => setDenoms({...denoms, [val]: parseInt(e.target.value) || 0})} />
                            <span className="flex-1 text-right font-black text-primary text-[11px]">{formatCurrency(val * (denoms[val] || 0))}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 p-8 border-l border-slate-200 space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                          <span>Solde Initial</span>
                          <span className="text-slate-900">{formatCurrency(initial)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-green-600">
                          <span>Total Entrées (+)</span>
                          <span>{formatCurrency(stats.entrees)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-destructive">
                          <span>Dépenses (-)</span>
                          <span>{formatCurrency(stats.depenses)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-orange-600">
                          <span>Versements (-)</span>
                          <span>{formatCurrency(stats.versements)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                          <span className="text-[10px] font-black uppercase text-primary/40 tracking-widest">Solde Théorique</span>
                          <span className="text-lg font-black text-slate-900">{formatCurrency(soldeTheorique)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center bg-primary/5 p-4 rounded-2xl border-2 border-primary/20">
                          <span className="text-[10px] font-black uppercase text-primary tracking-widest">Total Compté</span>
                          <span className="text-2xl font-black text-primary tracking-tighter">{formatCurrency(soldeReel)}</span>
                        </div>
                        
                        <div className={cn(
                          "flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all",
                          Math.abs(ecart) < 0.01 ? "bg-green-50 border-green-200" : "bg-destructive/5 border-destructive/20"
                        )}>
                          <span className="text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Écart de Caisse</span>
                          <div className="flex items-center gap-2">
                            <span className={cn("text-3xl font-black tracking-tighter", ecart >= 0 ? "text-green-600" : "text-destructive")}>
                              {ecart > 0 ? "+" : ""}{formatCurrency(ecart)}
                            </span>
                            {Math.abs(ecart) < 0.01 ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-destructive" />}
                          </div>
                        </div>
                      </div>

                      <Button onClick={handlePrintClosure} className="w-full h-14 rounded-2xl font-black text-sm shadow-xl mt-4">
                        VALIDER & IMPRIMER LE RAPPORT
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
                        <SelectItem value="APPORT" className="font-bold text-blue-600">Apport (Entrée)</SelectItem>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white border-none p-6 rounded-[32px] shadow-lg border-l-8 border-l-green-500">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Entrées (Ventes/Apports)</p>
            <p className="text-2xl font-black text-green-600">+{formatCurrency(stats.entrees)}</p>
          </Card>
          <Card className="bg-white border-none p-6 rounded-[32px] shadow-lg border-l-8 border-l-destructive">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Dépenses (Charges)</p>
            <p className="text-2xl font-black">-{formatCurrency(stats.depenses)}</p>
          </Card>
          <Card className="bg-white border-none p-6 rounded-[32px] shadow-lg border-l-8 border-l-orange-500">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Versements (Banque)</p>
            <p className="text-2xl font-black text-orange-600">-{formatCurrency(stats.versements)}</p>
          </Card>
          <Card className="bg-primary text-primary-foreground p-6 rounded-[32px] shadow-lg">
            <p className="text-[10px] uppercase font-black opacity-60 mb-1">Solde Net des Flux</p>
            <p className="text-2xl font-black">{formatCurrency(stats.entrees - stats.depenses - stats.versements)}</p>
          </Card>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="py-4 px-6 bg-slate-50/50 border-b">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Derniers Flux de Caisse</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-black px-6 py-4">Opération</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Montant</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> : 
                  transactions?.map((t: any) => (
                    <TableRow key={t.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase text-slate-800">{t.label}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={cn("text-[8px] font-black border-none px-2", 
                              t.type === 'APPORT' || t.type === 'VENTE' ? 'bg-green-100 text-green-700' : 
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
