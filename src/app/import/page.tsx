
"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Upload, CheckCircle2, Zap, CalendarDays, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, setDoc, query, getDocs, getDoc, where, limit, increment, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format, setHours, setMinutes, setSeconds, parseISO, isValid } from "date-fns";

type Mapping = Record<string, string>;

const GLOBAL_FIELDS = [
  { key: "date_col", label: "DATE (Colonne)", section: "GÉNÉRAL" },
  { key: "client_1", label: "Nom Client 1", section: "VENTES" },
  { key: "total_brut", label: "Total Brut", section: "VENTES" },
  { key: "avance_paye", label: "Avance Paye", section: "VENTES" },
  { key: "avance_ante", label: "Avance Ante", section: "VENTES" },
  { key: "achat_verre_det", label: "ACHAT VERRE (Détail)", section: "ACHATS" },
  { key: "nom_client_v", label: "NOM CLIENT (Verre)", section: "ACHATS" },
  { key: "montant_v", label: "MONTANT (Verre)", section: "ACHATS" },
  { key: "achat_mont_det", label: "ACHAT MONTURE (Détail)", section: "ACHATS" },
  { key: "nom_client_m", label: "NOM CLIENT (Monture)", section: "ACHATS" },
  { key: "montant_m", label: "MONTANT (Monture)", section: "ACHATS" },
  { key: "libelle_dep", label: "LIBELLE (Dépense)", section: "CHARGES" },
  { key: "montant_dep", label: "MONTANT (Dépense)", section: "CHARGES" },
  { key: "versement_mt", label: "VERSEMENT (Montant)", section: "VERSEMENTS" }
];

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
            const fileHeaders = Object.keys(jsonData[0] as object);
            setHeaders(fileHeaders);
            
            const newMapping: Mapping = {};
            GLOBAL_FIELDS.forEach(f => {
              if (fileHeaders.includes(f.label)) {
                newMapping[f.key] = f.label;
              }
            });
            setMapping(newMapping);
          }
        } catch (err) {
          toast({ variant: "destructive", title: "Erreur de lecture du fichier" });
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const downloadTemplate = () => {
    const templateHeaders = GLOBAL_FIELDS.map(f => f.label);
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modele_Import");
    XLSX.writeFile(wb, "Modele_Import_LikeVision.xlsx");
    toast({ title: "Modèle téléchargé" });
  };

  const cleanNum = (val: any): number => {
    if (val === undefined || val === null || val === "" || typeof val === 'object') return 0;
    const s = val.toString().replace(/\s/g, '').replace(',', '.');
    const p = parseFloat(s);
    return isNaN(p) ? 0 : p;
  };

  const parseRowDate = (val: any, defaultDate: Date): Date => {
    if (!val) return defaultDate;
    if (val instanceof Date) return val;
    const d = parseISO(val.toString());
    return isValid(d) ? d : defaultDate;
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
        
        let dayNum = null;
        const matches = sheetName.toString().match(/\d+/g);
        if (matches) {
          const num = parseInt(matches[matches.length - 1]);
          if (num >= 1 && num <= 31) dayNum = num;
        }
        if (!dayNum) continue;

        const dateStr = `2026-01-${dayNum.toString().padStart(2, '0')}`;
        setCurrentDayLabel(`${dayNum} Janvier`);
        
        const sheetDate = new Date(2026, 0, dayNum); 
        const sessionId = currentIsDraft ? `DRAFT-${dateStr}` : dateStr;

        let daySalesTotal = 0;
        let dayExpensesTotal = 0;
        let dayVersementsTotal = 0;
        const initialBalance = currentBalance;

        const sessionRef = doc(db, "cash_sessions", sessionId);
        const openTime = Timestamp.fromDate(setSeconds(setMinutes(setHours(sheetDate, 10), 0), 0));
        const closeTime = Timestamp.fromDate(setSeconds(setMinutes(setHours(sheetDate, 20), 0), 0));
        
        await setDoc(sessionRef, {
          date: dateStr,
          isDraft: currentIsDraft,
          status: "CLOSED",
          openedAt: openTime,
          closedAt: closeTime,
          openedBy: userName,
          closedBy: userName,
          openingBalance: initialBalance
        }, { merge: true });

        for (const row of rawData) {
          const rowDate = parseRowDate(row[mapping.date_col], sheetDate);
          const rowTimestamp = Timestamp.fromDate(rowDate);

          // 1. VENTES
          const clientNameRaw = row[mapping.client_1];
          const totalRaw = row[mapping.total_brut];
          if (clientNameRaw && totalRaw !== undefined) {
            const clientName = clientNameRaw.toString().trim();
            const totalVal = cleanNum(totalRaw);
            const currentAvance = cleanNum(row[mapping.avance_paye]);
            const historicalAvance = cleanNum(row[mapping.avance_ante]);
            const totalAvance = currentAvance + historicalAvance;
            
            const isPaid = totalAvance >= totalVal;
            const prefix = currentIsDraft ? "PREPA-" : "";
            if (isPaid) globalCounters.fc++; else globalCounters.rc++;
            const docType = isPaid ? "FC" : "RC";
            const seqNum = isPaid ? globalCounters.fc : globalCounters.rc;
            const invoiceId = `${prefix}${docType}-2026-${seqNum.toString().padStart(4, '0')}`;

            const saleRef = doc(collection(db, "sales"));
            await setDoc(saleRef, {
              invoiceId, clientName, total: totalVal, 
              avance: totalAvance, reste: Math.max(0, totalVal - totalAvance),
              statut: isPaid ? "Payé" : "Partiel",
              isDraft: currentIsDraft, createdAt: rowTimestamp, createdBy: userName,
              payments: [
                { amount: historicalAvance, date: rowDate.toISOString(), userName: "Historique", note: "Avance antérieure" },
                { amount: currentAvance, date: rowDate.toISOString(), userName: "Import", note: "Acompte Jour" }
              ]
            }, { merge: true });

            if (currentAvance > 0) {
              const transRef = doc(collection(db, "transactions"));
              await setDoc(transRef, {
                type: "VENTE", label: `${invoiceId}`, clientName: clientName,
                montant: currentAvance, isDraft: currentIsDraft, createdAt: rowTimestamp, 
                userName, relatedId: invoiceId
              }, { merge: true });
              daySalesTotal += currentAvance;
            }
          }

          // 2. ACHAT VERRES
          const glassAmount = cleanNum(row[mapping.montant_v]);
          if (glassAmount > 0) {
            const client = (row[mapping.nom_client_v] || "").toString().trim();
            const detail = (row[mapping.achat_verre_det] || "ACHAT VERRES").toString().trim();
            const transRef = doc(collection(db, "transactions"));
            await setDoc(transRef, {
              type: "ACHAT VERRES", label: detail, clientName: client,
              montant: -Math.abs(glassAmount), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            }, { merge: true });
            dayExpensesTotal += glassAmount;
          }

          // 3. ACHAT MONTURE
          const frameAmount = cleanNum(row[mapping.montant_m]);
          if (frameAmount > 0) {
            const client = (row[mapping.nom_client_m] || "").toString().trim();
            const detail = (row[mapping.achat_mont_det] || "ACHAT MONTURE").toString().trim();
            const transRef = doc(collection(db, "transactions"));
            await setDoc(transRef, {
              type: "ACHAT MONTURE", label: detail, clientName: client,
              montant: -Math.abs(frameAmount), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            }, { merge: true });
            dayExpensesTotal += frameAmount;
          }

          // 4. DEPENSES AUTRES
          const expenseAmount = cleanNum(row[mapping.montant_dep]);
          if (expenseAmount > 0) {
            const label = (row[mapping.libelle_dep] || "AUTRE CHARGE").toString().trim();
            const transRef = doc(collection(db, "transactions"));
            await setDoc(transRef, {
              type: "DEPENSE", label: label,
              montant: -Math.abs(expenseAmount), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            }, { merge: true });
            dayExpensesTotal += expenseAmount;
          }

          // 5. VERSEMENTS
          const versementAmount = cleanNum(row[mapping.versement_mt]);
          if (versementAmount > 0) {
            const transRef = doc(collection(db, "transactions"));
            await setDoc(transRef, {
              type: "VERSEMENT", label: "VERSEMENT CAISSE",
              montant: -Math.abs(versementAmount), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            }, { merge: true });
            dayVersementsTotal += versementAmount;
          }
        }

        currentBalance = initialBalance + daySalesTotal - dayExpensesTotal - dayVersementsTotal;

        await setDoc(sessionRef, {
          totalSales: daySalesTotal, totalExpenses: dayExpensesTotal, totalVersements: dayVersementsTotal,
          closingBalanceReal: currentBalance, closingBalanceTheoretical: currentBalance, discrepancy: 0
        }, { merge: true });

        setProgress(Math.round(((s + 1) / sheetNames.length) * 100));
      }

      await setDoc(counterRef, globalCounters, { merge: true });
      toast({ variant: "success", title: "Importation Janvier Terminée" });
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
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Importation calibrée sur votre structure Excel.</p>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="h-14 px-6 rounded-2xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm">
            <Download className="mr-2 h-5 w-5" /> MODÈLE EXCEL
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 rounded-[32px] bg-white overflow-hidden shadow-lg border-none">
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">1. Solde Initial (01/01)</CardTitle></CardHeader>
            <CardContent className="p-6">
              <Input type="number" className="h-14 rounded-2xl font-black text-xl text-center bg-slate-50 border-none shadow-inner" placeholder="DH" value={startingBalance === "0" || startingBalance === "" ? "" : startingBalance} onChange={e => setStartingBalance(e.target.value)} />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 rounded-[32px] bg-white overflow-hidden shadow-lg border-none">
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">2. Sélection Fichier</CardTitle></CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[32px] p-10 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4"><FileSpreadsheet className="h-8 w-8 text-primary" /></div>
                <h3 className="text-sm font-black text-slate-800 uppercase">{file ? file.name : "Choisir l'Excel"}</h3>
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
                <div className="bg-white/20 px-4 py-2 rounded-full font-black text-xs uppercase">{isProcessing ? `${currentDayLabel} : ${progress}%` : "Prêt pour Janvier"}</div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {GLOBAL_FIELDS.map(field => (
                  <div key={field.key} className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <Label className="text-[10px] font-black uppercase text-primary">{field.label}</Label>
                      <Badge variant="outline" className="text-[8px] font-bold opacity-40">{field.section}</Badge>
                    </div>
                    <Select value={mapping[field.key] || ""} onValueChange={(v) => setMapping({...mapping, [field.key]: v})}>
                      <SelectTrigger className="h-12 rounded-xl font-bold bg-slate-50 border-none shadow-inner px-4"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">{headers.map(h => <SelectItem key={h} value={h} className="font-bold text-xs">{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleImportGlobal} disabled={isProcessing || !file} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl bg-primary mt-10">
                {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "LANCER L'IMPORTATION"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
