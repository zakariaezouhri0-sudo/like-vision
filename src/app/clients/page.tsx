
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
import { formatPhoneNumber } from "@/lib/utils";

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
    client.phone?.replace(/\s/g, '').includes(searchTerm.replace(/\s/g, ''))
  ) || [];

  const handleCreateClient = () => {
    if (!newClient.name || !newClient.phone) {
      toast({ variant: "destructive", title: "Erreur", description: "Nom et téléphone obligatoires." });
      return;
    }

    // On nettoie le téléphone avant stockage pour indexation
    const cleanedPhone = newClient.phone.replace(/\s/g, '');

    const clientData = {
      name: newClient.name,
      phone: cleanedPhone,
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
      phone: editingClient.phone.replace(/\s/g, ''),
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
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
          <div>
            <h1 className="text-4xl font-black text-primary uppercase tracking-tighter">Fichier Clients</h1>
            <p className="text-[12px] font-black uppercase text-muted-foreground opacity-60 tracking-[0.3em] mt-1">Gestion des dossiers et ordonnances.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto h-16 font-black shadow-2xl rounded-2xl px-12 text-base">
                <Plus className="mr-3.5 h-7 w-7" /> NOUVEAU CLIENT
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[32px] p-8">
              <DialogHeader>
                <DialogTitle className="font-black uppercase text-primary text-2xl tracking-tight">Nouveau Dossier</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-6">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-black text-muted-foreground ml-1 tracking-widest">Nom Complet</Label>
                  <Input placeholder="M. Mohamed Alami" className="h-12 rounded-xl font-bold border-muted-foreground/20" value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-black text-muted-foreground ml-1 tracking-widest">Téléphone</Label>
                  <Input placeholder="06 00 00 00 00" className="h-12 rounded-xl font-bold border-muted-foreground/20" value={newClient.phone} onChange={(e) => setNewClient({...newClient, phone: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase font-black text-muted-foreground ml-1 tracking-widest">Mutuelle</Label>
                  <Select value={newClient.mutuelle} onValueChange={(v) => setNewClient({...newClient, mutuelle: v})}>
                    <SelectTrigger className="h-12 rounded-xl font-bold border-muted-foreground/20"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateClient} className="w-full h-14 text-lg font-black rounded-2xl shadow-xl">ENREGISTRER LE CLIENT</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[40px] bg-white">
          <CardHeader className="py-8 px-10 bg-slate-50/50 border-b">
            <div className="relative max-w-md w-full">
              <Search className="absolute left-5 top-4.5 h-6 w-6 text-primary/40 mt-0.5" />
              <Input placeholder="Rechercher par nom ou téléphone..." className="pl-14 h-16 text-base font-bold border-none bg-white shadow-inner rounded-2xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-5">
                  <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
                  <span className="text-sm font-black uppercase text-muted-foreground tracking-[0.3em]">Accès au fichier...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead className="text-sm uppercase font-black px-10 py-7 tracking-widest text-slate-500">Client</TableHead>
                      <TableHead className="text-sm uppercase font-black px-10 py-7 tracking-widest text-slate-500">Téléphone</TableHead>
                      <TableHead className="text-sm uppercase font-black px-10 py-7 tracking-widest text-slate-500">Mutuelle</TableHead>
                      <TableHead className="text-sm uppercase font-black px-10 py-7 tracking-widest text-slate-500 hidden md:table-cell">Dernière Visite</TableHead>
                      <TableHead className="text-right text-sm uppercase font-black px-10 py-7 tracking-widest text-slate-500">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c: any) => (
                        <TableRow key={c.id} className="hover:bg-primary/5 border-b last:border-0 transition-all">
                          <TableCell className="px-10 py-9">
                            <div className="flex items-center gap-6">
                              <div className="h-14 w-14 rounded-[20px] bg-primary/10 flex items-center justify-center shadow-inner shrink-0"><User className="h-7 w-7 text-primary" /></div>
                              <span className="text-lg font-black text-slate-900 leading-none">{c.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-black text-primary px-10 py-9 tracking-tighter">
                            {formatPhoneNumber(c.phone)}
                          </TableCell>
                          <TableCell className="px-10 py-9">
                            <Badge variant="outline" className="text-[11px] font-black uppercase border-primary/20 bg-primary/5 text-primary px-5 py-2.5 rounded-xl shadow-sm tracking-widest">
                              {c.mutuelle}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-bold text-muted-foreground px-10 py-9 hidden md:table-cell">{c.lastVisit}</TableCell>
                          <TableCell className="text-right px-10 py-9">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-12 w-12 hover:bg-primary/10 rounded-2xl transition-all"><MoreVertical className="h-7 w-7" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-[28px] p-4 shadow-2xl border-primary/10 min-w-[220px]">
                                <DropdownMenuItem onClick={() => setEditingClient(c)} className="py-4 font-black text-sm uppercase cursor-pointer rounded-2xl"><Edit2 className="mr-4 h-6 w-6 text-primary" /> Modifier</DropdownMenuItem>
                                <DropdownMenuItem className="py-4 font-black text-sm uppercase cursor-pointer rounded-2xl"><History className="mr-4 h-6 w-6 text-primary" /> Ordonnance</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive py-4 font-black text-sm uppercase cursor-pointer rounded-2xl" onClick={() => handleDeleteClient(c.id, c.name)}><Trash2 className="mr-4 h-6 w-6" /> Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-40 text-sm font-black uppercase text-muted-foreground opacity-30 italic tracking-[0.4em]">Aucun dossier trouvé dans la base.</TableCell></TableRow>
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
