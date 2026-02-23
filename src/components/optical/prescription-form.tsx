"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PrescriptionFieldProps {
  side: "OD" | "OG";
  values: {
    sph: string;
    cyl: string;
    axe: string;
  };
  onChange: (side: "OD" | "OG", field: string, value: string) => void;
}

function PrescriptionSide({ side, values, onChange }: PrescriptionFieldProps) {
  return (
    <div className="space-y-2 p-3 border rounded-md bg-card shadow-sm">
      <h3 className="text-xs font-black text-primary border-b pb-1 mb-2 uppercase tracking-wider">
        {side === "OD" ? "Oeil Droit (OD)" : "Oeil Gauche (OG)"}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Sphère</Label>
          <Input 
            placeholder="+0.00" 
            className="h-8 text-xs px-2"
            value={values.sph} 
            onChange={(e) => onChange(side, "sph", e.target.value)} 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cylindre</Label>
          <Input 
            placeholder="-0.00" 
            className="h-8 text-xs px-2"
            value={values.cyl} 
            onChange={(e) => onChange(side, "cyl", e.target.value)} 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Axe</Label>
          <Input 
            placeholder="0°" 
            className="h-8 text-xs px-2"
            value={values.axe} 
            onChange={(e) => onChange(side, "axe", e.target.value)} 
          />
        </div>
      </div>
    </div>
  );
}

export function PrescriptionForm({ 
  od, 
  og, 
  onChange 
}: { 
  od: any, 
  og: any, 
  onChange: (side: "OD" | "OG", field: string, value: string) => void 
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PrescriptionSide side="OD" values={od} onChange={onChange} />
      <PrescriptionSide side="OG" values={og} onChange={onChange} />
    </div>
  );
}
