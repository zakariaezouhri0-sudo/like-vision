import { NextResponse } from ' some next/server';
import { db, initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { startOfDay, endOfDay, parseISO, isValid } from 'date-fns';

const API_KEY = process.env.API_SECURE_KEY || "LV-2026-SECURE";

export async function GET(request: Request) {
  // Ensure Firebase is initialized
  initializeFirebase();

  const { searchParams } = new URL(request.url);
  
  // Vérification de la clé de sécurité
  const key = searchParams.get('key');
  if (key !== API_KEY) {
    return NextResponse.json({ error: "Non autorisé. Clé API invalide." }, { status: 401 });
  }

  const type = searchParams.get('type') || 'ALL'; 
  const mode = searchParams.get('mode') === 'DRAFT' ? true : false;
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');

  try {
    // Filtres de dates
    let start = startDateStr ? startOfDay(parseISO(startDateStr)) : startOfDay(new Date(2026, 0, 1));
    let end = endDateStr ? endOfDay(parseISO(endDateStr)) : endOfDay(new Date());

    if (!isValid(start)) start = startOfDay(new Date(2026, 0, 1));
    if (!isValid(end)) end = endOfDay(new Date());

    let results: any = {
      metadata: {
        generatedAt: new Date().toISOString(),
        filters: { type, mode, start: start.toISOString(), end: end.toISOString() }
      }
    };

    // 1. Récupération des Transactions
    const transRef = collection(db, "transactions");
    const transQuery = query(
      transRef,
      where("isDraft", "==", mode),
      where("createdAt", ">=", Timestamp.fromDate(start)),
      where("createdAt", "<=", Timestamp.fromDate(end))
    );

    const transSnap = await getDocs(transQuery);
    const allTrans = transSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    if (type === 'ALL' || type === 'ACHATS') {
      results.achats = allTrans.filter((t: any) => t.type === "ACHAT VERRES" || t.type === "ACHAT MONTURE");
    }
    if (type === 'ALL' || type === 'DEPENSES') {
      results.depenses = allTrans.filter((t: any) => t.type === "DEPENSE");
    }
    if (type === 'ALL' || type === 'VERSEMENTS') {
      results.versements = allTrans.filter((t: any) => t.type === "VERSEMENT");
    }

    // 2. Récupération des Ventes détaillées
    if (type === 'ALL' || type === 'VENTES') {
      const salesRef = collection(db, "sales");
      const salesQuery = query(
        salesRef,
        where("isDraft", "==", mode),
        where("createdAt", ">=", Timestamp.fromDate(start)),
        where("createdAt", "<=", Timestamp.fromDate(end))
      );
      const salesSnap = await getDocs(salesQuery);
      results.ventes = salesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ 
      error: "Erreur technique lors de l'extraction", 
      message: error.message,
      code: error.code 
    }, { status: 500 });
  }
}