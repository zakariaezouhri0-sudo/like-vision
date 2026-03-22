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
import { Search, Plus, History, User, Loader2, MoreVertical, Edit2, Trash2, Users } from "lucide-react";
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
    if (savedRole) setRole(savedRole.toUpperCase());
    else router.push('/login');
    setIsHydrated(true);
  }, [router]);

  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";
  const isPrepaMode = role === "PREPA";

  const clientsQuery = useMemoFirebase(() => query(collection(db, "clients"), orderBy("createdAt", "desc"), limit(500)), [db]);
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
    addDoc(collection(db, "clients"), { name: newClient.name.toUpperCase(), phone: newClient.phone.replace(/\s/g, ''), mutuelle: newClient.mutuelle, isDraft: isPrepaMode, createdAt: serverTimestamp() })
      .then(() => { toast({ variant: "success", title: "Client créé" }); setIsCreateOpen(false); setNewClient({ name: "", phone: "", mutuelle: "Aucun" }); });
  };

  const handleUpdateClient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingClient?.name) return;
    updateDoc(doc(db, "clients", editingClient.id), { name: editingClient.name.toUpperCase(), phone: editingClient.phone.replace(/\s/g, ''), mutuelle: editingClient.mutuelle, updatedAt: serverTimestamp() })
      .then(() => { toast({ variant: "success", title: "Client mis à jour" }); setIsEditOpen(false); });
  };

  const handleDeleteClient = (client: any) => {
    if (confirm(`Supprimer définitivement "${client.name}" ?`)) deleteDoc(doc(db, "clients", client.id)).then(() => toast({ variant: "success", title: "Client supprimé" }));
  };

  if (!isClientReady || role === null) return null;

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter flex items-center gap-4">
              <Users className="h-8 w-8 text-[#D4AF37]/40" />
              Fichier Clients
            </h1>
            <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">Gestion luxury de la base clientèle.</p>
          </div>
          <Button 
            onClick={() => setIsCreateOpen(true)} 
            className="h-12 px-10 font-black rounded-full shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all uppercase tracking-widest text-xs"
          >
            <Plus className="mr-2 h-5 w-5" />NOUVEAU CLIENT
          </Button>
        </div>

        <Card className="shadow-xl shadow-slate-200/50 rounded-[60px] bg-white border-none overflow-hidden">
          <CardHeader className="p-10 border-b bg-slate-50">
            <div className="relative max-w-md">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D4AF37]" />
              <input placeholder="Chercher un client..." className="w-full pl-14 h-12 text-sm font-bold rounded-2xl border-none shadow-inner outline-none bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Client</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Téléphone</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Mutuelle</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-24"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                  ) : filteredClients.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-slate-50 transition-all border-b last:border-0">
                      <TableCell className="px-10 py-6 font-black text-sm uppercase text-[#0D1B2A]">{c.name}</TableCell>
                      <TableCell className="px-10 py-6 font-bold text-xs tabular-nums text-slate-500">{formatPhoneNumber(c.phone)}</TableCell>
                      <TableCell className="px-10 py-6"><Badge className="text-[9px] font-black uppercase bg-[#0D1B2A]/5 text-[#0D1B2A] rounded-full py-1 px-3 border-none" variant="outline">{c.mutuelle}</Badge></TableCell>
                      <TableCell className="text-right px-10 py-6">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100"><MoreVertical className="h-5 w-5 text-slate-400" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-[24px] p-2 min-w-[180px] shadow-2xl">
                            <DropdownMenuItem onClick={() => router.push(`/ventes?search=${encodeURIComponent(c.name)}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><History className="mr-3 h-4 w-4 text-[#D4AF37]" /> Historique</DropdownMenuItem>
                            {isAdminOrPrepa && (
                              <>
                                <DropdownMenuItem onClick={() => { setEditingClient({ ...c }); setIsEditOpen(true); }} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-blue-600" /> Modifier</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteClient(c)} className="py-3 font-black text-[10px] uppercase cursor-pointer text-destructive rounded-xl"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}><DialogContent className="max-w-md rounded-[60px] p-10"><form onSubmit={handleCreateClient}><DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] text-center tracking-widest">Nouveau Dossier</DialogTitle></DialogHeader><div className="space-y-6 py-8"><div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Nom Complet</Label><Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} /></div><div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Téléphone</Label><Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} /></div></div><DialogFooter><Button type="submit" className="w-full h-14 font-black rounded-full shadow-xl tracking-widest bg-[#D4AF37] text-[#0D1B2A]">ENREGISTRER</Button></DialogFooter></form></DialogContent></Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md rounded-[60px] p-10">
          <form onSubmit={handleUpdateClient}>
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-[#0D1B2A] text-center tracking-widest">Modifier Client</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-8">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black ml-2">Nom Complet</Label>
                <Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={editingClient?.name || ''} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black ml-2">Téléphone</Label>
                <Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={editingClient?.phone || ''} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-black ml-2">Mutuelle</Label>
                <Select value={editingClient?.mutuelle || "Aucun"} onValueChange={value => setEditingClient({...editingClient, mutuelle: value})}>
                  <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-[32px]">{MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-black text-[10px] uppercase">{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full h-14 font-black rounded-full shadow-xl tracking-widest bg-[#D4AF37] text-[#0D1B2A]">METTRE À JOUR</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}