"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Filter } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency } from "@/lib/utils";

const marginData = [
  { id: 1, date: "01/05/2024", client: "M. Ahmed Mansour", mutuelle: "CNSS", vente: 2500, achat: 1200, marge: 1300 },
  { id: 2, date: "02/05/2024", client: "Mme Sara Benali", mutuelle: "CNOPS", vente: 1800, achat: 750, marge: 1050 },
  { id: 3, date: "02/05/2024", client: "M. Driss El Fassi", mutuelle: "FAR", vente: 3200, achat: 1400, marge: 1800 },
  { id: 4, date: "03/05/2024", client: "Mme Fatima Zahra", mutuelle: "Aucun", vente: 1500, achat: 600, marge: 900 },
];

export default function ReportsPage() {
  const totalVentes = marginData.reduce((acc, d) => acc + d.vente, 0);
  const totalMarges = marginData.reduce((acc, d) => acc + d.marge, 0);
  const avgMarge = (totalMarges / totalVentes * 100).toFixed(1);

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Rapports & Analyses</h1>
            <p className="text-muted-foreground">Outils d'analyse de performance et suivi des marges.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <Button variant="outline" className="flex-1 md:flex-none">
              <Filter className="mr-2 h-4 w-4" />
              Filtrer
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 flex-1 md:flex-none">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Exporter
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Chiffre d'Affaires Période</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold whitespace-nowrap">{formatCurrency(totalVentes)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Marge Brute Totale</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent whitespace-nowrap">{formatCurrency(totalMarges)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Taux de Marge Moyen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgMarge}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tableau de Marge par Client</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Client</TableHead>
                    <TableHead className="whitespace-nowrap">Mutuelle</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Prix Vente</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Prix Achat</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Marge Brute</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marginData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap">{row.date}</TableCell>
                      <TableCell className="font-medium whitespace-nowrap">{row.client}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline">{row.mutuelle}</Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">
                        {formatCurrency(row.vente)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                        {formatCurrency(row.achat)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-accent whitespace-nowrap">
                        {formatCurrency(row.marge)}
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
