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
import { PlusCircle, Wallet, LogOut, ArrowUpRight, ArrowDownRight, Printer, Coins, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy, limit } from "firebase/firestore";
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
  
  const [newOp, setNewOp] = useState({
    type: "DEPENSE",
    label: "",
    category: "Général",
    montant: ""
  });

  const transactionsQuery = useMemoFirebase(() => query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(50)), [db]);
  const { data: transactions, isLoading: loading } = useCollection(transactionsQuery);

  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
  const soldeReel = useMemo(() => Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0), [denoms]);

  const stats = useMemo(() => {
    if (!transactions) return { ventes: 0, depenses: 0, apports: 0 };
    return transactions.reduce((acc: any, t: any) => {
      if (t.type === "VENTE") acc.ventes += t.montant;
      if (t.type === "DEPENSE") acc.depenses += Math.abs(t.montant);
      if (t.type === "APPORT" || t.type === "VERSEMENT") acc.apports += t.montant;
      return acc;
    }, { ventes: 0, depenses: 0, apports: 0 });
  }, [transactions]);

  const soldeTheorique = stats.ventes + stats.apports - stats.depenses;
  const ecart = soldeReel - soldeTheorique;

  const handleAddOperation = async () => {
    if (!newOp.montant) {
      toast({ variant: "destructive", title: "Erreur", description: "Saisissez un montant." });
      return;
    }
    setOpLoading(true);
    const amount = parseFloat(newOp.montant);
    const finalAmount = newOp.type === "DEPENSE" ? -Math.abs(amount) : Math.abs(amount);

    const transData = {
      type: newOp.type,
      label: newOp.label || (newOp.type === "DEPENSE" ? "Dépense" : newOp.type === "VERSEMENT" ? "Versement" : "Apport"),
      category: newOp.category,
      montant: finalAmount,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "transactions"), transData);
      toast({ variant: "success", title: "Opération enregistrée", description: `${newOp.type} ajouté avec succès.` });
      setNewOp({ type: "DEPENSE", label: "", category: "Général", montant: "" });
      setIsOpDialogOpen(false);
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "transactions", operation: "create", requestResourceData: transData }));
    } finally {
      setOpLoading(false);
    }
  };

  const handlePrintClosure = () => {
    const params = new URLSearchParams({
      date: new Date().toLocaleDateString("fr-FR"),
      ventes: stats.ventes.toString(),
      depenses: stats.depenses.toString(),
      apports: stats.apports.toString(),
      reel: soldeReel.toString(),
      initial: "0" 
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
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Suivi des entrées et sorties d'espèces.</p>
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
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Type</Label>
                      <Select value={newOp.type} onValueChange={v => setNewOp({...newOp, type: v})}>
                        <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DEPENSE" className="font-bold text-destructive">Dépense</SelectItem>
                          <SelectItem value="VERSEMENT" className="font-bold text-green-600">Versement</SelectItem>
                          <SelectItem value="APPORT" className="font-bold text-blue-600">Apport</SelectItem>
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
                    <Input className="h-11 rounded-xl font-bold" value={newOp.label} onChange={e => setNewOp({...newOp, label: e.target.value})} placeholder="ex: Achat fournitures" />
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
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Détail par coupure</h4>
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
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Solde Théorique</span>
                          <span className="text-sm font-black text-slate-600">{formatCurrency(soldeTheorique)}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Total Compté</span>
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
                      <p className="text-[9px] text-center font-bold text-slate-400 uppercase leading-relaxed">
                        Cette action générera un document A4 officiel<br/>pour vos archives comptables.
                      </p>
                    </div>
                 </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-primary text-primary-foreground p-6 rounded-[32px] shadow-lg">
            <p className="text-[10px] uppercase font-black opacity-60 mb-1">Entrées (Ventes/Versements)</p>
            <p className="text-2xl font-black">{formatCurrency(stats.ventes + stats.apports)}</p>
          </Card>
          <Card className="bg-white border-none p-6 rounded-[32px] shadow-lg border-l-8 border-l-destructive">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Sorties (Dépenses)</p>
            <p className="text-2xl font-black text-destructive">-{formatCurrency(stats.depenses)}</p>
          </Card>
          <Card className="bg-accent text-accent-foreground p-6 rounded-[32px] shadow-lg">
            <p className="text-[10px] uppercase font-black opacity-60 mb-1">Solde de Caisse Actuel</p>
            <p className="text-2xl font-black">{formatCurrency(soldeTheorique)}</p>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={2} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow> : 
                  transactions?.map((t: any) => (
                    <TableRow key={t.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase text-slate-800">{t.label}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                            {t.type} {t.category ? `• ${t.category}` : ""}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right px-6 py-4 font-black text-xs", t.montant >= 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(t.montant)}
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
