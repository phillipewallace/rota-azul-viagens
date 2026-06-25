/**
 * Card de cliente na grid. Apenas apresentação — toda ação sai via callback.
 */
import React from 'react';
import { Building2, Edit3, History, MapPin, Phone, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Customer } from '@/hooks/useCustomers';
import { maskDocument } from '@/utils/brazilianDocs';
import { getPersonType } from '@/utils/customerHelpers';

interface Props {
  customer: Customer;
  sanCount: number;
  isDuplicate: boolean;
  duplicateReason?: string;
  onEdit: (c: Customer) => void;
  onHistory: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}

export const CustomerCard: React.FC<Props> = ({
  customer: c, sanCount, isDuplicate, duplicateReason, onEdit, onHistory, onDelete,
}) => {
  const type = getPersonType(c);
  return (
    <Card className={`hover:shadow-md transition-shadow relative ${isDuplicate ? 'ring-2 ring-amber-400 bg-amber-50/30' : ''}`}>
      {isDuplicate && (
        <div
          className="absolute -top-2 left-3 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full shadow"
          title={duplicateReason}
        >
          ⚠ {duplicateReason}
        </div>
      )}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              {c.customerName || <span className="italic text-muted-foreground">Sem nome</span>}
            </div>
            {c.document && (
              <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                {type} · {maskDocument(c.document, type)}
              </div>
            )}
            {c.address && (
              <div className="text-xs text-muted-foreground flex items-start gap-1 mt-1">
                <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">
                  {c.address}{c.cidade ? `, ${c.cidade}/${c.estado || ''}` : ''}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge variant={type === 'PF' ? 'outline' : 'secondary'} className="text-[10px]">{type}</Badge>
            {sanCount > 0 && <Badge className="bg-blue-100 text-blue-700">{sanCount} sanit.</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {c.contactPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.contactPhone}</span>}
          {c.email && <span>📧 {c.email}</span>}
        </div>
        <div className="flex gap-1 pt-2 border-t">
          <Button size="sm" variant="ghost" className="flex-1 gap-1" onClick={() => onEdit(c)}>
            <Edit3 className="h-3.5 w-3.5" />Editar
          </Button>
          <Button size="sm" variant="ghost" className="flex-1 gap-1" onClick={() => onHistory(c)}>
            <History className="h-3.5 w-3.5" />Histórico
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(c)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
