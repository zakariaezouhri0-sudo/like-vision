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
import { cn } from "@/lib/utils";

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
        toast({ variant: "success", title: "Succès", description: "Le client a été enregistré." });
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
        toast({ variant: "success", title: "Mis à jour", description: "Dossier client modifié." });
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
        toast({ variant: "success", title: "Supprimé", description: "Dossier supprimé." });
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
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Fichier Clients</h1>
            <p className="text-[11px] font-black uppercase text-muted-foreground opacity-60 tracking-[0.2em]">Gestion des dossiers et ordonnances.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto h-14 font-black shadow-xl rounded-2xl px-10">
                <Plus className="mr-3 h-6 w-6" /> NOUVEAU CLIENT
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl">
              <DialogHeader>
                <DialogTitle className="font-black uppercase text-primary text-xl">Nouveau Dossier</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Nom Complet</Label>
                  <Input placeholder="M. Mohamed Alami" className="h-11 rounded-xl font-bold" value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Téléphone</Label>
                  <Input placeholder="06 00 00 00 00" className="h-11 rounded-xl font-bold" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Mutuelle</Label>
                  <Select value={newClient.mutuelle} onValueChange={(v) => setNewClient({...newClient, mutuelle: v})}>
                    <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={handleCreateClient} className="w-full h-14 text-lg font-black rounded-2xl shadow-xl">ENREGISTRER</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingClient} onOpenChange={(open) => !open && setEditingClient(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-primary text-xl">Modifier Dossier</DialogTitle>
            </DialogHeader>
            {editingClient && (
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Nom Complet</Label>
                  <Input className="h-11 rounded-xl font-bold" value={editingClient.name} onChange={(e) => setEditingClient({...editingClient, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Téléphone</Label>
                  <Input className="h-11 rounded-xl font-bold" value={editingClient.phone} onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Mutuelle</Label>
                  <Select value={editingClient.mutuelle} onValueChange={(v) => setEditingClient({...editingClient, mutuelle: v})}>
                    <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter><Button onClick={handleUpdateClient} className="w-full h-14 text-lg font-black rounded-2xl shadow-xl">SAUVEGARDER</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px]">
          <CardHeader className="py-6 px-8 bg-muted/20 border-b">
            <div className="relative max-w-sm w-full">
              <Search className="absolute left-4 top-4 h-5 w-5 text-primary/40" />
              <Input placeholder="Rechercher un dossier..." className="pl-12 h-14 text-sm font-bold border-none bg-white shadow-inner rounded-2xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="h-14 w-14 animate-spin text-primary opacity-20" />
                  <span className="text-sm font-black uppercase text-muted-foreground tracking-[0.2em]">Chargement des dossiers...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead className="text-sm uppercase font-black px-8 py-6 tracking-widest text-slate-500">Client</TableHead>
                      <TableHead className="text-sm uppercase font-black px-8 py-6 tracking-widest text-slate-500">Téléphone</TableHead>
                      <TableHead className="text-sm uppercase font-black px-8 py-6 tracking-widest text-slate-500">Mutuelle</TableHead>
                      <TableHead className="text-sm uppercase font-black px-8 py-6 tracking-widest text-slate-500 hidden md:table-cell">Dernière Visite</TableHead>
                      <TableHead className="text-right text-sm uppercase font-black px-8 py-6 tracking-widest text-slate-500">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c: any) => (
                        <TableRow key={c.id} className="hover:bg-primary/5 border-b last:border-0 transition-all">
                          <TableCell className="px-8 py-8">
                            <div className="flex items-center gap-5">
                              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner shrink-0"><User className="h-6 w-6 text-primary" /></div>
                              <span className="text-base font-black text-slate-900 leading-none">{c.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-black text-primary px-8 py-8 tracking-tighter">{c.phone}</TableCell>
                          <TableCell className="px-8 py-8">
                            <Badge variant="outline" className="text-[10px] font-black uppercase border-primary/20 bg-primary/5 text-primary px-4 py-2 rounded-xl shadow-sm">
                              {c.mutuelle}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-bold text-muted-foreground px-8 py-8 hidden md:table-cell">{c.lastVisit}</TableCell>
                          <TableCell className="text-right px-8 py-8">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-11 w-11 hover:bg-primary/10 rounded-2xl transition-all"><MoreVertical className="h-6 w-6" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-3xl p-3 shadow-2xl border-primary/10 min-w-[180px]">
                                <DropdownMenuItem onClick={() => setEditingClient(c)} className="py-3 font-black text-sm uppercase cursor-pointer rounded-2xl"><Edit2 className="mr-3 h-5 w-5 text-primary" /> Modifier</DropdownMenuItem>
                                <DropdownMenuItem className="py-3 font-black text-sm uppercase cursor-pointer rounded-2xl"><History className="mr-3 h-5 w-5 text-primary" /> Ordonnance</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive py-3 font-black text-sm uppercase cursor-pointer rounded-2xl" onClick={() => handleDeleteClient(c.id, c.name)}><Trash2 className="mr-3 h-5 w-5" /> Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-32 text-sm font-black uppercase text-muted-foreground opacity-30 italic tracking-[0.3em]">Aucun dossier trouvé.</TableCell></TableRow>
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