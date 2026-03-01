
"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Upload, CheckCircle2, Zap, CalendarDays } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, setDoc, query, getDocs, getDoc, where, limit, increment, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format, setHours, setMinutes, setSeconds } from "date-fns";

type Mapping = Record<string, string>;

export default function ImportPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase();
    if (savedRole !== 'ADMIN' && savedRole !== 'PREPA') {
      router.push('/dashboard');
    } else {
      setRole(savedRole || "");
      setLoadingRole(false);
    }
  }, [router]);
  
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentDayLabel, setCurrentDayLabel] = useState("");
  const [startingBalance, setStartingBalance] = useState<string>("0");

  const GLOBAL_FIELDS = [
    { key: "clientName", label: "Nom Client (Vente)", section: "VENTES" },
    { key: "total", label: "Total Brut (Vente)", section: "VENTES" },
    { key: "avance", label: "Avance Payée (Vente)", section: "VENTES" },
    { key: "historicalAdvance", label: "Avance Antérieure (Vente)", section: "VENTES" },
    { key: "label", label: "Libellé (Dépense)", section: "CHARGES" },
    { key: "supplierName", label: "Nom Client / Tiers (Dépense)", section: "CHARGES" },
    { key: "montant", label: "Montant (Dépense)", section: "CHARGES" },
    { key: "category", label: "Catégorie / Dépense", section: "CHARGES" }
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
          setWorkbook(wb);
          
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          if (jsonData.length > 0) {
            setHeaders(Object.keys(jsonData[0] as object));
          }
        } catch (err) {
          toast({ variant: "destructive", title: "Erreur de lecture du fichier Excel" });
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const cleanNum = (val: any): number => {
    if (val === undefined || val === null || val === "" || typeof val === 'object') return 0;
    const s = val.toString().replace(/\s/g, '').replace(',', '.');
    const p = parseFloat(s);
    return isNaN(p) ? 0 : p;
  };

  const handleImportGlobal = async () => {
    if (!workbook || !file) return;
    
    const freshRole = localStorage.getItem('user_role')?.toUpperCase();
    if (!freshRole) {
      toast({ variant: "destructive", title: "Session expirée" });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    
    const currentIsDraft = freshRole === 'PREPA';
    const userName = user?.displayName || "Import Automatique";
    let currentBalance = cleanNum(startingBalance);

    // Initialisation des compteurs pour des IDs propres (FC-2026-0001)
    const counterDocPath = currentIsDraft ? "counters_draft" : "counters";
    const counterRef = doc(db, "settings", counterDocPath);
    const counterSnap = await getDoc(counterRef);
    let globalCounters = { fc: 0, rc: 0 };
    if (counterSnap.exists()) {
      globalCounters = counterSnap.data() as any;
    }

    // Tri numérique des feuilles
    const sheetNames = [...workbook.SheetNames].sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '')) || 0;
      const nb = parseInt(b.replace(/\D/g, '')) || 0;
      return na - nb;
    });

    const importSessionClients = new Map<string, string>();

    try {
      for (let s = 0; s < sheetNames.length; s++) {
        const sheetName = sheetNames[s];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
        
        // Extraction robuste du jour
        let day = s + 1;
        const sheetNumbers = sheetName.match(/\d+/g);
        if (sheetNumbers && sheetNumbers.length > 0) {
          const potentialDay = parseInt(sheetNumbers[sheetNumbers.length - 1]);
          if (potentialDay >= 1 && potentialDay <= 31) day = potentialDay;
        }
        day = Math.min(31, Math.max(1, day));

        const dateStr = `2026-01-${day.toString().padStart(2, '0')}`;
        setCurrentDayLabel(`Jour ${day}`);
        
        const currentDate = new Date(2026, 0, day); 
        const sessionId = currentIsDraft ? `DRAFT-${dateStr}` : dateStr;

        let daySalesTotal = 0;
        let dayExpensesTotal = 0;
        let dayVersementsTotal = 0;
        const initialBalance = currentBalance;

        const sessionRef = doc(db, "cash_sessions", sessionId);
        const openTime = Timestamp.fromDate(setSeconds(setMinutes(setHours(currentDate, 10), 0), 0));
        const closeTime = Timestamp.fromDate(setSeconds(setMinutes(setHours(currentDate, 20), 0), 0));
        
        await setDoc(sessionRef, {
          date: dateStr,
          isDraft: currentIsDraft,
          status: "OPEN",
          openedAt: openTime,
          openedBy: userName,
          openingBalance: initialBalance
        }, { merge: true });

        for (const row of rawData) {
          try {
            const clientNameRaw = row[mapping.clientName];
            const totalRaw = row[mapping.total];
            
            if (clientNameRaw && totalRaw !== undefined) {
              const clientName = clientNameRaw.toString().trim();
              const totalVal = cleanNum(totalRaw);
              const currentAvance = cleanNum(row[mapping.avance]);
              const historicalAvance = cleanNum(row[mapping.historicalAdvance]);
              const totalAvance = currentAvance + historicalAvance;
              
              const isPaid = totalAvance >= totalVal;
              const prefix = currentIsDraft ? "PREPA-" : "";
              
              // Génération d'ID séquentiel propre
              if (isPaid) globalCounters.fc++; else globalCounters.rc++;
              const docType = isPaid ? "FC" : "RC";
              const seqNum = isPaid ? globalCounters.fc : globalCounters.rc;
              const invoiceId = `${prefix}${docType}-2026-${seqNum.toString().padStart(4, '0')}`;

              const normalizedName = clientName.toUpperCase().trim();
              if (!importSessionClients.has(normalizedName)) {
                const clientQ = query(
                  collection(db, "clients"), 
                  where("name", "==", clientName), 
                  where("isDraft", "==", currentIsDraft), 
                  limit(1)
                );
                const clientSnap = await getDocs(clientQ);
                
                if (clientSnap.empty) {
                  const newClientRef = doc(collection(db, "clients"));
                  await setDoc(newClientRef, {
                    name: clientName, phone: "", mutuelle: "Aucun",
                    lastVisit: format(currentDate, "dd/MM/yyyy"),
                    ordersCount: 1, isDraft: currentIsDraft, createdAt: openTime
                  }, { merge: true });
                  importSessionClients.set(normalizedName, newClientRef.id);
                } else {
                  const existingRef = clientSnap.docs[0].ref;
                  await setDoc(existingRef, { 
                    ordersCount: increment(1), 
                    lastVisit: format(currentDate, "dd/MM/yyyy"),
                    isDraft: currentIsDraft
                  }, { merge: true });
                  importSessionClients.set(normalizedName, clientSnap.docs[0].id);
                }
              }

              const saleRef = doc(collection(db, "sales"));
              await setDoc(saleRef, {
                invoiceId, clientName, total: totalVal, 
                avance: totalAvance, reste: Math.max(0, totalVal - totalAvance),
                statut: isPaid ? "Payé" : "Partiel",
                isDraft: currentIsDraft, createdAt: openTime, createdBy: userName,
                payments: [
                  { amount: historicalAvance, date: currentDate.toISOString(), userName: "Historique", note: "Ancien" },
                  { amount: currentAvance, date: currentDate.toISOString(), userName: "Import", note: "Journée" }
                ]
              }, { merge: true });

              if (currentAvance > 0) {
                const transRef = doc(collection(db, "transactions"));
                await setDoc(transRef, {
                  type: "VENTE", label: `VENTE ${invoiceId}`, clientName: clientName,
                  montant: currentAvance, isDraft: currentIsDraft, createdAt: openTime, 
                  userName, relatedId: invoiceId
                }, { merge: true });
                daySalesTotal += currentAvance;
              }
            }

            const expenseVal = cleanNum(row[mapping.montant]);
            const labelRaw = row[mapping.label];
            const supplierRaw = row[mapping.supplierName];
            const expenseCategoryRaw = row[mapping.category]?.toString().trim() || "";

            if (expenseVal > 0) {
              let rawLabel = labelRaw ? labelRaw.toString().trim() : (supplierRaw ? supplierRaw.toString().trim() : "Opération");
              const upperLabel = rawLabel.toUpperCase();
              const upperCat = expenseCategoryRaw.toUpperCase();

              const isVersement = upperLabel.includes("VERSE") || upperLabel.includes("BANQUE") || 
                                 upperCat.includes("VERSE") || upperCat.includes("BANQUE") || 
                                 upperLabel.includes("VERS ");
              
              const isAchatVerres = upperLabel.includes("VERRE") || upperCat.includes("VERRE");
              const isAchatMonture = upperLabel.includes("MONTURE") || upperCat.includes("MONTURE");
              
              let type = "DEPENSE";
              let finalLabel = rawLabel;
              
              if (isVersement) {
                type = "VERSEMENT";
              } else if (isAchatVerres) {
                if (!upperLabel.startsWith("ACHAT VERRES")) finalLabel = `ACHAT VERRES - ${rawLabel}`;
              } else if (isAchatMonture) {
                if (!upperLabel.startsWith("ACHAT MONTURE")) finalLabel = `ACHAT MONTURE - ${rawLabel}`;
              }

              const transRef = doc(collection(db, "transactions"));
              await setDoc(transRef, {
                type: type, 
                label: finalLabel, 
                clientName: supplierRaw ? supplierRaw.toString().trim() : "",
                category: expenseCategoryRaw || (isVersement ? "Banque" : "Général"), 
                montant: -Math.abs(expenseVal), 
                isDraft: currentIsDraft, 
                createdAt: openTime, 
                userName
              }, { merge: true });

              if (type === "VERSEMENT") dayVersementsTotal += expenseVal;
              else dayExpensesTotal += expenseVal;
            }
          } catch (rowErr) {
            console.warn("Ligne ignorée", rowErr);
          }
        }

        currentBalance = initialBalance + daySalesTotal - dayExpensesTotal - dayVersementsTotal;

        await setDoc(sessionRef, {
          status: "CLOSED", closedAt: closeTime, closedBy: userName,
          totalSales: daySalesTotal, totalExpenses: dayExpensesTotal, totalVersements: dayVersementsTotal,
          closingBalanceReal: currentBalance, closingBalanceTheoretical: currentBalance, discrepancy: 0,
          isDraft: currentIsDraft
        }, { merge: true });

        setProgress(Math.round(((s + 1) / sheetNames.length) * 100));
      }

      // Mise à jour finale des compteurs globaux pour la suite manuelle
      await setDoc(counterRef, globalCounters, { merge: true });

      toast({ variant: "success", title: "Terminé", description: "Le mois de Janvier a été traité avec succès." });
      router.push("/caisse/sessions");
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur critique lors de l'importation" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Automate de Saisie Historique</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Importation Janvier : Ventes + Charges + Clients + Caisse.</p>
          </div>
          <div className="flex gap-2">
             <Badge variant="outline" className="h-12 rounded-xl font-black text-[10px] uppercase shadow-sm px-6 bg-white border-primary/20 text-primary"><Zap className="mr-2 h-4 w-4" /> MODE GLOBAL JANVIER</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-2"><CalendarDays className="h-4 w-4" /> 1. Solde de départ</CardTitle></CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Caisse au 01/01/2026 (DH)</Label>
                <Input type="number" className="h-14 rounded-2xl font-black text-xl text-center bg-slate-50 border-none shadow-inner" value={startingBalance} onChange={e => setStartingBalance(e.target.value)} />
              </div>
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"><p className="text-[9px] font-bold text-blue-800 leading-relaxed uppercase"><CheckCircle2 className="h-3 w-3 inline mr-1 mb-0.5" /> Les clients seront automatiquement créés de manière étanche.</p></div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-2"><Upload className="h-4 w-4" /> 2. Fichier Excel Janvier</CardTitle></CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[32px] bg-slate-50/30 p-10 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                <div className="h-20 w-20 bg-primary/10 rounded-[24px] flex items-center justify-center mb-4 shadow-inner"><FileSpreadsheet className="h-10 w-10 text-primary" /></div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{file ? file.name : "Sélectionner le fichier"}</h3>
                {workbook && (<p className="text-[9px] font-black text-green-600 mt-2 uppercase bg-green-50 px-3 py-1 rounded-full border border-green-100">{workbook.SheetNames.length} JOURNÉES DÉTECTÉES</p>)}
              </div>
            </CardContent>
          </Card>
        </div>

        {workbook && (
          <Card className="rounded-[32px] border-none shadow-2xl bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl font-black uppercase flex items-center gap-4 tracking-tighter">Configuration du Mapping</CardTitle>
                <div className="bg-white/20 px-4 py-2 rounded-full font-black text-xs uppercase">{isProcessing ? `${currentDayLabel} : ${progress}%` : "Prêt"}</div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                {GLOBAL_FIELDS.map(field => (
                  <div key={field.key} className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">{field.label}</Label>
                      <Badge variant="outline" className="text-[8px] font-black border-slate-200">{field.section}</Badge>
                    </div>
                    <Select value={mapping[field.key] || ""} onValueChange={(v) => setMapping({...mapping, [field.key]: v})}>
                      <SelectTrigger className="h-14 rounded-2xl font-black text-slate-900 border-none bg-slate-50 shadow-inner px-6"><SelectValue placeholder="Choisir colonne..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl">{headers.map(h => <SelectItem key={h} value={h} className="font-black text-xs">{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleImportGlobal} disabled={isProcessing || Object.keys(mapping).length < 4} className="w-full h-20 rounded-[24px] font-black text-xl shadow-2xl bg-primary mt-12 hover:scale-[1.01] transition-transform group">
                {isProcessing ? (
                  <div className="flex items-center gap-4"><Loader2 className="h-8 w-8 animate-spin" /><span>IMPORTATION EN COURS...</span></div>
                ) : (
                  <div className="flex items-center gap-4"><Zap className="h-8 w-8 group-hover:animate-pulse" /><span>LANCER L'AUTOMATE POUR LE MOIS DE JANVIER</span></div>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
