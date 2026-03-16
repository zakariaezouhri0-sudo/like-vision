
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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

  const isPrepaMode = role === "PREPA";
  
  // OPTIMISATION QUOTA : Limite à 100 clients
  const clientsQuery = useMemoFirebase(() => {
    return query(collection(db, "clients"), orderBy("createdAt", "desc"), limit(100));
  }, [db]);

  const { data: allClients, isLoading: loading, error } = useCollection(clientsQuery);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", phone: "", parentPhone: "", mutuelle: "Aucun" });
  const [newCustomMutuelle, setNewCustomMutuelle] = useState("");

  const [editingClient, setEditingClient] = useState<any>(null);
  const [editCustomMutuelle, setEditCustomMutuelle] = useState("");

  const filteredClients = useMemo(() => {
    if (!allClients || !role) return [];
    
    return allClients
      .filter((c: any) => {
        const matchesMode = isPrepaMode ? c.isDraft === true : (c.isDraft !== true);
        if (!matchesMode) return false;

        const search = searchTerm.toLowerCase().trim();
        if (!search) return true;

        const clientName = (c.name || "").toLowerCase();
        const clientPhone = (c.phone || "").replace(/\s/g, "");
        const parentPhone = (c.parentPhone || "").replace(/\s/g, "");
        const searchClean = search.replace(/\s/g, "");

        return clientName.includes(search) || 
               clientPhone.includes(searchClean) || 
               parentPhone.includes(searchClean);
      });
  }, [allClients, searchTerm, isPrepaMode, role]);

  const validatePhone = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (raw.length > 10) return false;
    if (raw.length >= 1 && raw[0] !== '0') return false;
    if (raw.length >= 2 && !['6', '7', '8'].includes(raw[1])) return false;
    return true;
  };

  const handleCreateClient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentRole = localStorage.getItem('user_role')?.toUpperCase();
    if (!currentRole) return;
    
    const currentIsDraft = currentRole === "PREPA";

    if (!newClient.name) {
      toast({ variant: "destructive", title: "Erreur", description: "Le nom est obligatoire." });
      return;
    }

    const finalMutuelle = newClient.mutuelle === "Autre" ? newCustomMutuelle : newClient.mutuelle;
    const cleanedPhone = newClient.phone ? newClient.phone.replace(/\s/g, '') : "";
    const cleanedParentPhone = newClient.parentPhone ? newClient.parentPhone.replace(/\s/g, '') : "";

    const clientData = {
      name: newClient.name,
      phone: cleanedPhone,
      parentPhone: cleanedParentPhone,
      mutuelle: finalMutuelle || "Aucun",
      lastVisit: new Date().toLocaleDateString("fr-FR"),
      ordersCount: 0,
      isDraft: currentIsDraft,
      createdAt: serverTimestamp(),
    };

    setIsCreateOpen(false);
    setNewClient({ name: "", phone: "", parentPhone: "", mutuelle: "Aucun" });
    setNewCustomMutuelle("");

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

  const handleOpenEdit = (client: any) => {
    const isStandard = MUTUELLES.filter(m => m !== "Autre").includes(client.mutuelle);
    setEditingClient({
      ...client,
      phone: client.phone || "",
      parentPhone: client.parentPhone || "",
      mutuelle: isStandard ? client.mutuelle : (client.mutuelle === "Aucun" ? "Aucun" : "Autre")
    });
    setEditCustomMutuelle(isStandard ? "" : (client.mutuelle === "Aucun" ? "" : client.mutuelle));
  };

  const handleUpdateClient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingClient || !role) return;
    const clientRef = doc(db, "clients", editingClient.id);
    const finalMutuelle = editingClient.mutuelle === "Autre" ? editCustomMutuelle : editingClient.mutuelle;
    
    const updateData = {
      name: editingClient.name,
      phone: editingClient.phone ? editingClient.phone.replace(/\s/g, '') : "",
      parentPhone: editingClient.parentPhone ? editingClient.parentPhone.replace(/\s/g, '') : "",
      mutuelle: finalMutuelle || "Aucun"
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
    if (!confirm(`Supprimer définitivement le dossier de ${name} ?`)) return;
    const clientRef = doc(db, "clients", id);
    deleteDoc(clientRef)
      .then(() => {
        toast({ variant: "success", title: "Supprimé", description: "Le dossier a été effacé." });
      })
      .catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: clientRef.path, operation: "delete" }));
      });
  };

  const goToHistory = (name: string) => {
    if (!name) {
      toast({ title: "Note", description: "Nom du client manquant." });
      return;
    }
    router.push(`/ventes?search=${encodeURIComponent(name.trim())}`);
  };

  if (!isClientReady || role === null) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vérification de sécurité...</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">
              Fichier Clients {isPrepaMode ? "(Brouillon)" : ""}
            </h1>
            <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60 tracking-[0.3em] mt-1">Gestion des dossiers (100 derniers).</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto h-14 font-black shadow-xl rounded-2xl px-8">
                <Plus className="mr-2 h-6 w-6" /> NOUVEAU CLIENT
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[24px]">
              <form onSubmit={handleCreateClient}>
                <DialogHeader>
                  <DialogTitle className="font-black uppercase text-primary text-xl">Nouveau Dossier {isPrepaMode ? "Brouillon" : ""}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nom Complet</Label>
                    <Input placeholder="M. Mohamed Alami" className="h-11 rounded-xl font-bold" value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} autoFocus />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Téléphone Client</Label>
                      <Input placeholder="06 00 00 00 00" className="h-11 rounded-xl font-bold" value={formatPhoneNumber(newClient.phone)} onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (validatePhone(raw)) setNewClient({...newClient, phone: raw});
                      }} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase text-orange-600 ml-1">Numéro Parent / Tuteur</Label>
                      <Input placeholder="06 00 00..." className="h-11 rounded-xl font-bold border-orange-100 bg-orange-50/30" value={formatPhoneNumber(newClient.parentPhone)} onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        if (validatePhone(raw)) setNewClient({...newClient, parentPhone: raw});
                      }} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Mutuelle</Label>
                    <Select value={newClient.mutuelle} onValueChange={(v) => setNewClient({...newClient, mutuelle: v})}>
                      <SelectTrigger className="h-11 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {newClient.mutuelle === "Autre" && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Libellé Mutuelle</Label>
                      <Input placeholder="Précisez la mutuelle..." className="h-11 rounded-xl font-bold" value={newCustomMutuelle} onChange={(e) => setNewCustomMutuelle(e.target.value)} />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full h-12 text-base font-black rounded-xl shadow-xl">ENREGISTRER</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="p-4 md:p-6 border-b bg-slate-50/50">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-primary/40" />
              <input 
                placeholder="Chercher par nom, téléphone ou parent..." 
                className="w-full pl-12 h-12 text-sm font-bold rounded-xl border-none shadow-inner bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Accès au fichier...</span>
                </div>
              ) : error ? (
                <div className="p-12 text-center text-destructive font-bold">
                  Erreur de chargement des clients.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#064e3b]">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest text-white whitespace-nowrap">Client</TableHead>
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest text-white whitespace-nowrap">Téléphone</TableHead>
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest text-white whitespace-nowrap">Lien Parent</TableHead>
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest text-white whitespace-nowrap">Mutuelle</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest text-white whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.length > 0 ? (
                      filteredClients.map((c: any) => (
                        <TableRow key={c.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                          <TableCell className="px-4 md:px-8 py-4 md:py-5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shadow-inner shrink-0">
                                <User className="h-4 w-4 text-primary" />
                              </div>
                              <span className="text-xs md:text-sm font-black text-slate-800 uppercase leading-none">{c.name || "---"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs md:text-sm font-black text-primary px-4 md:px-8 py-4 md:py-5 tracking-tighter whitespace-nowrap">
                            {c.phone ? formatPhoneNumber(c.phone) : <span className="text-slate-300">---</span>}
                          </TableCell>
                          <TableCell className="px-4 md:px-8 py-4 md:py-5">
                            {c.parentPhone ? (
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5">
                                  <Users className="h-3 w-3 text-orange-500" />
                                  <span className="text-[10px] font-black text-orange-600 tabular-nums">{formatPhoneNumber(c.parentPhone)}</span>
                                </div>
                                <Badge variant="outline" className="text-[7px] font-black uppercase mt-1 px-1.5 h-4 border-orange-200 bg-orange-50 text-orange-700 w-fit">Tuteur</Badge>
                              </div>
                            ) : <span className="text-slate-200">---</span>}
                          </TableCell>
                          <TableCell className="px-4 md:px-8 py-4 md:py-5">
                            <Badge 
                              className="text-[8px] md:text-[9px] px-2 md:px-3 py-1 font-black rounded-lg uppercase tracking-tighter shadow-sm border-none bg-blue-100 text-blue-700 whitespace-nowrap"
                              variant="outline"
                            >
                              {c.mutuelle || "---"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-4 md:py-5">
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 hover:bg-primary/10 rounded-xl transition-all">
                                  <MoreVertical className="h-4 w-4 md:h-5 md:w-5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-primary/10 min-w-[180px]">
                                <DropdownMenuItem onClick={() => goToHistory(c.name)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl">
                                  <History className="mr-3 h-4 w-4 text-primary" /> Historique
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenEdit(c)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl">
                                  <Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl" onClick={() => handleDeleteClient(c.id, c.name)}>
                                  <Trash2 className="mr-3 h-4 w-4" /> Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-32 text-xs font-black uppercase text-muted-foreground opacity-30 tracking-[0.4em]">
                          Aucun dossier trouvé.
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

      <Dialog open={!!editingClient} onOpenChange={(o) => !o && setEditingClient(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <form onSubmit={handleUpdateClient}>
            <DialogHeader><DialogTitle className="font-black uppercase text-primary">Modifier Dossier</DialogTitle></DialogHeader>
            {editingClient && (
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Nom Complet</Label>
                  <Input className="font-bold" value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black">Téléphone Client</Label>
                    <Input className="font-bold" value={formatPhoneNumber(editingClient.phone)} onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (validatePhone(raw)) setEditingClient({...editingClient, phone: raw});
                    }} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-orange-600">Numéro Parent</Label>
                    <Input className="font-bold border-orange-100 bg-orange-50/30" value={formatPhoneNumber(editingClient.parentPhone)} onChange={e => {
                      const raw = e.target.value.replace(/\D/g, '');
                      if (validatePhone(raw)) setEditingClient({...editingClient, parentPhone: raw});
                    }} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black">Mutuelle</Label>
                  <Select value={editingClient.mutuelle} onValueChange={v => setEditingClient({...editingClient, mutuelle: v})}>
                    <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {editingClient.mutuelle === "Autre" && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                    <Label className="text-[10px] uppercase font-black">Libellé Mutuelle</Label>
                    <Input placeholder="Précisez la mutuelle..." className="font-bold" value={editCustomMutuelle} onChange={(e) => setEditCustomMutuelle(e.target.value)} />
                  </div>
                )}
              </div>
            )}
            <DialogFooter><Button type="submit" className="w-full h-12 font-black rounded-xl">ENREGISTRER</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
