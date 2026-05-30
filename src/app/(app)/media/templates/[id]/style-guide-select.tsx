'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Sentinelle « aucune charte » : base-ui Select n'accepte pas "" comme valeur
// d'item, on la mappe donc sur "" via un champ caché (contrat de
// saveTemplateAction : style_guide_id "" → null).
const NONE = '__none__';

export interface GuideOption {
  id: string;
  name: string;
}

export function StyleGuideSelect({
  guides,
  defaultId,
}: {
  guides: GuideOption[];
  defaultId: string | null;
}) {
  const [value, setValue] = useState<string>(defaultId ?? NONE);

  return (
    <>
      <input type="hidden" name="style_guide_id" value={value === NONE ? '' : value} />
      <Select value={value} onValueChange={(v) => setValue((v as string) ?? NONE)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>— Aucune —</SelectItem>
          {guides.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              {g.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
