"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Eye, History, Phone, User } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MUTUELLES } from "@/lib/constants";

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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Fichier Clients</h1>
            <p className="text-sm text-muted-foreground">Gestion des dossiers et historique des ordonnances.</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto shadow-md">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau Dossier Client</DialogTitle>
                <CardDescription>Saisissez les informations pour créer un nouveau dossier.</CardDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nom Complet</Label>
                  <Input id="name" placeholder="M. Mohamed Alami" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input id="phone" placeholder="06 00 00 00 00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mutuelle">Mutuelle / Couverture</Label>
                  <Select defaultValue="Aucun">
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez" />
                    </SelectTrigger>
                    <SelectContent>
                      {MUTUELLES.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button className="w-full">Enregistrer le client</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="py-4 px-6 border-b">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Nom ou téléphone..." 
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
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase">Client</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase">Téléphone</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase">Mutuelle</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase">Dernière Visite</TableHead>
                    <TableHead className="whitespace-nowrap font-bold text-xs uppercase">Commandes</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold text-xs uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow key={client.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                          {client.name}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs font-medium">
                        {client.phone}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="text-[10px] font-bold px-2 h-5">
                          {client.mutuelle}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{client.lastVisit}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="secondary" className="text-[9px] font-bold rounded-sm h-5">
                          {client.orders} commande(s)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Voir dossier">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Historique">
                            <History className="h-4 w-4" />
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
