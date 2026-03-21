"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Shield, User, MoreVertical, Edit2, Trash2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/layout/app-shell";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useRouter } from "next/navigation";

export default function UsersPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    // Autoriser ADMIN et PREPA
    if (role !== 'ADMIN' && role !== 'PREPA') {
      router.push('/dashboard');
    } else {
      setLoadingRole(false);
    }
  }, [router]);
  
  const usersQuery = useMemoFirebase(() => {
    return query(collection(db, "users"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: users, isLoading } = useCollection(usersQuery);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    role: "OPTICIENNE",
    password: ""
  });

  const handleCreateUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newUser.name || !newUser.username || !newUser.password) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez remplir tous les champs." });
      return;
    }

    const userData = {
      name: newUser.name,
      username: newUser.username.toLowerCase().trim(),
      role: newUser.role,
      password: newUser.password,
      status: "Actif",
      createdAt: serverTimestamp(),
    };

    setIsCreateOpen(false);
    setNewUser({ name: "", username: "", role: "OPTICIENNE", password: "" });

    addDoc(collection(db, "users"), userData)
      .then(() => {
        toast({ variant: "success", title: "Succès", description: "L'utilisateur a été enregistré." });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "users", operation: "create", requestResourceData: userData }));
      });
  };

  const handleUpdateUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingUser) return;
    const userRef = doc(db, "users", editingUser.id);
    const updateData = { name: editingUser.name, role: editingUser.role, password: editingUser.password };
    setEditingUser(null);
    updateDoc(userRef, updateData)
      .then(() => toast({ variant: "success", title: "Mis à jour" }))
      .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: "update", requestResourceData: updateData })));
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (!confirm(`Supprimer ${name} ?`)) return;
    const userRef = doc(db, "users", id);
    deleteDoc(userRef)
      .then(() => toast({ variant: "success", title: "Supprimé" }))
      .catch(() => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: "delete" })));
  };

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0D1B2A]">Gestion des Utilisateurs</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider opacity-60">Accès et sécurité du magasin.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white w-full sm:w-auto h-11 font-black shadow-lg uppercase text-[10px] tracking-widest rounded-full px-8">
                <UserPlus className="mr-2 h-5 w-5" /> NOUVEL UTILISATEUR
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[40px]">
              <form onSubmit={handleCreateUser}>
                <DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] tracking-widest text-center">Nouveau Membre</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-400">Nom complet</Label><Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} autoFocus /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-400">Login</Label><Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-black text-slate-400">Rôle</Label>
                      <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                        <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="ADMIN" className="font-bold">Administrateur</SelectItem>
                          <SelectItem value="OPTICIENNE" className="font-bold">Opticienne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-400">Mot de passe</Label><Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} /></div>
                  </div>
                </div>
                <DialogFooter><Button type="submit" className="w-full h-14 text-base font-black shadow-xl rounded-full bg-[#D4AF37] text-[#0D1B2A] uppercase tracking-widest">CRÉER LE COMPTE</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-xl shadow-slate-200/50 border-none overflow-hidden rounded-[60px] bg-white">
          <CardHeader className="py-6 px-10 bg-slate-50 border-b"><CardTitle className="text-[11px] font-black uppercase tracking-widest text-[#0D1B2A]/60">Membres du Personnel ({users?.length || 0})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow><TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Nom complet</TableHead><TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Identifiant</TableHead><TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Accès</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-24"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                  ) : users?.map((u: any) => (
                    <TableRow key={u.id} className="hover:bg-slate-50 transition-all border-b last:border-0">
                      <TableCell className="px-10 py-6"><span className="text-sm font-black text-[#0D1B2A] uppercase">{u.name}</span></TableCell>
                      <TableCell className="text-sm font-black text-[#D4AF37] px-10 py-6 uppercase tracking-wider">{u.username}</TableCell>
                      <TableCell className="px-10 py-6"><Badge variant="outline" className="text-[10px] font-black uppercase bg-[#0D1B2A]/5 text-[#0D1B2A] border-none px-3 py-1 rounded-full">{u.role}</Badge></TableCell>
                      <TableCell className="text-right px-10 py-6">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100"><MoreVertical className="h-5 w-5 text-slate-400" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-[24px] p-2 min-w-[180px] shadow-2xl">
                            <DropdownMenuItem onClick={() => setEditingUser(u)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-blue-600" /> Modifier</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl" onClick={() => handleDeleteUser(u.id, u.name)}><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>
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

      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-[40px]">
          <form onSubmit={handleUpdateUser}>
            <DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] tracking-widest text-center">Modifier Compte</DialogTitle></DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-400">Nom complet</Label><Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-slate-400">Rôle</Label>
                    <Select value={editingUser.role} onValueChange={(v) => setEditingUser({...editingUser, role: v})}>
                      <SelectTrigger className="h-12 rounded-2xl bg-slate-50 border-none font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl"><SelectItem value="ADMIN" className="font-bold">Administrateur</SelectItem><SelectItem value="OPTICIENNE" className="font-bold">Opticienne</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-slate-400">Nouveau mot de passe</Label><Input className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={editingUser.password} onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} /></div>
                </div>
              </div>
            )}
            <DialogFooter><Button type="submit" className="w-full h-14 text-base font-black shadow-xl rounded-full bg-[#D4AF37] text-[#0D1B2A] uppercase tracking-widest">ENREGISTRER LES MODIFICATIONS</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
