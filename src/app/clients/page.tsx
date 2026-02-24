"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Eye, History, User, Loader2, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/layout/app-shell";
import { MUTUELLES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
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
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
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
      toast({ variant: "destructive", title: "Erreur", description: "Nom et téléphone obligatoires." });
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

    // Fermeture immédiate du dialogue
    setIsCreateOpen(false);
    setNewClient({ name: "", phone: "", mutuelle: "Aucun" });

    addDoc(collection(db, "clients"), clientData)
      .then(() => {
        toast({ title: "Client enregistré", description: `${clientData.name} a été ajouté.` });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "clients", operation: "create", requestResourceData: clientData }));
      });
  };

  const handleUpdateClient = () => {
    if (!editingClient) return;
    const clientRef = doc(db, "clients", editingClient.id);
    const updateData = {
      name: editingClient.name,
      phone: editingClient.phone,
      mutuelle: editingClient.mutuelle
    };

    // Fermeture immédiate du dialogue
    setEditingClient(null);

    updateDoc(clientRef, updateData)
      .then(() => {
        toast({ title: "Modifié", description: "Le client a été mis à jour." });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: clientRef.path, operation: "update", requestResourceData: updateData }));
      });
  };

  const handleDeleteClient = (id: string, name: string) => {
    if (!confirm(`Supprimer le dossier de ${name} ?`)) return;
    const clientRef = doc(db, "clients", id);
    deleteDoc(clientRef)
      .then(() => {
        toast({ title: "Supprimé", description: "Dossier supprimé avec succès." });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: clientRef.path, operation: "delete" }));
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
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto shadow-md">
                <Plus className="mr-2 h-4 w-4" /> Nouveau Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau Dossier Client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-bold text-muted-foreground">Nom Complet</Label>
                  <Input placeholder="M. Mohamed Alami" value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-bold text-muted-foreground">Téléphone</Label>
                  <Input placeholder="06 00 00 00 00" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-bold text-muted-foreground">Mutuelle</Label>
                  <Select value={newClient.mutuelle} onValueChange={(v) => setNewClient({...newClient, mutuelle: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={handleCreateClient} className="w-full">Enregistrer</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier le Client</DialogTitle>
            </DialogHeader>
            {editingClient && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-bold text-muted-foreground">Nom Complet</Label>
                  <Input value={editingClient.name} onChange={(e) => setEditingClient({...editingClient, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-bold text-muted-foreground">Téléphone</Label>
                  <Input value={editingClient.phone} onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-bold text-muted-foreground">Mutuelle</Label>
                  <Select value={editingClient.mutuelle} onValueChange={(v) => setEditingClient({...editingClient, mutuelle: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter><Button onClick={handleUpdateClient} className="w-full">Sauvegarder</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="shadow-sm border-none overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Nom ou téléphone..." className="pl-10 h-9 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[11px] uppercase font-bold px-4 py-3">Client</TableHead>
                      <TableHead className="text-[11px] uppercase font-bold px-4 py-3">Téléphone</TableHead>
                      <TableHead className="text-[11px] uppercase font-bold px-4 py-3">Mutuelle</TableHead>
                      <TableHead className="text-[11px] uppercase font-bold px-4 py-3 hidden md:table-cell">Dernière Visite</TableHead>
                      <TableHead className="text-right text-[11px] uppercase font-bold px-4 py-3">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c: any) => (
                        <TableRow key={c.id} className="hover:bg-muted/10 border-b last:border-0">
                          <TableCell className="font-medium px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-3.5 w-3.5 text-primary" /></div>
                              <span className="text-xs md:text-sm">{c.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-bold px-4 py-4">{c.phone}</TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge variant="outline" className="text-[9px] font-bold uppercase border-primary/20 bg-primary/5 text-primary">
                              {c.mutuelle}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground px-4 py-4 hidden md:table-cell">{c.lastVisit}</TableCell>
                          <TableCell className="text-right px-4 py-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingClient(c)}><Edit2 className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
                                <DropdownMenuItem><History className="mr-2 h-4 w-4" /> Historique</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteClient(c.id, c.name)}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground italic">Aucun client trouvé.</TableCell></TableRow>
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