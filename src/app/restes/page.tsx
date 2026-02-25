
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, HandCoins, Loader2, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, addDoc, arrayUnion } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function UnpaidSalesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  const allSalesQuery = useMemoFirebase(() => query(
    collection(db, "sales"), 
    orderBy("createdAt", "desc")
  ), [db]);
  
  const { data: sales, isLoading: loading } = useCollection(allSalesQuery);

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter((sale: any) => {
      const hasReste = (sale.reste || 0) > 0;
      if (!hasReste) return false;

      const matchesSearch = 
        sale.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        sale.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.clientPhone?.includes(searchTerm.replace(/\s/g, ''));
      
      return matchesSearch;
    });
  }, [sales, searchTerm]);

  const handleOpenPayment = (sale: any) => {
    setSelectedSale(sale);
    setPaymentAmount(sale.reste.toString());
  };

  const handleValidatePayment = async () => {
    if (!selectedSale || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    setIsProcessing(true);
    const totalNet = selectedSale.total - (selectedSale.remise || 0);
    const newAvance = (selectedSale.avance || 0) + amount;
    const newReste = Math.max(0, totalNet - newAvance);
    const isFullyPaid = newReste <= 0;
    
    let finalInvoiceId = selectedSale.invoiceId;
    if (isFullyPaid && selectedSale.invoiceId.startsWith("RC")) {
      finalInvoiceId = selectedSale.invoiceId.replace("RC", "FLV");
    }
    
    const newStatut = isFullyPaid ? "Payé" : "Partiel";

    const paymentEntry = {
      amount: amount,
      date: new Date().toISOString()
    };

    try {
      const saleRef = doc(db, "sales", selectedSale.id);
      await updateDoc(saleRef, { 
        invoiceId: finalInvoiceId,
        avance: newAvance, 
        reste: newReste, 
        statut: newStatut, 
        payments: arrayUnion(paymentEntry),
        updatedAt: serverTimestamp() 
      });
      
      await addDoc(collection(db, "transactions"), {
        type: "VENTE",
        label: `Vente ${finalInvoiceId}`,
        category: "Optique",
        montant: amount,
        relatedId: finalInvoiceId,
        createdAt: serverTimestamp()
      });

      toast({ variant: "success", title: "Paiement validé" });

      const page = isFullyPaid ? 'facture' : 'recu';
      const params = new URLSearchParams({ 
        client: selectedSale.clientName, 
        phone: selectedSale.clientPhone, 
        mutuelle: selectedSale.mutuelle, 
        total: selectedSale.total.toString(), 
        remise: (selectedSale.remise || 0).toString(), 
        remisePercent: selectedSale.remisePercent || "0", 
        avance: newAvance.toString(), 
        od_sph: selectedSale.prescription?.od?.sph || "", 
        od_cyl: selectedSale.prescription?.od?.cyl || "", 
        od_axe: selectedSale.prescription?.od?.axe || "", 
        og_sph: selectedSale.prescription?.og?.sph || "", 
        og_cyl: selectedSale.prescription?.og?.cyl || "", 
        og_axe: selectedSale.prescription?.og?.axe || "", 
        monture: selectedSale.monture || "", 
        verres: selectedSale.verres || "", 
        date: new Date().toLocaleDateString("fr-FR") 
      });
      router.push(`/ventes/${page}/${finalInvoiceId}?${params.toString()}`);
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
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-primary uppercase tracking-tighter">Restes à Régler</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-60">Suivi des créances par date décroissante.</p>
          </div>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[24px] md:rounded-[32px] bg-white">
          <CardHeader className="p-4 md:p-6 border-b bg-slate-50/50">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-3.5 md:top-4 h-5 w-5 text-primary/40" />
              <input 
                placeholder="Chercher client, document..." 
                className="w-full pl-12 h-12 md:h-14 text-sm md:text-base font-bold rounded-xl border-none shadow-inner bg-white focus:ring-2 focus:ring-primary/20 outline-none" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="py-24 text-center">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" />
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black px-3 md:px-6 py-5 whitespace-nowrap">Date & Client</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-2 md:px-6 py-5 whitespace-nowrap">Total Net</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-2 md:px-6 py-5 text-green-600 whitespace-nowrap">Payé</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-2 md:px-6 py-5 text-destructive whitespace-nowrap">Reste</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-3 md:px-6 py-5">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length > 0 ? filteredSales.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                        <TableCell className="px-3 md:px-6 py-4 md:py-5">
                          <div className="flex flex-col min-w-[140px]">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase mb-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd/MM/yyyy", { locale: fr }) : "---"}
                            </div>
                            <span className="font-black text-[11px] md:text-sm text-slate-800 uppercase leading-tight truncate">
                              {sale.clientName}
                            </span>
                            <span className="text-[9px] font-black text-primary/40 uppercase mt-0.5">{sale.invoiceId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-2 md:px-6 py-4 md:py-5 font-black text-[11px] md:text-sm whitespace-nowrap">
                          {formatCurrency(sale.total - (sale.remise || 0))}
                        </TableCell>
                        <TableCell className="text-right px-2 md:px-6 py-4 md:py-5 font-black text-[11px] md:text-sm text-green-600 whitespace-nowrap">
                          {formatCurrency(sale.avance || 0)}
                        </TableCell>
                        <TableCell className="text-right px-2 md:px-6 py-4 md:py-5 font-black text-[11px] md:text-sm text-destructive whitespace-nowrap">
                          {formatCurrency(sale.reste || 0)}
                        </TableCell>
                        <TableCell className="text-right px-3 md:px-6 py-4 md:py-5">
                          <Button 
                            onClick={() => handleOpenPayment(sale)} 
                            size="sm"
                            className="h-8 md:h-10 px-3 md:px-5 font-black text-[9px] md:text-xs uppercase rounded-xl bg-primary shadow-lg"
                          >
                            <HandCoins className="mr-1.5 h-3 w-3 md:h-4 md:w-4" />Régler
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-24 text-xs font-black uppercase opacity-20 tracking-widest">
                          Aucun reste à régler trouvé.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 md:p-8 bg-primary text-white">
              <DialogTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3">
                <HandCoins className="h-6 w-6 md:h-7 md:w-7" />Encaisser Vente
              </DialogTitle>
              <p className="text-[10px] md:text-sm font-bold opacity-60 mt-1 uppercase tracking-widest">Document {selectedSale?.invoiceId}</p>
            </DialogHeader>
            <div className="p-6 md:p-8 space-y-6">
              <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Client :</span><span className="text-slate-900 font-bold">{selectedSale?.clientName}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400">
                  <span>Reste à payer :</span><span className="text-destructive font-black text-sm">{formatCurrency(selectedSale?.reste || 0)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest">Montant Encaissé (DH)</Label>
                <input 
                  type="number" 
                  className="w-full h-16 md:h-20 text-3xl md:text-4xl font-black text-center rounded-2xl bg-slate-50 border-2 border-primary/10 outline-none focus:border-primary/30" 
                  value={paymentAmount} 
                  onChange={(e) => setPaymentAmount(e.target.value)} 
                  autoFocus 
                />
              </div>
            </div>
            <DialogFooter className="p-6 md:p-8 pt-0 flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" className="w-full h-12 md:h-14 font-black uppercase text-[10px]" onClick={() => setSelectedSale(null)}>Annuler</Button>
              <Button className="w-full h-12 md:h-14 font-black uppercase shadow-xl text-[10px] text-white" onClick={handleValidatePayment} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "VALIDER LE PAIEMENT"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
