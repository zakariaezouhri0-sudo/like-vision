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
  Tag, 
  History as HistoryIcon, 
  HandCoins, 
  TrendingUp,
  ChevronDown,
  Lock,
  AlertCircle
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, Timestamp, where, runTransaction, arrayUnion, limit, getDocs, writeBatch } from "firebase/firestore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format, isWithinInterval, startOfDay, endOfDay, isValid, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

  // Modification : Date de début fixée au 01/01/2026 par défaut
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date(2026, 0, 1));
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

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
    const startLimit = new Date(2026, 0, 1);
    return query(
      collection(db, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(startLimit)),
      orderBy("createdAt", "desc"),
      limit(2000)
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
        if (dateFrom && dateTo && saleDate) {
          const start = startOfDay(dateFrom);
          const end = endOfDay(dateTo);
          if (!isWithinInterval(saleDate, { start, end })) return false;
        }

        const search = searchTerm.toLowerCase().trim();
        const matchesSearch = !search || 
          (sale.clientName || "").toLowerCase().includes(search) || 
          (sale.invoiceId || "").toLowerCase().includes(search) ||
          (sale.bonNumber || "").toLowerCase().includes(search);

        const matchesStatus = statusFilter === "TOUS" || sale.statut === statusFilter;

        return matchesSearch && matchesStatus;
      });
  }, [rawSales, searchTerm, statusFilter, dateFrom, dateTo, isPrepaMode, isReady]);

  const handleDelete = async (sale: any) => {
    if (!isAdminOrPrepa) return;
    if (!confirm(`Supprimer la vente ${sale.invoiceId} ? Les transactions de caisse liées seront aussi supprimées.`)) return;

    try {
      const transQuery = query(collection(db, "transactions"), where("relatedId", "==", sale.invoiceId));
      const transSnap = await getDocs(transQuery);
      
      const batch = writeBatch(db);
      transSnap.docs.forEach(tDoc => batch.delete(tDoc.ref));
      batch.delete(doc(db, "sales", sale.id));
      
      await batch.commit();
      toast({ variant: "success", title: "Vente et transactions supprimées" });
    } catch (e) { 
      toast({ variant: "destructive", title: "Erreur lors de la suppression" }); 
    }
  };

  const handlePrint = (sale: any) => {
    const page = sale.reste <= 0 ? 'facture' : 'recu';
    let formattedDate = "---";
    try {
      const d = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
      if (d && isValid(d)) formattedDate = format(d, "dd-MM-yyyy");
    } catch (e) {}

    const params = new URLSearchParams({
      client: sale.clientName || "---", 
      phone: sale.clientPhone || "", 
      mutuelle: sale.mutuelle || "---",
      total: (sale.total || 0).toString(), 
      remise: (sale.remise || 0).toString(),
      avance: (sale.avance || 0).toString(), 
      od_sph: sale.prescription?.od?.sph || "---", 
      od_cyl: sale.prescription?.od?.cyl || "---",
      od_axe: sale.prescription?.od?.axe || "---", 
      od_add: sale.prescription?.od?.add || "---",
      og_sph: sale.prescription?.og?.sph || "---", 
      og_cyl: sale.prescription?.og?.cyl || "---",
      og_axe: sale.prescription?.og?.axe || "---", 
      og_add: sale.prescription?.og?.add || "---",
      date: formattedDate
    });
    router.push(`/ventes/${page}/${sale.invoiceId}?${params.toString()}`);
  };

  const handleUpdateCosts = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!costDialogSale || isReadOnly) return;
    setIsSavingCosts(true);
    
    const frameCost = parseAmount(purchaseCosts.frame);
    const lensesCost = parseAmount(purchaseCosts.lenses);
    const labelSuffix = purchaseCosts.label || costDialogSale.clientName || costDialogSale.invoiceId;

    try {
      await updateDoc(doc(db, "sales", costDialogSale.id), { 
        purchasePriceFrame: frameCost, 
        purchasePriceLenses: lensesCost, 
        updatedAt: serverTimestamp() 
      });

      if (frameCost > 0) {
        await addDoc(collection(db, "transactions"), { 
          type: "ACHAT MONTURE", 
          label: `COÛT MONTURE | ${labelSuffix}`, 
          clientName: `BC : ${costDialogSale.bonNumber || costDialogSale.invoiceId.slice(-4)}`,
          montant: -Math.abs(frameCost), 
          isDraft: isPrepaMode, 
          userName: user?.displayName || "---",
          createdAt: serverTimestamp() 
        });
      }
      if (lensesCost > 0) {
        await addDoc(collection(db, "transactions"), { 
          type: "ACHAT VERRES", 
          label: `COÛT VERRES | ${labelSuffix}`, 
          clientName: `BC : ${costDialogSale.bonNumber || costDialogSale.invoiceId.slice(-4)}`,
          montant: -Math.abs(lensesCost), 
          isDraft: isPrepaMode, 
          userName: user?.displayName || "---",
          createdAt: serverTimestamp() 
        });
      }

      toast({ variant: "success", title: "Coûts affectés et sorties de caisse créées" });
      setCostDialogSale(null);
    } catch (e) { 
      toast({ variant: "destructive", title: "Erreur technique" }); 
    } finally { 
      setIsSavingCosts(false); 
    }
  };

  const handleOpenPayment = (sale: any) => {
    if (isReadOnly) {
      toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse du jour est clôturée." });
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
    const userName = user?.displayName || "Personnel";

    try {
      await runTransaction(db, async (transaction) => {
        if (sessionRef && !isAdminOrPrepa) {
          const sSnap = await transaction.get(sessionRef);
          if (sSnap.exists() && sSnap.data().status === "CLOSED") throw new Error("SESSION_CLOSED");
        }

        const saleRef = doc(db, "sales", paymentSale.id);
        const saleSnap = await transaction.get(saleRef);
        const data = saleSnap.data()!;
        
        const totalNet = roundAmount((data.total || 0) - (data.remise || 0));
        const newAvance = roundAmount((data.avance || 0) + amount);
        const newReste = roundAmount(Math.max(0, totalNet - newAvance));
        const isPaid = newReste <= 0;

        let invId = data.invoiceId || "---";
        if (isPaid && invId.startsWith("RC-")) invId = invId.replace("RC-", "FC-");

        transaction.update(saleRef, {
          invoiceId: invId,
          avance: newAvance,
          reste: newReste,
          statut: isPaid ? "Payé" : "Partiel",
          deliveryStatus: isPaid ? "Livrée" : (data.deliveryStatus || "En préparation"),
          payments: arrayUnion({ amount, date: new Date().toISOString(), userName, note: "Règlement" }),
          updatedAt: serverTimestamp()
        });

        transaction.set(doc(collection(db, "transactions")), {
          type: "VENTE",
          label: `VENTE ${invId}`,
          clientName: data.clientName || "---",
          montant: amount,
          relatedId: invId,
          saleId: paymentSale.id,
          userName,
          isDraft: isPrepaMode,
          isBalancePayment: true,
          createdAt: serverTimestamp()
        });
      });

      toast({ variant: "success", title: "Règlement enregistré avec succès" });
      setPaymentSale(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message === "SESSION_CLOSED" ? "Caisse clôturée." : "Erreur lors du paiement." });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {isReadOnly && (
        <Alert variant="destructive" className="bg-red-600 text-white border-none rounded-[32px] mb-6 shadow-2xl py-6 animate-in fade-in slide-in-from-top-4">
          <Lock className="h-6 w-6 text-white" />
          <AlertTitle className="font-black uppercase tracking-[0.2em] text-lg">Caisse du jour Clôturée</AlertTitle>
          <AlertDescription className="font-bold opacity-95 text-sm">
            Toute modification financière ou règlement est désormais BLOQUÉ car la session de caisse actuelle est fermée.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <HistoryIcon className="h-8 w-8 text-[#D4AF37]/40 shrink-0" />
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter leading-none">
              HISTORIQUE DE VENTES
            </h1>
            <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">
              Registre central des ventes Réelles.
            </p>
          </div>
        </div>
        <Button asChild className="h-12 font-black rounded-full px-10 shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all uppercase tracking-widest text-xs">
          <Link href="/ventes/nouvelle"><Plus className="mr-2 h-5 w-5" />NOUVELLE VENTE</Link>
        </Button>
      </div>

      <Card className="shadow-xl shadow-slate-200/50 rounded-[60px] bg-white border-none overflow-hidden">
        <CardHeader className="p-10 border-b bg-slate-50">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-4 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Recherche Rapide</Label>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D4AF37]" />
                <input 
                  placeholder="Client, Facture ou BC..." 
                  className="w-full pl-14 h-12 text-sm font-bold rounded-2xl border-none shadow-inner outline-none bg-white" 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                />
              </div>
            </div>
            
            <div className="lg:col-span-2 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-12 rounded-2xl font-black border-none shadow-inner bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-[32px]">
                  {["TOUS", "Payé", "Partiel", "En attente"].map(s => <SelectItem key={s} value={s} className="font-black text-[10px] uppercase">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-6 space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Période du Rapport</Label>
              <div className="flex items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase bg-white border-none shadow-inner justify-between px-6">
                      <CalendarIcon className="h-4 w-4 text-[#D4AF37]" />
                      <span>{dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Début"}</span>
                      <ChevronDown className="h-3 w-3 opacity-20" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={fr} initialFocus /></PopoverContent>
                </Popover>
                <div className="h-px w-4 bg-slate-200" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 h-12 rounded-2xl font-black text-[10px] uppercase bg-white border-none shadow-inner justify-between px-6">
                      <CalendarIcon className="h-4 w-4 text-[#D4AF37]" />
                      <span>{dateTo ? format(dateTo, "dd/MM/yyyy") : "Fin"}</span>
                      <ChevronDown className="h-3 w-3 opacity-20" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={fr} initialFocus /></PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#0D1B2A]">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest whitespace-nowrap">Date</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest whitespace-nowrap">Document & Client</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest w-40 whitespace-nowrap">Total Net</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest w-40 whitespace-nowrap">Avancé</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest w-40 whitespace-nowrap">Reste</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest whitespace-nowrap">Statut</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest w-24 whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-24 text-center text-[10px] font-black uppercase text-slate-300 tracking-[0.5em]">Aucune vente trouvée.</TableCell></TableRow>
                ) : filteredSales.map((sale: any) => {
                  const totalNet = (sale.total || 0) - (sale.remise || 0);
                  const reste = sale.reste || 0;
                  
                  return (
                    <TableRow key={sale.id} className="hover:bg-slate-50 transition-all group border-b last:border-0">
                      <TableCell className="px-10 py-6 text-[11px] font-bold text-slate-500 tabular-nums whitespace-nowrap">
                        {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd/MM/yyyy") : "---"}
                      </TableCell>
                      <TableCell className="px-10 py-6 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-[18px] font-black text-[#0D1B2A] tracking-tighter uppercase leading-none">
                            {sale.invoiceId}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                            {sale.clientName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-10 py-6 text-sm font-black text-[#0D1B2A] tabular-nums whitespace-nowrap">
                        {formatCurrency(totalNet)}
                      </TableCell>
                      <TableCell className="text-right px-10 py-6 text-sm font-black text-emerald-600 tabular-nums whitespace-nowrap">
                        {formatCurrency(sale.avance || 0)}
                      </TableCell>
                      <TableCell className="text-center px-10 py-6">
                        <div className="flex items-center justify-center gap-3">
                          <span className={cn("text-sm font-black tabular-nums whitespace-nowrap", reste > 0 ? "text-red-500" : "text-slate-300")}>
                            {formatCurrency(reste)}
                          </span>
                          {reste > 0 && (
                            <button 
                              disabled={sessionLoading || isReadOnly} 
                              onClick={() => handleOpenPayment(sale)}
                              className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center transition-all shadow-sm",
                                (isReadOnly || sessionLoading) ? "bg-slate-100 text-slate-300 cursor-not-allowed" : "bg-red-50 text-red-500 hover:bg-red-500 hover:text-white"
                              )} 
                              title={isReadOnly ? "Caisse clôturée" : "Régler le reste"}
                            >
                              <HandCoins className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-10 py-6">
                        <Badge className={cn(
                          "text-[9px] font-black uppercase py-1 px-3 rounded-full border-none shadow-sm whitespace-nowrap", 
                          (sale.statut === "Payé" || sale.statut === "Payer") ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                        )} variant="outline">
                          {sale.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-10 py-6">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100"><MoreVertical className="h-5 w-5 text-slate-400" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-[24px] p-2 min-w-[180px] shadow-2xl">
                            <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                              <Printer className="mr-3 h-4 w-4 text-[#D4AF37]" /> Réimprimer
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
                <input 
                  className="h-16 w-full rounded-full text-center text-2xl font-black border-2 border-slate-100 bg-slate-50 focus:border-[#D4AF37] outline-none transition-all tabular-nums" 
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  onBlur={() => setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))} 
                  autoFocus
                  readOnly={isReadOnly}
                />
              </div>
            </div>
            <DialogFooter className="p-10 pt-0">
              <Button type="submit" disabled={isProcessingPayment || sessionLoading || isReadOnly} className="w-full h-16 rounded-full font-black text-base uppercase shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-[#D4AF37] transition-all">
                {isProcessingPayment ? <Loader2 className="animate-spin h-6 w-6" /> : "VALIDER LE PAIEMENT"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!costDialogSale} onOpenChange={setCostDialogSale}>
        <DialogContent className="max-w-md rounded-[60px] p-0 overflow-hidden shadow-2xl border-none">
          <form onSubmit={handleUpdateCosts}>
            <div className="bg-[#0D1B2A] p-10 text-center">
              <div className="h-16 w-16 bg-[#D4AF37]/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Tag className="h-8 w-8 text-[#D4AF37]" />
              </div>
              <DialogTitle className="text-2xl font-black uppercase text-[#D4AF37] tracking-tighter">Affectation des Coûts</DialogTitle>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mt-2">Calcul de Marge Brute</p>
            </div>
            <div className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">Coût Monture (DH)</Label>
                  <input 
                    className="h-12 w-full rounded-2xl bg-slate-50 border-none font-black text-lg text-center tabular-nums outline-none focus:ring-2 focus:ring-[#D4AF37]/20" 
                    value={purchaseCosts.frame} 
                    onChange={e => setPurchaseCosts(prev => ({ ...prev, frame: e.target.value }))} 
                    onBlur={() => purchaseCosts.frame && setPurchaseCosts(prev => ({ ...prev, frame: formatCurrency(parseAmount(purchaseCosts.frame)) }))} 
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">Coût Verres (DH)</Label>
                  <input 
                    className="h-12 w-full rounded-2xl bg-slate-50 border-none font-black text-lg text-center tabular-nums outline-none focus:ring-2 focus:ring-[#D4AF37]/20" 
                    value={purchaseCosts.lenses} 
                    onChange={e => setPurchaseCosts(prev => ({ ...prev, lenses: e.target.value }))} 
                    onBlur={() => purchaseCosts.lenses && setPurchaseCosts(prev => ({ ...prev, lenses: formatCurrency(parseAmount(purchaseCosts.lenses)) }))} 
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase ml-2 text-slate-400 tracking-widest">Référence Fournisseur / Note</Label>
                <Input 
                  className="h-12 rounded-2xl bg-slate-50 border-none font-bold text-sm px-4" 
                  placeholder="Ex: Vision Optic ou Stock..." 
                  value={purchaseCosts.label} 
                  onChange={e => setPurchaseCosts(prev => ({ ...prev, label: e.target.value }))} 
                  readOnly={isReadOnly}
                />
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" />
                <p className="text-[9px] font-bold text-blue-700 leading-tight">
                  Enregistrer ces coûts créera automatiquement deux transactions de sortie dans le journal de caisse pour refléter vos d'épenses réelles.
                </p>
              </div>
            </div>
            <DialogFooter className="p-10 pt-0">
              <Button type="submit" disabled={isSavingCosts || sessionLoading || isReadOnly} className="w-full h-16 rounded-full font-black text-base uppercase shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-[#D4AF37] transition-all">
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
