"use client";

import { useState, useEffect, useMemo } from "react";
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
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where, limit } from "firebase/firestore";
import { formatPhoneNumber } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function ClientsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [isClientReady, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole) {
      setRole(savedRole.toUpperCase());
    } else {
      router.push('/login');
    }
    setIsHydrated(true);
  }, [router]);

  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";
  const isPrepaMode = role === "PREPA";
  
  const clientsQuery = useMemoFirebase(() => {
    return query(collection(db, "clients"), orderBy("createdAt", "desc"), limit(200));
  }, [db]);

  const { data: allClients, isLoading: loading } = useCollection(clientsQuery);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone: "", mutuelle: "Aucun" });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  const filteredClients = useMemo(() => {
    if (!allClients || !role) return [];
    return allClients.filter((c: any) => {
      const matchesMode = isPrepaMode ? c.isDraft === true : (c.isDraft !== true);
      if (!matchesMode) return false;
      const search = searchTerm.toLowerCase().trim();
      if (!search) return true;
      return (c.name || "").toLowerCase().includes(search) || (c.phone || "").includes(search.replace(/\s/g, ""));
    });
  }, [allClients, searchTerm, isPrepaMode, role]);

  const handleCreateClient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newClient.name) return;
    const clientData = {
      name: newClient.name.toUpperCase(),
      phone: newClient.phone.replace(/\s/g, ''),
      mutuelle: newClient.mutuelle,
      lastVisit: new Date().toLocaleDateString("fr-FR"),
      ordersCount: 0,
      isDraft: isPrepaMode,
      createdAt: serverTimestamp(),
    };
    setIsCreateOpen(false);
    setNewClient({ name: "", phone: "", mutuelle: "Aucun" });
    addDoc(collection(db, "clients"), clientData).then(() => toast({ variant: "success", title: "Client créé" }));
  };

  const handleUpdateClient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingClient || !editingClient.name) return;

    const clientRef = doc(db, "clients", editingClient.id);
    const updateData = {
      name: editingClient.name.toUpperCase(),
      phone: editingClient.phone.replace(/\s/g, ''),
      mutuelle: editingClient.mutuelle,
      updatedAt: serverTimestamp()
    };

    updateDoc(clientRef, updateData)
      .then(() => {
        toast({ variant: "success", title: "Client mis à jour" });
        setIsEditOpen(false);
        setEditingClient(null);
      })
      .catch(() => toast({ variant: "destructive", title: "Erreur lors de la mise à jour" }));
  };

  const handleDeleteClient = (client: any) => {
    if (!confirm(`Supprimer définitivement le client "${client.name}" ?`)) return;
    
    deleteDoc(doc(db, "clients", client.id))
      .then(() => toast({ variant: "success", title: "Client supprimé" }))
      .catch(() => toast({ variant: "destructive", title: "Erreur lors de la suppression" }));
  };

  if (!isClientReady || role === null) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black text-primary uppercase">Fichier Clients</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild><Button className="h-12 px-8 font-black rounded-xl shadow-lg"><Plus className="mr-2 h-5 w-5" />NOUVEAU CLIENT</Button></DialogTrigger>
            <DialogContent className="max-w-md rounded-2xl">
              <form onSubmit={handleCreateClient}>
                <DialogHeader><DialogTitle className="font-black uppercase text-primary">Nouveau Dossier</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Nom Complet</Label><Input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} autoFocus /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Téléphone</Label><Input value={formatPhoneNumber(newClient.phone)} onChange={e => setNewClient({...newClient, phone: e.target.value})} /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Mutuelle</Label><Select value={newClient.mutuelle} onValueChange={v => setNewClient({...newClient, mutuelle: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <DialogFooter><Button type="submit" className="w-full font-black rounded-xl">ENREGISTRER</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm rounded-[24px] bg-white overflow-hidden">
          <CardHeader className="p-6 border-b bg-slate-50/50">
            <div className="relative max-w-md"><Search className="absolute left-4 top-3 h-4 w-4 text-primary/40" /><input placeholder="Chercher un client..." className="w-full pl-11 h-10 text-sm font-bold rounded-xl border-none shadow-inner outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#6a8036]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-8 py-4 text-white">Client</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-8 py-4 text-white">Téléphone</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-8 py-4 text-white">Mutuelle</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-8 py-4 text-white">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="h-8 w-8 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                  ) : filteredClients.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-slate-50">
                      <TableCell className="px-8 py-4 font-bold text-xs uppercase">{c.name}</TableCell>
                      <TableCell className="px-8 py-4 font-bold text-xs tabular-nums">{formatPhoneNumber(c.phone)}</TableCell>
                      <TableCell className="px-8 py-4"><Badge className="text-[8px] font-black uppercase bg-blue-50 text-blue-700 border-blue-100" variant="outline">{c.mutuelle}</Badge></TableCell>
                      <TableCell className="text-right px-8 py-4">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2 min-w-[160px]">
                            <DropdownMenuItem onClick={() => router.push(`/ventes?search=${encodeURIComponent(c.name)}`)} className="py-2.5 font-bold text-xs cursor-pointer"><History className="mr-2 h-4 w-4" /> Historique</DropdownMenuItem>
                            {isAdminOrPrepa && (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => { setEditingClient({ ...c }); setIsEditOpen(true); }} 
                                  className="py-2.5 font-bold text-xs cursor-pointer"
                                >
                                  <Edit2 className="mr-2 h-4 w-4" /> Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteClient(c)} 
                                  className="py-2.5 font-bold text-xs cursor-pointer text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={handleUpdateClient}>
            <DialogHeader><DialogTitle className="font-black uppercase text-primary">Modifier Client</DialogTitle></DialogHeader>
            {editingClient && (
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Nom Complet</Label>
                  <Input value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Téléphone</Label>
                  <Input value={formatPhoneNumber(editingClient.phone)} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Mutuelle</Label>
                  <Select value={editingClient.mutuelle} onValueChange={v => setEditingClient({...editingClient, mutuelle: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter><Button type="submit" className="w-full font-black rounded-xl">METTRE À JOUR</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}