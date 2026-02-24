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
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-primary">Historique</h1>
            <p className="text-[10px] text-muted-foreground">Suivi des factures.</p>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto h-8 text-xs shadow-md">
            <Link href="/ventes/nouvelle">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Nouvelle Vente
            </Link>
          </Button>
        </div>

        <Card className="shadow-sm border-none">
          <CardHeader className="p-3 md:p-4 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                placeholder="Chercher..." 
                className="pl-8 h-8 text-xs"
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
                    <TableHead className="text-[10px] uppercase font-bold whitespace-nowrap">Facture</TableHead>
                    <TableHead className="text-[10px] uppercase font-bold whitespace-nowrap">Client</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold whitespace-nowrap">Total</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-bold whitespace-nowrap">Reste</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-bold whitespace-nowrap">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30">
                      <TableCell className="font-bold text-[10px] whitespace-nowrap text-primary">{sale.id}</TableCell>
                      <TableCell className="font-medium text-[10px] whitespace-nowrap">{sale.client}</TableCell>
                      <TableCell className="text-right font-medium text-[10px] whitespace-nowrap">{formatCurrency(sale.total)}</TableCell>
                      <TableCell className={cn("text-right font-black text-[10px] whitespace-nowrap", sale.reste > 0 ? "text-destructive" : "text-muted-foreground/30")}>
                        {formatCurrency(sale.reste)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="text-[8px] px-1.5 h-4" variant={sale.statut === "Payé" ? "default" : "outline"}>
                          {sale.statut}
                        </Badge>
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
