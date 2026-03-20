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

  const allSalesQuery = useMemoFirebase(() => query(collection(db, "sales"), where("createdAt", ">=", Timestamp.fromDate(new Date(2026, 0, 1))), orderBy("createdAt", "desc"), limit(5000)), [db]);
  const { data: sales, isLoading: loading } = useCollection(allSalesQuery);

  const filteredSales = useMemo(() => {
    if (!sales || !isReady) return [];
    return sales.filter((sale: any) => {
      if ((isPrepaMode ? sale.isDraft !== true : sale.isDraft === true) || roundAmount(sale.reste || 0) <= 0) return false;
      const search = searchTerm.toLowerCase().trim();
      return !search || (sale.clientName || "").toLowerCase().includes(search) || (sale.invoiceId || "").toLowerCase().includes(search);
    });
  }, [sales, searchTerm, isPrepaMode, isReady]);

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
        const data = saleSnap.data();
        const totalNet = roundAmount((data.total || 0) - (data.remise || 0));
        const newAvance = roundAmount((data.avance || 0) + amount);
        const newReste = roundAmount(Math.max(0, totalNet - newAvance));
        let invId = data.invoiceId || "---";
        if (newReste <= 0 && invId.startsWith("RC-")) invId = invId.replace("RC-", "FC-");

        transaction.update(saleRef, { invoiceId: invId, avance: newAvance, reste: newReste, statut: newReste <= 0 ? "Payé" : "Partiel", payments: arrayUnion({ amount, date: new Date().toISOString(), userName, note: "Règlement" }), updatedAt: serverTimestamp() });
        transaction.set(doc(collection(db, "transactions")), { type: "VENTE", label: `VENTE ${invId}`, clientName: data.clientName || "---", montant: amount, relatedId: invId, saleId: selectedSale.id, userName, isDraft: isPrepaMode, isBalancePayment: true, createdAt: serverTimestamp() });
      });
      toast({ variant: "success", title: "Règlement validé" });
      setSelectedSale(null);
    } catch (err: any) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsProcessing(false); }
  };

  return (
    <AppShell>
      <div className="space-y-10 pb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div><h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter">Restes à Régler</h1><p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">Suivi Luxury des créances.</p></div>
        </div>

        <Card className="shadow-xl shadow-slate-200/50 border-none overflow-hidden rounded-[60px] bg-white">
          <CardHeader className="p-10 border-b bg-slate-50"><div className="relative max-w-md"><Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D4AF37]" /><input placeholder="Chercher client..." className="w-full pl-14 h-12 text-sm font-bold rounded-2xl border-none shadow-inner bg-white outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#0D1B2A]"><TableRow><TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Client</TableHead><TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Document</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Total Net</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Reste</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Action</TableHead></TableRow></TableHeader>
                <TableBody>{loading ? <TableRow><TableCell colSpan={5} className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow> : filteredSales.map(sale => (<TableRow key={sale.id} className="hover:bg-slate-50 transition-all border-b last:border-0"><TableCell className="px-10 py-6 font-black text-sm uppercase text-[#0D1B2A]">{sale.clientName}</TableCell><TableCell className="px-10 py-6 text-[11px] font-black">{sale.invoiceId}</TableCell><TableCell className="text-right px-10 py-6 font-black">{formatCurrency((sale.total || 0) - (sale.remise || 0))}</TableCell><TableCell className="text-right px-10 py-6 font-black text-red-500">{formatCurrency(sale.reste || 0)}</TableCell><TableCell className="text-right px-10 py-6"><Button onClick={() => setSelectedSale(sale)} disabled={isReadOnly} className="h-10 px-6 font-black text-[10px] uppercase rounded-full bg-[#D4AF37] text-[#0D1B2A]"><HandCoins className="mr-2 h-4 w-4" />Régler</Button></TableCell></TableRow>))}</TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!selectedSale} onOpenChange={setSelectedSale}><DialogContent className="max-w-md rounded-[60px] p-0 overflow-hidden shadow-2xl border-none"><form onSubmit={handleValidatePayment}><div className="bg-[#0D1B2A] p-10 text-center"><DialogTitle className="text-2xl font-black uppercase text-[#D4AF37] tracking-tighter">Encaisser Reste</DialogTitle></div><div className="p-10 space-y-6"><div className="bg-slate-50 p-6 rounded-[32px]"><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Reste à verser</p><p className="text-3xl font-black text-red-600 text-center tabular-nums">{formatCurrency(selectedSale?.reste || 0)}</p></div><Input className="h-16 rounded-full text-center text-2xl font-black" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} onBlur={() => setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))} /></div><DialogFooter className="p-10 pt-0"><Button type="submit" disabled={isProcessing} className="w-full h-14 rounded-full font-black bg-[#D4AF37] text-[#0D1B2A]">{isProcessing ? <Loader2 className="animate-spin" /> : "VALIDER LE PAIEMENT"}</Button></DialogFooter></form></DialogContent></Dialog>
      </div>
    </AppShell>
  );
}