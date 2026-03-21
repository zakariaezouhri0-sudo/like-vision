
"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { ShoppingBag, Save, Loader2, User, Phone, FileText, Printer, AlertTriangle, Calculator, HandCoins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn, roundAmount, formatPhoneNumber, parseAmount, sendWhatsApp } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp, runTransaction, Timestamp, query, where, limit, getDocs } from "firebase/firestore";
import { format, isValid } from "date-fns";
import { MUTUELLES } from "@/lib/constants";

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

  const [notes, setNotes] = useState(searchParams.get("notes") || "");
  const [total, setTotal] = useState<string>(searchParams.get("total") ? formatCurrency(searchParams.get("total")!) : "");

  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>(
    (searchParams.get("discountType") as 'fixed' | 'percent') || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState<string>(searchParams.get("discountValue") ? (searchParams.get("discountType") === 'percent' ? searchParams.get("discountValue")! : formatCurrency(searchParams.get("discountValue")!)) : "");
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

    if (nameSearch.length >= 3 && !selectedClientId) {
      return query(
        collection(db, "clients"),
        where("isDraft", "==", currentIsDraft),
        where("name", ">=", nameSearch),
        where("name", "<=", nameSearch + "\uf8ff"),
        limit(10)
      );
    }

    return null;
  }, [db, clientPhone, clientName, isPrepaMode, selectedClientId]);

  const { data: matchedClients } = useCollection(clientsQuery);

  const handleSelectMember = (client: any) => {
    if (!client) return;
    setClientName(client.name || "");
    setClientPhone(client.phone || clientPhone);
    setSelectedClientId(client.id || null);
    setIsFamilyMode(false);
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

  // Logic: Auto-fill if exactly 1 client found by phone or by name
  useEffect(() => {
    if (!activeEditId && matchedClients && matchedClients.length === 1 && !selectedClientId && !isFamilyMode) {
      const isPhoneSearch = clientPhone.replace(/\s/g, "").length >= 8;
      const isNameSearch = clientName.trim().length >= 3;
      
      if (isPhoneSearch || isNameSearch) {
        handleSelectMember(matchedClients[0]);
      }
    }
  }, [matchedClients, clientPhone, clientName, selectedClientId, isFamilyMode, activeEditId]);

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
      if (!isFamilyMode) {
        setClientName("");
        setMutuelle("Aucun");
        setCustomMutuelle("");
      }
      setSelectedClientId(null);
      return;
    }
    if (raw.length > 10) return;
    if (raw.length >= 1 && raw[0] !== '0') return;
    if (raw.length >= 2 && !['6', '7', '8'].includes(raw[1])) return;
    setClientPhone(raw);
    setSelectedClientId(null);
  };

  const handleToggleFamilyMode = (checked: boolean) => {
    setIsFamilyMode(checked);
    if (checked) {
      setSelectedClientId(null);
      setClientName(""); 
      toast({ title: "Mode Parrainage Activé", description: "Veuillez saisir le nom du nouveau membre." });
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
      const isDuplicate = bonCheckSnap.docs.some(d => (activeEditId ? d.id !== activeEditId : true) && d.data().isDraft === currentIsDraft);

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
          mutuelle: finalMutuelle, notes, total: nTotal, remise: calculatedRemise,
          discountType, discountValue: nDiscountVal, avance: nAvance, reste: resteAPayerValue,
          statut, prescription, isDraft: currentIsDraft, updatedAt: serverTimestamp(), createdAt: Timestamp.fromDate(saleDate)
        };

        if (!activeEditId) {
          saleData.createdBy = currentUserName;
          saleData.payments = nAvance > 0 ? [{ amount: nAvance, date: new Date().toISOString(), userName: currentUserName }] : [];
        }

        transaction.set(saleRef, saleData, { merge: true });

        const clientRef = selectedClientId ? doc(db, "clients", selectedClientId) : doc(collection(db, "clients"));
        transaction.set(clientRef, {
          name: clientName.toUpperCase(), phone: cleanedPhone,
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
      
      if (shouldPrint) {
        const page = resteAPayerValue <= 0 ? 'facture' : 'recu';
        const params = new URLSearchParams({
          client: clientName.toUpperCase(),
          phone: cleanedPhone,
          mutuelle: finalMutuelle,
          total: nTotal.toString(),
          remise: calculatedRemise.toString(),
          avance: nAvance.toString(),
          od_sph: prescription.od.sph, od_cyl: prescription.od.cyl, od_axe: prescription.od.axe, od_add: prescription.od.add,
          og_sph: prescription.og.sph, og_cyl: prescription.og.cyl, og_axe: prescription.og.axe, og_add: prescription.og.add,
          date: format(saleDate, "dd-MM-yyyy")
        });
        router.push(`/ventes/${page}/${invoiceId}?${params.toString()}`);
      } else {
        router.push("/ventes");
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erreur", description: err.message === "SESSION_CLOSED" ? "Caisse clôturée." : "Erreur technique." });
    } finally { setLoading(false); }
  };

  if (!isClientReady) return null;

  return (
    <AppShell>
      <div className="space-y-4 max-w-7xl mx-auto pb-10">
        <div className="flex justify-between items-center px-2">
          <h1 className="text-2xl font-black text-[#0D1B2A] uppercase tracking-tighter flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-[#D4AF37]/40" />
            {activeEditId ? "Modification" : "Nouvelle Vente"}
          </h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSave(true)} className="h-12 px-6 rounded-full font-black text-[10px] uppercase border-[#0D1B2A]/10 bg-white text-[#0D1B2A] shadow-sm hover:bg-slate-50 transition-all" disabled={loading || isReadOnly}><Printer className="mr-2 h-4 w-4 text-[#D4AF37]" /> IMPRIMER</Button>
            <Button onClick={() => handleSave(false)} className="h-12 px-8 rounded-full font-black text-[10px] uppercase shadow-lg bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all" disabled={loading || isReadOnly}>{loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} ENREGISTRER</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-7 space-y-4">
            <Card className="rounded-[40px] border-none shadow-xl overflow-hidden">
              <CardHeader className="py-4 px-6 bg-[#0D1B2A] flex flex-row items-center gap-3">
                <User className="h-5 w-5 text-[#D4AF37]" />
                <CardTitle className="text-sm uppercase font-black text-[#D4AF37] tracking-widest">Dossier Client</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3 bg-[#D4AF37]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1 relative">
                    <Label className="text-[9px] font-black uppercase text-[#0D1B2A] ml-1 tracking-widest">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-3 h-3 w-3 text-[#0D1B2A]/40" />
                      <Input className="h-10 pl-10 rounded-2xl bg-[#0D1B2A] border-none shadow-inner font-black text-sm text-[#D4AF37] placeholder:text-[#D4AF37]/20" value={formatPhoneNumber(clientPhone)} onChange={e => handlePhoneChange(e.target.value)} readOnly={isReadOnly} />
                    </div>
                  </div>
                  <div className="space-y-1 relative">
                    <Label className="text-[9px] font-black uppercase text-[#0D1B2A] ml-1 tracking-widest">Nom Complet</Label>
                    <Input className="h-10 rounded-2xl bg-[#0D1B2A] border-none shadow-inner font-black text-sm uppercase text-[#D4AF37]" value={clientName} onChange={e => { setClientName(e.target.value); setSelectedClientId(null); }} onFocus={() => setIsNameFocused(true)} onBlur={() => setTimeout(() => setIsNameFocused(false), 200)} readOnly={isReadOnly} />
                    {matchedClients?.length > 1 && isNameFocused && (
                      <div className="absolute z-50 w-full mt-1 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                        <div className="bg-slate-50 px-4 py-1.5 border-b"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Membres trouvés</p></div>
                        {matchedClients.map(c => (
                          <button key={c.id} onMouseDown={() => handleSelectMember(c)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b last:border-0 group">
                            <p className="text-[10px] font-black uppercase text-[#0D1B2A] group-hover:text-[#D4AF37] transition-colors">{c.name}</p>
                            <p className="text-[9px] font-bold text-slate-400">{formatPhoneNumber(c.phone)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-[#0D1B2A] ml-1 tracking-widest">N° BON</Label>
                    <Input className={cn("h-10 rounded-2xl bg-[#0D1B2A] border-none shadow-inner font-black text-sm text-[#D4AF37]", bonError && "ring-2 ring-red-500")} value={bonNumber} onChange={e => setBonNumber(e.target.value)} readOnly={isReadOnly} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-[#0D1B2A] ml-1 tracking-widest">Mutuelle</Label>
                    <Select value={mutuelle} onValueChange={setMutuelle} disabled={isReadOnly}>
                      <SelectTrigger className="h-10 rounded-2xl bg-[#0D1B2A] border-none font-black text-[#D4AF37] text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl">{MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-black uppercase text-[10px]">{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-1 border-t border-[#0D1B2A]/5 w-full">
                  <div className="flex items-center space-x-2 bg-[#0D1B2A]/10 px-4 py-2 rounded-full flex-1 justify-center">
                    <Checkbox id="familyMode" checked={isFamilyMode} onCheckedChange={handleToggleFamilyMode} className="h-4 w-4 rounded-md border-[#0D1B2A] data-[state=checked]:bg-[#0D1B2A] data-[state=checked]:text-[#D4AF37]" />
                    <label htmlFor="familyMode" className="text-[10px] font-black uppercase text-[#0D1B2A] cursor-pointer tracking-widest">PARRAINAGE</label>
                  </div>
                  <div className="flex items-center space-x-2 bg-[#0D1B2A]/10 px-4 py-2 rounded-full flex-1 justify-center">
                    <Checkbox id="fromDoctor" checked={fromDoctor} onCheckedChange={(v) => setFromDoctor(!!v)} className="h-4 w-4 rounded-md border-[#0D1B2A] data-[state=checked]:bg-[#0D1B2A] data-[state=checked]:text-[#D4AF37]" disabled={isReadOnly} />
                    <label htmlFor="fromDoctor" className="text-[10px] font-black uppercase text-[#0D1B2A] cursor-pointer tracking-widest">MÉDECIN</label>
                  </div>
                  {mutuelle === "Autre" && (
                    <div className="flex-[2]">
                      <Input className="h-10 w-full rounded-2xl bg-[#0D1B2A] border-none shadow-inner font-black text-xs text-[#D4AF37] px-4 placeholder:text-[#D4AF37]/20" placeholder="Libellé mutuelle..." value={customMutuelle} onChange={e => setCustomMutuelle(e.target.value)} readOnly={isReadOnly} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[40px] bg-white border-none shadow-xl overflow-hidden">
              <CardHeader className="py-4 px-6 bg-[#0D1B2A] flex flex-row items-center gap-3">
                <FileText className="h-5 w-5 text-[#D4AF37]" />
                <CardTitle className="text-sm uppercase font-black text-[#D4AF37] tracking-widest">Prescription</CardTitle>
              </CardHeader>
              <CardContent className="p-6 bg-[#D4AF37] space-y-3">
                <PrescriptionForm od={prescription.od} og={prescription.og} onChange={(s, f, v) => setPrescription(prev => ({...prev, [s.toLowerCase()]: {...(prev as any)[s.toLowerCase()], [f]: v}}))} />
                <div className="space-y-1 pt-2 border-t border-[#0D1B2A]/10">
                  <Label className="text-[9px] font-black uppercase text-[#0D1B2A] ml-1 tracking-widest">Libellé (Désignation)</Label>
                  <Input className="h-10 rounded-2xl bg-[#0D1B2A] border-none shadow-inner font-black text-sm text-[#D4AF37] uppercase placeholder:text-[#D4AF37]/20" value={notes} onChange={e => setNotes(e.target.value)} readOnly={isReadOnly} placeholder="DÉSIGNATION DE LA COMMANDE..." />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5">
            <div className="sticky top-24 space-y-4">
              <Card className="bg-[#0D1B2A] text-white rounded-[40px] shadow-2xl overflow-hidden border-none">
                <CardHeader className="py-4 px-6 border-b border-white/5 flex flex-row items-center gap-3"><Calculator className="h-5 w-5 text-[#D4AF37]" /><CardTitle className="text-sm uppercase font-black text-[#D4AF37] tracking-widest">Calcul Financier</CardTitle></CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="bg-white/5 p-5 rounded-3xl space-y-3">
                    <div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-[#D4AF37] tracking-widest">Prix Brut</Label><input type="text" className="bg-transparent text-right font-black text-xl text-white outline-none w-32 tabular-nums" value={total} onChange={e => setTotal(e.target.value)} onBlur={() => total && setTotal(formatCurrency(parseAmount(total)))} /></div>
                    <div className="space-y-3 pt-3 border-t border-white/5"><div className="flex justify-between items-center"><Label className="text-[10px] font-black uppercase text-white/40 tracking-widest">Remise</Label><div className="flex bg-white/10 p-0.5 rounded-full"><button onClick={() => setDiscountType('fixed')} className={cn("px-2.5 py-0.5 rounded-full text-[8px] font-black transition-all", discountType === 'fixed' ? "bg-[#D4AF37] text-[#0D1B2A] shadow-lg" : "text-white/40 hover:text-white/60")}>DH</button><button onClick={() => setDiscountType('percent')} className={cn("px-2.5 py-0.5 rounded-full text-[8px] font-black transition-all", discountType === 'percent' ? "bg-[#D4AF37] text-[#0D1B2A] shadow-lg" : "text-white/40 hover:text-white/60")}>%</button></div></div><div className="flex justify-between items-center"><Label className="text-[9px] font-black uppercase text-white/20 tracking-widest">Valeur</Label><input type="text" className="bg-transparent text-right font-black text-lg text-white outline-none w-32 tabular-nums" value={discountValue} onChange={e => setDiscountValue(e.target.value)} /></div></div>
                  </div>
                  <div className="bg-white/5 p-5 rounded-3xl"><div className="flex justify-between items-center"><div className="flex items-center gap-2"><HandCoins className="h-4 w-4 text-[#D4AF37]" /><Label className="text-[10px] font-black uppercase text-[#D4AF37] tracking-widest">AVANCE</Label></div><input type="text" className="bg-transparent text-right font-black text-xl text-white outline-none w-32 tabular-nums border-b border-white/10 focus:border-[#D4AF37] transition-colors" value={avance} onChange={e => setAvance(e.target.value)} onBlur={() => avance && setAvance(formatCurrency(parseAmount(avance)))} /></div></div>
                  <div className={cn("p-6 rounded-3xl text-center shadow-inner border-2 transition-all", resteAPayerValue > 0 ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")}><p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1">Reste à Régler</p><p className="text-3xl font-black tabular-nums">{formatCurrency(resteAPayerValue)}</p></div>
                  <Button onClick={() => handleSave(true)} className="w-full h-16 rounded-3xl font-black text-sm uppercase shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-white hover:text-[#0D1B2A] transition-all mt-2" disabled={loading || isReadOnly}>{loading ? <Loader2 className="animate-spin h-5 w-5" /> : <Save className="mr-2 h-5 w-5" />} ENREGISTRER & IMPRIMER</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewSalePage() { return <Suspense fallback={null}><NewSaleForm /></Suspense>; }
