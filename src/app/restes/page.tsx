"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Search, 
  Loader2, 
  MessageSquare, 
  PackageCheck, 
  CheckCircle2, 
  Clock 
} from "lucide-react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, sendWhatsApp } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, doc, updateDoc, serverTimestamp, limit, where, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const DELIVERY_STATUSES = [
  { value: "En préparation", label: "En préparation", icon: Clock, color: "text-red-600 bg-red-50" },
  { value: "Prête", label: "Prête", icon: PackageCheck, color: "text-orange-600 bg-orange-50" },
  { value: "Livrée", label: "Livrée", icon: CheckCircle2, color: "text-blue-600 bg-blue-50" },
];

export default function OrderTrackingPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [role, setRole] = useState<string>("");
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    setRole(savedRole);
    setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
    setIsReady(true);
  }, []);

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
      if (isPrepaMode ? sale.isDraft !== true : sale.isDraft === true) return false;
      
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch = !search || 
        (sale.clientName || "").toLowerCase().includes(search) || 
        (sale.invoiceId || "").toLowerCase().includes(search);
      
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
    
    const message = `Bonjour ${sale.clientName}, votre commande N°${sale.invoiceId} chez Like Vision est prête ! Reste à payer: ${formatCurrency(sale.reste)} DH. \uD83D\uDD76`;
    sendWhatsApp(sale.clientPhone, message);
  };

  return (
    <AppShell>
      <div className="space-y-10 pb-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <PackageCheck className="h-8 w-8 text-[#D4AF37]/40 shrink-0" />
            <div className="flex flex-col text-left">
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
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest w-80">Client</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest w-32">Reste</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest w-48">État Commande</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                  ) : filteredSales.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="py-24 text-center text-[10px] font-black uppercase text-slate-300 tracking-widest">Aucune commande à suivre.</TableCell></TableRow>
                  ) : filteredSales.map(sale => {
                    const currentStatusObj = DELIVERY_STATUSES.find(s => s.value === (sale.deliveryStatus || "En préparation"));
                    
                    return (
                      <TableRow key={sale.id} className="hover:bg-slate-50 transition-all border-b last:border-0 group animate-subtle">
                        <TableCell className="px-6 py-6">
                          <div className="flex flex-col">
                            <span className="font-black text-sm uppercase text-[#0D1B2A] whitespace-nowrap">{sale.clientName}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">{sale.invoiceId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-6">
                          <span className={cn("text-sm font-black tabular-nums whitespace-nowrap", (sale.reste || 0) > 0 ? "text-red-500" : "text-emerald-600")}>
                            {formatCurrency(sale.reste || 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center px-6 py-6">
                          <Select 
                            value={sale.deliveryStatus || "En préparation"} 
                            onValueChange={(val) => handleUpdateDeliveryStatus(sale.id, val)}
                          >
                            <SelectTrigger className={cn(
                              "h-9 rounded-full border-none font-black text-[10px] uppercase shadow-inner px-4 min-w-[160px] whitespace-nowrap",
                              currentStatusObj?.color
                            )}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl">
                              {DELIVERY_STATUSES.map(status => (
                                <SelectItem key={status.value} value={status.value} className={cn("font-black text-[10px] uppercase", status.color)}>
                                  <div className="flex items-center gap-2">
                                    <status.icon className="h-3 w-3" />
                                    <span className="whitespace-nowrap">{status.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right px-6 py-6">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              onClick={() => handleNotifyClient(sale)}
                              variant="outline"
                              disabled={sale.deliveryStatus !== "Prête"}
                              className={cn(
                                "h-9 px-6 font-black text-[9px] uppercase rounded-full transition-all shadow-sm",
                                sale.deliveryStatus === "Prête" 
                                  ? "border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100" 
                                  : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                              )}
                            >
                              <MessageSquare className="mr-2 h-3.5 w-3.5" /> NOTIFIER
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
