
"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Table as TableIcon, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp, doc, updateDoc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type Mapping = Record<string, string>;

export default function ImportPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (role !== 'ADMIN' && role !== 'PREPA') {
      router.push('/dashboard');
    } else {
      setLoadingRole(false);
    }
  }, [router]);
  
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importType, setImportType] = useState<"sales" | "clients">("sales");

  const SALES_FIELDS = [
    { key: "invoiceId", label: "N° Facture" },
    { key: "clientName", label: "Nom Client" },
    { key: "clientPhone", label: "Téléphone" },
    { key: "total", label: "Total Brut" },
    { key: "avance", label: "Avance Payée" },
    { key: "createdAt", label: "Date" },
    { key: "mutuelle", label: "Mutuelle" }
  ];

  const CLIENTS_FIELDS = [
    { key: "name", label: "Nom Complet" },
    { key: "phone", label: "Téléphone" },
    { key: "mutuelle", label: "Mutuelle" }
  ];

  const currentFields = importType === "sales" ? SALES_FIELDS : CLIENTS_FIELDS;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
          const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          if (jsonData.length > 0) {
            setData(jsonData);
            setHeaders(Object.keys(jsonData[0] as object));
            const newMapping: Mapping = {};
            Object.keys(jsonData[0] as object).forEach(header => {
              const lowerHeader = header.toLowerCase();
              currentFields.forEach(field => {
                if (lowerHeader.includes(field.label.toLowerCase()) || lowerHeader.includes(field.key.toLowerCase())) {
                  newMapping[field.key] = header;
                }
              });
            });
            setMapping(newMapping);
          }
        } catch (err) {}
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    const role = localStorage.getItem('user_role');
    const isDraft = role === 'PREPA';

    // Parcourir les lignes par petits lots pour Firestore
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (importType === "sales") {
          const clientName = row[mapping.clientName] || "Client Importé";
          const clientPhone = (row[mapping.clientPhone]?.toString() || "").replace(/\s/g, "");
          const total = parseFloat(row[mapping.total]) || 0;
          const avance = parseFloat(row[mapping.avance]) || 0;
          const invoiceId = row[mapping.invoiceId]?.toString() || `OPT-IMP-${Date.now().toString().slice(-4)}-${i}`;
          
          let createdAtDate = new Date();
          if (row[mapping.createdAt]) {
            const parsed = new Date(row[mapping.createdAt]);
            if (!isNaN(parsed.getTime())) createdAtDate = parsed;
          }

          const saleData = {
            invoiceId, clientName, clientPhone, total, avance,
            reste: Math.max(0, total - avance),
            statut: avance >= total ? "Payé" : (avance > 0 ? "Partiel" : "En attente"),
            mutuelle: row[mapping.mutuelle] || "Aucun",
            createdAt: Timestamp.fromDate(createdAtDate),
            updatedAt: serverTimestamp(),
            remise: 0, notes: "Importé depuis historique", isDraft
          };

          // Ajouter la vente
          await addDoc(collection(db, "sales"), saleData);

          // CRUCIAL : Ajouter la transaction de caisse pour l'avance importée
          if (avance > 0) {
            await addDoc(collection(db, "transactions"), {
              type: "VENTE",
              label: `Import Historique - ${invoiceId}`,
              clientName,
              category: "Optique",
              montant: avance,
              relatedId: invoiceId,
              userName: "Système (Import)",
              isDraft,
              createdAt: Timestamp.fromDate(createdAtDate) // On garde la date d'origine pour la caisse aussi
            });
          }
        } else {
          const name = row[mapping.name];
          const phone = (row[mapping.phone]?.toString() || "").replace(/\s/g, "");
          if (name && phone) {
            await addDoc(collection(db, "clients"), {
              name, phone, mutuelle: row[mapping.mutuelle] || "Aucun",
              createdAt: serverTimestamp(), lastVisit: new Date().toLocaleDateString("fr-FR"), ordersCount: 0
            });
          }
        }
      } catch (e) {}
      setProgress(Math.round(((i + 1) / data.length) * 100));
    }

    setIsProcessing(false);
    toast({ variant: "success", title: "Importation Réussie", description: "Ventes et Transactions synchronisées." });
    setData([]);
    setFile(null);
  };

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Importation Historique</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Les avances seront automatiquement ajoutées à la caisse.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-[11px] font-black uppercase text-primary/60 tracking-widest">1. Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Type à importer</Label>
                <Select value={importType} onValueChange={(v: any) => setImportType(v)}>
                  <SelectTrigger className="h-12 rounded-xl font-bold bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="sales" className="font-bold">Historique de Ventes</SelectItem>
                    <SelectItem value="clients" className="font-bold">Fichier Clients Seul</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-[11px] font-black uppercase text-primary/60 tracking-widest">2. Fichier Source</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[32px] bg-slate-50/30 p-10 cursor-pointer hover:bg-slate-50" onClick={() => fileInputRef.current?.click()}>
                <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                <div className="h-20 w-20 bg-primary/10 rounded-[24px] flex items-center justify-center mb-4 shadow-inner">
                  <FileSpreadsheet className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{file ? file.name : "Cliquez pour choisir votre fichier"}</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        {data.length > 0 && (
          <Card className="rounded-[32px] border-none shadow-2xl bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
            <CardHeader className="bg-primary text-white p-8">
              <CardTitle className="text-2xl font-black uppercase flex items-center gap-4 tracking-tighter">Validation de l'import</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {currentFields.map(field => (
                  <div key={field.key} className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">{field.label}</Label>
                    <Select value={mapping[field.key] || ""} onValueChange={(v) => setMapping({...mapping, [field.key]: v})}>
                      <SelectTrigger className="h-14 rounded-2xl font-black text-slate-900 border-none bg-slate-50 shadow-inner px-6"><SelectValue placeholder="Choisir la colonne..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl">{headers.map(h => <SelectItem key={h} value={h} className="font-black text-xs">{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleImport} disabled={isProcessing || Object.keys(mapping).length < 2} className="w-full h-16 rounded-[24px] font-black text-lg shadow-2xl bg-primary mt-12">
                {isProcessing ? `TRAITEMENT... ${progress}%` : "LANCER L'IMPORTATION"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
