"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, Eye } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency } from "@/lib/utils";

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
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Historique des Ventes</h1>
            <p className="text-muted-foreground">Consultez et gérez toutes les transactions passées.</p>
          </div>
          <Button asChild>
            <Link href="/ventes/nouvelle">Nouvelle Vente</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par client ou N° facture..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Facture</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Client</TableHead>
                    <TableHead className="whitespace-nowrap">Total</TableHead>
                    <TableHead className="whitespace-nowrap">Avance</TableHead>
                    <TableHead className="whitespace-nowrap">Reste</TableHead>
                    <TableHead className="whitespace-nowrap">Statut</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium whitespace-nowrap">{sale.id}</TableCell>
                      <TableCell className="whitespace-nowrap">{sale.date}</TableCell>
                      <TableCell className="whitespace-nowrap">{sale.client}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{formatCurrency(sale.total)}</TableCell>
                      <TableCell className="text-green-600 font-bold whitespace-nowrap">{formatCurrency(sale.avance)}</TableCell>
                      <TableCell className={cn("whitespace-nowrap", sale.reste > 0 ? "text-destructive font-black" : "")}>
                        {formatCurrency(sale.reste)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={
                          sale.statut === "Payé" ? "default" : 
                          sale.statut === "Partiel" ? "secondary" : "outline"
                        }>
                          {sale.statut}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" title="Voir détails">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Imprimer">
                            <Printer className="h-4 w-4" />
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
