"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { MUTUELLES } from "@/lib/constants";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, Save, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function NewSalePage() {
  const { toast } = useToast();
  const [mutuelle, setMutuelle] = useState("Aucun");
  const [prescription, setPrescription] = useState({
    od: { sph: "", cyl: "", axe: "" },
    og: { sph: "", cyl: "", axe: "" }
  });

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

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Nouvelle Vente</h1>
          <p className="text-muted-foreground">Saisissez les informations du client et de l'ordonnance.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.print()}>
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
                  <Input id="clientName" placeholder="M. Mohamed Alami" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clientPhone">Téléphone</Label>
                  <Input id="clientPhone" placeholder="06 00 00 00 00" />
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
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle>Détail Facturation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label>Total TTC (DH)</Label>
                  <Input className="w-32 text-right font-bold" type="number" defaultValue="1500" />
                </div>
                <div className="flex justify-between items-center">
                  <Label>Avance (DH)</Label>
                  <Input className="w-32 text-right text-green-600 font-medium" type="number" defaultValue="500" />
                </div>
                <Separator />
                <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-lg">Reste à Payer</span>
                  <span className="font-bold text-lg text-destructive">1 000,00 DH</span>
                </div>
              </div>

              {/* Admin Only Margin Input */}
              <div className="pt-6 border-t">
                 <div className="bg-muted p-4 rounded-lg space-y-3">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Section Administrative (Masqué Client)</h4>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Prix Achat Verres</Label>
                      <Input className="h-8 w-24 text-right text-xs" type="number" placeholder="0.00" />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Prix Achat Monture</Label>
                      <Input className="h-8 w-24 text-right text-xs" type="number" placeholder="0.00" />
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-muted-foreground/20">
                      <span className="text-xs font-bold">Marge Brute Estimée</span>
                      <span className="text-xs font-bold text-accent">--- DH</span>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
