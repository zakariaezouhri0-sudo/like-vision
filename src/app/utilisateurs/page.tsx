
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
import { UserPlus, Shield, User, MoreVertical, Edit2, Trash2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/layout/app-shell";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function UsersPage() {
  const { toast } = useToast();
  const db = useFirestore();
  
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
        toast({ title: "Succès", description: "L'utilisateur a été enregistré." });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: "users", 
          operation: "create", 
          requestResourceData: userData 
        }));
      });
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    const userRef = doc(db, "users", editingUser.id);
    const updateData = {
      name: editingUser.name,
      role: editingUser.role,
      password: editingUser.password
    };

    setEditingUser(null);

    updateDoc(userRef, updateData)
      .then(() => {
        toast({ title: "Mis à jour", description: "Modification enregistrée." });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: userRef.path, 
          operation: "update", 
          requestResourceData: updateData 
        }));
      });
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer ${name} ?`)) return;
    const userRef = doc(db, "users", id);
    deleteDoc(userRef)
      .then(() => {
        toast({ title: "Supprimé", description: "L'utilisateur a été retiré." });
      })
      .catch(() => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
          path: userRef.path, 
          operation: "delete"
        }));
      });
  };

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
                <UserPlus className="mr-2 h-5 w-5" />
                NOUVEL UTILISATEUR
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-black uppercase text-primary">Nouveau Membre</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Nom complet</Label>
                  <Input placeholder="Prénom Nom" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Login (Identifiant)</Label>
                  <Input placeholder="ex: amine" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Rôle</Label>
                    <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Administrateur</SelectItem>
                        <SelectItem value="CAISSIER">Caissier / Opticien</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground">Mot de passe</Label>
                    <Input type="text" placeholder="Pass..." value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateUser} className="w-full h-12 text-base font-black shadow-xl">CRÉER LE COMPTE</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-black uppercase text-primary">Modifier Utilisateur</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Nom complet</Label>
                  <Input value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Mot de passe</Label>
                  <Input value={editingUser.password} onChange={(e) => setEditingUser({...editingUser, password: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black text-muted-foreground">Rôle</Label>
                  <Select value={editingUser.role} onValueChange={(v) => setEditingUser({...editingUser, role: v})}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrateur</SelectItem>
                      <SelectItem value="CAISSIER">Caissier / Opticien</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleUpdateUser} className="w-full h-12 text-base font-black">SAUVEGARDER</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="shadow-sm border-none overflow-hidden rounded-2xl">
          <CardHeader className="py-4 px-6 bg-muted/20 border-b">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Membres du Personnel ({users?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary opacity-50" />
                  <span className="text-sm font-bold text-muted-foreground">Chargement...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-sm uppercase font-black px-6 py-4">Nom complet</TableHead>
                      <TableHead className="text-sm uppercase font-black px-6 py-4">Identifiant</TableHead>
                      <TableHead className="text-sm uppercase font-black px-6 py-4">Accès</TableHead>
                      <TableHead className="text-right text-sm uppercase font-black px-6 py-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users && users.length > 0 ? (
                      users.map((u: any) => (
                        <TableRow key={u.id} className="hover:bg-muted/10 border-b last:border-0 transition-colors">
                          <TableCell className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shadow-inner"><User className="h-4 w-4 text-primary" /></div>
                              <span className="text-sm font-bold text-slate-900">{u.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-black text-primary px-6 py-5 uppercase tracking-tighter">{u.username}</TableCell>
                          <TableCell className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              {u.role === 'ADMIN' ? <Shield className="h-3.5 w-3.5 text-primary" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
                              <Badge variant="outline" className="text-[10px] font-black uppercase bg-muted/30 px-2 py-0.5 rounded border-none shadow-none">{u.role}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-6 py-5">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-muted rounded-full"><MoreVertical className="h-5 w-5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl p-2 shadow-xl border-primary/10">
                                <DropdownMenuItem onClick={() => setEditingUser(u)} className="py-2.5 font-bold text-sm cursor-pointer"><Edit2 className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive py-2.5 font-bold text-sm cursor-pointer" onClick={() => handleDeleteUser(u.id, u.name)}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={4} className="text-center py-20 text-sm text-muted-foreground font-bold italic">Aucun utilisateur trouvé.</TableCell></TableRow>
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
