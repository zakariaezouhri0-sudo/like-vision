
"use client";

import { useState, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Table as TableIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type Mapping = Record<string, string>;

export default function ImportPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    { key: "createdAt", label: "Date (Optionnel)" },
    { key: "mutuelle", label: "Mutuelle (Optionnel)" }
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
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws);
        if (jsonData.length > 0) {
          setData(jsonData);
          setHeaders(Object.keys(jsonData[0] as object));
          // Auto-mapping simple
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
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setIsProcessing(true);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (importType === "sales") {
          const clientName = row[mapping.clientName] || "Client Inconnu";
          const clientPhone = (row[mapping.clientPhone]?.toString() || "").replace(/\s/g, "");
          const total = parseFloat(row[mapping.total]) || 0;
          const avance = parseFloat(row[mapping.avance]) || 0;
          const invoiceId = row[mapping.invoiceId] || `IMP-${Date.now().toString().slice(-6)}-${i}`;
          const dateStr = row[mapping.createdAt];
          const createdAt = dateStr ? new Date(dateStr) : new Date();

          const saleData = {
            invoiceId,
            clientName,
            clientPhone,
            total,
            avance,
            reste: Math.max(0, total - avance),
            statut: avance >= total ? "Payé" : (avance > 0 ? "Partiel" : "En attente"),
            mutuelle: row[mapping.mutuelle] || "Aucun",
            createdAt: Timestamp.fromDate(createdAt),
            updatedAt: serverTimestamp(),
            remise: 0,
            notes: "Importé depuis Excel"
          };

          // 1. Sauvegarder la vente
          await addDoc(collection(db, "sales"), saleData);

          // 2. Créer/Mettre à jour le client
          const clientsRef = collection(db, "clients");
          const clientQ = query(clientsRef, where("phone", "==", clientPhone));
          const clientSnap = await getDocs(clientQ);
          if (clientSnap.empty && clientPhone) {
            await addDoc(clientsRef, {
              name: clientName,
              phone: clientPhone,
              mutuelle: saleData.mutuelle,
              createdAt: serverTimestamp(),
              lastVisit: createdAt.toLocaleDateString("fr-FR"),
              ordersCount: 1
            });
          }

          // 3. Enregistrer la transaction de caisse
          if (avance > 0) {
            await addDoc(collection(db, "transactions"), {
              type: "VENTE",
              label: `Import ${invoiceId}`,
              category: "Optique",
              montant: avance,
              relatedId: invoiceId,
              createdAt: Timestamp.fromDate(createdAt)
            });
          }
        } else {
          // Import Clients uniquement
          const name = row[mapping.name];
          const phone = (row[mapping.phone]?.toString() || "").replace(/\s/g, "");
          if (name && phone) {
            await addDoc(collection(db, "clients"), {
              name,
              phone,
              mutuelle: row[mapping.mutuelle] || "Aucun",
              createdAt: serverTimestamp(),
              lastVisit: new Date().toLocaleDateString("fr-FR"),
              ordersCount: 0
            });
          }
        }
        successCount++;
      } catch (e) {
        console.error("Error importing row", i, e);
        errorCount++;
      }
      setProgress(Math.round(((i + 1) / data.length) * 100));
    }

    setIsProcessing(false);
    toast({
      variant: errorCount > 0 ? "destructive" : "success",
      title: "Importation Terminée",
      description: `${successCount} lignes importées avec succès. ${errorCount} erreurs.`
    });
    
    if (errorCount === 0) {
      setData([]);
      setFile(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-10">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Importation de Données</h1>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Importez vos anciens fichiers Excel (Mois 1, Mois 2, etc.)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-[11px] font-black uppercase text-primary/60">1. Choisir le type</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Type de données</Label>
                <Select value={importType} onValueChange={(v: any) => setImportType(v)}>
                  <SelectTrigger className="h-12 rounded-xl font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="sales" className="font-bold">Historique des Ventes</SelectItem>
                    <SelectItem value="clients" className="font-bold">Fichier Clients</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-bold text-blue-700 leading-relaxed uppercase">
                  L'importation des ventes créera automatiquement les fiches clients et les entrées en caisse correspondantes.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-[11px] font-black uppercase text-primary/60">2. Télécharger le fichier</CardTitle>
            </CardHeader>
            <CardContent className="p-10 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 m-6 rounded-[24px] bg-slate-50/50">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept=".xlsx, .xls, .csv" 
                onChange={handleFileChange} 
              />
              <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
                <FileSpreadsheet className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-sm font-black text-slate-800 uppercase mb-2">
                {file ? file.name : "Aucun fichier sélectionné"}
              </h3>
              <Button 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                className="h-12 px-8 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white"
              >
                <Upload className="mr-2 h-4 w-4" /> SELECTIONNER UN EXCEL
              </Button>
            </CardContent>
          </Card>
        </div>

        {data.length > 0 && (
          <Card className="rounded-[32px] border-none shadow-2xl bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="bg-primary text-white p-8">
              <CardTitle className="text-xl font-black uppercase flex items-center gap-3">
                <TableIcon className="h-6 w-6" /> Correspondance des Colonnes
              </CardTitle>
              <CardDescription className="text-white/60 font-bold text-[10px] uppercase tracking-widest mt-1">
                {data.length} lignes détectées. Associez vos colonnes Excel aux champs du système.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                {currentFields.map(field => (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-widest flex justify-between">
                      {field.label}
                      {mapping[field.key] ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <AlertCircle className="h-3 w-3 text-red-500" />}
                    </Label>
                    <Select 
                      value={mapping[field.key] || ""} 
                      onValueChange={(v) => setMapping({...mapping, [field.key]: v})}
                    >
                      <SelectTrigger className="h-12 rounded-xl font-bold bg-slate-50 border-none shadow-inner">
                        <SelectValue placeholder="Choisir une colonne..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {headers.map(h => <SelectItem key={h} value={h} className="font-bold">{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="mt-12 space-y-6">
                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase text-primary">
                      <span>Importation en cours...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-3 rounded-full bg-slate-100" />
                  </div>
                )}

                <Button 
                  onClick={handleImport} 
                  disabled={isProcessing || Object.keys(mapping).length < (importType === "sales" ? 4 : 2)}
                  className="w-full h-16 rounded-[24px] font-black text-base shadow-xl bg-primary hover:bg-primary/90"
                >
                  {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "LANCER L'IMPORTATION"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
