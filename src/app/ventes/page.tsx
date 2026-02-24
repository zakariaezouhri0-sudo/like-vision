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
            <p className="text-sm text-muted-foreground uppercase font-bold opacity-60">Suivi complet de vos facturations.</p>
          </div>
          <Button asChild className="w-full sm:w-auto h-12 text-sm font-black shadow-lg rounded-xl px-6">
            <Link href="/ventes/nouvelle">
              <Plus className="mr-2 h-5 w-5" />
              NOUVELLE VENTE
            </Link>
          </Button>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-2xl">
          <CardHeader className="p-5 border-b bg-muted/20">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Chercher par client ou facture..." 
                className="pl-10 h-11 text-base font-medium rounded-xl border-muted-foreground/20"
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
                    <TableHead className="text-xs uppercase font-black px-6 py-4">Facture</TableHead>
                    <TableHead className="text-xs uppercase font-black px-6 py-4">Client</TableHead>
                    <TableHead className="text-right text-xs uppercase font-black px-6 py-4">Total</TableHead>
                    <TableHead className="text-right text-xs uppercase font-black px-6 py-4">Reste</TableHead>
                    <TableHead className="text-center text-xs uppercase font-black px-6 py-4">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((sale) => (
                    <TableRow key={sale.id} className="hover:bg-muted/30 border-b last:border-0 transition-colors">
                      <TableCell className="font-black text-sm text-primary px-6 py-5">{sale.id}</TableCell>
                      <TableCell className="font-bold text-sm text-slate-800 px-6 py-5">{sale.client}</TableCell>
                      <TableCell className="text-right font-black text-sm text-slate-900 px-6 py-5">{formatCurrency(sale.total)}</TableCell>
                      <TableCell className={cn(
                        "text-right font-black text-sm px-6 py-5", 
                        sale.reste > 0 ? "text-destructive" : "text-muted-foreground/30"
                      )}>
                        {formatCurrency(sale.reste)}
                      </TableCell>
                      <TableCell className="text-center px-6 py-5">
                        <Badge 
                          className={cn(
                            "text-[10px] px-3 py-1 font-black rounded-lg uppercase tracking-tighter shadow-sm whitespace-nowrap",
                            sale.statut === "Payé" ? "bg-green-100 text-green-700 border-green-200" : 
                            sale.statut === "En attente" ? "bg-red-100 text-red-700 border-red-200" : 
                            "bg-blue-100 text-blue-700 border-blue-200"
                          )}
                          variant="outline"
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
