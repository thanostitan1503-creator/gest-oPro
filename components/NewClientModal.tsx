
import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, User, Phone, Calendar, CreditCard, Save, MapPin, Map } from 'lucide-react';
import { db } from '@/domain/db';

interface NewClientModalProps {
  onClose: () => void;
  onSave?: (clientData: any) => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    reference: '',
    phone: '',
    cpf: '',
    birthDate: '',
    deliveryZoneId: ''
  });
  const [zoneLockedByUser, setZoneLockedByUser] = useState(false);

  const deliveryZones = useLiveQuery(() => db.delivery_zones?.toArray(), []) || [];
  const deliverySectors = useLiveQuery(() => db.delivery_zones?.toArray(), []) || [];

  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const findZoneMatch = (address: string) => {
    const normalized = normalizeText(address || '');
    if (!normalized) return null;

    const sectorMatch = deliverySectors
      .map((sector) => ({ sector, key: normalizeText(sector?.name || '') }))
      .filter((item) => item.key.length > 2 && normalized.includes(item.key))
      .sort((a, b) => b.key.length - a.key.length)[0];

    if (sectorMatch?.sector) {
      const zone = deliveryZones.find((z) => z.id === sectorMatch.sector.zone_id) ?? null;
      if (zone) {
        return { zoneId: zone.id, zoneName: zone.name ?? zone.nome ?? '', source: 'setor' };
      }
    }

    const zoneMatch = deliveryZones
      .map((zone) => ({ zone, key: normalizeText(zone?.name || zone?.nome || '') }))
      .filter((item) => item.key.length > 2 && normalized.includes(item.key))
      .sort((a, b) => b.key.length - a.key.length)[0];

    if (zoneMatch?.zone) {
      return { zoneId: zoneMatch.zone.id, zoneName: zoneMatch.zone.name ?? zoneMatch.zone.nome ?? '', source: 'zona' };
    }

    return null;
  };

  const zoneSuggestion = useMemo(
    () => findZoneMatch(formData.address),
    [formData.address, deliveryZones, deliverySectors]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (name === 'address') setZoneLockedByUser(false);
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData({ ...formData, deliveryZoneId: e.target.value });
    setZoneLockedByUser(true);
  };

  useEffect(() => {
    if (zoneLockedByUser) return;
    const nextId = zoneSuggestion?.zoneId ?? '';
    if (formData.deliveryZoneId !== nextId) {
      setFormData((prev) => ({ ...prev, deliveryZoneId: nextId }));
    }
  }, [zoneSuggestion, zoneLockedByUser, formData.deliveryZoneId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple validation
    if (!formData.name || !formData.address) {
      alert("Nome e Endereço são obrigatórios.");
      return;
    }
    
    // Map internal state to entity structure expectation
    const clientPayload = {
      // keep original keys for any consumers that expect English names
      ...formData,
      // add Portuguese keys used across the app to avoid legacy mismatches
      nome: (formData.name || '').trim(),
      name: (formData.name || '').trim(),
      endereco: (formData.address || '').trim(),
      address: (formData.address || '').trim(),
      referencia: (formData.reference || '').trim(),
      referencia_pt: (formData.reference || '').trim(),
      telefone: (formData.phone || '').trim(),
      phone: (formData.phone || '').trim(),
      cpf: (formData.cpf || '').trim(),
      dataNascimento: formData.birthDate || '',
      deliveryZoneId: formData.deliveryZoneId || null,
    };

    console.log('Saving from Modal:', clientPayload);

    if (onSave) onSave(clientPayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
        onClick={onClose}
      ></div>

      {/* Janela Modal */}
      <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 fade-in duration-200 border border-bdr transition-colors duration-300 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-app border-b border-bdr px-6 py-4 flex justify-between items-center shrink-0">
          <h3 className="text-txt-main font-bold text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Novo Cliente
          </h3>
          <button 
            onClick={onClose}
            className="text-txt-muted hover:text-txt-main hover:bg-bdr p-1.5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-txt-muted uppercase ml-1">Nome Completo *</label>
            <div className="relative">
              <User className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
              <input 
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ex: João da Silva"
                className="w-full pl-10 pr-4 py-2.5 border border-bdr bg-app rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-txt-main text-sm font-medium transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-txt-muted uppercase ml-1">Endereço Completo *</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
              <input 
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="Rua, Número, Bairro"
                className="w-full pl-10 pr-4 py-2.5 border border-bdr bg-app rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-txt-main text-sm font-medium transition-all"
              />
            </div>
          </div>

          {/* Referência */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-txt-muted uppercase ml-1">Ponto de Referência</label>
            <div className="relative">
              <Map className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
              <input 
                type="text"
                name="reference"
                value={formData.reference}
                onChange={handleChange}
                placeholder="Ex: Próximo ao mercado X"
                className="w-full pl-10 pr-4 py-2.5 border border-bdr bg-app rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-txt-main text-sm font-medium transition-all"
              />
            </div>
          </div>

          {/* Zona de entrega */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-txt-muted uppercase ml-1">Zona de entrega</label>
            <select
              value={formData.deliveryZoneId}
              onChange={handleZoneChange}
              className="w-full px-4 py-2.5 border border-bdr bg-app rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-txt-main text-sm font-medium transition-all"
            >
              <option value="">Sem zona definida</option>
              {deliveryZones.map((zone: any) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name ?? zone.nome ?? zone.id}
                </option>
              ))}
            </select>
            {zoneSuggestion && zoneSuggestion.zoneId === formData.deliveryZoneId && (
              <div className="text-[11px] text-emerald-600">
                Zona detectada automaticamente: {zoneSuggestion.zoneName || 'Zona encontrada'}.
              </div>
            )}
            {zoneSuggestion && zoneSuggestion.zoneId !== formData.deliveryZoneId && (
              <div className="text-[11px] text-amber-600">
                Zona sugerida pelo endereco: {zoneSuggestion.zoneName || 'Zona encontrada'}.
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Telefone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-txt-muted uppercase ml-1">Telefone / Whats</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
                <input 
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(00) 00000-0000"
                  className="w-full pl-10 pr-4 py-2.5 border border-bdr bg-app rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-txt-main text-sm font-medium transition-all"
                />
              </div>
            </div>

            {/* Data Nascimento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-txt-muted uppercase ml-1">Nascimento</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
                <input 
                  type="date"
                  name="birthDate"
                  value={formData.birthDate}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-bdr bg-app rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-txt-main text-sm font-medium transition-all"
                />
              </div>
            </div>
          </div>

          {/* CPF */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-txt-muted uppercase ml-1">CPF</label>
            <div className="relative">
              <CreditCard className="w-4 h-4 text-txt-muted absolute left-3 top-3" />
              <input 
                type="text"
                name="cpf"
                value={formData.cpf}
                onChange={handleChange}
                placeholder="000.000.000-00"
                className="w-full pl-10 pr-4 py-2.5 border border-bdr bg-app rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none text-txt-main text-sm font-medium transition-all"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-3 text-sm font-bold text-txt-muted hover:bg-app rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className="flex-[2] py-3 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Cadastrar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
