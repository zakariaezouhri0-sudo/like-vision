"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { ShoppingBag, Save, Loader2, User, Phone, ShieldCheck, FileText, Glasses, Printer, Percent, Lock, ClipboardList, Stethoscope, HandCoins, Users, AlertTriangle, Calendar as CalendarIcon, XCircle, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn, roundAmount, formatPhoneNumber, parseAmount, sendWhatsApp } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp, runTransaction, Timestamp, query, where, limit, getDocs } from "firebase/firestore";
import { format, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { MUTUELLES } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

function NewSaleForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();

  const [role, setRole] = useState<string | null>(null);
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [isClientReady, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeEditId] = useState<string | null>(searchParams.get("editId"));

  const [isNameFocused, setIsNameFocused] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    const savedRole = typeof window !== 'undefined' ? localStorage.getItem('user_role')?.toUpperCase() : null;
    const savedMode = typeof window !== 'undefined' ? localStorage.getItem('work_mode') : null;

    if (savedRole) {
      setRole(savedRole);
      setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
      setIsHydrated(true);
    } else {
      router.push('/login');
    }
  }, [router]);

  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";

  const [saleDate, setSaleDate] = useState<Date>(() => {
    const d = searchParams.get("date_raw");
    if (d) {
      const parsed = new Date(d);
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  });

  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  const [bonNumber, setBonNumber] = useState(searchParams.get("bonNumber") || "");
  const [bonError, setBonError] = useState(false);
  const [fromDoctor, setFromDoctor] = useState(searchParams.get("fromDoctor") === "true");
  const [editableInvoiceId, setEditableInvoiceId] = useState(searchParams.get("invoiceId") || "");

  const [isFamilyMode, setIsFamilyMode] = useState(false);

  const [mutuelle, setMutuelle] = useState(() => {
    const m = searchParams.get("mutuelle");
    if (m && m !== "Aucun" && !MUTUELLES.filter(opt => opt !== "Autre").includes(m)) return "Autre";
    return m || "Aucun";
  });
  const [customMutuelle, setCustomMutuelle] = useState(() => {
    const m = searchParams.get("mutuelle");
    if (m && m !== "Aucun" && !MUTUELLES.filter(opt => opt !== "Autre").includes(m)) return m;
    return "";
  });

  const [monture, setMonture] = useState(searchParams.get("monture") || "");
  const [verres, setVerres] = useState(searchParams.get("verres") || "");
  const [notes, setNotes] = useState(searchParams.get("notes") || "");
  const [total, setTotal] = useState<string>(searchParams.get("total") ? formatCurrency(searchParams.get("total")!) : "");

  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>(
    (searchParams.get("discountType") as 'fixed' | 'percent') || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState<string>(searchParams.get("discountValue") ? formatCurrency(searchParams.get("discountValue")!) : "");
  const [avance, setAvance] = useState<string>(searchParams.get("avance") ? formatCurrency(searchParams.get("avance")!) : "");

  const [prescription, setPrescription] = useState({
    od: { sph: searchParams.get("od_sph") || "", cyl: searchParams.get("od_cyl") || "", axe: searchParams.get("od_axe") || "", add: searchParams.get("od_add") || "" },
    og: { sph: searchParams.get("og_sph") || "", cyl: searchParams.get("og_cyl") || "", axe: searchParams.get("og_axe") || "", add: searchParams.get("og_add") || "" }
  });

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings } = useDoc(settingsRef);

  const existingSaleRef = useMemoFirebase(() => activeEditId ? doc(db, "sales", activeEditId) : null, [db, activeEditId]);
  const { data: existingSale, isLoading: saleDataLoading } = useDoc(existingSaleRef);

  useEffect(() => {
    if (existingSale) {
      setClientName(existingSale.clientName || "");
      setClientPhone(existingSale.clientPhone || "");
      setBonNumber(existingSale.bonNumber || "");
      setFromDoctor(!!existingSale.fromDoctor);
      setEditableInvoiceId(existingSale.invoiceId || "");
      setMonture(existingSale.monture || "");
      setVerres(existingSale.verres || "");
      setNotes(existingSale.notes || "");
      setTotal(formatCurrency(existingSale.total || 0));
      setDiscountType(existingSale.discountType || 'fixed');
      setDiscountValue(existingSale.discountType === 'percent' ? (existingSale.discountValue || 0).toString() : formatCurrency(existingSale.discountValue || 0));
      setAvance(formatCurrency(existingSale.avance || 0));

      if (existingSale.prescription) {
        setPrescription({
          od: {
            sph: existingSale.prescription.od?.sph || "",
            cyl: existingSale.prescription.od?.cyl || "",
            axe: existingSale.prescription.od?.axe || "",
            add: existingSale.prescription.od?.add || ""
          },
          og: {
            sph: existingSale.prescription.og?.sph || "",
            cyl: existingSale.prescription.og?.cyl || "",
            axe: existingSale.prescription.og?.axe || "",
            add: existingSale.prescription.og?.add || ""
          }
        });
      }

      if (existingSale.mutuelle) {
        if (MUTUELLES.filter(m => m !== 'Autre').includes(existingSale.mutuelle)) {
          setMutuelle(existingSale.mutuelle);
          setCustomMutuelle("");
        } else {
          setMutuelle("Autre");
          setCustomMutuelle(existingSale.mutuelle);
        }
      }

      if (existingSale.createdAt?.toDate) {
        setSaleDate(existingSale.createdAt.toDate());
      }
    }
  }, [existingSale]);

  const sessionDocId = useMemo(() => {
    if (!isClientReady || !isValid(saleDate)) return null;
    const ds = format(saleDate, "yyyy-MM-dd");
    return isPrepaMode ? `DRAFT-${ds}` : ds;
  }, [isClientReady, saleDate, isPrepaMode]);

  const sessionRef = useMemoFirebase(() => sessionDocId ? doc(db, "cash_sessions", sessionDocId) : null, [db, sessionDocId]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);
  const isSessionClosed = !sessionLoading && sessionData?.status === "CLOSED";
  const isReadOnly = isSessionClosed && !isAdminOrPrepa;

  const clientsQuery = useMemoFirebase(() => {
    const cleanedPhone = (clientPhone || "").replace(/\s/g, "");
    const nameSearch = (clientName || "").trim().toUpperCase();
    const currentIsDraft = isPrepaMode;

    if (cleanedPhone.length >= 8) {
      return query(
        collection(db, "clients"),
        where("isDraft", "==", currentIsDraft),
        where("phone", "==", cleanedPhone),
        limit(10)
      );
    }

    if (nameSearch.length >= 3) {
      return query(
        collection(db, "clients"),
        where("isDraft", "==", currentIsDraft),
        where("name", ">=", nameSearch),
        where("name", "<=", nameSearch + "\uf8ff"),
        limit(10)
      );
    }

    return null;
  }, [db, clientPhone, clientName, isPrepaMode]);

  const { data: matchedClients } = useCollection(clientsQuery);

  const handleSelectMember = (client: any) => {
    if (!client) return;
    setClientName(client.name || "");
    setClientPhone(client.phone || clientPhone);
    setSelectedClientId(client.id || null);

    setIsFamilyMode(!!client.parentPhone);

    if (client.mutuelle) {
      if (MUTUELLES.filter(m => m !== 'Autre').includes(client.mutuelle)) {
        setMutuelle(client.mutuelle);
        setCustomMutuelle("");
      } else {
        setMutuelle("Autre");
        setCustomMutuelle(client.mutuelle);
      }
    }
    setIsNameFocused(false);
  };

  useEffect(() => {
    if (activeEditId || !isClientReady || !matchedClients) return;

    const cleanedPhone = (clientPhone || "").replace(/\s/g, "");
    if (cleanedPhone.length >= 8 && matchedClients.length > 0 && !isFamilyMode) {
      if (matchedClients.length === 1 && !clientName) {
        const found = matchedClients[0];
        setClientName(found.name || "");
        setSelectedClientId(found.id);
        if (found.mutuelle) {
          if (MUTUELLES.filter(m => m !== 'Autre').includes(found.mutuelle)) {
            setMutuelle(found.mutuelle);
            setCustomMutuelle("");
          } else {
            setMutuelle("Autre");
            setCustomMutuelle(found.mutuelle);
          }
        }
      }
    }
  }, [matchedClients, activeEditId, isClientReady, clientName, clientPhone, isFamilyMode]);

  const nTotal = useMemo(() => parseAmount(total), [total]);
  const nDiscountVal = useMemo(() => parseAmount(discountValue), [discountValue]);
  const nAvance = useMemo(() => parseAmount(avance), [avance]);
  const calculatedRemise = useMemo(() => discountType === 'percent' ? roundAmount((nTotal * nDiscountVal) / 100) : roundAmount(nDiscountVal), [nTotal, nDiscountVal, discountType]);
  const totalNetValue = useMemo(() => roundAmount(Math.max(0, nTotal - calculatedRemise)), [nTotal, calculatedRemise]);
  const resteAPayerValue = useMemo(() => roundAmount(Math.max(0, totalNetValue - nAvance)), [totalNetValue, nAvance]);

  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (raw === "") {
      setClientPhone("");
      setMutuelle("Aucun");
      setCustomMutuelle("");
      setIsFamilyMode(false);
      setSelectedClientId(null);
      return;
    }
    if (raw.length > 10) return;
    if (raw.length >= 1 && raw[0] !== '0') return;
    if (raw.length >= 2 && !['6', '7', '8'].includes(raw[1])) return;
    setClientPhone(raw);
  };

  const handleToggleFamilyMode = (checked: boolean) => {
    setIsFamilyMode(checked);
    if (checked) {
      setSelectedClientId(null);
      setClientName("");
      toast({
        title: "Mode Parrainage Activé",
        description: "Saisissez le nom du nouveau membre pour ce numéro."
      });
    }
  };

  const handleSave = async (shouldPrint: boolean = false) => {
    if (sessionLoading || saleDataLoading) return;

    if (isSessionClosed && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "ACTION BLOQUÉE", description: "La caisse est clôturée." });
      return;
    }

    if (!clientName) { toast({ variant: "destructive", title: "Erreur", description: "Nom client obligatoire." }); return; }
    if (!bonNumber && !activeEditId) { toast({ variant: "destructive", title: "Erreur", description: "N° BON obligatoire." }); return; }

    setLoading(true);
    const currentIsDraft = isPrepaMode;

    try {
      const bonCheckQuery = query(collection(db, "sales"), where("bonNumber", "==", bonNumber.trim()));
      const bonCheckSnap = await getDocs(bonCheckQuery);
      const isDuplicate = bonCheckSnap.docs.some(d => {
        if (activeEditId && d.id === activeEditId) return false;
        return d.data().isDraft === currentIsDraft;
      });

      if (isDuplicate) {
        setBonError(true);
        toast({ variant: "destructive", title: "Erreur", description: "Ce Numéro de Bon existe déjà !" });
        setLoading(false);
        return;
      }
      setBonError(false);

      const currentUserName = user?.displayName || "Inconnu";
      const finalMutuelle = mutuelle === "Autre" ? (customMutuelle || "Autre") : (mutuelle || "Aucun");
      const cleanedPhone = (clientPhone || "").replace(/\s/g, "");
      let finalInvoiceIdForURL = "";

      await runTransaction(db, async (transaction) => {
        if (sessionRef && !isAdminOrPrepa) {
          const sessionSnap = await transaction.get(sessionRef);
          if (sessionSnap.exists() && sessionSnap.data().status === "CLOSED") throw new Error("SESSION_CLOSED");
        }

        const saleRef = activeEditId ? doc(db, "sales", activeEditId) : doc(collection(db, "sales"));
        const isPaid = resteAPayerValue <= 0;
        const statut = isPaid ? "Payé" : (nAvance > 0 ? "Partiel" : "En attente");
        let invoiceId = editableInvoiceId || "";

        if (!activeEditId) {
          const prefix = isPaid ? "FC" : "RC";
          invoiceId = `${prefix}-2026-${bonNumber}`;
        } else if (isPaid && invoiceId.startsWith("RC-")) {
          invoiceId = invoiceId.replace("RC-", "FC-");
        }

        const saleData: any = {
          invoiceId, bonNumber, fromDoctor, clientName: clientName.toUpperCase(), clientPhone: cleanedPhone,
          mutuelle: finalMutuelle, monture, verres, notes, total: nTotal, remise: calculatedRemise,
          discountType, discountValue: nDiscountVal, avance: nAvance, reste: resteAPayerValue,
          statut, prescription, isDraft: currentIsDraft, updatedAt: serverTimestamp(), createdAt: Timestamp.fromDate(saleDate)
        };

        if (!activeEditId) {
          saleData.createdBy = currentUserName;
          saleData.payments = nAvance > 0 ? [{ amount: nAvance, date: new Date().toISOString(), userName: currentUserName }] : [];
        }

        transaction.set(saleRef, saleData, { merge: true });
        finalInvoiceIdForURL = invoiceId;

        const clientRef = selectedClientId ? doc(db, "clients", selectedClientId) : doc(collection(db, "clients"));
        transaction.set(clientRef, {
          name: clientName.toUpperCase(), phone: cleanedPhone, parentPhone: isFamilyMode ? cleanedPhone : "",
          mutuelle: finalMutuelle, lastVisit: format(new Date(), "dd/MM/yyyy"), isDraft: currentIsDraft, updatedAt: serverTimestamp()
        }, { merge: true });

        if (nAvance > 0 && !activeEditId) {
          transaction.set(doc(collection(db, "transactions")), {
            type: "VENTE", label: `VENTE ${invoiceId}`, clientName: clientName.toUpperCase(),
            montant: nAvance, relatedId: invoiceId, saleId: saleRef.id, userName: currentUserName, isDraft: currentIsDraft, createdAt: serverTimestamp()
          });
        }
      });

      toast({ variant: "success", title: "Enregistré avec succès" });
      if (cleanedPhone && !activeEditId) {
        const template = settings?.whatsappDarija;
        sendWhatsApp(cleanedPhone, (template || "").replace(/\[Nom\]/gi, clientName.toUpperCase()));
      }
      router.push("/ventes");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message === "SESSION_CLOSED" ? "Caisse clôturée." : "Erreur technique." });
    } finally { setLoading(false); }
  };

  if (!isClientReady) return null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-24">
        <div className="flex justify-between items-center px-2">
          <div>
            <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter flex items-center gap-4">
              <ShoppingBag className="h-8 w-8 text-[#D4AF37]/40" />
              {activeEditId ? "Modification" : "Nouvelle Vente"}
            </h1>
            <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">Enregistrement de commande luxury.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSave(true)} className="h-12 rounded-full font-black text-[10px] px-8 border-[#0D1B2A]/10 text-[#0D1B2A]" disabled={loading || isReadOnly}><Printer className="mr-2 h-4 w-4 text-[#D4AF37]" /> IMPRIMER</Button>
            <Button onClick={() => handleSave(false)} className="h-12 rounded-full font-black text-[10px] px-10 shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all" disabled={loading || isReadOnly}>{loading ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" /> } ENREGISTRER</Button>
          </div>
        </div>

        {isSessionClosed && (
          <div className={cn("p-8 rounded-[60px] flex items-center gap-6 shadow-2xl border-l-[16px]", isAdminOrPrepa ? "bg-white border-l-orange-500" : "bg-red-50 border-l-destructive")}>
            <AlertTriangle className={cn("h-12 w-12", isAdminOrPrepa ? "text-orange-500" : "text-red-600")} />
            <p className="font-black uppercase text-xl text-[#0D1B2A] tracking-tight">Attention : Session Clôturée. {isAdminOrPrepa ? "Modification autorisée (Admin)." : "Action bloquée."}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-8">
            <Card className="rounded-[60px] bg-white border-none shadow-xl shadow-slate-200/50 overflow-hidden">
              <CardHeader className="py-8 px-10 bg-[#0D1B2A] flex flex-row items-center gap-4">
                <User className="h-8 w-8 text-[#D4AF37]" />
                <CardTitle className="text-xl uppercase font-black text-[#D4AF37] tracking-widest">Dossier Client</CardTitle>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-5 top-4 h-4 w-4 text-[#D4AF37]" />
                      <Input className="h-14 pl-12 rounded-[24px] bg-slate-50 border-none shadow-inner font-black text-lg" value={formatPhoneNumber(clientPhone)} onChange={e => handlePhoneChange(e.target.value)} readOnly={isReadOnly} />
                    </div>
                    <div className="flex items-center space-x-2 mt-2 px-2">
                      <Checkbox id="familyMode" checked={isFamilyMode} onCheckedChange={handleToggleFamilyMode} />
                      <label htmlFor="familyMode" className="text-[10px] font-black uppercase text-orange-600 cursor-pointer">PARRAINAGE / FAMILLE</label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Nom Complet</Label>
                    <Input className="h-14 rounded-[24px] bg-slate-50 border-none shadow-inner font-black text-lg uppercase" value={clientName} onChange={e => setClientName(e.target.value)} onFocus={() => setIsNameFocused(true)} onBlur={() => setTimeout(() => setIsNameFocused(false), 200)} readOnly={isReadOnly} />
                    {matchedClients?.length > 0 && isNameFocused && (
                      <div className="absolute z-50 w-full max-w-xs mt-2 bg-white rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden">
                        {matchedClients.map(c => (
                          <button key={c.id} onClick={() => handleSelectMember(c)} className="w-full text-left px-6 py-4 hover:bg-slate-50 transition-colors border-b last:border-0">
                            <p className="text-xs font-black uppercase">{c.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">{formatPhoneNumber(c.phone)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">N° BON</Label>
                    <Input className={cn("h-14 rounded-[24px] bg-slate-50 border-none shadow-inner font-black text-xl text-[#0D1B2A]", bonError && "ring-2 ring-red-500")} value={bonNumber} onChange={e => setBonNumber(e.target.value)} readOnly={isReadOnly} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Mutuelle</Label>
                    <Select value={mutuelle} onValueChange={setMutuelle} disabled={isReadOnly}>
                      <SelectTrigger className="h-14 rounded-[24px] bg-slate-50 border-none font-black"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-[32px]">{MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-black uppercase text-[10px]">{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {mutuelle === "Autre" && <div className="space-y-3"><Label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Libellé Mutuelle</Label><Input className="h-14 rounded-[24px] bg-slate-50 border-none font-black" value={customMutuelle} onChange={e => setCustomMutuelle(e.target.value)} readOnly={isReadOnly} /></div>}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[60px] bg-white border-none shadow-xl shadow-slate-200/50 overflow-hidden">
              <CardHeader className="py-8 px-10 bg-[#0D1B2A] flex flex-row items-center gap-4">
                <FileText className="h-8 w-8 text-[#D4AF37]" />
                <CardTitle className="text-xl uppercase font-black text-[#D4AF37] tracking-widest">Prescription</CardTitle>
              </CardHeader>
              <CardContent className="p-10">
                <PrescriptionForm od={prescription.od} og={prescription.og} onChange={(s, f, v) => setPrescription(prev => ({...prev, [s.toLowerCase()]: {...(prev as any)[s.toLowerCase()], [f]: v}}))} />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <Card className="bg-[#0D1B2A] text-white rounded-[60px] shadow-2xl overflow-hidden sticky top-24">
              <CardHeader className="py-8 px-10 border-b border-white/5 flex flex-row items-center gap-4">
                <Calculator className="h-8 w-8 text-[#D4AF37]" />
                <CardTitle className="text-xl uppercase font-black text-[#D4AF37] tracking-widest">Calcul Financier</CardTitle>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                <div className="bg-white/5 p-8 rounded-[40px] space-y-6">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-black uppercase text-[#D4AF37] tracking-widest">Prix Brut</Label>
                    <input 
                      type="text" 
                      className="bg-transparent text-right font-black text-4xl text-white outline-none w-48 tabular-nums" 
                      value={total} 
                      onChange={e => setTotal(e.target.value)} 
                      onBlur={() => total && setTotal(formatCurrency(parseAmount(total)))} 
                    />
                  </div>
                  
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-black uppercase text-white/40 tracking-widest">Type Remise</Label>
                      <div className="flex bg-white/10 p-1.5 rounded-full">
                        <button 
                          onClick={() => setDiscountType('fixed')} 
                          className={cn("px-6 py-2 rounded-full text-xs font-black transition-all", discountType === 'fixed' ? "bg-[#D4AF37] text-[#0D1B2A] shadow-lg" : "text-white/40 hover:text-white/60")}
                        >
                          DH
                        </button>
                        <button 
                          onClick={() => setDiscountType('percent')} 
                          className={cn("px-6 py-2 rounded-full text-xs font-black transition-all", discountType === 'percent' ? "bg-[#D4AF37] text-[#0D1B2A] shadow-lg" : "text-white/40 hover:text-white/60")}
                        >
                          %
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-black uppercase text-white/40 tracking-widest">Valeur Remise</Label>
                      <input 
                        type="text" 
                        className="bg-transparent text-right font-black text-3xl text-white outline-none w-48 tabular-nums" 
                        value={discountValue} 
                        onChange={e => setDiscountValue(e.target.value)} 
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[#D4AF37] p-10 rounded-[40px] text-[#0D1B2A] text-center shadow-2xl transform hover:scale-[1.02] transition-all">
                  <p className="text-xs font-black uppercase tracking-[0.3em] mb-3 opacity-60">Total Net à Payer</p>
                  <p className="text-5xl font-black tabular-nums tracking-tighter">{formatCurrency(totalNetValue)}</p>
                </div>

                <div className="bg-white/5 p-8 rounded-[40px] space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <HandCoins className="h-5 w-5 text-[#D4AF37]" />
                      <Label className="text-xs font-black uppercase text-[#D4AF37] tracking-widest">Versé ce jour</Label>
                    </div>
                    <input 
                      type="text" 
                      className="bg-transparent text-right font-black text-3xl text-white outline-none w-48 tabular-nums border-b border-white/10 focus:border-[#D4AF37] transition-colors" 
                      value={avance} 
                      onChange={e => setAvance(e.target.value)} 
                      onBlur={() => avance && setAvance(formatCurrency(parseAmount(avance)))} 
                    />
                  </div>
                </div>

                <div className={cn(
                  "p-10 rounded-[40px] text-center shadow-inner border-2 transition-all", 
                  resteAPayerValue > 0 
                    ? "bg-red-500/10 border-red-500/20 text-red-400" 
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                )}>
                  <p className="text-xs font-black uppercase tracking-[0.3em] mb-2">Reste à Régler</p>
                  <p className="text-4xl font-black tabular-nums">{formatCurrency(resteAPayerValue)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewSalePage() { return <Suspense fallback={null}><NewSaleForm /></Suspense>; }
