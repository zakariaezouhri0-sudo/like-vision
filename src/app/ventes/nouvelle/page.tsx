
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { MUTUELLES } from "@/lib/constants";
import { ShoppingBag, Save, Printer, Loader2, Search, AlertTriangle, CheckCircle2, Star, Calendar as CalendarIcon, Tag, History, Landmark, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, serverTimestamp, query, where, getDocs, increment, Timestamp, runTransaction, limit } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function NewSaleForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeEditId, setActiveEditId] = useState<string | null>(searchParams.get("editId"));

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole) setRole(savedRole.toUpperCase());
    else router.push('/login');
  }, [router]);

  const isPrepaMode = role === "PREPA";

  const [saleDate, setSaleDate] = useState<Date>(() => {
    const d = searchParams.get("date_raw");
    return d ? new Date(d) : new Date();
  });
  
  const [mutuelle, setMutuelle] = useState("Aucun");
  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  const [total, setTotal] = useState<string>(searchParams.get("total") || "");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("amount");
  const [discountValue, setDiscountValue] = useState<string>(searchParams.get("discountValue") || "");
  const [avance, setAvance] = useState<string>(searchParams.get("avance") || "");
  const [historicalAdvance, setHistoricalAdvance] = useState<string>("");
  const [monture, setMonture] = useState(searchParams.get("monture") || "");
  const [verres, setVerres] = useState(searchParams.get("verres") || "");
  const [purchasePriceFrame, setPurchasePriceFrame] = useState<string>(searchParams.get("purchasePriceFrame") || "");
  const [purchasePriceLenses, setPurchasePriceLenses] = useState<string>(searchParams.get("purchasePriceLenses") || "");

  const [prescription, setPrescription] = useState({
    od: { sph: "", cyl: "", axe: "", add: "" },
    og: { sph: "", cyl: "", axe: "", add: "" }
  });

  const cleanVal = (val: string | number): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = val.toString().replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const nTotal = cleanVal(total);
  const nDiscount = cleanVal(discountValue);
  const nHistorical = cleanVal(historicalAdvance);
  const nAvance = cleanVal(avance);
  
  const remiseAmountValue = discountType === "percent" ? (nTotal * nDiscount) / 100 : nDiscount;
  const totalNetValue = Math.max(0, nTotal - remiseAmountValue);
  const resteAPayerValue = Math.max(0, totalNetValue - nHistorical - nAvance);

  const handleSave = async () => {
    const currentRole = localStorage.getItem('user_role')?.toUpperCase();
    if (!currentRole || !clientName) {
      toast({ variant: "destructive", title: "Erreur", description: "Le nom du client est requis." });
      return;
    }
    
    setLoading(true);
    const currentIsDraft = currentRole === "PREPA";
    const currentUserName = user?.displayName || "Inconnu";

    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "settings", currentIsDraft ? "counters_draft" : "counters");
        const counterSnap = await transaction.get(counterRef);
        const saleRef = activeEditId ? doc(db, "sales", activeEditId) : doc(collection(db, "sales"));
        
        let counters = { fc: 0, rc: 0 };
        if (counterSnap.exists()) counters = counterSnap.data() as any;

        const isPaid = resteAPayerValue <= 0;
        const statut = isPaid ? "Payé" : ((nAvance + nHistorical) > 0 ? "Partiel" : "En attente");
        let invoiceId = searchParams.get("invoiceId") || "";

        if (!activeEditId) {
          const prefix = currentIsDraft ? "PREPA-" : "";
          if (isPaid) { 
            counters.fc += 1; 
            invoiceId = `${prefix}FC-2026-${counters.fc.toString().padStart(4, '0')}`; 
          } else { 
            counters.rc += 1; 
            invoiceId = `${prefix}RC-2026-${counters.rc.toString().padStart(4, '0')}`; 
          }
          transaction.set(counterRef, counters, { merge: true });
        }

        const saleData: any = {
          invoiceId,
          clientName, clientPhone: clientPhone.replace(/\s/g, ""), mutuelle,
          total: nTotal, remise: remiseAmountValue, discountType, discountValue: nDiscount,
          avance: nHistorical + nAvance, reste: resteAPayerValue, statut,
          prescription, monture, verres, isDraft: currentIsDraft, 
          updatedAt: serverTimestamp(),
          purchasePriceFrame: cleanVal(purchasePriceFrame), 
          purchasePriceLenses: cleanVal(purchasePriceLenses)
        };

        if (!activeEditId) {
          saleData.createdAt = Timestamp.fromDate(saleDate);
          saleData.createdBy = currentUserName;
          saleData.payments = [];
          if (nHistorical > 0) saleData.payments.push({ amount: nHistorical, date: saleDate.toISOString(), userName: "Historique" });
          if (nAvance > 0) saleData.payments.push({ amount: nAvance, date: new Date().toISOString(), userName: currentUserName });
        }

        transaction.set(saleRef, saleData, { merge: true });

        if (nAvance > 0 && !activeEditId) {
          const transRef = doc(collection(db, "transactions"));
          transaction.set(transRef, {
            type: "VENTE", label: `VENTE ${invoiceId}`, clientName, montant: nAvance, relatedId: invoiceId,
            userName: currentUserName, isDraft: currentIsDraft, createdAt: serverTimestamp()
          }, { merge: true });
        }
      });

      toast({ variant: "success", title: "Vente Enregistrée" });
      router.push("/ventes");
    } catch (err) { 
      toast({ variant: "destructive", title: "Erreur lors de l'enregistrement" }); 
    } finally { 
      setLoading(false); 
    }
  };

  if (!role) return null;

  return (
    <AppShell>
      <div className="space-y-4 max-w-5xl mx-auto pb-24">
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border shadow-sm">
          <div className="flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", isPrepaMode ? "bg-orange-100 text-orange-600" : "bg-primary/10 text-primary")}><ShoppingBag className="h-6 w-6" /></div>
            <div><h1 className="text-2xl font-black text-primary uppercase tracking-tighter">{isPrepaMode ? "Saisie Historique" : "Nouvelle Vente"}</h1></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="h-12 rounded-xl font-black text-[10px] px-8 shadow-xl" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" />}ENREGISTRER</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-[32px] bg-white border-none shadow-sm">
              <CardHeader className="py-4 px-8 bg-slate-50 border-b"><CardTitle className="text-[10px] uppercase font-black text-primary/60">Client & Date</CardTitle></CardHeader>
              <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Nom Client</Label><Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner" value={clientName} onChange={e => setClientName(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase">Date</Label>
                  <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full h-12 rounded-xl bg-slate-50 border-none justify-start font-bold"><CalendarIcon className="mr-2 h-4 w-4" />{format(saleDate, "dd MMMM yyyy", { locale: fr })}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={saleDate} onSelect={(d) => d && setSaleDate(d)} locale={fr} initialFocus /></PopoverContent></Popover>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[32px] bg-white border-none shadow-sm"><CardHeader className="py-4 px-8 bg-slate-50 border-b"><CardTitle className="text-[10px] uppercase font-black text-primary/60">Prescription</CardTitle></CardHeader><CardContent className="p-8"><PrescriptionForm od={prescription.od} og={prescription.og} onChange={(s, f, v) => setPrescription(prev => ({...prev, [s.toLowerCase()]: {...(prev as any)[s.toLowerCase()], [f]: v}}))} /></CardContent></Card>
          </div>

          <Card className="bg-primary text-white rounded-[40px] shadow-2xl overflow-hidden h-fit">
            <CardHeader className="py-6 px-8 text-white/60"><CardTitle className="text-[10px] font-black uppercase">Finances</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="bg-white p-4 rounded-2xl flex justify-between items-center"><Label className="text-[10px] font-black text-primary uppercase">Prix Brut</Label><input type="number" className="bg-transparent text-right font-black text-slate-950 outline-none text-lg w-24" placeholder="---" value={total === "0" ? "" : total} onChange={e => setTotal(e.target.value)} /></div>
              <div className="bg-white/10 p-4 rounded-2xl flex justify-between items-center"><Label className="text-[10px] font-black uppercase">Remise (DH)</Label><input type="number" className="bg-transparent text-right font-black text-white outline-none text-lg w-24" placeholder="---" value={discountValue === "0" ? "" : discountValue} onChange={e => setDiscountValue(e.target.value)} /></div>
              <div className="bg-white p-4 rounded-2xl flex justify-between items-center"><Label className="text-[10px] font-black text-primary uppercase">Versé ce jour</Label><input type="number" className="bg-transparent text-right font-black text-slate-950 outline-none text-lg w-24" placeholder="---" value={avance === "0" ? "" : avance} onChange={e => setAvance(e.target.value)} /></div>
              <div className="bg-slate-900 p-6 rounded-3xl text-center space-y-1"><p className="text-[9px] font-black text-white/40 uppercase">Reste à payer</p><p className="text-3xl font-black text-accent">{formatCurrency(resteAPayerValue)}</p></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewSalePage() { return <Suspense fallback={null}><NewSaleForm /></Suspense>; }
