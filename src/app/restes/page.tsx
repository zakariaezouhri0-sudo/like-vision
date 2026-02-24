
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Printer, HandCoins, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function UnpaidSalesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const unpaidSalesQuery = useMemoFirebase(() => query(collection(db, "sales"), where("reste", ">", 0), orderBy("reste", "desc")), [db]);
  const { data: sales, isLoading: loading } = useCollection(unpaidSalesQuery);

  const filteredSales = sales?.filter((sale: any) => 
    sale.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    sale.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.clientPhone?.includes(searchTerm.replace(/\s/g, ''))
  ) || [];

  const handleOpenPayment = (sale: any) => {
    setSelectedSale(sale);
    setPaymentAmount(sale.reste.toString());
  };

  const handleValidatePayment = async () => {
    if (!selectedSale || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessing(true);
    const newAvance = (selectedSale.avance || 0) + amount;
    const newReste = Math.max(0, selectedSale.total - (selectedSale.remise || 0) - newAvance);
    const newStatut = newReste <= 0 ? "Payé" : "Partiel";

    try {
      // 1. Update Sale
      await updateDoc(doc(db, "sales", selectedSale.id), { avance: newAvance, reste: newReste, statut: newStatut, updatedAt: serverTimestamp() });
      
      // 2. Record Transaction
      await addDoc(collection(db, "transactions"), {
        type: "VENTE",
        label: `Versement ${selectedSale.invoiceId}`,
        category: "Optique",
        montant: amount,
        relatedId: selectedSale.invoiceId,
        createdAt: serverTimestamp()
      });

      toast({ variant: "success", title: "Paiement validé" });

      const params = new URLSearchParams({ client: selectedSale.clientName, phone: selectedSale.clientPhone, mutuelle: selectedSale.mutuelle, total: selectedSale.total.toString(), remise: (selectedSale.remise || 0).toString(), remisePercent: selectedSale.remisePercent || "0", avance: newAvance.toString(), od_sph: selectedSale.prescription?.od?.sph || "", od_cyl: selectedSale.prescription?.od?.cyl || "", od_axe: selectedSale.prescription?.od?.axe || "", og_sph: selectedSale.prescription?.og?.sph || "", og_cyl: selectedSale.prescription?.og?.cyl || "", og_axe: selectedSale.prescription?.og?.axe || "", monture: selectedSale.monture || "", verres: selectedSale.verres || "", date: new Date().toLocaleDateString("fr-FR") });
      router.push(`/ventes/facture/${selectedSale.invoiceId}?${params.toString()}`);
      setSelectedSale(null);
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `sales/${selectedSale.id}`, operation: "update" }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Restes à Régler</h1><p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-60">Gestion des créances clients.</p></div>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="p-4 md:p-6 border-b bg-slate-50/50">
            <div className="relative max-w-md"><Search className="absolute left-4 top-3.5 h-5 w-5 text-primary/40" /><input placeholder="Chercher par nom, téléphone ou n°..." className="w-full pl-12 h-12 text-sm font-bold rounded-xl border-none shadow-inner bg-white focus:ring-2 focus:ring-primary/20 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? <div className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></div> : (
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black px-6">Facture</TableHead>
                      <TableHead className="text-[10px] uppercase font-black px-6">Client</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6">Total Net</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 text-green-600">Payé</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 text-destructive">Reste</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length > 0 ? filteredSales.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all">
                        <TableCell className="font-black text-xs text-primary px-6">{sale.invoiceId}</TableCell>
                        <TableCell className="px-6 py-4">
                          <div className="flex flex-col"><span className="font-black text-[11px] text-slate-800 uppercase">{sale.clientName}</span><span className="text-[9px] font-black text-slate-400">{formatPhoneNumber(sale.clientPhone)}</span></div>
                        </TableCell>
                        <TableCell className="text-right px-6 font-black text-xs">{formatCurrency(sale.total - (sale.remise || 0))}</TableCell>
                        <TableCell className="text-right px-6 font-black text-xs text-green-600">{formatCurrency(sale.avance || 0)}</TableCell>
                        <TableCell className="text-right px-6 font-black text-xs text-destructive">{formatCurrency(sale.reste || 0)}</TableCell>
                        <TableCell className="text-right px-6">
                          <Button onClick={() => handleOpenPayment(sale)} className="h-9 px-4 font-black text-[10px] uppercase rounded-xl bg-primary shadow-lg"><HandCoins className="mr-2 h-4 w-4" />Régler</Button>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={6} className="text-center py-20 text-[10px] font-black uppercase opacity-20">Tout est à jour !</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-primary text-white"><DialogTitle className="text-xl font-black uppercase flex items-center gap-3"><HandCoins className="h-6 w-6" />Encaisser Versement</DialogTitle><p className="text-xs font-bold opacity-60 mt-1 uppercase">Facture {selectedSale?.invoiceId}</p></DialogHeader>
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Client :</span><span className="text-slate-900">{selectedSale?.clientName}</span></div>
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Reste :</span><span className="text-destructive font-black">{formatCurrency(selectedSale?.reste || 0)}</span></div>
              </div>
              <div className="space-y-3"><Label className="text-[10px] font-black uppercase text-primary ml-1">Montant Encaissé (DH)</Label><Input type="number" className="h-16 text-3xl font-black text-center rounded-2xl bg-slate-50 border-2 border-primary/10" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} autoFocus /></div>
            </div>
            <DialogFooter className="p-8 pt-0 flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" className="w-full h-14 font-black uppercase" onClick={() => setSelectedSale(null)}>Annuler</Button>
              <Button className="w-full h-14 font-black uppercase shadow-xl" onClick={handleValidatePayment} disabled={isProcessing}>{isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : "VALIDER LE PAIEMENT"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
