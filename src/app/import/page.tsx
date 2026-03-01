
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
  const [startingBalance, setStartingBalance] = useState<string>("");

  const GLOBAL_FIELDS = [
    { key: "clientName", label: "Nom Client (Vente)", section: "VENTES" },
    { key: "total", label: "Total Brut (Vente)", section: "VENTES" },
    { key: "avance", label: "Avance Payée (Vente)", section: "VENTES" },
    { key: "historicalAdvance", label: "Avance Antérieure (Vente)", section: "VENTES" },
    { key: "label", label: "Libellé (Opération)", section: "FLUX" },
    { key: "montant", label: "Montant (Dépense/Charge)", section: "FLUX" },
    { key: "versement", label: "Montant (Versement)", section: "FLUX" }
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
    if (!freshRole) return;

    setIsProcessing(true);
    const currentIsDraft = freshRole === 'PREPA';
    const userName = user?.displayName || "Import Automatique";
    let currentBalance = cleanNum(startingBalance);

    const counterDocPath = currentIsDraft ? "counters_draft" : "counters";
    const counterRef = doc(db, "settings", counterDocPath);
    const counterSnap = await getDoc(counterRef);
    let globalCounters = { fc: 0, rc: 0 };
    if (counterSnap.exists()) globalCounters = counterSnap.data() as any;

    const sheetNames = [...workbook.SheetNames];
    const importSessionClients = new Map<string, string>();

    try {
      for (let s = 0; s < sheetNames.length; s++) {
        const sheetName = sheetNames[s];
        const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
        
        // Extraction précise du jour depuis le nom de la feuille
        let dayNum = null;
        const matches = sheetName.toString().match(/\d+/g);
        if (matches) {
          const num = parseInt(matches[matches.length - 1]);
          if (num >= 1 && num <= 31) dayNum = num;
        }
        if (!dayNum) dayNum = (s + 1 <= 31) ? s + 1 : null;
        if (!dayNum) continue;

        const dateStr = `2026-01-${dayNum.toString().padStart(2, '0')}`;
        setCurrentDayLabel(`${dayNum} Janvier`);
        
        const currentDate = new Date(2026, 0, dayNum); 
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
          // 1. TRAITEMENT DES VENTES
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
            
            if (isPaid) globalCounters.fc++; else globalCounters.rc++;
            const docType = isPaid ? "FC" : "RC";
            const seqNum = isPaid ? globalCounters.fc : globalCounters.rc;
            const invoiceId = `${prefix}${docType}-2026-${seqNum.toString().padStart(4, '0')}`;

            const normalizedName = clientName.toUpperCase().trim();
            if (!importSessionClients.has(normalizedName)) {
              const clientQ = query(collection(db, "clients"), where("name", "==", clientName), where("isDraft", "==", currentIsDraft), limit(1));
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
                { amount: historicalAvance, date: currentDate.toISOString(), userName: "Historique", note: "Avance antérieure" },
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

          // 2. TRAITEMENT DES DÉPENSES
          const expenseVal = cleanNum(row[mapping.montant]);
          if (expenseVal > 0) {
            const labelRaw = row[mapping.label] || "Dépense Import";
            const transRef = doc(collection(db, "transactions"));
            await setDoc(transRef, {
              type: "DEPENSE", label: labelRaw.toString().trim(), 
              montant: -Math.abs(expenseVal), isDraft: currentIsDraft, 
              createdAt: openTime, userName
            }, { merge: true });
            dayExpensesTotal += expenseVal;
          }

          // 3. TRAITEMENT DES VERSEMENTS
          const versementVal = cleanNum(row[mapping.versement]);
          if (versementVal > 0) {
            const labelRaw = row[mapping.label] || "Versement Import";
            const transRef = doc(collection(db, "transactions"));
            await setDoc(transRef, {
              type: "VERSEMENT", label: labelRaw.toString().trim(), 
              montant: -Math.abs(versementVal), isDraft: currentIsDraft, 
              createdAt: openTime, userName
            }, { merge: true });
            dayVersementsTotal += versementVal;
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

      await setDoc(counterRef, globalCounters, { merge: true });
      toast({ variant: "success", title: "Terminé", description: "Le mois de Janvier a été traité avec distinction des Versements." });
      router.push("/caisse/sessions");
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de l'importation" });
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
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Automate Historique</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Importation directe avec séparation Versements/Charges.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 rounded-[32px] bg-white overflow-hidden shadow-lg border-none">
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">1. Solde Initial (01/01)</CardTitle></CardHeader>
            <CardContent className="p-6">
              <Input type="number" className="h-14 rounded-2xl font-black text-xl text-center bg-slate-50 border-none shadow-inner" placeholder="Saisir solde départ..." value={startingBalance === "0" ? "" : startingBalance} onChange={e => setStartingBalance(e.target.value)} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 rounded-[32px] bg-white overflow-hidden shadow-lg border-none">
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">2. Sélection Fichier</CardTitle></CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[32px] p-10 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4"><FileSpreadsheet className="h-8 w-8 text-primary" /></div>
                <h3 className="text-sm font-black text-slate-800 uppercase">{file ? file.name : "Sélectionner le fichier"}</h3>
                {workbook && (<p className="text-[9px] font-black text-green-600 mt-2 uppercase bg-green-50 px-3 py-1 rounded-full">{workbook.SheetNames.length} FEUILLES TROUVÉES</p>)}
              </div>
            </CardContent>
          </Card>
        </div>

        {workbook && (
          <Card className="rounded-[32px] bg-white overflow-hidden shadow-2xl border-none">
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-black uppercase">Mapping des Colonnes</CardTitle>
                <div className="bg-white/20 px-4 py-2 rounded-full font-black text-xs uppercase">{isProcessing ? `${currentDayLabel} : ${progress}%` : "Prêt"}</div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {GLOBAL_FIELDS.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary ml-1">{field.label}</Label>
                    <Select value={mapping[field.key] || ""} onValueChange={(v) => setMapping({...mapping, [field.key]: v})}>
                      <SelectTrigger className="h-12 rounded-xl font-bold bg-slate-50 border-none shadow-inner px-4"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">{headers.map(h => <SelectItem key={h} value={h} className="font-bold text-xs">{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleImportGlobal} disabled={isProcessing || !file} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl bg-primary mt-10 hover:scale-[1.01] transition-transform">
                {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "LANCER L'IMPORTATION JANVIER"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
