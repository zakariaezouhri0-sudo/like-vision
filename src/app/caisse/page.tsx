"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Wallet, LogOut, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default function CaissePage() {
  const [isSessionOpen, setIsSessionOpen] = useState(true);
  const [soldeInitial, setSoldeInitial] = useState(500);
  
  const [transactions] = useState([
    { id: 1, type: "VENTE", label: "Vente OPT-2024-001", montant: 1200, date: "10:30" },
    { id: 2, type: "DEPENSE", label: "Achat Fournitures", montant: -150, date: "11:15" },
    { id: 3, type: "APPORT", label: "Fonds de roulement", montant: 200, date: "14:00" },
    { id: 4, type: "VENTE", label: "Vente OPT-2024-002", montant: 850, date: "15:45" },
  ]);

  const totalVentes = transactions.filter(t => t.type === "VENTE").reduce((acc, t) => acc + t.montant, 0);
  const totalDepenses = transactions.filter(t => t.type === "DEPENSE").reduce((acc, t) => acc + Math.abs(t.montant), 0);
  const totalApports = transactions.filter(t => t.type === "APPORT").reduce((acc, t) => acc + t.montant, 0);
  const soldeTheorique = soldeInitial + totalVentes + totalApports - totalDepenses;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">Gestion de la Caisse</h1>
          <p className="text-muted-foreground">Suivi quotidien des flux financiers du magasin.</p>
        </div>
        
        {!isSessionOpen ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                <PlusCircle className="mr-2 h-5 w-5" />
                Ouvrir la Caisse
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ouverture de Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Solde Initial (DH)</Label>
                  <Input type="number" placeholder="0.00" value={soldeInitial} onChange={(e) => setSoldeInitial(Number(e.target.value))} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsSessionOpen(true)}>Confirmer l'Ouverture</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="lg" className="border-destructive text-destructive hover:bg-destructive/10">
                <LogOut className="mr-2 h-5 w-5" />
                Clôturer la Caisse
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Clôture de Session</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm font-medium">Solde Initial:</div>
                  <div className="text-sm text-right">{soldeInitial.toFixed(2)} DH</div>
                  <div className="text-sm font-medium">Total Ventes:</div>
                  <div className="text-sm text-right">{totalVentes.toFixed(2)} DH</div>
                  <div className="text-sm font-medium">Total Dépenses:</div>
                  <div className="text-sm text-right">-{totalDepenses.toFixed(2)} DH</div>
                  <div className="text-sm font-medium">Total Apports:</div>
                  <div className="text-sm text-right">{totalApports.toFixed(2)} DH</div>
                  <div className="pt-2 border-t font-bold text-primary">Solde Théorique:</div>
                  <div className="pt-2 border-t font-bold text-primary text-right">{soldeTheorique.toFixed(2)} DH</div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label>Solde Réel Constaté (DH)</Label>
                  <Input type="number" placeholder="Entrez le montant en caisse" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="destructive" onClick={() => setIsSessionOpen(false)}>Clôturer Définitivement</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium opacity-80">Solde Actuel (Théorique)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{soldeTheorique.toFixed(2)} DH</div>
            <div className="flex items-center gap-2 mt-1 opacity-80">
              <Wallet className="h-4 w-4" />
              <span className="text-xs">Initial: {soldeInitial.toFixed(2)} DH</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Entrées</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{(totalVentes + totalApports).toFixed(2)} DH</div>
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <ArrowUpRight className="h-3 w-3" />
              <span className="text-xs">Ventes + Apports</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Sorties</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">-{totalDepenses.toFixed(2)} DH</div>
            <div className="flex items-center gap-1 mt-1 text-muted-foreground">
              <ArrowDownRight className="h-3 w-3" />
              <span className="text-xs">Dépenses & Versements</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Dernières Transactions</CardTitle>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">Nouvelle Transaction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Ajouter une Transaction</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez le type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEPENSE">Dépense</SelectItem>
                      <SelectItem value="APPORT">Apport</SelectItem>
                      <SelectItem value="VERSEMENT">Versement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Libellé</Label>
                  <Input placeholder="Ex: Achat café, Transport..." />
                </div>
                <div className="space-y-2">
                  <Label>Montant (DH)</Label>
                  <Input type="number" placeholder="0.00" />
                </div>
              </div>
              <DialogFooter>
                <Button>Enregistrer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Heure</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{t.date}</TableCell>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === "VENTE" ? "default" : t.type === "DEPENSE" ? "destructive" : "secondary"}>
                      {t.type}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-right font-bold", t.montant > 0 ? "text-green-600" : "text-destructive")}>
                    {t.montant > 0 ? "+" : ""}{t.montant.toFixed(2)} DH
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}
