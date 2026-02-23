
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { MUTUELLES } from "@/lib/constants";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, Save, Printer, Percent, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function NewSalePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mutuelle, setMutuelle] = useState("Aucun");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [total, setTotal] = useState(1500);
  
  // Gestion de la remise
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  
  const [avance, setAvance] = useState(500);
  
  const [prescription, setPrescription] = useState({
    od: { sph: "", cyl: "", axe: "" },
    og: { sph: "", cyl: "", axe: "" }
  });

  const remiseAmount = discountType === "percent" 
    ? (total * discountValue) / 100 
    : discountValue;

  const totalNet = total - remiseAmount;
  const resteAPayer = totalNet - avance;

  const handlePrescriptionChange = (side: "OD" | "OG", field: string, value: string) => {
    setPrescription(prev => ({
      ...prev,
      [side.toLowerCase()]: {
        ...prev[side.toLowerCase() as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    toast({
      title: "Vente Enregistrée",
      description: "La facture OPT-2024-124 a été générée avec succès.",
    });
  };

  const handlePrint = () => {
    const params = new URLSearchParams({
      client: clientName,
      phone: clientPhone,
      mutuelle,
      total: total.toString(),
      remise: remiseAmount.toString(),
      remisePercent: discountType === "percent" ? discountValue.toString() : "Fixe",
      avance: avance.toString(),
      od_sph: prescription.od.sph,
      od_cyl: prescription.od.cyl,
      od_axe: prescription.od.axe,
      og_sph: prescription.og.sph,
      og_cyl: prescription.og.cyl,
      og_axe: prescription.og.axe,
      date: new Date().toLocaleDateString("fr-FR"),
    });
    router.push(`/ventes/facture/OPT-2024-124?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Nouvelle Vente</h1>
            <p className="text-muted-foreground">Saisissez les informations du client et de l'ordonnance.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Imprimer Facture
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Enregistrer Vente
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-accent" />
                  Informations Client
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientName">Nom complet</Label>
                    <Input 
                      id="clientName" 
                      placeholder="M. Mohamed Alami" 
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientPhone">Téléphone</Label>
                    <Input 
                      id="clientPhone" 
                      placeholder="06 00 00 00 00" 
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mutuelle</Label>
                    <Select onValueChange={setMutuelle} defaultValue="Aucun">
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez" />
                      </SelectTrigger>
                      <SelectContent>
                        {MUTUELLES.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {mutuelle === "Autre" && (
                    <div className="space-y-2">
                      <Label htmlFor="autreMutuelle">Nom de la Mutuelle</Label>
                      <Input id="autreMutuelle" placeholder="Spécifiez..." />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prescription (ODOG)</CardTitle>
              </CardHeader>
              <CardContent>
                <PrescriptionForm 
                  od={prescription.od} 
                  og={prescription.og} 
                  onChange={handlePrescriptionChange} 
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Détails Monture & Verres</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Monture</Label>
                    <Input placeholder="Modèle, Marque, Couleur..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Type de Verres</Label>
                    <Input placeholder="Progressifs, Antireflet, etc." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes Additionnelles</Label>
                  <Textarea placeholder="Instructions de montage ou observations..." />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-8">
            <Card className="sticky top-8 shadow-md border-primary/20">
              <CardHeader>
                <CardTitle>Détail Facturation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label>Total Brut (DH)</Label>
                    <Input 
                      className="w-32 text-right font-medium" 
                      type="number" 
                      value={total} 
                      onChange={(e) => setTotal(Number(e.target.value))}
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-destructive font-semibold">Remise</Label>
                      <Tabs 
                        value={discountType} 
                        onValueChange={(v) => setDiscountType(v as "percent" | "amount")}
                        className="w-auto"
                      >
                        <TabsList className="h-8 grid grid-cols-2 w-[100px]">
                          <TabsTrigger value="percent" className="text-[10px]">%</TabsTrigger>
                          <TabsTrigger value="amount" className="text-[10px]">DH</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-muted-foreground italic">
                        {discountType === "percent" ? `Soit -${formatCurrency(remiseAmount)}` : "Montant déduit"}
                      </span>
                      <div className="relative">
                        {discountType === "percent" ? (
                          <Percent className="absolute right-3 top-3 h-3 w-3 text-destructive" />
                        ) : (
                          <Coins className="absolute right-3 top-3 h-3 w-3 text-destructive" />
                        )}
                        <Input 
                          className="w-32 text-right text-destructive font-bold pr-8" 
                          type="number" 
                          min="0"
                          value={discountValue} 
                          onChange={(e) => setDiscountValue(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-muted/50 p-2 rounded">
                    <Label className="font-bold">Total Net (DH)</Label>
                    <span className="font-bold">{formatCurrency(totalNet)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <Label className="text-green-600 font-semibold">Avance (DH)</Label>
                    <Input 
                      className="w-32 text-right text-green-700 font-bold" 
                      type="number" 
                      value={avance} 
                      onChange={(e) => setAvance(Number(e.target.value))}
                    />
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-black text-xl uppercase tracking-tighter">Reste à Payer</span>
                    <span className="font-black text-2xl text-primary underline decoration-accent decoration-4 underline-offset-4">
                      {formatCurrency(resteAPayer)}
                    </span>
                  </div>
                </div>

                <div className="pt-6 border-t">
                  <div className="bg-muted/30 p-4 rounded-lg space-y-3 border border-dashed">
                    <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-2">Section Administrative (Achat)</h4>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Achat Verres</Label>
                      <Input className="h-8 w-24 text-right text-xs" type="number" placeholder="0.00" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Achat Monture</Label>
                      <Input className="h-8 w-24 text-right text-xs" type="number" placeholder="0.00" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
