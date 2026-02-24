
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
import { PlusCircle, Wallet, LogOut, ArrowUpRight, ArrowDownRight, Printer, Coins, Loader2 } from "lucide-react";
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
  const [isSessionOpen, setIsSessionOpen] = useState(true);
  const [isOpDialogOpen, setIsOpDialogOpen] = useState(false);
  const [opLoading, setOpLoading] = useState(false);
  
  const [newOp, setNewOp] = useState({
    type: "DEPENSE",
    label: "",
    category: "Fournitures",
    montant: ""
  });

  const transactionsQuery = useMemoFirebase(() => query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(20)), [db]);
  const { data: transactions, isLoading: loading } = useCollection(transactionsQuery);

  const [denoms, setDenoms] = useState<Record<number, number>>({ 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 });
  const soldeReel = useMemo(() => Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0), [denoms]);

  const stats = useMemo(() => {
    if (!transactions) return { ventes: 0, depenses: 0, apports: 0 };
    return transactions.reduce((acc: any, t: any) => {
      if (t.type === "VENTE") acc.ventes += t.montant;
      if (t.type === "DEPENSE") acc.depenses += Math.abs(t.montant);
      if (t.type === "APPORT") acc.apports += t.montant;
      return acc;
    }, { ventes: 0, depenses: 0, apports: 0 });
  }, [transactions]);

  const handleAddOperation = async () => {
    if (!newOp.label || !newOp.montant) {
      toast({ variant: "destructive", title: "Erreur", description: "Saisissez un libellé et un montant." });
      return;
    }
    setOpLoading(true);
    const amount = parseFloat(newOp.montant);
    const finalAmount = newOp.type === "DEPENSE" ? -Math.abs(amount) : Math.abs(amount);

    const transData = {
      type: newOp.type,
      label: newOp.label,
      category: newOp.category,
      montant: finalAmount,
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(db, "transactions"), transData);
      toast({ variant: "success", title: "Opération enregistrée", description: `${newOp.type} ajouté avec succès.` });
      setNewOp({ type: "DEPENSE", label: "", category: "Fournitures", montant: "" });
      setIsOpDialogOpen(false);
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "transactions", operation: "create", requestResourceData: transData }));
    } finally {
      setOpLoading(false);
    }
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
                <DialogHeader><DialogTitle className="font-black uppercase text-primary">Encaisser / Décaisser</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Type</Label>
                      <Select value={newOp.type} onValueChange={v => setNewOp({...newOp, type: v})}>
                        <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="DEPENSE">Dépense</SelectItem><SelectItem value="APPORT">Apport</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black text-muted-foreground">Montant (DH)</Label>
                      <Input type="number" className="h-11 rounded-xl font-bold" value={newOp.montant} onChange={e => setNewOp({...newOp, montant: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Libellé</Label>
                    <Input className="h-11 rounded-xl font-bold" value={newOp.label} onChange={e => setNewOp({...newOp, label: e.target.value})} placeholder="ex: Achat papier A4" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddOperation} disabled={opLoading} className="w-full h-12 font-black rounded-xl">
                    {opLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "VALIDER"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-destructive text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> CLÔTURE
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl rounded-3xl">
                 <DialogHeader><DialogTitle className="font-black uppercase text-primary text-center">Clôture & Comptage Espèces</DialogTitle></DialogHeader>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                    <div className="space-y-4">
                      {DENOMINATIONS.map(val => (
                        <div key={val} className="flex items-center gap-3">
                          <span className="w-16 text-right font-black text-xs">{val} DH</span>
                          <Input type="number" className="h-9 w-20 text-center font-bold" value={denoms[val]} onChange={e => setDenoms({...denoms, [val]: parseInt(e.target.value) || 0})} />
                          <span className="flex-1 text-right font-black text-primary/60 text-xs">{formatCurrency(val * (denoms[val] || 0))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl border space-y-4 text-center">
                      <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Compté</p>
                      <p className="text-4xl font-black text-primary tracking-tighter">{formatCurrency(soldeReel)}</p>
                      <div className="h-px bg-slate-200" />
                      <Button className="w-full h-12 rounded-xl font-black">VALIDER & IMPRIMER</Button>
                    </div>
                 </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-primary text-primary-foreground p-6 rounded-[32px] shadow-lg">
            <p className="text-[10px] uppercase font-black opacity-60 mb-1">Entrées (Ventes/Apports)</p>
            <p className="text-2xl font-black">{formatCurrency(stats.ventes + stats.apports)}</p>
          </Card>
          <Card className="bg-white border-none p-6 rounded-[32px] shadow-lg border-l-8 border-l-destructive">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1">Sorties (Dépenses)</p>
            <p className="text-2xl font-black text-destructive">-{formatCurrency(stats.depenses)}</p>
          </Card>
          <Card className="bg-accent text-accent-foreground p-6 rounded-[32px] shadow-lg">
            <p className="text-[10px] uppercase font-black opacity-60 mb-1">Solde Théorique</p>
            <p className="text-2xl font-black">{formatCurrency(stats.ventes + stats.apports - stats.depenses)}</p>
          </Card>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
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
                    <TableRow key={t.id} className="hover:bg-primary/5 border-b last:border-0">
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase text-slate-800">{t.label}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{t.type} • {t.category}</span>
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
