"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Eye, History, Phone, User, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MUTUELLES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ClientsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  
  const clientsQuery = useMemo(() => {
    return query(collection(db, "clients"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: clients, loading } = useCollection(clientsQuery);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    mutuelle: "Aucun"
  });

  const filteredClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter((client: any) => 
      client.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      client.phone?.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const handleCreateClient = () => {
    if (!newClient.name || !newClient.phone) {
      toast({
        variant: "destructive",
        title: "Champs manquants",
        description: "Le nom et le téléphone sont obligatoires.",
      });
      return;
    }

    const clientData = {
      name: newClient.name,
      phone: newClient.phone,
      mutuelle: newClient.mutuelle,
      lastVisit: new Date().toLocaleDateString("fr-FR"),
      ordersCount: 0,
      createdAt: serverTimestamp(),
    };

    addDoc(collection(db, "clients"), clientData)
      .then(() => {
        setIsDialogOpen(false);
        setNewClient({ name: "", phone: "", mutuelle: "Aucun" });
        toast({
          title: "Client enregistré",
          description: `Le dossier de ${newClient.name} a été créé avec succès.`,
        });
      })
      .catch(async (error) => {
        const permissionError = new FirestorePermissionError({
          path: "clients",
          operation: "create",
          requestResourceData: clientData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Fichier Clients</h1>
            <p className="text-sm text-muted-foreground">Gestion des dossiers et historique des ordonnances.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                  <Input 
                    id="name" 
                    placeholder="M. Mohamed Alami" 
                    value={newClient.name}
                    onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input 
                    id="phone" 
                    placeholder="06 00 00 00 00" 
                    value={newClient.phone}
                    onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mutuelle">Mutuelle / Couverture</Label>
                  <Select 
                    value={newClient.mutuelle} 
                    onValueChange={(v) => setNewClient({...newClient, mutuelle: v})}
                  >
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
                <Button className="w-full" onClick={handleCreateClient}>Enregistrer le client</Button>
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
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
                </div>
              ) : (
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
                    {filteredClients.length > 0 ? (
                      filteredClients.map((client: any) => (
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
                              {client.ordersCount || 0} commande(s)
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
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                          {searchTerm ? "Aucun résultat pour cette recherche." : "Aucun client dans la base. Commencez par en créer un !"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}