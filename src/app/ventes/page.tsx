
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Search, 
  Printer, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Loader2, 
  Trash2, 
  Calendar as CalendarIcon, 
  FileText, 
  Tag, 
  Save, 
  History as HistoryIcon, 
  HandCoins, 
  Lock, 
  AlertTriangle, 
  XCircle, 
  History,
  TrendingUp,
  Wallet
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, Timestamp, where, runTransaction, arrayUnion, getDoc, limit, getDocs, writeBatch } from "firebase/firestore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format, isWithinInterval, startOfDay, endOfDay, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

function SalesHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("TOUS");
  const [role, setRole] = useState<string>("");
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const [costDialogSale, setCostDialogSale] = useState<any>(null);
  const [purchaseCosts, setPurchaseCosts] = useState({ frame: "", lenses: "", label: "" });
  const [isSavingCosts, setIsSavingCosts] = useState(false);

  const [paymentSale, setPaymentSale] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    const savedMode = localStorage.getItem('work_mode');

    setRole(savedRole);
    setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
    setIsReady(true);
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${todayStr}` : todayStr;
  const sessionRef = useMemoFirebase(() => isReady ? doc(db, "cash_sessions", sessionDocId) : null, [db, sessionDocId, isReady]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);
  const isTodayClosed = !sessionLoading && sessionData?.status === "CLOSED";
  const isReadOnly = isTodayClosed && !isAdminOrPrepa;

  const salesQuery = useMemoFirebase(() => {
    const startOfYear = new Date(2026, 0, 1);
    return query(
      collection(db, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(startOfYear)),
      orderBy("createdAt", "desc"),
      limit(5000)
    );
  }, [db]);
  const { data: rawSales, isLoading: loading } = useCollection(salesQuery);

  const filteredSales = useMemo(() => {
    if (!rawSales || !isReady) return [];

    return rawSales
      .filter((sale: any) => {
        const matchesMode = isPrepaMode ? sale.isDraft === true : (sale.isDraft !== true);
        if (!matchesMode) return false;

        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
        let matchesDate = true;
        if (dateFrom) {
          if (!saleDate) {
            matchesDate = false;
          } else {
            const start = startOfDay(dateFrom);
            const end = endOfDay(dateTo || dateFrom);
            matchesDate = isWithinInterval(saleDate, { start: start < end ? start : end, end: start < end ? end : start });
          }
        }

        const search = searchTerm.toLowerCase().trim();
        const matchesSearch = !search || (sale.clientName || "").toLowerCase().includes(search) || (sale.invoiceId || "").toLowerCase().includes(search);
        const matchesStatus = statusFilter === "TOUS" || sale.statut === statusFilter;
        return matchesDate && matchesSearch && matchesStatus;
      });
  }, [rawSales, searchTerm, statusFilter, dateFrom, dateTo, isPrepaMode, isReady]);

  const handleDelete = async (sale: any) => {
    if (!isAdminOrPrepa) return;
    if (!confirm("Êtes-vous sûr ? Cette action supprimera également le montant de la caisse.")) return;

    try {
      const transQuery = query(collection(db, "transactions"), where("saleId", "==", sale.id));
      const transSnap = await getDocs(transQuery);
      const batch = writeBatch(db);
      transSnap.docs.forEach(tDoc => batch.delete(tDoc.ref));
      batch.delete(doc(db, "sales", sale.id));
      await batch.commit();
      toast({ variant: "success", title: "Vente supprimée" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const handlePrint = (sale: any) => {
    const page = sale.reste <= 0 ? 'facture' : 'recu';
    let formattedDate = "---";
    try {
      const d = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
      if (d && isValid(d)) formattedDate = format(d, "dd-MM-yyyy");
    } catch (e) {}

    const params = new URLSearchParams({
      client: sale.clientName || "---", phone: sale.clientPhone || "", mutuelle: sale.mutuelle || "---",
      total: (sale.total || 0).toString(), remise: (sale.remise || 0).toString(),
      avance: (sale.avance || 0).toString(), od_sph: sale.prescription?.od?.sph || "---", od_cyl: sale.prescription?.od?.cyl || "---",
      od_axe: sale.prescription?.od?.axe || "---", od_add: sale.prescription?.od?.add || "---",
      og_sph: sale.prescription?.og?.sph || "---", og_cyl: sale.prescription?.og?.cyl || "---",
      og_axe: sale.prescription?.og?.axe || "---", og_add: sale.prescription?.og?.add || "---",
      monture: sale.monture || "---", verres: sale.verres || "---", date: formattedDate
    });
    router.push(`/ventes/${page}/${sale.invoiceId}?${params.toString()}`);
  };

  const handleUpdateCosts = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!costDialogSale) return;
    setIsSavingCosts(true);
    const frameCost = parseAmount(purchaseCosts.frame);
    const lensesCost = parseAmount(purchaseCosts.lenses);
    const labelSuffix = purchaseCosts.label || costDialogSale.invoiceId;
    try {
      await updateDoc(doc(db, "sales", costDialogSale.id), { purchasePriceFrame: frameCost, purchasePriceLenses: lensesCost, updatedAt: serverTimestamp() });
      if (frameCost > 0) await addDoc(collection(db, "transactions"), { type: "DEPENSE", label: `ACHAT MONTURE - ${labelSuffix}`, clientName: costDialogSale.clientName || "---", category: "Achats", montant: -Math.abs(frameCost), relatedId: costDialogSale.invoiceId, userName: user?.displayName || "---", isDraft: isPrepaMode, createdAt: serverTimestamp() });
      if (lensesCost > 0) await addDoc(collection(db, "transactions"), { type: "DEPENSE", label: `ACHAT VERRES - ${labelSuffix}`, clientName: costDialogSale.clientName || "---", category: "Achats", montant: -Math.abs(lensesCost), relatedId: costDialogSale.invoiceId, userName: user?.displayName || "---", isDraft: isPrepaMode, createdAt: serverTimestamp() });
      toast({ variant: "success", title: "Coûts enregistrés" });
      setCostDialogSale(null);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsSavingCosts(false); }
  };

  const handleOpenPayment = (sale: any) => {
    if (isTodayClosed && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Caisse Clôturée", description: "L'enregistrement est verrouillé." });
      return;
    }
    setPaymentSale(sale);
    setPaymentAmount(formatCurrency(sale.reste || 0));
  };

  const handleValidatePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!paymentSale || !paymentAmount) return;
    const amount = parseAmount(paymentAmount);
    if (amount <= 0 || isReadOnly) return;

    setIsProcessingPayment(true);
    const currentUserName = user?.displayName || "Inconnu";

    try {
      await runTransaction(db, async (transaction) => {
        if (sessionRef && !isAdminOrPrepa) {
          const sSnap = await transaction.get(sessionRef);
          if (sSnap.exists() && sSnap.data().status === "CLOSED") throw new Error("SESSION_CLOSED");
        }

        const saleRef = doc(db, "sales", paymentSale.id);
        const saleSnap = await transaction.get(saleRef);
        const currentData = saleSnap.data();
        const totalNet = roundAmount((currentData.total || 0) - (currentData.remise || 0));
        const newAvance = roundAmount((currentData.avance || 0) + amount);
        const newReste = roundAmount(Math.max(0, totalNet - newAvance));
        const isFullyPaid = newReste <= 0;

        let finalInvoiceId = currentData.invoiceId || "---";
        if (isFullyPaid && finalInvoiceId.startsWith("RC-")) finalInvoiceId = finalInvoiceId.replace("RC-", "FC-");

        transaction.update(saleRef, {
          invoiceId: finalInvoiceId, avance: newAvance, reste: newReste, statut: isFullyPaid ? "Payé" : "Partiel",
          payments: arrayUnion({ amount, date: new Date().toISOString(), userName: currentUserName, note: "Règlement" }),
          updatedAt: serverTimestamp()
        });

        transaction.set(doc(collection(db, "transactions")), {
          type: "VENTE", label: `VENTE ${finalInvoiceId}`, clientName: currentData.clientName || "---",
          montant: amount, relatedId: finalInvoiceId, saleId: paymentSale.id, userName: currentUserName,
          isDraft: isPrepaMode, isBalancePayment: true, createdAt: serverTimestamp()
        });
      });
      toast({ variant: "success", title: "Paiement validé" });
      setPaymentSale(null);
    } catch (err: any) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsProcessingPayment(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter flex items-center gap-4">
            <HistoryIcon className="h-8 w-8 text-[#D4AF37]/40" />
            Historique Ventes
          </h1>
          <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">Registre de prestige.</p>
        </div>
        <Button asChild className="h-12 font-black rounded-full px-10 shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all uppercase tracking-widest text-xs">
          <Link href="/ventes/nouvelle"><Plus className="mr-2 h-5 w-5" />NOUVELLE VENTE</Link>
        </Button>
      </div>

      <Card className="shadow-xl shadow-slate-200/50 rounded-[60px] bg-white border-none overflow-hidden">
        <CardHeader className="p-10 border-b bg-slate-50">
          <div className="flex flex-col lg:flex-row items-end gap-6">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Recherche</Label>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D4AF37]" />
                <input 
                  placeholder="Client ou Document..." 
                  className="w-full pl-14 h-12 text-sm font-bold rounded-2xl border-none shadow-inner outline-none bg-white" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            <div className="w-full lg:w-64 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-12 rounded-2xl font-black border-none shadow-inner bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-[32px]">
                  {["TOUS", "Payé", "Partiel", "En attente"].map(s => (
                    <SelectItem key={s} value={s} className="font-black text-[10px] uppercase">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#0D1B2A]">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Date</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Document</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Client</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Total Net</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Avance</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Reste</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Statut</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-24 text-center">
                      <Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" />
                    </TableCell>
                  </TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-24 text-center text-[10px] font-black uppercase text-slate-300 tracking-[0.5em]">
                      Aucun résultat trouvé.
                    </TableCell>
                  </TableRow>
                ) : filteredSales.map((sale: any) => (
                  <TableRow key={sale.id} className="hover:bg-slate-50 transition-all group border-b last:border-0">
                    <TableCell className="px-10 py-6 text-[11px] font-bold text-slate-500 tabular-nums">
                      {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd/MM/yyyy") : "---"}
                    </TableCell>
                    <TableCell className="px-10 py-6 text-[11px] font-black text-[#0D1B2A] whitespace-nowrap tracking-tight">
                      {sale.invoiceId}
                    </TableCell>
                    <TableCell className="px-10 py-6 text-[11px] font-black uppercase text-[#0D1B2A]">
                      {sale.clientName}
                    </TableCell>
                    <TableCell className="text-right px-10 py-6 text-sm font-black text-[#0D1B2A] tabular-nums">
                      {formatCurrency((sale.total || 0) - (sale.remise || 0))}
                    </TableCell>
                    <TableCell className="text-right px-10 py-6 text-sm font-black text-emerald-600 tabular-nums">
                      {formatCurrency(sale.avance || 0)}
                    </TableCell>
                    <TableCell className="text-center px-10 py-6">
                      <div className="flex items-center justify-center gap-3">
                        <span className={cn("text-sm font-black tabular-nums", (sale.reste || 0) > 0 ? "text-red-500" : "text-slate-300")}>
                          {formatCurrency(sale.reste || 0)}
                        </span>
                        {(sale.reste || 0) > 0 && (
                          <button 
                            disabled={isReadOnly} 
                            className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center transition-all shadow-sm",
                              isReadOnly ? "bg-slate-100 text-slate-300" : "bg-red-50 text-red-500 hover:bg-red-500 hover:text-white"
                            )} 
                            onClick={() => handleOpenPayment(sale)}
                            title="Régler le reste"
                          >
                            <HandCoins className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center px-10 py-6">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase py-1 px-3 rounded-full border-none", 
                        (sale.statut === "Payé" || sale.statut === "Payer") ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      )} variant="outline">
                        {sale.statut}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-10 py-6">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100">
                            <MoreVertical className="h-5 w-5 text-slate-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-[24px] p-2 min-w-[180px] shadow-2xl">
                          <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                            <FileText className="mr-3 h-4 w-4 text-[#D4AF37]" /> Imprimer
                          </DropdownMenuItem>
                          {isAdminOrPrepa && (
                            <DropdownMenuItem onClick={() => router.push(`/ventes/nouvelle?editId=${sale.id}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                              <Edit2 className="mr-3 h-4 w-4 text-blue-600" /> Modifier
                            </DropdownMenuItem>
                          )}
                          {isAdminOrPrepa && (
                            <DropdownMenuItem onClick={() => { 
                              setCostDialogSale(sale); 
                              setPurchaseCosts({ 
                                frame: formatCurrency(sale.purchasePriceFrame || 0), 
                                lenses: formatCurrency(sale.purchasePriceLenses || 0), 
                                label: "" 
                              }); 
                            }} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                              <Tag className="mr-3 h-4 w-4 text-orange-500" /> Coûts d'Achat
                            </DropdownMenuItem>
                          )}
                          {isAdminOrPrepa && (
                            <DropdownMenuItem onClick={() => handleDelete(sale)} className="text-destructive py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                              <Trash2 className="mr-3 h-4 w-4" /> Supprimer
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogue Règlement */}
      <Dialog open={!!paymentSale} onOpenChange={setPaymentSale}>
        <DialogContent className="max-w-md rounded-[60px] p-0 overflow-hidden shadow-2xl border-none">
          <form onSubmit={handleValidatePayment}>
            <div className="bg-[#0D1B2A] p-10 text-center">
              <div className="h-16 w-16 bg-[#D4AF37]/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <HandCoins className="h-8 w-8 text-[#D4AF37]" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase text-[#D4AF37] tracking-tighter">Encaisser Reste</DialogTitle>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mt-2">Document : {paymentSale?.invoiceId}</p>
            </div>
            <div className="p-10 space-y-6">
              <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center mb-1">Reste dû par le client</p>
                <p className="text-3xl font-black text-red-600 text-center tabular-nums">{formatCurrency(paymentSale?.reste || 0)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest">Montant Versé (DH)</Label>
                <Input 
                  className="h-16 rounded-full text-center text-2xl font-black border-2 border-slate-100 bg-slate-50 focus:border-[#D4AF37] transition-all tabular-nums" 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  onBlur={() => setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))} 
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="p-10 pt-0">
              <Button type="submit" disabled={isProcessingPayment} className="w-full h-16 rounded-full font-black text-base uppercase shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-[#D4AF37] transition-all">
                {isProcessingPayment ? <Loader2 className="animate-spin h-6 w-6" /> : "VALIDER LE PAIEMENT"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialogue Coûts d'Achat */}
      <Dialog open={!!costDialogSale} onOpenChange={setCostDialogSale}>
        <DialogContent className="max-w-md rounded-[60px] p-0 overflow-hidden shadow-2xl border-none">
          <form onSubmit={handleUpdateCosts}>
            <div className="bg-[#0D1B2A] p-10 text-center">
              <div className="h-16 w-16 bg-[#D4AF37]/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Tag className="h-8 w-8 text-[#D4AF37]" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase text-[#D4AF37] tracking-tighter">Coûts d'Achat</DialogTitle>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mt-2">Calcul de Marge Brute</p>
            </div>
            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">Monture (DH)</Label>
                  <Input 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-black text-lg text-center tabular-nums" 
                    value={purchaseCosts.frame} 
                    onChange={e => setPurchaseCosts(prev => ({ ...prev, frame: e.target.value }))} 
                    onBlur={() => purchaseCosts.frame && setPurchaseCosts(prev => ({ ...prev, frame: formatCurrency(parseAmount(purchaseCosts.frame)) }))} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">Verres (DH)</Label>
                  <Input 
                    className="h-12 rounded-2xl bg-slate-50 border-none font-black text-lg text-center tabular-nums" 
                    value={purchaseCosts.lenses} 
                    onChange={e => setPurchaseCosts(prev => ({ ...prev, lenses: e.target.value }))} 
                    onBlur={() => purchaseCosts.lenses && setPurchaseCosts(prev => ({ ...prev, lenses: formatCurrency(parseAmount(purchaseCosts.lenses)) }))} 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">Libellé Transaction (Ex: Nom Fournisseur)</Label>
                <Input 
                  className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-sm px-4" 
                  placeholder="Optionnel..." 
                  value={purchaseCosts.label} 
                  onChange={e => setPurchaseCosts(prev => ({ ...prev, label: e.target.value }))} 
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" />
                <p className="text-[9px] font-bold text-blue-700 leading-tight">
                  La saisie de ces coûts générera automatiquement deux transactions de sortie en caisse pour le suivi financier.
                </p>
              </div>
            </div>
            <DialogFooter className="p-10 pt-0">
              <Button type="submit" disabled={isSavingCosts} className="w-full h-16 rounded-full font-black text-base uppercase shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-[#D4AF37] transition-all">
                {isSavingCosts ? <Loader2 className="animate-spin h-6 w-6" /> : "ENREGISTRER LES COÛTS"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SalesHistoryPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}>
        <SalesHistoryContent />
      </Suspense>
    </AppShell>
  );
}
