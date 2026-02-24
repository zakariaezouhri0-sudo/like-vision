"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, Eye, Plus } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn } from "@/lib/utils";

const MOCK_SALES = [
  { id: "OPT-2024-001", date: "10/05/2024", client: "Ahmed Mansour", mutuelle: "CNSS", total: 1200, avance: 1200, reste: 0, statut: "Payé" },
  { id: "OPT-2024-002", date: "11/05/2024", client: "Sara Benali", mutuelle: "CNOPS", total: 1800, avance: 800, reste: 1000, statut: "Partiel" },
  { id: "OPT-2024-003", date: "12/05/2024", client: "Driss El Fassi", mutuelle: "FAR", total: 3200, avance: 0, reste: 3200, statut: "En attente" },
  { id: "OPT-2024-004", date: "12/05/2024", client: "Fatima Zahra", mutuelle: "Aucun", total: 1500, avance: 1500, reste: 0, statut: "Payé" },
];

export default function SalesHistoryPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSales = MOCK_SALES.filter(sale => 
    sale.client.toLowerCase().includes(searchTerm.toLowerCase()) || 
    sale.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Historique des Ventes</h1>
            <p className="text-sm text-muted-foreground">Suivi des factures et règlements clients.</p>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto shadow-md">
            <Link href="/ventes/nouvelle">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle Vente
            </Link>
          </Button>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="py-4 px-6 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Chercher client ou N° facture..." 
                className="pl-10 h-9 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase">Facture</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase">Date</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase">Client</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase text-right">Total</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase text-right">Avance</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase text-right">Reste</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase text-center">Statut</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold text-xs uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold whitespace-nowrap text-primary text-xs">{sale.id}</TableCell>
                      <TableCell className="whitespace-nowrap text-[10px] text-muted-foreground">{sale.date}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold text-xs">{sale.client}</TableCell>
                      <TableCell className="whitespace-nowrap text-right font-medium text-xs">{formatCurrency(sale.total)}</TableCell>
                      <TableCell className="text-green-600 font-bold whitespace-nowrap text-right text-xs">{formatCurrency(sale.avance)}</TableCell>
                      <TableCell className={cn("whitespace-nowrap text-right font-black text-xs", sale.reste > 0 ? "text-destructive" : "text-muted-foreground/30")}>
                        {formatCurrency(sale.reste)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-center">
                        <Badge className="text-[9px] font-black px-2 py-0 h-5" variant={
                          sale.statut === "Payé" ? "default" : 
                          sale.statut === "Partiel" ? "secondary" : "outline"
                        }>
                          {sale.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Détails">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Imprimer">
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
