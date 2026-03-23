"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, HandCoins, Loader2, MessageSquare, PackageCheck, CheckCircle2, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, parseAmount, sendWhatsApp } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, arrayUnion, runTransaction, limit, where, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const DELIVERY_STATUSES = [
  { value: "En préparation", label: "En préparation", icon: Clock, color: "text-orange-500 bg-orange-50" },
  { value: "Prête", label: "Prête", icon: PackageCheck, color: "text-emerald-600 bg-emerald-50" },
  { value: "Livrée", label: "Livrée", icon: CheckCircle2, color: "text-blue-600 bg-blue-50" },
];

export default function OrderTrackingPage() {
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

  const allSalesQuery = useMemoFirebase(() => query(
    collection(db, "sales"), 
    where("createdAt", ">=", Timestamp.fromDate(new Date(2026, 0, 1))), 
    orderBy("createdAt", "desc"), 
    limit(5000)
  ), [db]);
  const { data: sales, isLoading: loading } = useCollection(allSalesQuery);

  const filteredSales = useMemo(() => {
    if (!sales || !isReady) return [];
    return sales.filter((sale: any) => {
      // On filtre pour n'afficher que le mode actuel (Brouillon ou Réel)
      if (isPrepaMode ? sale.isDraft !== true : sale.isDraft === true) return false;
      
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || 
        (sale.clientName || "").toLowerCase().includes(search) || 
        (sale.invoiceId || "").toLowerCase().includes(search);
      
      // On affiche les commandes qui ont un reste OU qui ne sont pas encore livrées
      const hasReste = roundAmount(sale.reste || 0) > 0;
      const isNotDelivered = sale.deliveryStatus !== "Livrée";
      
      return matchesSearch && (hasReste || isNotDelivered);
    });
  }, [sales, searchTerm, isPrepaMode, isReady]);

  const handleUpdateDeliveryStatus = async (saleId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "sales", saleId), {
        deliveryStatus: newStatus,
        updatedAt: serverTimestamp()
      });
      toast({ variant: "success", title: "Statut mis à jour", description: `La commande est désormais : ${newStatus}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Erreur lors de la mise à jour" });
    }
  };

  const handleNotifyClient = (sale: any) => {
    if (!sale.clientPhone) {
      toast({ variant: "destructive", title: "Erreur", description: "Le client n'a pas de numéro de téléphone enregistré." });
      return;
    }
    
    // Message : 'Bonjour [Client], votre commande N°[No] chez Like Vision est prête ! Reste à payer: [Amount] DH. 🕶️'
    // 🕶️ Unicode: \uD83D\uDD76
    const message = `Bonjour ${sale.clientName}, votre commande N°${sale.invoiceId} chez Like Vision est prête ! Reste à payer: ${formatCurrency(sale.reste)} DH. \uD83D\uDD76`;
    sendWhatsApp(sale.clientPhone, message);
  };

  const handleValidatePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedSale || !paymentAmount || isReadOnly) return;
    const amount = parseAmount(paymentAmount);
    if (amount <= 0) return;
    setIsProcessing(true);
    const userName = user?.displayName || "Personnel";

    try {
      await runTransaction(db, async (transaction) => {
        if (sessionRef && !isAdminOrPrepa) {
          const sSnap = await transaction.get(sessionRef);
          if (sSnap.exists() && sSnap.data().status === "CLOSED") throw new Error("SESSION_CLOSED");
        }
        const saleRef = doc(db, "sales", selectedSale.id);
        const saleSnap = await transaction.get(saleRef);
        const data = saleSnap.data()!;
        const totalNet = roundAmount((data.total || 0) - (data.remise || 0));
        const newAvance = roundAmount((data.avance || 0) + amount);
        const newReste = roundAmount(Math.max(0, totalNet - newAvance));
        let invId = data.invoiceId || "---";
        if (newReste <= 0 && invId.startsWith("RC-")) invId = invId.replace("RC-", "FC-");

        transaction.update(saleRef, { 
          invoiceId: invId, 
          avance: newAvance, 
          reste: newReste, 
          statut: newReste <= 0 ? "Payé" : "Partiel", 
          payments: arrayUnion({ amount, date: new Date().toISOString(), userName, note: "Règlement" }), 
          updatedAt: serverTimestamp() 
        });
        
        transaction.set(doc(collection(db, "transactions")), { 
          type: "VENTE", 
          label: `VENTE ${invId}`, 
          clientName: data.clientName || "---", 
          montant: amount, 
          relatedId: invId, 
          saleId: selectedSale.id, 
          userName, 
          isDraft: isPrepaMode, 
          isBalancePayment: true, 
          createdAt: serverTimestamp() 
        });
      });
      toast({ variant: "success", title: "Règlement validé" });
      setSelectedSale(null);
    } catch (err: any) { 
      toast({ variant: "destructive", title: "Erreur", description: err.message === "SESSION_CLOSED" ? "La caisse est clôturée." : "Erreur technique." }); 
    } finally { 
      setIsProcessing(false); 
    }
  };

  return (
    <AppShell>
      <div className="space-y-10 pb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <PackageCheck className="h-8 w-8 text-[#D4AF37]/40 shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter leading-none">
                Order Tracking (Follow-up)
              </h1>
              <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">
                Suivi de l'état des commandes et notifications.
              </p>
            </div>
          </div>
        </div>

        <Card className="shadow-xl shadow-slate-200/50 border-none overflow-hidden rounded-[60px] bg-white">
          <CardHeader className="p-10 border-b bg-slate-50">
            <div className="relative max-w-md">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D4AF37]" />
              <input 
                placeholder="Chercher par client ou facture..." 
                className="w-full pl-14 h-12 text-sm font-bold rounded-2xl border-none shadow-inner bg-white outline-none" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Client</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Document</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest w-32">Reste</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest w-48">État Commande</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={5} className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                  ) : filteredSales.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-24 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">Aucune commande à suivre.</TableCell></TableRow>
                  ) : filteredSales.map(sale => (
                    <TableRow key={sale.id} className="hover:bg-slate-50 transition-all border-b last:border-0 group">
                      <TableCell className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-sm uppercase text-[#0D1B2A]">{sale.clientName}</span>
                          <span className="text-[10px] font-bold text-slate-400">{formatPhoneNumber(sale.clientPhone)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-10 py-6">
                        <span className="text-[11px] font-black uppercase tracking-tight">{sale.invoiceId}</span>
                      </TableCell>
                      <TableCell className="text-right px-10 py-6">
                        <span className={cn("text-sm font-black tabular-nums", (sale.reste || 0) > 0 ? "text-red-500" : "text-emerald-600")}>
                          {formatCurrency(sale.reste || 0)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center px-10 py-6">
                        <Select 
                          value={sale.deliveryStatus || "En préparation"} 
                          onValueChange={(val) => handleUpdateDeliveryStatus(sale.id, val)}
                        >
                          <SelectTrigger className="h-9 rounded-full border-none bg-slate-50 font-black text-[10px] uppercase shadow-inner px-4">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl">
                            {DELIVERY_STATUSES.map(status => (
                              <SelectItem key={status.value} value={status.value} className="font-black text-[10px] uppercase">
                                <div className="flex items-center gap-2">
                                  <status.icon className="h-3 w-3" />
                                  {status.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right px-10 py-6">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            onClick={() => handleNotifyClient(sale)}
                            variant="outline"
                            className="h-9 px-4 font-black text-[9px] uppercase rounded-full border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-sm"
                          >
                            <MessageSquare className="mr-2 h-3.5 w-3.5" /> NOTIFIER
                          </Button>
                          {(sale.reste || 0) > 0 && (
                            <Button 
                              onClick={() => setSelectedSale(sale)} 
                              disabled={isReadOnly} 
                              className="h-9 px-4 font-black text-[9px] uppercase rounded-full bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white shadow-md"
                            >
                              <HandCoins className="mr-2 h-3.5 w-3.5" /> RÉGLER
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedSale} onOpenChange={setSelectedSale}>
          <DialogContent className="max-w-md rounded-[60px] p-0 overflow-hidden shadow-2xl border-none">
            <form onSubmit={handleValidatePayment}>
              <div className="bg-[#0D1B2A] p-10 text-center">
                <div className="h-16 w-16 bg-[#D4AF37]/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <HandCoins className="h-8 w-8 text-[#D4AF37]" />
                </div>
                <DialogTitle className="text-2xl font-black uppercase text-[#D4AF37] tracking-tighter">Encaisser Reste</DialogTitle>
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mt-2">{selectedSale?.invoiceId}</p>
              </div>
              <div className="p-10 space-y-6">
                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center mb-1">Reste à verser</p>
                  <p className="text-3xl font-black text-red-600 text-center tabular-nums">{formatCurrency(selectedSale?.reste || 0)}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Montant du règlement</Label>
                  <Input 
                    className="h-16 rounded-full text-center text-2xl font-black border-2 border-slate-100 bg-slate-50 focus:border-[#D4AF37] outline-none" 
                    value={paymentAmount} 
                    onChange={e => setPaymentAmount(e.target.value)} 
                    onBlur={() => setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))} 
                    autoFocus
                  />
                </div>
              </div>
              <DialogFooter className="p-10 pt-0">
                <Button type="submit" disabled={isProcessing} className="w-full h-14 rounded-full font-black uppercase tracking-widest bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-[#D4AF37] transition-all">
                  {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : "VALIDER LE PAIEMENT"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
