
"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Download, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { setHours, setMinutes, setSeconds, startOfDay, endOfDay, addDays, format, isSunday } from "date-fns";

type Mapping = Record<string, string>;

const GLOBAL_FIELDS = [
  { key: "date_col", label: "DATE (Colonne)", section: "GÉNÉRAL" },
  { key: "client_1", label: "Nom Client 1", section: "VENTES" },
  { key: "total_brut", label: "Total Brut", section: "VENTES" },
  { key: "avance_paye", label: "Avance Paye", section: "VENTES" },
  { key: "avance_ante", label: "Avance Anterieure", section: "VENTES" },
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
          const headerRow = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] as string[];
          if (headerRow && headerRow.length > 0) {
            setHeaders(headerRow.map(h => h?.toString().trim()));
            const newMapping: Mapping = {};
            GLOBAL_FIELDS.forEach(f => {
              if (headerRow.includes(f.label)) newMapping[f.key] = f.label;
            });
            setMapping(newMapping);
          }
        } catch (err) {
          toast({ variant: "destructive", title: "Erreur de lecture" });
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const downloadTemplate = () => {
    const templateHeaders = GLOBAL_FIELDS.map(f => f.label);
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle Import");
    XLSX.writeFile(wb, "Modele_LikeVision_14_Colonnes.xlsx");
  };

  const cleanNum = (val: any): number => {
    if (val === undefined || val === null || val === "") return 0;
    const s = val.toString().replace(/\s/g, '').replace(',', '.');
    const p = parseFloat(s);
    return isNaN(p) ? 0 : p;
  };

  const handleImportGlobal = async () => {
    if (!workbook || !file) return;
    setIsProcessing(true);
    const currentIsDraft = role === 'PREPA';
    const userName = user?.displayName || "Import Automatique";
    let runningBalance = cleanNum(startingBalance);

    const counterDocPath = currentIsDraft ? "counters_draft" : "counters";
    const counterRef = doc(db, "settings", counterDocPath);
    const counterSnap = await getDoc(counterRef);
    let globalCounters = counterSnap.exists() ? counterSnap.data() as any : { fc: 0, rc: 0 };

    try {
      // On boucle sur les 31 jours de Janvier 2026
      for (let day = 1; day <= 31; day++) {
        const dateStr = `2026-01-${day.toString().padStart(2, '0')}`;
        const currentDate = new Date(2026, 0, day);
        setCurrentDayLabel(format(currentDate, "dd MMMM", { locale: require('date-fns/locale').fr }));
        setProgress(Math.round((day / 31) * 100));

        const sessionId = currentIsDraft ? `DRAFT-${dateStr}` : dateStr;
        const sessionRef = doc(db, "cash_sessions", sessionId);

        let daySales = 0;
        let dayExpenses = 0;
        let dayVersements = 0;
        const initialBalanceForDay = runningBalance;

        // Chercher la feuille correspondante dans l'Excel (ex: "05", "Janvier 05", etc)
        const sheetName = workbook.SheetNames.find(n => n.includes(day.toString().padStart(2, '0')) || n === day.toString());
        
        if (sheetName) {
          const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
          for (const row of rawData) {
            const rowTimestamp = Timestamp.fromDate(setHours(currentDate, 12));

            // 1. VENTES
            const clientName = (row[mapping.client_1] || "").toString().trim();
            const totalVal = cleanNum(row[mapping.total_brut]);
            if (clientName && totalVal > 0) {
              const currentAvance = cleanNum(row[mapping.avance_paye]);
              const historicalAvance = cleanNum(row[mapping.avance_ante]);
              const totalAvance = currentAvance + historicalAvance;
              const isPaid = totalAvance >= totalVal;
              
              if (isPaid) globalCounters.fc++; else globalCounters.rc++;
              const docType = isPaid ? "FC" : "RC";
              const invoiceId = `${currentIsDraft ? 'PREPA-' : ''}${docType}-2026-${(isPaid ? globalCounters.fc : globalCounters.rc).toString().padStart(4, '0')}`;

              await setDoc(doc(collection(db, "sales")), {
                invoiceId, clientName, total: totalVal, avance: totalAvance, reste: Math.max(0, totalVal - totalAvance),
                statut: isPaid ? "Payé" : "Partiel", isDraft: currentIsDraft, createdAt: rowTimestamp, createdBy: userName,
                payments: [
                  { amount: historicalAvance, date: currentDate.toISOString(), userName: "Historique", note: "Avance antérieure" },
                  { amount: currentAvance, date: currentDate.toISOString(), userName: "Import", note: "Acompte Jour" }
                ]
              });

              if (currentAvance > 0) {
                await setDoc(doc(collection(db, "transactions")), {
                  type: "VENTE", label: invoiceId, clientName, montant: currentAvance, 
                  isDraft: currentIsDraft, createdAt: rowTimestamp, userName, relatedId: invoiceId
                });
                daySales += currentAvance;
              }
            }

            // 2. ACHAT VERRES
            const vAmt = cleanNum(row[mapping.montant_v]);
            if (vAmt > 0) {
              const label = (row[mapping.achat_verre_det] || "ACHAT VERRES").toString().trim();
              await setDoc(doc(collection(db, "transactions")), {
                type: "ACHAT VERRES", label, clientName: (row[mapping.nom_client_v] || "").toString().trim(),
                montant: -Math.abs(vAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
              });
              dayExpenses += vAmt;
            }

            // 3. ACHAT MONTURE
            const mAmt = cleanNum(row[mapping.montant_m]);
            if (mAmt > 0) {
              const label = (row[mapping.achat_mont_det] || "ACHAT MONTURE").toString().trim();
              await setDoc(doc(collection(db, "transactions")), {
                type: "ACHAT MONTURE", label, clientName: (row[mapping.nom_client_m] || "").toString().trim(),
                montant: -Math.abs(mAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
              });
              dayExpenses += mAmt;
            }

            // 4. DEPENSES
            const dAmt = cleanNum(row[mapping.montant_dep]);
            if (dAmt > 0) {
              await setDoc(doc(collection(db, "transactions")), {
                type: "DEPENSE", label: (row[mapping.libelle_dep] || "CHARGE").toString().trim(),
                montant: -Math.abs(dAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
              });
              dayExpenses += dAmt;
            }

            // 5. VERSEMENTS
            const verAmt = cleanNum(row[mapping.versement_mt]);
            if (verAmt > 0) {
              await setDoc(doc(collection(db, "transactions")), {
                type: "VERSEMENT", label: "VERSEMENT CAISSE", montant: -Math.abs(verAmt),
                isDraft: currentIsDraft, createdAt: rowTimestamp, userName
              });
              dayVersements += verAmt;
            }
          }
        }

        runningBalance = initialBalanceForDay + daySales - dayExpenses - dayVersements;

        await setDoc(sessionRef, {
          date: dateStr, isDraft: currentIsDraft, status: "CLOSED",
          openedAt: Timestamp.fromDate(setHours(currentDate, 9)),
          closedAt: Timestamp.fromDate(setHours(currentDate, 20)),
          openedBy: userName, closedBy: userName,
          openingBalance: initialBalanceForDay,
          closingBalanceReal: runningBalance,
          closingBalanceTheoretical: runningBalance,
          totalSales: daySales, totalExpenses: dayExpenses, totalVersements: dayVersements,
          discrepancy: 0
        });
      }

      await setDoc(counterRef, globalCounters);
      toast({ variant: "success", title: "Importation terminée avec succès" });
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
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Automate de Janvier</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Génération automatique des 31 sessions.</p>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="h-14 px-6 rounded-2xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm">
            <Download className="mr-2 h-5 w-5" /> MODÈLE EXCEL
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-[32px] bg-white shadow-lg border-none">
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">1. Solde Initial au 01/01</CardTitle></CardHeader>
            <CardContent className="p-6">
              <Input type="number" className="h-14 rounded-2xl font-black text-xl text-center bg-slate-50 border-none" placeholder="DH" value={startingBalance} onChange={e => setStartingBalance(e.target.value)} />
            </CardContent>
          </Card>

          <Card className="rounded-[32px] bg-white shadow-lg border-none" onClick={() => fileInputRef.current?.click()}>
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">2. Fichier Excel</CardTitle></CardHeader>
            <CardContent className="p-6 flex flex-col items-center justify-center cursor-pointer">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
              <FileSpreadsheet className="h-10 w-10 text-primary mb-2" />
              <span className="text-xs font-black uppercase">{file ? file.name : "Choisir le fichier"}</span>
            </CardContent>
          </Card>
        </div>

        {workbook && (
          <Card className="rounded-[32px] bg-white shadow-2xl border-none overflow-hidden">
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-black uppercase">Configuration de l'Import</CardTitle>
                {isProcessing && <div className="bg-white/20 px-4 py-2 rounded-full font-black text-xs uppercase">{currentDayLabel} : {progress}%</div>}
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {GLOBAL_FIELDS.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase ml-1">{f.label}</Label>
                    <Select value={mapping[f.key] || ""} onValueChange={v => setMapping({...mapping, [f.key]: v})}>
                      <SelectTrigger className="h-11 rounded-xl font-bold bg-slate-50 border-none"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">{headers.map(h => <SelectItem key={h} value={h} className="font-bold text-xs">{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleImportGlobal} disabled={isProcessing || !file || !startingBalance} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl bg-primary">
                {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "LANCER L'IMPORTATION COMPLÈTE"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
