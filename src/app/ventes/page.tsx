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
            <h1 className="text-xl font-bold text-primary">Historique des Ventes</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">Suivi complet des factures.</p>
          </div>
          <Button asChild size="sm" className="w-full sm:w-auto h-9 text-xs font-bold shadow-md">
            <Link href="/ventes/nouvelle">
              <Plus className="mr-1.5 h-4 w-4" />
              Nouvelle Vente
            </Link>
          </Button>
        </div>

        <Card className="shadow-sm border-none overflow-hidden">
          <CardHeader className="p-3 md:p-4 border-b bg-muted/20">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Chercher par client ou ID..." 
                className="pl-9 h-9 text-sm"
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
                    <TableHead className="text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Facture</TableHead>
                    <TableHead className="text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Client</TableHead>
                    <TableHead className="text-right text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Total</TableHead>
                    <TableHead className="text-right text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Reste</TableHead>
                    <TableHead className="text-center text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30 border-b last:border-0">
                      <TableCell className="font-bold text-xs whitespace-nowrap text-primary px-4 py-4">{sale.id}</TableCell>
                      <TableCell className="font-medium text-xs whitespace-nowrap px-4 py-4">{sale.client}</TableCell>
                      <TableCell className="text-right font-medium text-xs whitespace-nowrap px-4 py-4">{formatCurrency(sale.total)}</TableCell>
                      <TableCell className={cn("text-right font-black text-xs whitespace-nowrap px-4 py-4", sale.reste > 0 ? "text-destructive" : "text-muted-foreground/30")}>
                        {formatCurrency(sale.reste)}
                      </TableCell>
                      <TableCell className="text-center px-4 py-4">
                        <Badge 
                          className="text-[10px] px-2 py-0.5 font-black rounded-sm whitespace-nowrap" 
                          variant={sale.statut === "Payé" ? "default" : sale.statut === "En attente" ? "destructive" : "outline"}
                        >
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
