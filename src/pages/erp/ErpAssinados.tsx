/**
 * ERP → Assinados
 * Lista todos os PDFs gerados pela aba Assinatura, com download/abrir/excluir.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { erpService, type ErpCompany, type SignedPdf } from '@/services/erp';
import { toAbsoluteUrl } from '@/utils/absoluteUrl';
import { confirmDialog } from '@/lib/confirm';
import { Files, Download, ExternalLink, Trash2, Search, RefreshCw, FileText } from 'lucide-react';

const fmtBytes = (n?: number) => {
  if (!n || n <= 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};
const fmtDate = (s: string) => new Date(s).toLocaleString('pt-BR');

const ErpAssinados: React.FC = () => {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<ErpCompany[]>([]);
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [items, setItems] = useState<SignedPdf[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await erpService.listSignedPdfs(
        companyFilter === 'all' ? undefined : companyFilter,
      );
      setItems(list);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    erpService.listCompanies().then(setCompanies).catch(() => {});
  }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyFilter]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        i.originalFilename.toLowerCase().includes(term) ||
        (i.companyName || '').toLowerCase().includes(term),
    );
  }, [items, q]);

  const handleDownload = (it: SignedPdf) => {
    const url = toAbsoluteUrl(it.fileUrl);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = it.originalFilename;
    a.rel = 'noopener';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDelete = async (it: SignedPdf) => {
    const ok = await confirmDialog({
      title: 'Excluir PDF assinado?',
      description: `"${it.originalFilename}" será removido permanentemente.`,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    try {
      await erpService.deleteSignedPdf(it.id);
      setItems((prev) => prev.filter((x) => x.id !== it.id));
      toast({ title: 'PDF excluído' });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white">
          <Files className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">PDFs Assinados</h1>
          <p className="text-sm text-muted-foreground">Histórico dos documentos gerados na aba Assinatura.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </header>

      <Card className="p-4 grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Empresa</Label>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.razaoSocial}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Buscar</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome do arquivo ou empresa…"
              className="pl-9"
            />
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            {loading ? 'Carregando…' : 'Nenhum PDF assinado ainda. Vá para a aba Assinatura para começar.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Arquivo</th>
                  <th className="text-left px-4 py-3 font-medium">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium">Data</th>
                  <th className="text-right px-4 py-3 font-medium">Páginas</th>
                  <th className="text-right px-4 py-3 font-medium">Tamanho</th>
                  <th className="text-right px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 max-w-[280px] truncate" title={it.originalFilename}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                        <span className="truncate">{it.originalFilename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{it.companyName || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(it.createdAt)}</td>
                    <td className="px-4 py-3 text-right">{it.pages ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{fmtBytes(it.sizeBytes)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => window.open(toAbsoluteUrl(it.fileUrl) || '#', '_blank', 'noopener')}
                          title="Abrir em nova aba"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDownload(it)} title="Baixar">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleDelete(it)}
                          title="Excluir"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ErpAssinados;
