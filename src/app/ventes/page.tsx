"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Printer, Eye } from "lucide-react";
import Link from "next/link";
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Facture</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Avance</TableHead>
                <TableHead>Reste</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.id}</TableCell>
                  <TableCell>{sale.date}</TableCell>
                  <TableCell>{sale.client}</TableCell>
                  <TableCell>{formatCurrency(sale.total)}</TableCell>
                  <TableCell className="text-green-600 font-medium">{formatCurrency(sale.avance)}</TableCell>
                  <TableCell className={sale.reste > 0 ? "text-destructive font-bold" : ""}>
                    {formatCurrency(sale.reste)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={
                      sale.statut === "Payé" ? "default" : 
                      sale.statut === "Partiel" ? "secondary" : "outline"
                    }>
                      {sale.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
        </CardContent>
      </Card>
    </div>
  );
}
