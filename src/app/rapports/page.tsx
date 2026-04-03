"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  Loader2,
  Printer,
  FileText,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Tag,
  Filter,
  CalendarDays,
  Landmark,
  PieChart as PieChartIcon,
  Edit2
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, serverTimestamp, runTransaction, getDocs, where } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function ReportsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [loadingRole, setLoadingRole] = useState(true);
  const [role, setRole] = useState<string>("OPTICIENNE");

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole !== 'ADMIN' && savedRole !== 'PREPA') router.push('/dashboard');
    else { setRole(savedRole.toUpperCase()); setLoadingRole(false); }
  }, [router]);

  const isPrepaMode = role === "PREPA";
  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ 
    from: startOfMonth(new Date()), 
    to: endOfMonth(new Date()) 
  });

  // Filtres pour l'impression des charges
  const [includeVerres, setIncludeVerres] = useState(true);
  const [includeMontures, setIncludeMontures] = useState(true);
  const [includeFrais, setIncludeFrais] = useState(true);
  const [includeVersements, setIncludeVersements] = useState(true);

  // States pour l'édition
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTrans, setSelectedTrans] = useState<any>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [editOp, setEditOp] = useState({ type: "DEPENSE", label: "", clientName: "", montant: "" });

  const salesQuery = useMemoFirebase(() => query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(2000)), [db]);
  const { data: rawSales, isLoading: salesLoading } = useCollection(salesQuery);

  const transQuery = useMemoFirebase(() => query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(2000)), [db]);
  const { data: rawTransactions, isLoading: transLoading } = useCollection(transQuery);

  const stats = useMemo(() => {
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to);
    
    const filteredSales = (rawSales || []).filter((s: any) => 
      (isPrepaMode ? s.isDraft === true : !s.isDraft) && 
      s.createdAt?.toDate && 
      isWithinInterval(s.createdAt.toDate(), { start: from, end: to })
    );

    const filteredTrans = (rawTransactions || []).filter((t: any) => 
      (isPrepaMode ? t.isDraft === true : !t.isDraft) && 
      t.createdAt?.toDate && 
      isWithinInterval(t.createdAt.toDate(), { start: from, end: to })
    );

    const ca = filteredTrans.filter(t => t.type === "VENTE").reduce((acc, t) => acc + (Number(t.montant) || 0), 0);
    const volumeFacture = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0) - (Number(s.remise) || 0), 0);
    const costs = filteredSales.reduce((acc, s) => acc + (Number(s.purchasePriceFrame) || 0) + (Number(s.purchasePriceLenses) || 0), 0);
    const expenses = filteredTrans.filter(t => ["DEPENSE", "ACHAT VERRES", "ACHAT MONTURE", "VERSEMENT"].includes(t.type)).reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

    const chargeVerres = filteredTrans.filter(t => t.type === "ACHAT VERRES").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);
    const chargeMontures = filteredTrans.filter(t => t.type === "ACHAT MONTURE").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);
    const chargeGeral = filteredTrans.filter(t => t.type === "DEPENSE").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);
    const chargeVersements = filteredTrans.filter(t => t.type === "VERSEMENT").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

    return { 
      ca: roundAmount(ca), 
      volumeFacture: roundAmount(volumeFacture), 
      marge: roundAmount(volumeFacture - costs), 
      expenses: roundAmount(expenses), 
      chargeVerres: roundAmount(chargeVerres),
      chargeMontures: roundAmount(chargeMontures),
      chargeGeral: roundAmount(chargeGeral),
      chargeVersements: roundAmount(chargeVersements),
      filteredSales, 
      filteredTrans 
    };
  }, [rawSales, rawTransactions, dateRange, isPrepaMode]);

  const handleOpenEdit = (t: any) => {
    setSelectedTrans(t);
    setEditOp({
      type: t.type,
      label: t.label || "",
      clientName: t.clientName || "",
      montant: formatCurrency(Math.abs(t.montant))
    });
    setIsEditDialogOpen(true);
  };

  const handleAutoAffectBC = async (clientName: string, type: string, amount: number) => {
    const bcMatch = (clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
    if (bcMatch && (type === "ACHAT VERRES" || type === "ACHAT MONTURE")) {
      const bcId = bcMatch[1].padStart(4, '0');
      try {
        // Filtrage en mémoire pour éviter l'erreur d'index Firestore
        const q = query(
          collection(db, "sales"), 
          where("invoiceId", "in", [`FC-2026-${bcId}`, `RC-2026-${bcId}`])
        );
        const snap = await getDocs(q);
        const saleDoc = snap.docs.find(d => d.data().isDraft === isPrepaMode);
        
        if (saleDoc) {
          const updateField = type === "ACHAT VERRES" ? "purchasePriceLenses" : "purchasePriceFrame";
          await updateDoc(saleDoc.ref, { [updateField]: amount });
          return true;
        }
      } catch (e) {
        console.error("Erreur affectation BC:", e);
      }
    }
    return false;
  };

  const handleUpdateOperation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTrans || !editOp.montant) return;

    setOpLoading(true);
    const amt = parseAmount(editOp.montant);
    const finalAmount = (editOp.type === "VENTE") ? Math.abs(amt) : -Math.abs(amt);
    const finalLabel = editOp.label || (editOp.type === "VERSEMENT" ? "BANQUE" : editOp.type);
    
    try {
      await runTransaction(db, async (transaction) => {
        const transRef = doc(db, "transactions", selectedTrans.id);
        transaction.update(transRef, {
          type: editOp.type,
          label: finalLabel,
          clientName: editOp.clientName || "---",
          montant: finalAmount,
          updatedAt: serverTimestamp()
        });
      });

      await handleAutoAffectBC(editOp.clientName, editOp.type, amt);
      toast({ variant: "success", title: "Opération mise à jour" });
      setIsEditDialogOpen(false);
    } catch (e: any) { 
      toast({ variant: "destructive", title: "Erreur" }); 
    } finally { setOpLoading(false); }
  };

  const handlePrintCharges = () => {
    const types = [];
    if (includeVerres) types.push("ACHAT VERRES");
    if (includeMontures) types.push("ACHAT MONTURE");
    if (includeFrais) types.push("DEPENSE");
    if (includeVersements) types.push("VERSEMENT");

    const params = new URLSearchParams({
      from: format(dateRange.from, "yyyy-MM-dd"),
      to: format(dateRange.to, "yyyy-MM-dd"),
      types: types.join(",")
    });
    router.push(`/rapports/print/charges?${params.toString()}`);
  };

  const setMonth = (monthsAgo: number) => {
    const target = subMonths(new Date(), monthsAgo);
    setDateRange({
      from: startOfMonth(target),
      to: endOfMonth(target)
    });
  };

  if (loadingRole) return null;

  const RenderChargesTable = ({ title, type, color, icon: Icon }: any) => {
    const data = stats.filteredTrans.filter(t => t.type === type);
    return (
      <Card className="rounded-[40px] border-none shadow-xl bg-white overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b p-6 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-2xl flex items-center justify-center bg-white shadow-sm border", color)}>
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-black uppercase text-[#0D1B2A] tracking-wider">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400">Total :</span>
            <Badge className={cn("text-xs font-black px-4 py-1.5 rounded-full border-none shadow-sm", color.replace('text-', 'bg-') + '/10 ' + color)}>
              {formatCurrency(data.reduce((acc, t) => acc + Math.abs(t.montant), 0))}
            </Badge>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#0D1B2A]/5">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-black px-8 py-4">Opération</TableHead>
                <TableHead className="text-[10px] uppercase font-black px-8 py-4 text-center">Réf / Client</TableHead>
                <TableHead className="text-[10px] uppercase font-black px-8 py-4 text-right">Montant</TableHead>
                <TableHead className="text-[10px] uppercase font-black px-8 py-4 text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length > 0 ? data.map(t => {
                const bcMatch = (t.clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
                const bcNum = bcMatch ? bcMatch[1] : "---";
                return (
                  <TableRow key={t.id} className="hover:bg-slate-50 transition-all group border-b last:border-0">
                    <TableCell className="px-8 py-5">
                      <div className="flex items-center gap-6">
                        <span className="text-[10px] font-black text-slate-400 w-16 tabular-nums">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yy") : "---"}</span>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase text-[#0D1B2A] group-hover:text-primary transition-colors">{t.label}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">{t.clientName || "---"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-8 py-5 text-center">
                      {bcNum !== "---" && <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200 bg-white">BC {bcNum}</Badge>}
                    </TableCell>
                    <TableCell className="px-8 py-5 text-right">
                      <span className="text-sm font-black tabular-nums text-red-500">-{formatCurrency(Math.abs(t.montant))}</span>
                    </TableCell>
                    <TableCell className="px-8 py-5 text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full hover:bg-slate-100 text-[#0D1B2A]/40 hover:text-primary"
                        onClick={() => handleOpenEdit(t)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }) : (
                <TableRow><TableCell colSpan={4} className="text-center py-12 text-[10px] font-black uppercase opacity-20 tracking-[0.3em]">Aucune opération enregistrée.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    );
  };

  return (
    <AppShell>
      <div className="space-y-8 pb-10">
        <div className="bg-white p-8 rounded-[60px] border shadow-xl shadow-slate-200/50 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-[#0D1B2A] rounded-[24px] flex items-center justify-center shadow-lg shadow-[#0D1B2A]/20">
              <TrendingUp className="h-7 w-7 text-[#D4AF37]" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter leading-none">
                Rapports d'Activité
              </h1>
              <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">
                Suivi Luxury des marges et des sorties de caisse.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex bg-slate-50 p-1 rounded-full border shadow-inner">
              <Button variant="ghost" onClick={() => setMonth(0)} className="h-10 px-4 rounded-full font-black text-[9px] uppercase text-[#0D1B2A] hover:bg-white hover:shadow-sm transition-all">Ce mois</Button>
              <Button variant="ghost" onClick={() => setMonth(1)} className="h-10 px-4 rounded-full font-black text-[9px] uppercase text-[#0D1B2A] hover:bg-white hover:shadow-sm transition-all">Mois dernier</Button>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-full border shadow-inner">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-12 px-6 rounded-full font-black text-[10px] uppercase bg-white border min-w-[220px] justify-between shadow-sm text-[#0D1B2A]">
                    <CalendarIcon className="mr-2 h-4 w-4 text-[#D4AF37]" />
                    <span>{format(dateRange.from, "dd MMM")} - {format(dateRange.to, "dd MMM yyyy")}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl overflow-hidden">
                  <Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(r: any) => r?.from && setDateRange({ from: r.from, to: r.to || r.from })} locale={fr} />
                </PopoverContent>
              </Popover>
              <Button onClick={() => router.push(`/rapports/print/journalier?date=${format(dateRange.from, "yyyy-MM-dd")}`)} className="h-12 px-8 rounded-full font-black text-[10px] uppercase shadow-lg bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all">
                <FileText className="mr-2 h-4 w-4" /> JOURNALIER
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[ 
            { l: "CA Encaissé", v: stats.ca, c: "text-[#D4AF37]", bg: "bg-white" }, 
            { l: "Marge Brute", v: stats.marge, c: "text-emerald-600", bg: "bg-white" }, 
            { l: "Achats (V+M)", v: -(stats.chargeVerres + stats.chargeMontures), c: "text-orange-500", bg: "bg-white" }, 
            { l: "Résultat Net", v: stats.ca - stats.expenses, c: "text-white", bg: "bg-[#0D1B2A]" } 
          ].map((item, i) => (
            <Card key={i} className={cn("p-8 rounded-[60px] border-none shadow-xl shadow-slate-200/50 relative overflow-hidden", item.bg)}>
              <p className={cn("text-[10px] uppercase font-black mb-3 tracking-widest", item.bg === "bg-[#0D1B2A]" ? "text-slate-400" : "text-slate-400")}>{item.l}</p>
              <p className={cn("text-2xl font-black tabular-nums tracking-tighter", item.c)}>{formatCurrency(item.v)}</p>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="flux" className="w-full">
          <TabsList className="bg-white p-1 rounded-[32px] shadow-sm border h-14 w-fit flex overflow-x-auto">
            <TabsTrigger value="flux" className="rounded-full font-black text-[10px] uppercase px-8">Flux de Caisse</TabsTrigger>
            <TabsTrigger value="marges" className="rounded-full font-black text-[10px] uppercase px-8">Analyse Marges</TabsTrigger>
            <TabsTrigger value="charges" className="rounded-full font-black text-[10px] uppercase px-8">Détail des Charges</TabsTrigger>
          </TabsList>

          <TabsContent value="flux" className="mt-6">
            <Card className="rounded-[60px] shadow-xl border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Opération</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.filteredTrans.length > 0 ? stats.filteredTrans.map(t => (
                    <TableRow key={t.id} className="hover:bg-slate-50 transition-all group border-b last:border-0">
                      <TableCell className="px-10 py-6 font-bold text-[11px] text-slate-400">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM HH:mm") : "---"}</TableCell>
                      <TableCell className="px-10 py-6 font-black uppercase text-xs text-[#0D1B2A]">{t.label}</TableCell>
                      <TableCell className={cn("text-right px-10 py-6 font-black text-sm tabular-nums", t.montant >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {t.montant >= 0 ? "+" : ""}{formatCurrency(t.montant)}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="text-center py-20 text-[10px] font-black uppercase opacity-20 tracking-widest">Aucune donnée sur cette période.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="marges" className="mt-6">
            <Card className="rounded-[60px] shadow-xl border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Facture & Client</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">CA Net</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Coût Monture</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Coût Verres</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Marge</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.filteredSales.length > 0 ? stats.filteredSales.map(s => {
                    const caNet = (s.total || 0) - (s.remise || 0);
                    const costFrame = s.purchasePriceFrame || 0;
                    const costLenses = s.purchasePriceLenses || 0;
                    const totalCost = costFrame + costLenses;
                    const marge = caNet - totalCost;
                    const margePct = caNet > 0 ? (marge / caNet) * 100 : 0;

                    return (
                      <TableRow key={s.id} className="hover:bg-slate-50 border-b last:border-0 transition-all">
                        <TableCell className="px-6 py-6 font-bold text-[11px] text-slate-400 whitespace-nowrap">
                          {s.createdAt?.toDate ? format(s.createdAt.toDate(), "dd/MM/yyyy") : "---"}
                        </TableCell>
                        <TableCell className="px-6 py-6">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-[#0D1B2A] uppercase truncate">{s.invoiceId}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase truncate">{s.clientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-slate-900">{formatCurrency(caNet)}</TableCell>
                        <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-red-400">-{formatCurrency(costFrame)}</TableCell>
                        <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-red-400">-{formatCurrency(costLenses)}</TableCell>
                        <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-emerald-600">{formatCurrency(marge)}</TableCell>
                        <TableCell className="text-center px-6 py-6">
                          <Badge className={cn("text-[9px] font-black px-3 py-1 rounded-full", margePct > 50 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>
                            {margePct.toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-[10px] font-black uppercase opacity-20 tracking-widest">Affectez des coûts d'achat pour voir vos marges.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="charges" className="mt-6 space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[40px] border shadow-lg gap-8">
              <div className="flex items-center gap-6 overflow-hidden">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="h-10 w-10 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Filter className="h-5 w-5 text-[#D4AF37]" />
                  </div>
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest hidden sm:inline">Afficher :</span>
                </div>
                <div className="flex flex-nowrap items-center gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
                  <div className="flex items-center space-x-3 bg-blue-50/50 px-4 py-2.5 rounded-2xl border border-blue-100 shrink-0">
                    <Switch id="inc-verres" checked={includeVerres} onCheckedChange={setIncludeVerres} className="data-[state=checked]:bg-blue-600" />
                    <Label htmlFor="inc-verres" className="text-[11px] font-black uppercase cursor-pointer text-blue-700 tracking-tight">Verres</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-orange-50/50 px-4 py-2.5 rounded-2xl border border-orange-100 shrink-0">
                    <Switch id="inc-montures" checked={includeMontures} onCheckedChange={setIncludeMontures} className="data-[state=checked]:bg-orange-600" />
                    <Label htmlFor="inc-montures" className="text-[11px] font-black uppercase cursor-pointer text-orange-700 tracking-tight">Montures</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-red-50/50 px-4 py-2.5 rounded-2xl border border-red-100 shrink-0">
                    <Switch id="inc-frais" checked={includeFrais} onCheckedChange={setIncludeFrais} className="data-[state=checked]:bg-red-600" />
                    <Label htmlFor="inc-frais" className="text-[11px] font-black uppercase cursor-pointer text-red-700 tracking-tight">Frais</Label>
                  </div>
                  <div className="flex items-center space-x-3 bg-slate-100 px-4 py-2.5 rounded-2xl border border-slate-200 shrink-0">
                    <Switch id="inc-versements" checked={includeVersements} onCheckedChange={setIncludeVersements} className="data-[state=checked]:bg-[#0D1B2A]" />
                    <Label htmlFor="inc-versements" className="text-[11px] font-black uppercase cursor-pointer text-[#0D1B2A] tracking-tight">Versements</Label>
                  </div>
                </div>
              </div>
              
              <Button onClick={handlePrintCharges} className="h-14 px-10 rounded-full font-black text-xs uppercase shadow-xl bg-[#0D1B2A] text-[#D4AF37] hover:bg-[#D4AF37] hover:text-[#0D1B2A] transition-all transform active:scale-95 shrink-0">
                <Printer className="mr-3 h-5 w-5" /> IMPRIMER LE DÉTAIL (PDF)
              </Button>
            </div>
            
            <div className="grid grid-cols-1 gap-10">
              {includeVerres && <RenderChargesTable title="Achats de Verres" type="ACHAT VERRES" color="text-blue-600" icon={Tag} />}
              {includeMontures && <RenderChargesTable title="Achats de Montures" type="ACHAT MONTURE" color="text-orange-600" icon={Tag} />}
              {includeFrais && <RenderChargesTable title="Charges Générales & Frais" type="DEPENSE" color="text-red-600" icon={TrendingDown} />}
              {includeVersements && <RenderChargesTable title="Versements Bancaires" type="VERSEMENT" color="text-[#0D1B2A]" icon={Landmark} />}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md rounded-[40px] p-10" onKeyDown={(e) => e.key === 'Enter' && handleUpdateOperation(e)}>
          <form onSubmit={handleUpdateOperation}>
            <DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] tracking-widest text-center text-xl">Modifier Opération</DialogTitle></DialogHeader>
            <div className="space-y-6 py-8">
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Type</Label><select className="w-full h-12 rounded-2xl font-bold bg-slate-50 border-none px-4 outline-none" value={editOp.type} onChange={e => setEditOp({...editOp, type: e.target.value})}><option value="VENTE">Vente (+)</option><option value="DEPENSE">Dépense (-)</option><option value="ACHAT MONTURE">Achat Monture (-)</option><option value="ACHAT VERRES">Achat Verres (-)</option><option value="VERSEMENT">Versement (-)</option></select></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Libellé</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none px-4" placeholder="Désignation..." value={editOp.label} onChange={e => setEditOp({...editOp, label: e.target.value})} /></div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Nom Client / BC</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none px-4" placeholder="M. Mohamed ou BC : 2472..." value={editOp.clientName} onChange={e => setEditOp({...editOp, clientName: e.target.value})} /></div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black ml-2">Montant (DH)</Label>
                <Input 
                  type="text" 
                  className="h-12 rounded-2xl font-black text-lg bg-slate-50 border-none px-4 text-[#0D1B2A] tabular-nums" 
                  placeholder="0,00" 
                  value={editOp.montant} 
                  onChange={e => setEditOp({...editOp, montant: e.target.value})} 
                  onBlur={() => editOp.montant && setEditOp({...editOp, montant: formatCurrency(parseAmount(editOp.montant))})}
                />
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={opLoading} className="w-full h-14 font-black rounded-full text-base tracking-widest shadow-xl">ENREGISTRER</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
