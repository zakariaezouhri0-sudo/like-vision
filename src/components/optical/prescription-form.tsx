"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PrescriptionFieldProps {
  side: "OD" | "OG";
  values: {
    sph: string;
    cyl: string;
    axe: string;
    add: string;
  };
  onChange: (side: "OD" | "OG", field: string, value: string) => void;
}

function PrescriptionSide({ side, values, onChange }: PrescriptionFieldProps) {
  return (
    <div className="space-y-2 p-4 rounded-[24px] bg-[#0D1B2A]/10 border border-[#0D1B2A]/10 shadow-inner">
      <h3 className="text-xs font-black text-[#0D1B2A] border-b border-[#0D1B2A]/10 pb-1 mb-2 uppercase tracking-widest text-center">
        {side === "OD" ? "Oeil Droit (OD)" : "Oeil Gauche (OG)"}
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Sphère", field: "sph", placeholder: "0.00" },
          { label: "Cylindre", field: "cyl", placeholder: "0.00" },
          { label: "Axe", field: "axe", placeholder: "0°" },
          { label: "ADD", field: "add", placeholder: "0.00" },
        ].map((item) => (
          <div key={item.field} className="space-y-1">
            <Label className="text-[8px] font-black uppercase text-[#0D1B2A] tracking-widest text-center block w-full">{item.label}</Label>
            <Input 
              placeholder={item.placeholder}
              className="h-9 rounded-xl bg-[#0D1B2A] border-none shadow-inner font-black text-xs text-[#D4AF37] placeholder:text-[#D4AF37]/20 text-center px-1"
              value={(values as any)[item.field]} 
              onChange={(e) => onChange(side, item.field, e.target.value)} 
            />
          </div>
        ))}
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
    <div className="grid grid-cols-1 gap-3">
      <PrescriptionSide side="OD" values={od} onChange={onChange} />
      <PrescriptionSide side="OG" values={og} onChange={onChange} />
    </div>
  );
}
