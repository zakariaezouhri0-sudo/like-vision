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
import { collection, query, where, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
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

  const unpaidSalesQuery = useMemoFirebase(() => {
    return query(
      collection(db, "sales"), 
      where("reste", ">", 0),
      orderBy("reste", "desc")
    );
  }, [db]);

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
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Erreur", description: "Montant invalide." });
      return;
    }

    setIsProcessing(true);
    
    const newAvance = (selectedSale.avance || 0) + amount;
    const newReste = Math.max(0, selectedSale.total - (selectedSale.remise || 0) - newAvance);
    const newStatut = newReste <= 0 ? "Payé" : "Partiel";

    const updateData = {
      avance: newAvance,
      reste: newReste,
      statut: newStatut,
      updatedAt: serverTimestamp()
    };

    try {
      const saleRef = doc(db, "sales", selectedSale.id);
      await updateDoc(saleRef, updateData);
      
      toast({
        variant: "success",
        title: "Paiement validé",
        description: `Le solde de ${selectedSale.clientName} a été mis à jour.`
      });

      // Impression automatique
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
        date: new Date().toLocaleDateString("fr-FR"),
      });
      
      router.push(`/ventes/facture/${selectedSale.invoiceId}?${params.toString()}`);
      setSelectedSale(null);
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: `sales/${selectedSale.id}`, 
        operation: "update", 
        requestResourceData: updateData 
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter flex items-center gap-3">
              <HandCoins className="h-8 w-8" />
              Restes à Régler
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] opacity-60">Gestion des créances clients.</p>
          </div>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="p-4 md:p-6 border-b bg-slate-50/50">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-primary/40" />
              <input 
                placeholder="Chercher par nom, téléphone ou n°..." 
                className="w-full pl-12 h-12 text-sm font-bold rounded-xl border-none shadow-inner bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Analyse des comptes...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Facture</TableHead>
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Client</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Total Net</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap text-green-600">Déjà Payé</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap text-destructive">Reste</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length > 0 ? (
                      filteredSales.map((sale: any) => (
                        <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                          <TableCell className="font-black text-xs md:text-sm text-primary px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">{sale.invoiceId}</TableCell>
                          <TableCell className="px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-black text-xs md:text-sm text-slate-800 uppercase truncate">{sale.clientName}</span>
                              <span className="text-[10px] font-black text-slate-400">{formatPhoneNumber(sale.clientPhone)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="font-black text-xs md:text-sm text-slate-900">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(sale.total - (sale.remise || 0))}</span>
                              <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase">DH</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                            <div className="flex items-baseline justify-end gap-1">
                              <span className="font-black text-xs md:text-sm text-green-600">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(sale.avance || 0)}</span>
                              <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase">DH</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                            <div className="bg-destructive/10 px-3 py-2 rounded-xl inline-flex items-baseline justify-end gap-1">
                              <span className="font-black text-xs md:text-sm text-destructive">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(sale.reste || 0)}</span>
                              <span className="text-[8px] md:text-[10px] font-black text-destructive/60 uppercase">DH</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-5 md:py-6">
                            <Button 
                              onClick={() => handleOpenPayment(sale)}
                              className="h-10 px-6 font-black text-[10px] uppercase rounded-xl bg-primary shadow-lg hover:scale-105 transition-transform"
                            >
                              <HandCoins className="mr-2 h-4 w-4" />
                              Régler
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-32">
                          <div className="flex flex-col items-center gap-4 opacity-30">
                            <CheckCircle2 className="h-16 w-16 text-green-500" />
                            <span className="text-xs font-black uppercase tracking-[0.4em]">Tous les comptes sont à jour !</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Modal de Paiement */}
        <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-8 bg-primary text-white">
              <DialogTitle className="text-xl font-black uppercase tracking-tighter flex items-center gap-3">
                <HandCoins className="h-6 w-6" />
                Régler le Solde
              </DialogTitle>
              <p className="text-xs font-bold opacity-60 mt-1 uppercase tracking-widest">Facture {selectedSale?.invoiceId}</p>
            </DialogHeader>
            <div className="p-8 space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex justify-between text-xs font-black uppercase text-slate-400 tracking-widest">
                  <span>Client :</span>
                  <span className="text-slate-900">{selectedSale?.clientName}</span>
                </div>
                <div className="flex justify-between text-xs font-black uppercase text-slate-400 tracking-widest">
                  <span>Reste Actuel :</span>
                  <span className="text-destructive">{formatCurrency(selectedSale?.reste || 0)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-primary tracking-widest ml-1">Montant à encaisser (DH)</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    className="h-16 text-2xl font-black text-center rounded-2xl bg-slate-50 border-2 border-primary/10 focus:border-primary shadow-inner"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-2xl flex items-center gap-3 text-green-700">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-[10px] font-black uppercase leading-tight">La facture sera marquée comme "Payée" si le solde est nul.</p>
              </div>
            </div>
            <DialogFooter className="p-8 pt-0 flex flex-col sm:flex-row gap-3">
              <Button 
                variant="ghost" 
                className="w-full h-14 font-black uppercase text-xs rounded-2xl"
                onClick={() => setSelectedSale(null)}
              >
                Annuler
              </Button>
              <Button 
                className="w-full h-14 font-black uppercase text-xs rounded-2xl shadow-xl shadow-primary/20"
                onClick={handleValidatePayment}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : "VALIDER LE PAIEMENT"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
