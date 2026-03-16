
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, HandCoins, Loader2, Calendar, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, addDoc, arrayUnion, runTransaction, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";
import { fr } from "date-fns/locale";

export default function UnpaidSalesPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [role, setRole] = useState<string>("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role') || "OPTICIENNE";
    setRole(savedRole.toUpperCase());
    setIsReady(true);
  }, []);

  const isPrepaMode = role === "PREPA";

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${todayStr}` : todayStr;
  const sessionRef = useMemoFirebase(() => isReady ? doc(db, "cash_sessions", sessionDocId) : null, [db, sessionDocId, isReady]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);
  const isTodayClosed = !sessionLoading && sessionData?.status === "CLOSED";

  // OPTIMISATION QUOTA : Limite aux 100 dernières ventes avec reste
  const allSalesQuery = useMemoFirebase(() => query(
    collection(db, "sales"), 
    orderBy("createdAt", "desc"),
    limit(100)
  ), [db]);
  const { data: sales, isLoading: loading } = useCollection(allSalesQuery);

  const filteredSales = useMemo(() => {
    if (!sales || !isReady) return [];
    
    return sales
      .filter((sale: any) => {
        const matchesMode = isPrepaMode ? sale.isDraft === true : (sale.isDraft !== true);
        if (!matchesMode) return false;

        const hasReste = (sale.reste || 0) > 0;
        if (!hasReste) return false;

        const search = searchTerm.toLowerCase().trim();
        const matchesSearch = !search || 
          (sale.clientName || "").toLowerCase().includes(search) || 
          (sale.invoiceId || "").toLowerCase().includes(search) ||
          (sale.clientPhone || "").includes(search.replace(/\s/g, ''));
        
        return matchesSearch;
      });
  }, [sales, searchTerm, isPrepaMode, isReady]);

  const handleOpenPayment = (sale: any) => {
    setSelectedSale(sale);
    setPaymentAmount(formatCurrency(sale.reste));
  };

  const handleValidatePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSale || !paymentAmount) return;

    if (sessionLoading) return;
    if (isTodayClosed) {
      toast({ variant: "destructive", title: "Caisse Fermée", description: "Impossible d'encaisser sur une journée clôturée." });
      return;
    }

    const amount = parseAmount(paymentAmount);
    if (amount <= 0) return;

    setIsProcessing(true);
    const currentUserName = user?.displayName || "Inconnu";

    try {
      await runTransaction(db, async (transaction) => {
        if (sessionRef) {
          const sSnap = await transaction.get(sessionRef);
          if (sSnap.exists() && sSnap.data().status === "CLOSED") {
            throw new Error("SESSION_CLOSED");
          }
        }

        const saleRef = doc(db, "sales", selectedSale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Vente inexistante.");

        const currentData = saleSnap.data();
        const totalNet = currentData.total - (currentData.remise || 0);
        const newAvance = (currentData.avance || 0) + amount;
        const newReste = Math.max(0, totalNet - newAvance);
        const isFullyPaid = newReste <= 0;
        
        let finalInvoiceId = currentData.invoiceId;

        if (isFullyPaid && finalInvoiceId.startsWith("RC-")) {
          finalInvoiceId = finalInvoiceId.replace("RC-", "FC-");
        }

        transaction.update(saleRef, { 
          invoiceId: finalInvoiceId,
          avance: newAvance, 
          reste: newReste, 
          statut: isFullyPaid ? "Payé" : "Partiel", 
          payments: arrayUnion({ 
            amount, 
            date: new Date().toISOString(), 
            userName: currentUserName,
            note: "Règlement"
          }),
          updatedAt: serverTimestamp() 
        });

        const transRef = doc(collection(db, "transactions"));
        transaction.set(transRef, {
          type: "VENTE",
          label: `VENTE ${finalInvoiceId}`,
          clientName: currentData.clientName,
          category: "Optique", 
          montant: amount, 
          relatedId: finalInvoiceId,
          saleId: selectedSale.id, 
          userName: currentUserName, 
          isDraft: isPrepaMode, 
          isBalancePayment: true,
          createdAt: serverTimestamp()
        });
      });

      toast({ variant: "success", title: "Paiement validé" });
      setSelectedSale(null);
    } catch (err: any) {
      if (err.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Caisse Fermée", description: "La caisse a été clôturée entre temps." });
      } else {
        toast({ variant: "destructive", title: "Erreur lors du paiement" });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-primary uppercase tracking-tighter">Restes à Régler {isPrepaMode ? "(Brouillon)" : ""}</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em] opacity-60">Suivi des 100 dernières créances.</p>
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
              <Table className="min-w-[900px]">
                <TableHeader className="bg-[#052e16]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-3 md:px-6 py-5 text-white">Date & Client</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-3 md:px-6 py-5 text-white">Document</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-2 md:px-6 py-5 text-white">Total Net</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-2 md:px-6 py-5 text-green-400">Versé</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-2 md:px-6 py-5 text-red-400">Reste</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-3 md:px-6 py-5 text-white">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                  ) : filteredSales.length > 0 ? (
                    filteredSales.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                        <TableCell className="px-3 md:px-6 py-4 md:py-5">
                          <div className="flex flex-col min-w-[140px]">
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase mb-1">
                              <Calendar className="h-2.5 w-2.5" />
                              {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd-MM-yyyy", { locale: fr }) : "---"}
                            </div>
                            <span className="font-black text-[11px] md:text-sm text-slate-800 uppercase leading-tight truncate">{sale.clientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-3 md:px-6 py-4 md:py-5 whitespace-nowrap"><span className="text-[10px] font-black text-primary tabular-nums tracking-tighter">{sale.invoiceId}</span></TableCell>
                        <TableCell className="text-right px-2 md:px-6 py-4 md:py-5 whitespace-nowrap"><span className="font-black text-[11px] md:text-sm tabular-nums text-slate-900">{formatCurrency(sale.total - (sale.remise || 0))}</span></TableCell>
                        <TableCell className="text-right px-2 md:px-6 py-4 md:py-5 whitespace-nowrap"><span className="font-black text-[11px] md:text-sm tabular-nums text-green-600">{formatCurrency(sale.avance || 0)}</span></TableCell>
                        <TableCell className="text-right px-2 md:px-6 py-4 md:py-5 whitespace-nowrap"><span className="font-black text-[11px] md:text-sm tabular-nums text-destructive">{formatCurrency(sale.reste || 0)}</span></TableCell>
                        <TableCell className="text-right px-3 md:px-6 py-4 md:py-5">
                          <Button 
                            onClick={() => handleOpenPayment(sale)} 
                            size="sm" 
                            disabled={sessionLoading || isTodayClosed}
                            className="h-8 md:h-10 px-3 md:px-5 font-black text-[9px] md:text-xs uppercase rounded-xl bg-primary shadow-lg"
                          >
                            <HandCoins className="mr-1.5 h-3 w-3 md:h-4 md:w-4" />Régler
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="text-center py-24 text-xs font-black uppercase opacity-20 tracking-widest">Aucun reste à régler.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl" onKeyDown={(e) => e.key === 'Enter' && handleValidatePayment(e)}>
            <form onSubmit={handleValidatePayment}>
              <DialogHeader className="p-6 md:p-8 bg-primary text-white">
                <DialogTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3"><HandCoins className="h-6 w-6 md:h-7 md:w-7" />Encaisser Vente</DialogTitle>
                <p className="text-[10px] md:text-sm font-bold opacity-60 mt-1 uppercase tracking-widest">Document {selectedSale?.invoiceId}</p>
              </DialogHeader>

              {isTodayClosed && (
                <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
                  <Lock className="h-5 w-5 text-red-600" />
                  <p className="text-[10px] font-black text-red-700 uppercase">Attention : La caisse d'aujourd'hui est clôturée.</p>
                </div>
              )}

              <div className="p-6 md:p-8 space-y-6">
                <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border space-y-3">
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Client :</span><span className="text-slate-900 font-bold uppercase">{selectedSale?.clientName}</span></div>
                  <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 whitespace-nowrap"><span>Reste à verser :</span><span className="text-destructive font-black text-sm tabular-nums">{formatCurrency(selectedSale?.reste || 0)}</span></div>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest">Montant Encaissé (DH)</Label>
                  <input 
                    type="text" 
                    className={cn("w-full h-16 md:h-20 text-3xl md:text-4xl font-black text-center rounded-2xl bg-slate-50 border-2 border-primary/10 outline-none focus:border-primary/30 tabular-nums", (isTodayClosed || sessionLoading) && "opacity-50 cursor-not-allowed")} 
                    value={paymentAmount} 
                    placeholder="0,00"
                    onChange={(e) => !isTodayClosed && !sessionLoading && setPaymentAmount(e.target.value)} 
                    onBlur={() => !isTodayClosed && !sessionLoading && paymentAmount && setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))}
                    autoFocus 
                    readOnly={isTodayClosed || sessionLoading}
                  />
                </div>
              </div>
              <DialogFooter className="p-6 md:p-8 pt-0 flex flex-col sm:flex-row gap-3">
                <Button variant="ghost" className="w-full h-12 md:h-14 font-black uppercase text-[10px]" onClick={() => setSelectedSale(null)}>Annuler</Button>
                <Button type="submit" className="w-full h-12 md:h-14 font-black uppercase shadow-xl text-[10px] text-white" disabled={isProcessing || isTodayClosed || sessionLoading}>{isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "VALIDER LE PAIEMENT"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
