
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, History, User, Loader2, MoreVertical, Edit2, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/layout/app-shell";
import { MUTUELLES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ClientsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  
  const clientsQuery = useMemoFirebase(() => {
    return query(collection(db, "clients"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: clients, isLoading: loading } = useCollection(clientsQuery);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [newClient, setNewClient] = useState({
    name: "",
    phone: "",
    mutuelle: "Aucun"
  });

  const filteredClients = clients?.filter((client: any) => 
    client.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    client.phone?.includes(searchTerm)
  ) || [];

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

    setIsCreateOpen(false);
    setNewClient({ name: "", phone: "", mutuelle: "Aucun" });

    addDoc(collection(db, "clients"), clientData)
      .then(() => {
        toast({ title: "Client enregistré", description: `${clientData.name} a été ajouté.` });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: "clients", 
          operation: "create", 
          requestResourceData: clientData 
        }));
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

    setEditingClient(null);

    updateDoc(clientRef, updateData)
      .then(() => {
        toast({ title: "Modifié", description: "Le client a été mis à jour." });
      })
      .catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: clientRef.path, 
          operation: "update", 
          requestResourceData: updateData 
        }));
      });
  };

  const handleDeleteClient = (id: string, name: string) => {
    if (!confirm(`Supprimer le dossier de ${name} ?`)) return;
    const clientRef = doc(db, "clients", id);
    deleteDoc(clientRef)
      .then(() => {
        toast({ title: "Supprimé", description: "Dossier supprimé avec succès." });
      })
      .catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: clientRef.path, operation: "delete" }));
      });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary uppercase tracking-tighter">Fichier Clients</h1>
            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Gestion des dossiers et ordonnances.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto h-11 font-black shadow-lg">
                <Plus className="mr-2 h-5 w-5" /> NOUVEAU CLIENT
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-black uppercase text-primary">Nouveau Dossier</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Nom Complet</Label>
                  <Input placeholder="M. Mohamed Alami" value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Téléphone</Label>
                  <Input placeholder="06 00 00 00 00" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Mutuelle</Label>
                  <Select value={newClient.mutuelle} onValueChange={(v) => setNewClient({...newClient, mutuelle: v})}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={handleCreateClient} className="w-full h-12 text-base font-black">ENREGISTRER</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-primary">Modifier Client</DialogTitle>
            </DialogHeader>
            {editingClient && (
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Nom Complet</Label>
                  <Input value={editingClient.name} onChange={(e) => setEditingClient({...editingClient, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Téléphone</Label>
                  <Input value={editingClient.phone} onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Mutuelle</Label>
                  <Select value={editingClient.mutuelle} onValueChange={(v) => setEditingClient({...editingClient, mutuelle: v})}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter><Button onClick={handleUpdateClient} className="w-full h-12 text-base font-black">SAUVEGARDER</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="shadow-sm border-none overflow-hidden rounded-2xl">
          <CardHeader className="py-4 px-6 bg-muted/20 border-b">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Rechercher par nom ou téléphone..." className="pl-10 h-11 text-sm font-bold border-muted-foreground/20 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                  <span className="text-sm font-bold text-muted-foreground">Chargement des dossiers...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-sm uppercase font-black px-6 py-4">Client</TableHead>
                      <TableHead className="text-sm uppercase font-black px-6 py-4">Téléphone</TableHead>
                      <TableHead className="text-sm uppercase font-black px-6 py-4">Mutuelle</TableHead>
                      <TableHead className="text-sm uppercase font-black px-6 py-4 hidden md:table-cell">Dernière Visite</TableHead>
                      <TableHead className="text-right text-sm uppercase font-black px-6 py-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c: any) => (
                        <TableRow key={c.id} className="hover:bg-muted/10 border-b last:border-0 transition-colors">
                          <TableCell className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shadow-inner"><User className="h-4 w-4 text-primary" /></div>
                              <span className="text-sm font-bold text-slate-900">{c.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-black text-slate-700 px-6 py-5 tracking-tighter">{c.phone}</TableCell>
                          <TableCell className="px-6 py-5">
                            <Badge variant="outline" className="text-[10px] font-black uppercase border-primary/20 bg-primary/5 text-primary px-3 py-0.5">
                              {c.mutuelle}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-bold text-muted-foreground px-6 py-5 hidden md:table-cell">{c.lastVisit}</TableCell>
                          <TableCell className="text-right px-6 py-5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-muted rounded-full"><MoreVertical className="h-5 w-5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl p-2 shadow-xl border-primary/10">
                                <DropdownMenuItem onClick={() => setEditingClient(c)} className="py-2.5 font-bold text-sm cursor-pointer"><Edit2 className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
                                <DropdownMenuItem className="py-2.5 font-bold text-sm cursor-pointer"><History className="mr-2 h-4 w-4" /> Historique</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive py-2.5 font-bold text-sm cursor-pointer" onClick={() => handleDeleteClient(c.id, c.name)}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-20 text-sm text-muted-foreground font-bold italic">Aucun client trouvé.</TableCell></TableRow>
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
