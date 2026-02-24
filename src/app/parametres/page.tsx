"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, Upload, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { AppShell } from "@/components/layout/app-shell";

export default function SettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    name: "VisionGere Optique",
    address: "123 Rue de la Lumière, Paris, France",
    phone: "+33 1 23 45 67 89",
    icePatent: "ICE-987654321",
    logoUrl: "https://picsum.photos/seed/visiongere-logo/200/200"
  });

  const handleSave = () => {
    toast({
      variant: "success",
      title: "Paramètres Enregistrés",
      description: "Les informations du magasin ont été mises à jour.",
    });
  };

  return (
    <AppShell>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Configuration du Magasin</h1>
          <p className="text-muted-foreground">Gérez l'identité visuelle et les coordonnées de votre établissement.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Logo du Magasin</CardTitle>
                <CardDescription>Format carré recommandé (PNG/JPG)</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div className="relative h-40 w-40 border rounded-xl overflow-hidden bg-muted flex items-center justify-center">
                  <Image 
                    src={settings.logoUrl} 
                    alt="Shop Logo" 
                    fill 
                    className="object-contain p-2"
                    data-ai-hint="optical logo"
                  />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <Upload className="mr-2 h-4 w-4" />
                  Changer le Logo
                </Button>
              </CardContent>
            </Card>
            
            <div className="bg-primary/5 p-4 rounded-lg flex gap-3 text-sm text-primary">
              <Info className="h-5 w-5 shrink-0" />
              <p>Ces informations apparaîtront automatiquement sur l'en-tête de vos factures et rapports PDF.</p>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-accent" />
                  Informations Générales
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="shopName">Nom du Magasin</Label>
                  <Input 
                    id="shopName" 
                    value={settings.name} 
                    onChange={(e) => setSettings({...settings, name: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="shopAddress">Adresse complète</Label>
                  <Input 
                    id="shopAddress" 
                    value={settings.address} 
                    onChange={(e) => setSettings({...settings, address: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shopPhone">Téléphone</Label>
                    <Input 
                      id="shopPhone" 
                      value={settings.phone} 
                      onChange={(e) => setSettings({...settings, phone: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icePatent">ICE / Patent / Registre</Label>
                    <Input 
                      id="icePatent" 
                      value={settings.icePatent} 
                      onChange={(e) => setSettings({...settings, icePatent: e.target.value})} 
                    />
                  </div>
                </div>

                <Separator />
                
                <div className="flex justify-end pt-4">
                  <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer les modifications
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}