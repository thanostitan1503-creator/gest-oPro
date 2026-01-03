
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import { MapContainer, TileLayer, FeatureGroup, Polygon, Tooltip as RLTooltip, useMap, Pane } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import { 
  X, Truck, Map as MapIcon, Flame, Activity, MapPin, Plus, Trash2, Search
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getOrders, getDriverLocations } from '../domain/storage';
import { OrdemServico, DriverLocation } from '../domain/types';
import { db } from '../domain/db';
import { 
  upsertDeliveryZone,
  deleteDeliveryZone,
  upsertDeliverySector,
  deleteDeliverySector,
  moveDeliverySector,
} from '../domain/repositories/deliveryZones.repo';
import { upsertZonePricing } from '../domain/repositories/zonePricing.repo';
import { upsertDeposit } from '../domain/repositories/deposits.repo';

type LatLngTuple = [number, number];
type LatLngPolygon = LatLngTuple[][];

interface DeliveryReportModuleProps {
  onClose: () => void;
}

const HUB_COORDS = { lat: -17.7915, lng: -50.9197 };
const DEFAULT_SCOPE = 'Rio Verde, GO';
const DEFAULT_SCOPE_BOUNDS = {
  south: -18.347,
  north: -17.0898436,
  west: -51.7307464,
  east: -50.3568883,
};

const toast = {
  error: (msg: string) => alert(msg),
  success: (msg: string) => alert(msg),
};

const ensureDrawReadableAreaPatch = () => {
  const geom: any = (L as any).GeometryUtil;
  if (!geom || geom._gpReadableAreaPatched) return;
  geom._gpReadableAreaPatched = true;

  const defaultPrecision = {
    km: 2,
    ha: 2,
    m: 0,
    mi: 2,
    ac: 2,
    yd: 0,
    ft: 0,
    nm: 2,
  };

  geom.readableArea = (area: number, metric: any, precision: any) => {
    const opts = L.Util.extend({}, defaultPrecision, precision);
    let units: string[] = ['ha', 'm'];
    const metricType = typeof metric;

    if (metric) {
      if (metricType === 'string') {
        units = [metric];
      } else if (metricType !== 'boolean') {
        units = metric;
      }

      if (area >= 1000000 && units.indexOf('km') !== -1) {
        return `${geom.formattedNumber(area / 1000000, opts.km)} km2`;
      }
      if (area >= 10000 && units.indexOf('ha') !== -1) {
        return `${geom.formattedNumber(area / 10000, opts.ha)} ha`;
      }
      return `${geom.formattedNumber(area, opts.m)} m2`;
    }

    const areaInYards = area / 0.836127;
    if (areaInYards >= 3097600) {
      return `${geom.formattedNumber(areaInYards / 3097600, opts.mi)} mi2`;
    }
    if (areaInYards >= 4840) {
      return `${geom.formattedNumber(areaInYards / 4840, opts.ac)} acres`;
    }
    return `${geom.formattedNumber(areaInYards, opts.yd)} yd2`;
  };
};

const toLatLngTuple = (point: any): LatLngTuple | null => {
  if (!point) return null;
  if (Array.isArray(point) && point.length >= 2) {
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }
  if (typeof point === 'object') {
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.lon ?? point.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }
  return null;
};

const normalizePolygon = (raw: any): LatLngPolygon | null => {
  if (!raw) return null;
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  // GeoJSON object
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const asAny: any = data;
    const geom = asAny.type === 'Feature' ? asAny.geometry : asAny;
    const coords = geom?.coordinates;
    const type = geom?.type;
    if (type === 'Polygon' && Array.isArray(coords)) {
      return coords
        .map((ring: any[]) =>
          Array.isArray(ring)
            ? ring
                .map((pt: any) => [Number(pt?.[1]), Number(pt?.[0])] as LatLngTuple)
                .filter((p: any) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
            : []
        )
        .filter((ring: any[]) => ring.length > 2);
    }
    if (type === 'MultiPolygon' && Array.isArray(coords) && Array.isArray(coords[0])) {
      const first = coords[0];
      return first
        .map((ring: any[]) =>
          Array.isArray(ring)
            ? ring
                .map((pt: any) => [Number(pt?.[1]), Number(pt?.[0])] as LatLngTuple)
                .filter((p: any) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
            : []
        )
        .filter((ring: any[]) => ring.length > 2);
    }
  }

  if (!Array.isArray(data) || data.length === 0) return null;

  // GeoJSON Polygon.coordinates -> [ [ [lng,lat], ... ] ]
  if (Array.isArray(data[0]) && Array.isArray(data[0][0])) {
    const maybeLngLat = data[0][0];
    if (Array.isArray(maybeLngLat) && maybeLngLat.length === 2 && !Array.isArray(maybeLngLat[0])) {
      const rings = (data as any[]).map((ring) =>
        (ring as any[])
          .map((pair) => toLatLngTuple([pair[1], pair[0]]))
          .filter(Boolean) as LatLngTuple[]
      );
      return rings.filter((r) => r.length > 2);
    }
  }

  // Already lat,lng tuples
  const tuples = (data as any[])
    .map((ring) =>
      Array.isArray(ring)
        ? (ring as any[])
            .map((p) => toLatLngTuple(p))
            .filter((p): p is LatLngTuple => !!p)
        : []
    )
    .filter((ring) => ring.length > 2);

  return tuples.length ? tuples : null;
};

const polygonToGeoJSON = (polygon: LatLngPolygon | null) => {
  if (!polygon || !polygon.length) return null;
  const coordinates = polygon.map((ring) => ring.map(([lat, lng]) => [lng, lat]));
  return { type: 'Polygon', coordinates };
};

// Helpers para busca de endereços
const normalizeText = (text: string) => 
  String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getCityName = (item: any) => {
  const addr = item?.address ?? {};
  return addr.city || addr.town || addr.village || addr.municipality || null;
};

const getScopeCity = (scope: string) => {
  const parts = scope.split(',').map((p) => p.trim());
  return normalizeText(parts[0] || '');
};

const MapResizeHandler: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => map.invalidateSize();
    const el = map.getContainer();
    const onWin = () => invalidate();
    window.addEventListener('resize', onWin);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => invalidate());
      observer.observe(el);
    }

    const t1 = setTimeout(invalidate, 50);
    const t2 = setTimeout(invalidate, 250);
    const t3 = setTimeout(invalidate, 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', onWin);
      if (observer) observer.disconnect();
    };
  }, [map]);

  return null;
};

export const DeliveryReportModule: React.FC<DeliveryReportModuleProps> = ({ onClose }) => {
  const [deliveries, setDeliveries] = useState<OrdemServico[]>([]);
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [viewMode, setViewMode] = useState<'realtime' | 'heatmap'>('realtime');
  
  // Estados de modo (mapa/precificação)
  const [settingsMode, setSettingsMode] = useState<'map' | 'pricing'>('map');
  
  // Estados de zonas
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneColor, setZoneColor] = useState('#f97316');
  const [polygonDraft, setPolygonDraft] = useState<LatLngPolygon | null>(null);
  const [isSavingZone, setIsSavingZone] = useState(false);
  
  // Estados de precificação
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, string>>({});
  const [freeShippingValue, setFreeShippingValue] = useState('0');
  
  // Estados de busca
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState(DEFAULT_SCOPE);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  
  // Estados de setores
  const [sectorName, setSectorName] = useState('');
  
  const liveOrders = useLiveQuery(() => db.service_orders?.toArray(), []);
  const zones = useLiveQuery(() => db.delivery_zones?.toArray(), []);
  const zonePricing = useLiveQuery(() => db.zone_pricing?.toArray(), []);
  const deposits = useLiveQuery(() => db.deposits?.toArray(), []);
  const sectors = useLiveQuery(() => db.delivery_zones?.toArray(), []);
  
  // Refs para controle da instância do mapa e elementos gráficos
  const mapInstanceRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const driverMarkersRef = useRef<any[]>([]);
  const deliveryMarkersRef = useRef<any[]>([]);
  const refreshMapRef = useRef<() => void>(() => {});
  const drawnLayerRef = useRef<any>(null);

  const pricingByDeposit = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    (zonePricing ?? []).forEach((p) => {
      if (!map.has(p.deposit_id)) map.set(p.deposit_id, new Map());
      map.get(p.deposit_id)?.set(p.zone_id, Number(p.price ?? 0));
    });
    return map;
  }, [zonePricing]);

  const handleNewZone = useCallback(() => {
    setSelectedZoneId(null);
    setZoneName('');
    setZoneColor('#f97316');
    setPriceDraft('');
    setPolygonDraft(null);
    if (drawnLayerRef.current) drawnLayerRef.current.clearLayers();
  }, []);

  useEffect(() => {
    ensureDrawReadableAreaPatch();
  }, []);

  const handleSaveZone = useCallback(async () => {
    const name = zoneName.trim();
    if (!name) {
      alert('Informe o nome da zona');
      return;
    }
    if (!polygonDraft || polygonDraft.length === 0) {
      alert('Desenhe a área da zona no mapa antes de salvar.');
      return;
    }

    setIsSavingZone(true);
    try {
      const payload: any = {
        id: selectedZoneId ?? undefined,
        name,
        color: zoneColor,
        deposit_id: null, // zonas sao globais
        fee: 0,
        map_polygon: polygonToGeoJSON(polygonDraft) ?? polygonDraft,
      };

      const saved = await upsertDeliveryZone(payload);

      if (selectedDepositId && priceDraft.trim() !== '') {
        const priceNumber = Number(priceDraft);
        await upsertZonePricing({
          id: `${selectedDepositId}:${saved.id}`,
          deposit_id: selectedDepositId,
          zone_id: saved.id,
          price: Number.isFinite(priceNumber) ? priceNumber : 0,
        } as any);
      }

      setSelectedZoneId(saved.id);
      alert('Zona salva com sucesso');
    } catch (err: any) {
      alert(err?.message || 'Falha ao salvar zona');
    } finally {
      setIsSavingZone(false);
    }
  }, [zoneName, polygonDraft, selectedZoneId, zoneColor, selectedDepositId, priceDraft]);

  const fitPolygonOnMap = useCallback((polygon: LatLngPolygon | null) => {
    if (!polygon || !polygon.length || !mapInstanceRef.current) return;
    const layer = L.polygon(polygon as any);
    mapInstanceRef.current.fitBounds(layer.getBounds(), { padding: [24, 24] });
  }, []);

  const fitAllZones = useCallback(() => {
    if (!mapInstanceRef.current || !zones || zones.length === 0) return;
    const latLngs: any[] = [];
    zones.forEach((zone) => {
      const polygon = normalizePolygon((zone as any).map_polygon);
      if (!polygon) return;
      polygon.forEach((ring) => {
        ring.forEach((pt) => latLngs.push(pt));
      });
    });
    if (latLngs.length === 0) return;
    const bounds = L.latLngBounds(latLngs as any);
    mapInstanceRef.current.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
  }, [zones]);

  // Handlers adicionais
  const handleSearch = async () => {
    const term = searchQuery.trim();
    if (!term || !mapInstanceRef.current) return;
    setIsSearching(true);
    setSearchError(null);
    setSearchNotice(null);
    try {
      const scope = searchScope.trim() || DEFAULT_SCOPE;
      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          format: 'jsonv2',
          q: `${term}, ${scope}`,
          polygon_geojson: 1,
          addressdetails: 1,
          limit: 5,
          countrycodes: 'br',
        },
        headers: { 'Accept-Language': 'pt-BR' },
      });
      const results = Array.isArray(data) ? data : [];
      if (!results.length) {
        setSearchNotice('Nenhum resultado encontrado. Desenhe manualmente.');
        return;
      }
      const first = results[0];
      const lat = Number(first?.lat);
      const lon = Number(first?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setSearchError('Localização inválida.');
        return;
      }
      
      if (!selectedZoneId && !isCreatingZone) {
        setIsCreatingZone(true);
        if (!zoneName) setZoneName(term);
      }
      
      mapInstanceRef.current.flyTo([lat, lon], 15);
      setSearchNotice('Endereço encontrado. Desenhe a área manualmente no mapa.');
    } catch (err) {
      setSearchError('Falha ao buscar endereço.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Excluir esta zona?')) return;
    try {
      await deleteDeliveryZone(zoneId);
      if (selectedZoneId === zoneId) {
        setSelectedZoneId(null);
        setPolygonDraft(null);
      }
      toast.success('Zona excluída');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir zona');
    }
  };

  const handleSaveZonePricing = async (zoneId: string) => {
    if (!selectedDepositId) {
      toast.error('Selecione um depósito para salvar preço.');
      return;
    }
    const raw = pricingDrafts[zoneId] ?? '';
    const price = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(price)) {
      toast.error('Preço inválido.');
      return;
    }
    try {
      await upsertZonePricing({
        id: `${selectedDepositId}:${zoneId}`,
        zone_id: zoneId,
        deposit_id: selectedDepositId,
        price,
      } as any);
      toast.success('Preço salvo');
    } catch (err: any) {
      toast.error('Erro ao salvar preço');
    }
  };

  const handleSaveFreeShipping = async () => {
    if (!selectedDepositId || !deposits) return;
    const deposit = deposits.find((d) => d.id === selectedDepositId);
    if (!deposit) return;
    const value = Number(freeShippingValue || 0) || 0;
    try {
      await upsertDeposit({
        ...deposit,
        free_shipping_min_value: value,
      } as any);
      toast.success('Frete grátis atualizado');
    } catch (err: any) {
      toast.error('Erro ao salvar frete grátis');
    }
  };

  const handleAddSector = async () => {
    if (!selectedZoneId || !sectorName.trim()) return;
    try {
      await upsertDeliverySector({
        id: crypto.randomUUID(),
        zone_id: selectedZoneId,
        name: sectorName.trim(),
      } as any);
      setSectorName('');
      toast.success('Setor adicionado');
    } catch (err: any) {
      toast.error('Erro ao adicionar setor');
    }
  };

  const handleDeleteSector = async (sectorId: string) => {
    if (!confirm('Excluir este setor?')) return;
    try {
      await deleteDeliverySector(sectorId);
      toast.success('Setor excluído');
    } catch (err: any) {
      toast.error('Erro ao excluir setor');
    }
  };

  const selectedDeposit = useMemo(
    () => deposits?.find((d) => d.id === selectedDepositId),
    [deposits, selectedDepositId]
  );

  const zoneSectors = useMemo(
    () => (sectors ?? []).filter((s) => s.zone_id === selectedZoneId),
    [sectors, selectedZoneId]
  );

  const pricingByZoneId = useMemo(() => {
    const map = new Map<string, any>();
    if (!selectedDepositId) return map;
    for (const pricing of zonePricing ?? []) {
      if (pricing.deposit_id === selectedDepositId) {
        map.set(pricing.zone_id, pricing);
      }
    }
    return map;
  }, [zonePricing, selectedDepositId]);

  // Outras zonas (não selecionadas) para render no mapa
  const otherZonePolygons = useMemo(
    () =>
      (zones ?? [])
        .filter((zone) => zone.id !== selectedZoneId)
        .map((zone) => ({
          id: zone.id,
          name: zone.name,
          color: zone.color || '#f97316',
          polygon: normalizePolygon((zone as any).map_polygon),
        }))
        .filter((zone) => zone.polygon),
    [zones, selectedZoneId]
  );

  const selectedPolygon = useMemo(
    () => {
      if (!selectedZoneId || !zones) return null;
      const zone = zones.find((z) => z.id === selectedZoneId);
      return zone ? normalizePolygon((zone as any).map_polygon) : null;
    },
    [selectedZoneId, zones]
  );

  // 1. Ajusta tamanho do mapa ao abrir
  useEffect(() => {
    const id = requestAnimationFrame(() => refreshMapRef.current());
    const t1 = setTimeout(() => refreshMapRef.current(), 200);
    const t2 = setTimeout(() => refreshMapRef.current(), 800);
    const t3 = setTimeout(() => fitAllZones(), 1000);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [fitAllZones]);

  // 2. Data Polling
  useEffect(() => {
    const fetchDrivers = () => {
      setDrivers(getDriverLocations());
    };
    fetchDrivers();
    const interval = setInterval(fetchDrivers, 5000); // 5s refresh
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (liveOrders === undefined) return;
    if (liveOrders.length > 0) {
      setDeliveries(liveOrders);
      return;
    }
    setDeliveries(getOrders());
  }, [liveOrders]);

  // Depósito padrão
  useEffect(() => {
    if (selectedDepositId || !deposits || deposits.length === 0) return;
    setSelectedDepositId(deposits[0].id);
  }, [deposits, selectedDepositId]);

  // Sincroniza seleção de zona com formulário
  useEffect(() => {
    if (!zones) return;
    const zone = selectedZoneId ? zones.find((z) => z.id === selectedZoneId) : null;
    if (!zone) {
      setZoneName('');
      setZoneColor('#f97316');
      setPolygonDraft(null);
      fitAllZones();
      return;
    }
    setZoneName(zone.name ?? '');
    setZoneColor(zone.color ?? '#f97316');
    setPolygonDraft(normalizePolygon((zone as any).map_polygon));
  }, [selectedZoneId, zones, fitAllZones]);

  // Atualiza preço selecionado ao trocar depósito/zona
  useEffect(() => {
    if (!selectedDepositId || !selectedZoneId || !zonePricing) {
      setPriceDraft('');
      return;
    }
    const pricing = zonePricing.find(
      (p) => p.zone_id === selectedZoneId && p.deposit_id === selectedDepositId
    );
    setPriceDraft(pricing ? String(pricing.price ?? '') : '');
  }, [selectedDepositId, selectedZoneId, zonePricing]);

  // Sincroniza drafts de precificação (modo precificação)
  useEffect(() => {
    if (!selectedDepositId || !zones) {
      setPricingDrafts({});
      return;
    }
    const next: Record<string, string> = {};
    for (const zone of zones) {
      const pricing = pricingByZoneId.get(zone.id);
      next[zone.id] = pricing ? String(pricing.price ?? 0) : '';
    }
    setPricingDrafts(next);
  }, [selectedDepositId, zones, pricingByZoneId]);

  // Sincroniza frete grátis do depósito
  useEffect(() => {
    if (!selectedDeposit) return;
    const value =
      (selectedDeposit as any).free_shipping_min_value ??
      (selectedDeposit as any).freeShippingMinValue ??
      0;
    setFreeShippingValue(String(Number(value) || 0));
  }, [selectedDeposit]);

  // Renderiza rascunho no FeatureGroup (handled via EditControl events)
  useEffect(() => {
    if (!drawnLayerRef.current) return;
    drawnLayerRef.current.clearLayers();
    if (!polygonDraft || polygonDraft.length === 0) return;
    const layer = L.polygon(polygonDraft as any, {
      color: zoneColor,
      fillColor: zoneColor,
      fillOpacity: 0.25,
      weight: 2,
    });
    drawnLayerRef.current.addLayer(layer);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(layer.getBounds(), { padding: [24, 24] });
    }
  }, [polygonDraft, zoneColor]);

  // 3. Render Layers (heat/markers)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (heatLayerRef.current) {
      mapInstanceRef.current.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }
    driverMarkersRef.current.forEach(m => m.remove());
    driverMarkersRef.current = [];
    deliveryMarkersRef.current.forEach(m => m.remove());
    deliveryMarkersRef.current = [];

    if (viewMode === 'heatmap') {
      const points = deliveries
        .filter(d => d.latitude && d.longitude)
        .map(d => [d.latitude, d.longitude, 0.8]);

      if (L.heatLayer) {
        heatLayerRef.current = L.heatLayer(points, { 
          radius: 25,
          blur: 15,
          maxZoom: 17,
        }).addTo(mapInstanceRef.current);
      }
    }

    if (viewMode === 'realtime') {
      drivers.forEach(d => {
        const iconHtml = `
          <div style="background-color:#ef4444; width:32px; height:32px; border-radius:50%; border:2px solid white; box-shadow:0 0 10px rgba(239,68,68,0.5); display:flex; align-items:center; justify-content:center; color:white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          </div>
        `;
        const icon = L.divIcon({ html: iconHtml, className: 'driver-icon', iconSize: [32, 32], iconAnchor: [16, 16] });
        
        const marker = L.marker([d.coords.lat, d.coords.lng], { icon, zIndexOffset: 900 })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<b>${d.nome}</b><br>Status: ${d.status}<br>Atualizado: ${new Date(d.ultimoUpdate).toLocaleTimeString()}`);
        
        driverMarkersRef.current.push(marker);
      });

      deliveries
        .filter(d => (d.status === 'PENDENTE' || d.status === 'EM_ANDAMENTO') && d.latitude)
        .forEach(d => {
           const color = d.status === 'PENDENTE' ? '#f59e0b' : '#3b82f6';
           const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`;
           
           const iconHtml = `
             <div style="background-color:${color}; width:24px; height:24px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                ${svgIcon}
             </div>
           `;
           const icon = L.divIcon({ html: iconHtml, className: 'dot-icon', iconSize: [24, 24], iconAnchor: [12, 12] });
           
           const marker = L.marker([d.latitude, d.longitude], { icon })
             .addTo(mapInstanceRef.current)
             .bindPopup(`<b>${d.clienteNome}</b><br>O.S #${d.numeroOs}<br>Status: ${d.status}`);
           
           deliveryMarkersRef.current.push(marker);
        });
    }

    requestAnimationFrame(() => refreshMapRef.current());
  }, [viewMode, deliveries, drivers]);

  const formatCurrency = (value: number) =>
    Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const revenueSummary = useMemo(() => {
    const finalized = deliveries.filter(
      (o) => o.status === 'CONCLUIDA' || o.statusEntrega === 'ENTREGUE'
    );
    let productRevenue = 0;
    let deliveryFees = 0;
    let totalRevenue = 0;

    finalized.forEach((o) => {
      const total = Number(o.total ?? 0) || 0;
      const fee =
        Number((o as any).delivery_fee ?? (o as any).deliveryFee ?? 0) || 0;
      const netProducts = Math.max(0, total - fee);
      productRevenue += netProducts;
      deliveryFees += fee;
      totalRevenue += total;
    });

    return { productRevenue, deliveryFees, totalRevenue, count: finalized.length };
  }, [deliveries]);

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      
      {/* Header */}
      <div className="bg-surface border-b border-bdr px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm shrink-0 gap-4 transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500/10 p-2.5 rounded-xl border border-orange-500/20">
            <Truck className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Monitoramento Logístico</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Rastreamento e Zonas de Calor</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-red-500/10 text-txt-muted hover:text-red-500 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* Painel Lateral Expandido */}
        <div className="w-full md:w-96 overflow-y-auto p-4 space-y-4 border-r border-bdr bg-app/20">
          
          {/* Abas de Modo */}
          <div className="bg-surface border border-bdr rounded-xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-2">
              <button
                onClick={() => setSettingsMode('map')}
                className={`py-3 text-xs font-black uppercase transition-colors ${
                  settingsMode === 'map'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-app text-txt-muted hover:bg-surface'
                }`}
              >
                Modo Mapa/Global
              </button>
              <button
                onClick={() => setSettingsMode('pricing')}
                className={`py-3 text-xs font-black uppercase transition-colors ${
                  settingsMode === 'pricing'
                    ? 'bg-blue-500 text-white'
                    : 'bg-app text-txt-muted hover:bg-surface'
                }`}
              >
                Modo Precificação
              </button>
            </div>
          </div>

          {settingsMode === 'map' && (
            <>
              {/* Modo de Visualização */}
              <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm">
                <h4 className="text-xs font-black text-txt-muted uppercase mb-3">Visualização</h4>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setViewMode('realtime')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase flex flex-col items-center gap-1 transition-all ${viewMode === 'realtime' ? 'bg-orange-500 text-white shadow-md' : 'bg-app text-txt-muted hover:bg-surface border border-bdr'}`}
                  >
                    <Activity className="w-4 h-4" /> Tempo Real
                  </button>
                  <button 
                    onClick={() => setViewMode('heatmap')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase flex flex-col items-center gap-1 transition-all ${viewMode === 'heatmap' ? 'bg-red-600 text-white shadow-md' : 'bg-app text-txt-muted hover:bg-surface border border-bdr'}`}
                  >
                    <Flame className="w-4 h-4" /> Mapa de Calor
                  </button>
                </div>
              </div>

              {/* Busca de Endereços */}
              <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-blue-500" />
                  <h4 className="text-xs font-black text-txt-muted uppercase">Buscar Local</h4>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Ex: Centro, Vila Aurora..."
                  className="w-full h-9 rounded-lg border border-bdr bg-app px-3 text-sm text-txt-main"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="w-full h-9 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-black uppercase disabled:opacity-60"
                >
                  {isSearching ? 'Buscando...' : 'Buscar'}
                </button>
                {searchError && (
                  <p className="text-xs text-red-500">{searchError}</p>
                )}
                {searchNotice && (
                  <p className="text-xs text-amber-500">{searchNotice}</p>
                )}
              </div>

              {/* Gestão de Zonas */}
              <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-xs font-black text-txt-muted uppercase">Zonas</h4>
                  </div>
                  <button
                    onClick={handleNewZone}
                    className="text-[11px] font-black uppercase px-3 py-1.5 rounded-lg bg-app border border-bdr hover:bg-surface text-txt-main"
                  >
                    Nova zona
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-txt-muted uppercase">Depósito (opcional p/ preço)</label>
                  <select
                    value={selectedDepositId ?? ''}
                    onChange={(e) => setSelectedDepositId(e.target.value || null)}
                className="w-full h-9 rounded-lg border border-bdr bg-app px-3 text-sm text-txt-main"
              >
                <option value="">Selecione um depósito...</option>
                {(deposits ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
              </select>
              <p className="text-[11px] text-txt-muted">Zonas são globais; preços são por depósito.</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-txt-muted uppercase">
                <span>Zonas cadastradas</span>
                <span className="text-xs text-txt-main">{zones?.length ?? 0}</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {(zones ?? []).length === 0 && (
                  <div className="text-xs text-txt-muted italic">Nenhuma zona cadastrada.</div>
                )}
                {(zones ?? [])
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((zone) => {
                    const zonePrices = pricingByDeposit.get(selectedDepositId || '')?.get(zone.id);
                    const priceLabel = zonePrices !== undefined ? `R$ ${Number(zonePrices || 0).toFixed(2)}` : 'Sem preço';
                    const isActive = selectedZoneId === zone.id;
                    return (
                      <button
                        key={zone.id}
                        onClick={() => {
                          setSelectedZoneId(zone.id === selectedZoneId ? null : zone.id);
                          const poly = normalizePolygon((zone as any).map_polygon);
                          setPolygonDraft(poly);
                          if (zone.id !== selectedZoneId) fitPolygonOnMap(poly);
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${isActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-bdr bg-app hover:bg-surface'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: zone.color || '#f97316' }} />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-txt-main leading-tight">{zone.name}</p>
                          <p className="text-[11px] text-txt-muted">{priceLabel}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-txt-muted uppercase">Nome da zona</label>
                <input
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  className="w-full h-9 rounded-lg border border-bdr bg-app px-3 text-sm text-txt-main"
                  placeholder="Ex: Centro 1"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-txt-muted uppercase">Cor</label>
                <input
                  type="color"
                  value={zoneColor}
                  onChange={(e) => setZoneColor(e.target.value)}
                  className="w-full h-9 rounded-lg border border-bdr bg-app px-2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-txt-muted uppercase">Preço para o depósito selecionado</label>
              <div className="flex gap-2">
                <input
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                  disabled={!selectedDepositId}
                  className="flex-1 h-9 rounded-lg border border-bdr bg-app px-3 text-sm text-txt-main disabled:opacity-50"
                  placeholder="R$ 0,00"
                />
                <button
                  onClick={() => setPriceDraft('')}
                  className="px-3 h-9 text-[11px] font-black uppercase rounded-lg border border-bdr bg-app hover:bg-surface"
                >
                  Limpar
                </button>
              </div>
              <p className="text-[11px] text-txt-muted">Desenhe/edite a área no mapa à direita. Clique em "Salvar zona" para gravar área e preço.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveZone}
                disabled={isSavingZone}
                className="flex-1 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-xs tracking-widest disabled:opacity-60"
              >
                {isSavingZone ? 'Salvando...' : 'Salvar zona'}
              </button>
              <button
                onClick={handleNewZone}
                className="flex-1 h-10 rounded-lg border border-bdr bg-app hover:bg-surface text-txt-main font-black uppercase text-xs tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </div>

          {/* Setores da Zona */}
          {selectedZoneId && (
            <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm space-y-3">
              <h4 className="text-xs font-black text-txt-muted uppercase">Setores</h4>
              <div className="flex gap-2">
                <input
                  value={sectorName}
                  onChange={(e) => setSectorName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSector()}
                  placeholder="Nome do setor"
                  className="flex-1 h-9 rounded-lg border border-bdr bg-app px-3 text-sm text-txt-main"
                />
                <button
                  onClick={handleAddSector}
                  disabled={!sectorName.trim()}
                  className="px-3 h-9 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {zoneSectors.length === 0 ? (
                <p className="text-xs text-txt-muted italic">Nenhum setor</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {zoneSectors.map((sector) => (
                    <div
                      key={sector.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-app border border-bdr"
                    >
                      <span className="text-sm text-txt-main">{sector.name}</span>
                      <button
                        onClick={() => handleDeleteSector(sector.id)}
                        className="p-1 hover:bg-red-500/10 text-txt-muted hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Frete Grátis */}
          {selectedDepositId && (
            <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm space-y-3">
              <h4 className="text-xs font-black text-txt-muted uppercase">Frete Grátis</h4>
              <p className="text-xs text-txt-muted">
                Valor mínimo para frete grátis em <b>{selectedDeposit?.nome ?? 'depósito'}</b>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={freeShippingValue}
                  onChange={(e) => setFreeShippingValue(e.target.value)}
                  placeholder="R$ 0,00"
                  className="flex-1 h-9 rounded-lg border border-bdr bg-app px-3 text-sm text-txt-main"
                />
                <button
                  onClick={handleSaveFreeShipping}
                  className="px-4 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase"
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm">
             <h4 className="text-xs font-black text-txt-muted uppercase mb-3">Relatorio Financeiro</h4>
             <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-txt-muted">
                  <span>Produtos</span>
                  <span className="font-bold text-txt-main">{formatCurrency(revenueSummary.productRevenue)}</span>
                </div>
                <div className="flex items-center justify-between text-txt-muted">
                  <span>Taxas de entrega</span>
                  <span className="font-bold text-orange-500">{formatCurrency(revenueSummary.deliveryFees)}</span>
                </div>
                <div className="flex items-center justify-between text-txt-muted">
                  <span>Total</span>
                  <span className="font-black text-emerald-600">{formatCurrency(revenueSummary.totalRevenue)}</span>
                </div>
             </div>
             <p className="text-[10px] text-txt-muted mt-3">
               Baseado em O.S finalizadas/entregues ({revenueSummary.count}).
             </p>
          </div>

          <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm">
             <h4 className="text-xs font-black text-txt-muted uppercase mb-3">Entregadores Ativos</h4>
             <div className="space-y-2">
                {drivers.length === 0 ? (
                   <p className="text-xs text-txt-muted italic text-center py-4">Nenhum entregador online</p>
                ) : (
                   drivers.map(d => (
                      <div key={d.driverId} className="flex items-center gap-3 p-2 rounded-lg bg-app border border-bdr">
                         <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                         <div>
                            <p className="text-sm font-bold text-txt-main leading-tight">{d.nome}</p>
                            <p className="text-[10px] text-txt-muted">Último sinal: {new Date(d.ultimoUpdate).toLocaleTimeString()}</p>
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>
            </>
          )}

          {settingsMode === 'pricing' && (
            <>
              {/* Modo Precificação */}
              <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm space-y-3">
                <h4 className="text-sm font-black text-txt-main uppercase">Precificação por Zona</h4>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-txt-muted uppercase">Selecione o Depósito</label>
                  <select
                    value={selectedDepositId ?? ''}
                    onChange={(e) => setSelectedDepositId(e.target.value || null)}
                    className="w-full h-9 rounded-lg border border-bdr bg-app px-3 text-sm text-txt-main"
                  >
                    <option value="">-- Selecione --</option>
                    {(deposits ?? []).map((d) => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>

                {!selectedDepositId && (
                  <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    ⚠️ Selecione um depósito para editar preços.
                  </div>
                )}

                {selectedDepositId && zones && zones.length > 0 && (
                  <div className="space-y-2">
                    {zones.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex flex-col gap-3 bg-app border border-bdr rounded-xl px-3 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full border border-bdr"
                            style={{ backgroundColor: zone.color || '#f97316' }}
                          />
                          <div className="flex-1">
                            <div className="text-sm font-black text-txt-main">{zone.name}</div>
                            <div className="text-[11px] text-txt-muted">
                              Atual:{' '}
                              {pricingByZoneId.get(zone.id)
                                ? `R$ ${Number(pricingByZoneId.get(zone.id)?.price || 0).toFixed(2)}`
                                : 'Sem preço'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-txt-muted font-bold">R$</span>
                            <input
                              type="text"
                              value={pricingDrafts[zone.id] ?? ''}
                              onChange={(e) =>
                                setPricingDrafts({ ...pricingDrafts, [zone.id]: e.target.value })
                              }
                              placeholder="0,00"
                              className="w-20 h-8 rounded-lg border border-bdr bg-app px-2 text-sm text-txt-main"
                            />
                          </div>
                          <button
                            onClick={() => handleSaveZonePricing(zone.id)}
                            className="flex-1 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => handleDeleteZone(zone.id)}
                            className="h-8 px-2 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Frete Grátis Global no Modo Precificação */}
              {selectedDepositId && (
                <div className="bg-surface p-4 rounded-xl border border-bdr shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-txt-muted uppercase">Frete Grátis</h4>
                  <p className="text-xs text-txt-muted">
                    Valor mínimo para frete grátis em <b>{selectedDeposit?.nome ?? 'depósito'}</b>
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={freeShippingValue}
                      onChange={(e) => setFreeShippingValue(e.target.value)}
                      placeholder="R$ 0,00"
                      className="flex-1 h-9 rounded-lg border border-bdr bg-app px-3 text-sm text-txt-main"
                    />
                    <button
                      onClick={handleSaveFreeShipping}
                      className="px-4 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black uppercase"
                    >
                      Salvar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Mapa Container Real (Leaflet via react-leaflet) */}
        <div className="flex-1 bg-surface border-l border-bdr relative overflow-hidden">
          <MapContainer
            center={[HUB_COORDS.lat, HUB_COORDS.lng]}
            zoom={12}
            minZoom={3}
            maxZoom={19}
            className="w-full h-full z-0"
            whenCreated={(map) => {
              mapInstanceRef.current = map;
              refreshMapRef.current = () => map.invalidateSize();
              requestAnimationFrame(() => map.invalidateSize());
            }}
          >
            <MapResizeHandler />
            <TileLayer
              attribution="&copy; OSM contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              crossOrigin={true}
            />

            {/* Todas as zonas sempre visíveis */}
            <Pane name="all-zones" style={{ zIndex: 300 }}>
              {(zones ?? []).map((zone) => {
                const polygon = normalizePolygon((zone as any).map_polygon);
                if (!polygon) return null;
                const color = zone.color || '#f97316';
                const isActive = zone.id === selectedZoneId;
                return (
                  <Polygon
                    key={zone.id}
                    positions={polygon as any}
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: isActive ? 0.25 : 0.12,
                      weight: isActive ? 3 : 1,
                      dashArray: isActive ? undefined : '4 6',
                      className: 'cursor-pointer',
                    }}
                    eventHandlers={{
                      click: () => {
                        setSelectedZoneId(zone.id === selectedZoneId ? null : zone.id);
                        setPolygonDraft(polygon);
                        if (zone.id !== selectedZoneId) fitPolygonOnMap(polygon);
                      },
                    }}
                  >
                    <RLTooltip sticky>{zone.name}</RLTooltip>
                  </Polygon>
                );
              })}
            </Pane>

            {/* Desenho/edição da zona atual */}
            <FeatureGroup ref={drawnLayerRef as any}>
              <EditControl
                position="topright"
                onCreated={(e) => {
                  const layer: any = e.layer;
                  const latlngs = layer.getLatLngs();
                  const polygon = (latlngs as any[])
                    .map((ring) => (ring as any[]).map((p) => [p.lat, p.lng] as LatLngTuple))
                    .filter((ring) => ring.length > 2);
                  setPolygonDraft(polygon);
                  setSelectedZoneId(null);
                  fitPolygonOnMap(polygon);
                }}
                onEdited={(e) => {
                  const layers = (e as any).layers;
                  let polygon: LatLngPolygon | null = null;
                  layers.eachLayer((layer: any) => {
                    const latlngs = layer.getLatLngs();
                    polygon = (latlngs as any[])
                      .map((ring) => (ring as any[]).map((p) => [p.lat, p.lng] as LatLngTuple))
                      .filter((ring) => ring.length > 2);
                  });
                  setPolygonDraft(polygon);
                  fitPolygonOnMap(polygon);
                }}
                onDeleted={() => {
                  setPolygonDraft(null);
                }}
                draw={{
                  polygon: { shapeOptions: { color: zoneColor, fillColor: zoneColor, fillOpacity: 0.3, weight: 2 } },
                  rectangle: { shapeOptions: { color: zoneColor, fillColor: zoneColor, fillOpacity: 0.3, weight: 2 } },
                  polyline: false,
                  circle: false,
                  marker: false,
                  circlemarker: false,
                }}
                edit={{
                  edit: { selectedPathOptions: { color: zoneColor, fillColor: zoneColor, fillOpacity: 0.25, weight: 2 } },
                  remove: {},
                }}
              />
            </FeatureGroup>
          </MapContainer>

          <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur px-4 py-3 rounded-xl border border-bdr shadow-xl text-xs font-medium text-txt-muted max-w-xs text-right z-[1000] pointer-events-none">
            <p className="font-black text-txt-main flex items-center justify-end gap-2 mb-1">
              <MapIcon className="w-3 h-3 text-emerald-500" />
              OpenStreetMap
            </p>
            <p className="opacity-80">
               {viewMode === 'realtime' ? 'Mostrando frota em tempo real' : 'Densidade de entregas históricas'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
