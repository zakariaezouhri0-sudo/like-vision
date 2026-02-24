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
import { UserPlus, Shield, User, MoreVertical, Edit2, Trash2, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AppShell } from "@/components/layout/app-shell";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection } from "@/firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function UsersPage() {
  const { toast } = useToast();
  const db = useFirestore();
  
  const usersQuery = useMemo(() => {
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
    if (!newUser.name || !newUser.username) {
      toast({ variant: "destructive", title: "Erreur", description: "Veuillez remplir les champs obligatoires." });
      return;
    }

    const userData = {
      name: newUser.name,
      username: newUser.username,
      role: newUser.role,
      status: "Actif",
      createdAt: serverTimestamp(),
    };

    // Fermeture immédiate du dialogue
    setIsCreateOpen(false);
    setNewUser({ name: "", username: "", role: "CAISSIER", password: "" });

    addDoc(collection(db, "users"), userData)
      .then(() => {
        toast({ title: "Utilisateur créé", description: `${userData.name} a été ajouté.` });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "users", operation: "create", requestResourceData: userData }));
      });
  };

  const handleUpdateUser = () => {
    if (!editingUser) return;
    const userRef = doc(db, "users", editingUser.id);
    const updateData = {
      name: editingUser.name,
      username: editingUser.username,
      role: editingUser.role,
      status: editingUser.status
    };

    // Fermeture immédiate du dialogue
    setEditingUser(null);

    updateDoc(userRef, updateData)
      .then(() => {
        toast({ title: "Mis à jour", description: "L'utilisateur a été modifié avec succès." });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: "update", requestResourceData: updateData }));
      });
  };

  const handleDeleteUser = (id: string, name: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer l'utilisateur ${name} ?`)) return;
    const userRef = doc(db, "users", id);
    deleteDoc(userRef)
      .then(() => {
        toast({ title: "Supprimé", description: "L'utilisateur a été retiré de la base." });
      })
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: userRef.path, operation: "delete" }));
      });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">Gestion des Utilisateurs</h1>
            <p className="text-sm text-muted-foreground">Gérez les accès et les permissions de votre équipe.</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary w-full sm:w-auto">
                <UserPlus className="mr-2 h-4 w-4" />
                Nouvel Utilisateur
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Ajouter un membre</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input placeholder="Prénom Nom" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Nom d'utilisateur / Email</Label>
                  <Input placeholder="nom.prenom@email.com" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rôle</Label>
                    <Select value={newUser.role} onValueChange={(v) => setNewUser({...newUser, role: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Administrateur</SelectItem>
                        <SelectItem value="CAISSIER">Caissier / Opticien</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mot de passe</Label>
                    <Input type="password" disabled className="bg-muted opacity-50" placeholder="Configuré via Firebase" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateUser} className="w-full">Créer le compte</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Modifier l'utilisateur</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input value={editingUser.name} onChange={(e) => setEditingUser({...editingUser, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Rôle</Label>
                  <Select value={editingUser.role} onValueChange={(v) => setEditingUser({...editingUser, role: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Administrateur</SelectItem>
                      <SelectItem value="CAISSIER">Caissier / Opticien</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={editingUser.status} onValueChange={(v) => setEditingUser({...editingUser, status: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Actif">Actif</SelectItem>
                      <SelectItem value="Suspendu">Suspendu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={handleUpdateUser} className="w-full">Sauvegarder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Card className="shadow-sm border-none overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Liste du Personnel</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-[11px] uppercase font-bold px-4 py-3">Nom</TableHead>
                      <TableHead className="text-[11px] uppercase font-bold px-4 py-3 hidden md:table-cell">Utilisateur</TableHead>
                      <TableHead className="text-[11px] uppercase font-bold px-4 py-3">Rôle</TableHead>
                      <TableHead className="text-[11px] uppercase font-bold px-4 py-3">Statut</TableHead>
                      <TableHead className="text-right text-[11px] uppercase font-bold px-4 py-3">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users && users.length > 0 ? (
                      users.map((u: any) => (
                        <TableRow key={u.id} className="hover:bg-muted/10 border-b last:border-0">
                          <TableCell className="font-medium px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center"><User className="h-3.5 w-3.5 text-primary" /></div>
                              <span className="text-xs md:text-sm">{u.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground px-4 py-4 hidden md:table-cell">{u.username}</TableCell>
                          <TableCell className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              {u.role === 'ADMIN' ? <Shield className="h-3 w-3 text-primary" /> : <User className="h-3 w-3 text-muted-foreground" />}
                              <span className="text-[10px] md:text-xs font-bold uppercase tracking-tighter">{u.role}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-4">
                            <Badge variant={u.status === "Actif" ? "default" : "secondary"} className="text-[9px] px-2 py-0 font-bold uppercase">
                              {u.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-4 py-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingUser(u)}><Edit2 className="mr-2 h-4 w-4" /> Modifier</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteUser(u.id, u.name)}><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={5} className="text-center py-10 text-xs text-muted-foreground italic">Aucun utilisateur enregistré.</TableCell></TableRow>
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