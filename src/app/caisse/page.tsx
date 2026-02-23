"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Wallet, LogOut, ArrowUpRight, ArrowDownRight, Printer, Coins } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency } from "@/lib/utils";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export default function CaissePage() {
  const router = useRouter();
  const [isSessionOpen, setIsSessionOpen] = useState(true);
  const [soldeInitial, setSoldeInitial] = useState(500);
  
  const [denoms, setDenoms] = useState<Record<number, number>>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
  });

  const soldeReel = useMemo(() => {
    return Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0);
  }, [denoms]);

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

  const handleUpdateDenom = (val: number, qty: string) => {
    setDenoms(prev => ({ ...prev, [val]: Number(qty) || 0 }));
  };

  const handleCloturerEtImprimer = () => {
    const params = new URLSearchParams({
      date: new Date().toLocaleDateString("fr-FR"),
      initial: soldeInitial.toString(),
      ventes: totalVentes.toString(),
      depenses: totalDepenses.toString(),
      apports: totalApports.toString(),
      reel: soldeReel.toString(),
    });
    
    Object.entries(denoms).forEach(([val, qty]) => {
      params.append(`d${val}`, qty.toString());
    });

    router.push(`/rapports/print/cloture?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Gestion de la Caisse</h1>
            <p className="text-muted-foreground">Suivi quotidien des flux financiers du magasin.</p>
          </div>
          
          {!isSessionOpen ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="lg" className="bg-primary hover:bg-primary/90 w-full md:w-auto">
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
                <Button variant="outline" size="lg" className="border-destructive text-destructive hover:bg-destructive/10 w-full md:w-auto">
                  <LogOut className="mr-2 h-5 w-5" />
                  Clôturer la Caisse
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Clôture de Session & Comptage</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2 border-b pb-2">
                      <Coins className="h-4 w-4" />
                      Détail des Espèces
                    </h3>
                    <div className="space-y-2">
                      {DENOMINATIONS.map(val => (
                        <div key={val} className="grid grid-cols-[60px_20px_1fr_100px] items-center gap-2">
                          <div className="text-right font-bold text-xs">{val} DH</div>
                          <div className="text-muted-foreground text-xs text-center">x</div>
                          <Input 
                            type="number" 
                            className="h-8 text-center" 
                            value={denoms[val]}
                            onChange={(e) => handleUpdateDenom(val, e.target.value)}
                            min="0"
                          />
                          <div className="text-right text-xs font-medium whitespace-nowrap">
                            {formatCurrency(val * (denoms[val] || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t bg-primary/5 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm">TOTAL COMPTÉ :</span>
                        <span className="text-xl font-black text-primary whitespace-nowrap">{formatCurrency(soldeReel)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-8">
                    <h3 className="text-sm font-bold uppercase text-muted-foreground border-b pb-2">Résumé Comptable</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-muted-foreground">Solde Initial:</span>
                        <span className="font-medium whitespace-nowrap">{formatCurrency(soldeInitial)}</span>
                      </div>
                      <div className="flex justify-between items-center text-green-600 gap-4">
                        <span>Total Ventes:</span>
                        <span className="font-bold whitespace-nowrap">+{formatCurrency(totalVentes)}</span>
                      </div>
                      <div className="flex justify-between items-center text-destructive gap-4">
                        <span>Total Dépenses:</span>
                        <span className="font-bold whitespace-nowrap">-{formatCurrency(totalDepenses)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-4">
                        <span className="text-muted-foreground">Total Apports:</span>
                        <span className="font-medium whitespace-nowrap">+{formatCurrency(totalApports)}</span>
                      </div>
                      <div className="pt-3 border-t font-black text-primary flex justify-between items-center gap-4">
                        <span>SOLDE THÉORIQUE:</span>
                        <span className="whitespace-nowrap">{formatCurrency(soldeTheorique)}</span>
                      </div>
                    </div>

                    <div className={cn(
                      "mt-8 p-4 rounded-lg border-2 text-center",
                      soldeReel - soldeTheorique === 0 ? "border-green-200 bg-green-50" : "border-destructive/20 bg-destructive/5"
                    )}>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Écart de Caisse</p>
                      <p className={cn("text-2xl font-black whitespace-nowrap", soldeReel - soldeTheorique >= 0 ? "text-green-600" : "text-destructive")}>
                        {soldeReel - soldeTheorique >= 0 ? "+" : ""}{formatCurrency(soldeReel - soldeTheorique)}
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t pt-4">
                  <Button variant="ghost" className="text-muted-foreground w-full sm:w-auto" onClick={() => setIsSessionOpen(false)}>Annuler</Button>
                  <Button className="bg-primary w-full sm:w-auto" onClick={handleCloturerEtImprimer}>
                    <Printer className="mr-2 h-4 w-4" />
                    Valider & Imprimer
                  </Button>
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
              <div className="text-3xl font-bold whitespace-nowrap">{formatCurrency(soldeTheorique)}</div>
              <div className="flex items-center gap-2 mt-1 opacity-80">
                <Wallet className="h-4 w-4" />
                <span className="text-xs">Initial: {formatCurrency(soldeInitial)}</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Entrées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 whitespace-nowrap">{formatCurrency(totalVentes + totalApports)}</div>
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
              <div className="text-2xl font-bold text-destructive whitespace-nowrap">-{formatCurrency(totalDepenses)}</div>
              <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                <ArrowDownRight className="h-3 w-3" />
                <span className="text-xs">Dépenses & Versements</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle>Dernières Transactions</CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto">Nouvelle Transaction</Button>
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
                  <Button className="w-full sm:w-auto">Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Heure</TableHead>
                    <TableHead className="whitespace-nowrap">Libellé</TableHead>
                    <TableHead className="whitespace-nowrap">Type</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">{t.date}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{t.label}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={t.type === "VENTE" ? "default" : t.type === "DEPENSE" ? "destructive" : "secondary"}>
                          {t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("text-right font-bold whitespace-nowrap", t.montant > 0 ? "text-green-600" : "text-destructive")}>
                        {t.montant > 0 ? "+" : ""}{formatCurrency(t.montant)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
