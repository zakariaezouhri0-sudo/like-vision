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
    <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
      <h3 className="font-semibold text-primary border-b pb-2 mb-4">{side === "OD" ? "Oeil Droit (OD)" : "Oeil Gauche (OG)"}</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-xs">Sphère</Label>
          <Input 
            placeholder="+0.00" 
            value={values.sph} 
            onChange={(e) => onChange(side, "sph", e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Cylindre</Label>
          <Input 
            placeholder="-0.00" 
            value={values.cyl} 
            onChange={(e) => onChange(side, "cyl", e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Axe</Label>
          <Input 
            placeholder="0°" 
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <PrescriptionSide side="OD" values={od} onChange={onChange} />
      <PrescriptionSide side="OG" values={og} onChange={onChange} />
    </div>
  );
}
