
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
    if (role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
      setLoadingRole(false);
    }
  }, [router]);
  
  const usersQuery = useMemoFirebase(() => {
    return query(collection(db, "users"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: users, loading } = useCollection(usersQuery);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    role: "CAISSIER",
    password: ""
  });

  const handleCreateUser = () => {
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
    setNewUser({ name: "", username: "", role: "CAISSIER", password: "" });

    addDoc(collection(db, "users"), userData)
      .then(() => {
        toast({ variant: "success", title: "Succès", description: "L'utilisateur a été enregistré." });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "users", operation: "create", requestResourceData: userData }));
      });
  };

  const handleUpdateUser = () => {
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
            <h1 className="text-2xl font-bold text-primary">Gestion des Utilisateurs</h1>
            <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider opacity-60">Accès et sécurité du magasin.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto h-11 font-black shadow-lg">
                <UserPlus className="mr-2 h-5 w-5" /> NOUVEL UTILISATEUR
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
              <DialogHeader><DialogTitle className="font-black uppercase text-primary">Nouveau Membre</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Nom complet</Label><Input value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} /></div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Login</Label><Input value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Rôle</Label>
                    <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="ADMIN">Administrateur</SelectItem><SelectItem value="CAISSIER">Caissier</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black text-muted-foreground">Mot de passe</Label><Input value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={handleCreateUser} className="w-full h-12 text-base font-black shadow-xl">CRÉER LE COMPTE</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-2xl">
          <CardHeader className="py-4 px-6 bg-muted/20 border-b"><CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Membres du Personnel ({users?.length || 0})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow><TableHead className="text-sm uppercase font-black px-6 py-4">Nom complet</TableHead><TableHead className="text-sm uppercase font-black px-6 py-4">Identifiant</TableHead><TableHead className="text-sm uppercase font-black px-6 py-4">Accès</TableHead><TableHead className="text-right text-sm uppercase font-black px-6 py-4">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((u: any) => (
                    <TableRow key={u.id} className="hover:bg-muted/10 border-b last:border-0">
                      <TableCell className="px-6 py-5"><span className="text-sm font-bold text-slate-900">{u.name}</span></TableCell>
                      <TableCell className="text-sm font-black text-primary px-6 py-5 uppercase">{u.username}</TableCell>
                      <TableCell className="px-6 py-5"><Badge variant="outline" className="text-[10px] font-black uppercase bg-muted/30">{u.role}</Badge></TableCell>
                      <TableCell className="text-right px-6 py-5">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10"><MoreVertical className="h-5 w-5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2">
                            <DropdownMenuItem onClick={() => setEditingUser(u)} className="py-2.5 font-bold text-sm cursor-pointer"><Edit2 className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive py-2.5 font-bold text-sm cursor-pointer" onClick={() => handleDeleteUser(u.id, u.name)}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
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
    </AppShell>
  );
}
