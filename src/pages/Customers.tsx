import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Plus, Trash2, Search, MapPin, Phone, 
  ChevronDown, ChevronUp, Copy, Save, Loader2, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { useCustomers, Customer } from '@/hooks/useCustomers';
import { geocodingService } from '@/services/geocoding';

const Customers: React.FC = () => {
  const { customers, loading, addCustomer, updateCustomer, deleteCustomer, saveCustomers } = useCustomers();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchingAddress, setSearchingAddress] = useState<string | null>(null);

  const handleAddCustomer = () => {
    const newCustomer: Customer = {
      id: uuidv4(),
      customerName: '',
      address: '',
      cep: '',
      restroomsQty: undefined,
      cleaningsQty: undefined,
      contactName: '',
      contactPhone: '',
      notes: '',
      lat: undefined,
      lng: undefined
    };
    addCustomer(newCustomer);
    
    // Scroll para o novo cliente
    setTimeout(() => {
      const cards = document.querySelectorAll('[data-customer-card]');
      const lastCard = cards[cards.length - 1];
      lastCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const handleUpdate = (id: string, field: keyof Customer, value: any) => {
    updateCustomer(id, field, value);
  };

  const handleRemove = (id: string) => {
    deleteCustomer(id);
    toast.success('Cliente removido');
  };

  const handleDuplicate = (id: string) => {
    const customer = customers.find(c => c.id === id);
    if (customer) {
      const newCustomer: Customer = {
        ...customer,
        id: uuidv4(),
        customerName: `${customer.customerName} (cópia)`
      };
      addCustomer(newCustomer);
      toast.success('Cliente duplicado');
    }
  };

  const handleSearchByCep = async (id: string, cep: string) => {
    if (!cep || cep.length < 8) return;
    
    setSearchingAddress(id);
    try {
      const result = await geocodingService.getAddressByCep(cep);
      if (result) {
        handleUpdate(id, 'address', result.address);
        if (result.lat && result.lng) {
          handleUpdate(id, 'lat', result.lat);
          handleUpdate(id, 'lng', result.lng);
        }
        toast.success('Endereço encontrado pelo CEP');
      } else {
        toast.error('CEP não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    } finally {
      setSearchingAddress(null);
    }
  };

  const handleSearchByAddress = async (id: string, address: string) => {
    if (!address || address.length < 5) return;
    
    setSearchingAddress(id);
    try {
      const result = await geocodingService.getCoordinatesFromAddress(address);
      if (result) {
        handleUpdate(id, 'lat', result.lat);
        handleUpdate(id, 'lng', result.lng);
        toast.success('Coordenadas encontradas');
      } else {
        toast.error('Endereço não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar endereço');
    } finally {
      setSearchingAddress(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCustomers();
      toast.success('Clientes salvos com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar clientes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between max-w-full">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Clientes</h1>
            </div>
            <Badge variant="secondary" className="text-xs">
              {customers.length} clientes
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleAddCustomer}
              variant="outline"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Cliente
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="p-4">
        <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
          {/* Header da tabela */}
          <div className="grid grid-cols-[40px_180px_100px_1fr_80px_80px_150px_1fr_100px] gap-2 items-center px-3 py-3 bg-muted/50 border-b text-sm font-semibold text-muted-foreground">
            <div className="text-center">#</div>
            <div>Cliente</div>
            <div>CEP</div>
            <div>Endereço</div>
            <div className="text-center">Banh.</div>
            <div className="text-center">Limp.</div>
            <div>Telefone</div>
            <div>Observações</div>
            <div className="text-right">Ações</div>
          </div>

          {/* Corpo da tabela */}
          {customers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhum cliente cadastrado</p>
              <p className="text-sm">Clique em "Adicionar Cliente" para começar</p>
            </div>
          ) : (
            customers.map((customer, index) => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                index={index}
                onRemove={handleRemove}
                onUpdate={handleUpdate}
                onSearchByCep={handleSearchByCep}
                onSearchByAddress={handleSearchByAddress}
                onDuplicate={handleDuplicate}
                expandedRow={expandedRow}
                setExpandedRow={setExpandedRow}
                searchingAddress={searchingAddress}
              />
            ))
          )}

          {/* Botão para adicionar cliente */}
          <div className="p-2 border-t bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddCustomer}
              className="w-full h-8 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 border border-dashed"
            >
              <Plus className="h-3 w-3 mr-1" />
              Adicionar cliente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CustomerRowProps {
  customer: Customer;
  index: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof Customer, value: any) => void;
  onSearchByCep: (id: string, cep: string) => void;
  onSearchByAddress: (id: string, address: string) => void;
  onDuplicate: (id: string) => void;
  expandedRow: string | null;
  setExpandedRow: (id: string | null) => void;
  searchingAddress: string | null;
}

const CustomerRow: React.FC<CustomerRowProps> = ({
  customer,
  index,
  onRemove,
  onUpdate,
  onSearchByCep,
  onSearchByAddress,
  onDuplicate,
  expandedRow,
  setExpandedRow,
  searchingAddress
}) => {
  const isExpanded = expandedRow === customer.id;
  const isSearching = searchingAddress === customer.id;

  return (
    <div data-customer-card>
      {/* Linha principal */}
      <div className={`grid grid-cols-[40px_180px_100px_1fr_80px_80px_150px_1fr_100px] gap-2 items-center px-3 py-3 min-h-[56px] border-b hover:bg-muted/30 transition-colors ${isExpanded ? 'bg-blue-50/50' : ''}`}>
        {/* Número */}
        <div className="flex justify-center">
          <span className="text-sm text-muted-foreground font-medium">{index + 1}</span>
        </div>

        {/* Cliente */}
        <Input
          value={customer.customerName || ''}
          onChange={(e) => onUpdate(customer.id, 'customerName', e.target.value)}
          placeholder="Nome do cliente"
          className="h-9 text-sm font-medium"
        />

        {/* CEP */}
        <div className="flex gap-1">
          <Input
            value={customer.cep || ''}
            onChange={(e) => onUpdate(customer.id, 'cep', e.target.value)}
            placeholder="CEP"
            className="h-9 text-sm"
            maxLength={9}
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => customer.cep && onSearchByCep(customer.id, customer.cep)}
                  disabled={!customer.cep || customer.cep.length < 8 || isSearching}
                  className="h-9 w-9 p-0 shrink-0"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Buscar CEP</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Endereço */}
        <div className="flex gap-1">
          <Input
            value={customer.address || ''}
            onChange={(e) => onUpdate(customer.id, 'address', e.target.value)}
            placeholder="Endereço completo"
            className="h-9 text-sm"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => customer.address && onSearchByAddress(customer.id, customer.address)}
                  disabled={!customer.address || customer.address.length < 5 || isSearching}
                  className="h-9 w-9 p-0 shrink-0"
                >
                  <MapPin className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Buscar coordenadas</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Qtd Banheiros */}
        <Input
          type="number"
          min="0"
          value={customer.restroomsQty ?? ''}
          onChange={(e) => onUpdate(customer.id, 'restroomsQty', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="Banh."
          className="h-9 text-sm text-center"
        />

        {/* Qtd Limpezas */}
        <Input
          type="number"
          min="0"
          value={customer.cleaningsQty ?? ''}
          onChange={(e) => onUpdate(customer.id, 'cleaningsQty', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="Limp."
          className="h-9 text-sm text-center"
        />

        {/* Contato (telefone) */}
        <div className="flex items-center gap-1">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={customer.contactPhone || ''}
            onChange={(e) => onUpdate(customer.id, 'contactPhone', e.target.value)}
            placeholder="Telefone"
            className="h-9 text-sm"
          />
        </div>

        {/* Observações */}
        <Input
          value={customer.notes || ''}
          onChange={(e) => onUpdate(customer.id, 'notes', e.target.value)}
          placeholder="Observações..."
          className="h-9 text-sm"
        />

        {/* Ações */}
        <div className="flex items-center gap-1 justify-end">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpandedRow(isExpanded ? null : customer.id)}
                  className="h-8 w-8 p-0"
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mais detalhes</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDuplicate(customer.id)}
                  className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Duplicar</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(customer.id)}
                  className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remover</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Linha expandida com mais detalhes */}
      {isExpanded && (
        <div className="bg-slate-50 border-b px-4 py-3 grid grid-cols-3 gap-4">
          {/* Coordenadas */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Coordenadas</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-muted-foreground">Lat</span>
                <Input
                  value={customer.lat || ''}
                  readOnly
                  className="h-7 text-xs bg-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground">Lng</span>
                <Input
                  value={customer.lng || ''}
                  readOnly
                  className="h-7 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Responsável no local</label>
            <Input
              value={customer.contactName || ''}
              onChange={(e) => onUpdate(customer.id, 'contactName', e.target.value)}
              placeholder="Nome do responsável"
              className="h-8 text-xs"
            />
          </div>

          {/* Observações detalhadas */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Textarea
              value={customer.notes || ''}
              onChange={(e) => onUpdate(customer.id, 'notes', e.target.value)}
              placeholder="Observações sobre este cliente..."
              className="h-16 text-xs resize-none"
              maxLength={500}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
