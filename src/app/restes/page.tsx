"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, HandCoins, Loader2, Calendar, Lock, AlertTriangle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, addDoc, arrayUnion, runTransaction, limit, where, Timestamp } from "firebase/firestore";
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
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    const savedMode = localStorage.getItem('work_mode');
    
    setRole(savedRole);
    setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
    setIsReady(true);
  }, []);

  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${todayStr}` : todayStr;
  const sessionRef = useMemoFirebase(() => isReady ? doc(db, "cash_sessions", sessionDocId) : null, [db, sessionDocId, isReady]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);
  const isTodayClosed = !sessionLoading && sessionData?.status === "CLOSED";
  const isReadOnly = isTodayClosed && !isAdminOrPrepa;

  const allSalesQuery = useMemoFirebase(() => {
    const startOfYear = new Date(2026, 0, 1);
    return query(
      collection(db, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(startOfYear)),
      orderBy("createdAt", "desc"),
      limit(5000)
    );
  }, [db]);
  const { data: sales, isLoading: loading } = useCollection(allSalesQuery);

  const filteredSales = useMemo(() => {
    if (!sales || !isReady) return [];
    
    return sales
      .filter((sale: any) => {
        const matchesMode = isPrepaMode ? sale.isDraft === true : (sale.isDraft !== true);
        if (!matchesMode) return false;

        const hasReste = roundAmount(sale.reste || 0) > 0;
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
    if (isTodayClosed && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Caisse Clôturée", description: "L'enregistrement est verrouillé sur une session fermée." });
      return;
    }
    setSelectedSale(sale);
    setPaymentAmount(formatCurrency(sale.reste || 0));
  };

  const handleValidatePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSale || !paymentAmount) return;

    const amount = parseAmount(paymentAmount);
    if (amount <= 0) return;

    if (isReadOnly) {
      toast({ variant: "destructive", title: "Action Interdite", description: "La caisse est clôturée." });
      return;
    }

    setIsProcessing(true);
    const currentUserName = user?.displayName || "Inconnu";

    try {
      await runTransaction(db, async (transaction) => {
        // Sécurité : Vérification de la clôture
        if (sessionRef && !isAdminOrPrepa) {
          const sSnap = await transaction.get(sessionRef);
          if (sSnap.exists() && sSnap.data().status === "CLOSED") {
            throw new Error("SESSION_CLOSED");
          }
        }

        const saleRef = doc(db, "sales", selectedSale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Vente introuvable.");

        const currentData = saleSnap.data();
        const totalNet = roundAmount((currentData.total || 0) - (currentData.remise || 0));
        const currentAvance = roundAmount(currentData.avance || 0);
        
        const newAvance = roundAmount(currentAvance + amount);
        const newReste = roundAmount(Math.max(0, totalNet - newAvance));
        const isFullyPaid = newReste <= 0;
        
        let finalInvoiceId = currentData.invoiceId || "---";

        if (isFullyPaid && finalInvoiceId.startsWith("RC-")) {
          finalInvoiceId = finalInvoiceId.replace("RC-", "FC-");
        }

        // Mise à jour de la vente
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

        // Création de la transaction de caisse
        const transRef = doc(collection(db, "transactions"));
        transaction.set(transRef, {
          type: "VENTE",
          label: `VENTE ${finalInvoiceId}`,
          clientName: currentData.clientName || "---",
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

      toast({ variant: "success", title: "Paiement validé", description: "Le montant a été ajouté à la caisse." });
      setSelectedSale(null);
    } catch (err: any) {
      console.error("Erreur paiement:", err);
      if (err.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Caisse Fermée", description: "La session a été clôturée entre temps." });
      } else {
        toast({ variant: "destructive", title: "Erreur Technique", description: "Impossible de valider le règlement." });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-10 pb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter">Restes à Régler {isPrepaMode ? "(Brouillon)" : ""}</h1>
            <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">Suivi rigoureux des créances clients depuis le 01/01/2026.</p>
          </div>
        </div>

        <Card className="shadow-xl shadow-slate-200/50 border-none overflow-hidden rounded-[60px] bg-white">
          <CardHeader className="p-10 border-b bg-slate-50/50">
            <div className="relative max-w-md">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D4AF37]" />
              <input 
                placeholder="Chercher client, document..." 
                className="w-full pl-14 h-12 text-sm font-bold rounded-2xl border-none shadow-inner bg-white focus:ring-2 focus:ring-[#D4AF37]/20 outline-none" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Date & Client</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Document</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Total Net</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Versé</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Reste</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                  ) : filteredSales.length > 0 ? (
                    filteredSales.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-slate-50 transition-all group">
                        <TableCell className="px-10 py-6">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2 text-[9px] font-black text-[#D4AF37] uppercase mb-1.5 tracking-widest">
                              <Calendar className="h-3 w-3" />
                              {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd-MM-yyyy", { locale: fr }) : "---"}
                            </div>
                            <span className="font-black text-sm text-[#0D1B2A] uppercase leading-tight">{sale.clientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-10 py-6 whitespace-nowrap"><span className="text-[11px] font-black text-[#0D1B2A] tabular-nums tracking-tight">{sale.invoiceId}</span></TableCell>
                        <TableCell className="text-right px-10 py-6 whitespace-nowrap"><span className="font-black text-sm tabular-nums text-[#0D1B2A]">{formatCurrency((sale.total || 0) - (sale.remise || 0))}</span></TableCell>
                        <TableCell className="text-right px-10 py-6 whitespace-nowrap"><span className="font-black text-sm tabular-nums text-green-600">{formatCurrency(sale.avance || 0)}</span></TableCell>
                        <TableCell className="text-right px-10 py-6 whitespace-nowrap"><span className="font-black text-sm tabular-nums text-red-600">{formatCurrency(sale.reste || 0)}</span></TableCell>
                        <TableCell className="text-right px-10 py-6">
                          <Button 
                            onClick={() => handleOpenPayment(sale)} 
                            size="sm" 
                            disabled={isReadOnly}
                            className={cn(
                              "h-10 px-6 font-black text-[10px] uppercase rounded-full shadow-lg transition-all",
                              isReadOnly ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white"
                            )}
                          >
                            <HandCoins className="mr-2 h-4 w-4" />Régler
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="text-center py-24 text-[10px] font-black uppercase opacity-20 tracking-widest">Aucun reste à régler depuis le 01/01/2026.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[60px] p-0 overflow-hidden border-none shadow-2xl" onKeyDown={(e) => e.key === 'Enter' && handleValidatePayment(e)}>
            <form onSubmit={handleValidatePayment}>
              <DialogHeader className={cn("p-10 text-white", isReadOnly ? "bg-red-600" : "bg-[#0D1B2A]")}>
                <DialogTitle className="text-2xl font-black uppercase flex items-center justify-center gap-4 tracking-tighter">
                  {isReadOnly ? <XCircle className="h-8 w-8" /> : <HandCoins className="h-8 w-8 text-[#D4AF37]" />}
                  {isReadOnly ? "Action Interdite" : "Encaisser Vente"}
                </DialogTitle>
                <p className="text-[10px] font-black opacity-60 mt-3 uppercase tracking-[0.3em] text-center">
                  {isReadOnly ? "Session de caisse clôturée" : `Document ${selectedSale?.invoiceId}`}
                </p>
              </DialogHeader>

              {isTodayClosed && (
                <div className={cn("p-6 border-b flex items-center gap-4", isAdminOrPrepa ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-700")}>
                  {isAdminOrPrepa ? <AlertTriangle className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    {isAdminOrPrepa ? "Mode Correction : Modification autorisée sur caisse close." : "Attention : La caisse est clôturée. Enregistrement bloqué."}
                  </p>
                </div>
              )}

              <div className={cn("p-10 space-y-8 transition-all", isReadOnly && "grayscale brightness-95 opacity-80 pointer-events-none")}>
                <div className="bg-slate-50 p-8 rounded-[32px] space-y-4 shadow-inner">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest"><span>Client :</span><span className="text-[#0D1B2A] font-black uppercase text-xs">{selectedSale?.clientName}</span></div>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest whitespace-nowrap"><span>Reste à verser :</span><span className="text-red-600 font-black text-lg tabular-nums">{formatCurrency(selectedSale?.reste || 0)}</span></div>
                </div>
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase text-[#0D1B2A] ml-4 tracking-[0.3em]">Montant Encaissé (DH)</Label>
                  <input 
                    type="text" 
                    className={cn("w-full h-20 text-4xl font-black text-center rounded-[32px] bg-slate-50 border-2 border-[#0D1B2A]/5 outline-none focus:border-[#D4AF37]/30 tabular-nums transition-all", isReadOnly && "cursor-not-allowed")} 
                    value={paymentAmount} 
                    placeholder="0,00"
                    onChange={(e) => !isReadOnly && setPaymentAmount(e.target.value)} 
                    onBlur={() => !isReadOnly && paymentAmount && setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))}
                    autoFocus 
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              <DialogFooter className="p-10 pt-0 flex flex-col sm:flex-row gap-4">
                <Button variant="ghost" className="w-full h-14 font-black uppercase text-[10px] rounded-full tracking-widest hover:bg-slate-100" type="button" onClick={() => setSelectedSale(null)}>Annuler</Button>
                {!isReadOnly && (
                  <Button type="submit" className="w-full h-14 font-black uppercase shadow-2xl text-[10px] tracking-widest rounded-full bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all" disabled={isProcessing || sessionLoading}>
                    {isProcessing ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "VALIDER LE PAIEMENT"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}