"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Eye, History, Phone } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

const MOCK_CLIENTS = [
  { id: 1, name: "Ahmed Mansour", phone: "06 61 22 33 44", lastVisit: "10/05/2024", mutuelle: "CNSS", orders: 3 },
  { id: 2, name: "Sara Benali", phone: "06 70 11 22 33", lastVisit: "11/05/2024", mutuelle: "CNOPS", orders: 1 },
  { id: 3, name: "Driss El Fassi", phone: "06 12 34 56 78", lastVisit: "12/05/2024", mutuelle: "FAR", orders: 5 },
  { id: 4, name: "Fatima Zahra", phone: "06 55 44 33 22", lastVisit: "12/05/2024", mutuelle: "Aucun", orders: 2 },
];

export default function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = MOCK_CLIENTS.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    client.phone.includes(searchTerm)
  );

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary">Fichier Clients</h1>
            <p className="text-muted-foreground">Gestion des dossiers clients et historique des ordonnances.</p>
          </div>
          <Button className="bg-primary">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Client
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par nom ou téléphone..." 
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
                  <TableHead>Client</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Mutuelle</TableHead>
                  <TableHead>Dernière Visite</TableHead>
                  <TableHead>Commandes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {client.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{client.mutuelle}</Badge>
                    </TableCell>
                    <TableCell>{client.lastVisit}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="rounded-sm">
                        {client.orders} commande(s)
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" title="Voir dossier">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Historique ventes">
                          <History className="h-4 w-4" />
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
    </AppShell>
  );
}
