import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet.heat';
import { X, Truck, Plus, Trash2, Map as MapIcon, Palette } from 'lucide-react';
import { FeatureGroup, MapContainer, Pane, Polygon, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { depositService } from '@/services';
import { deliveryService } from '@/services/deliveryService';
import type { Database } from '@/types/supabase';

interface DeliverySettingsModalProps {
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

type LatLngTuple = [number, number];
type HeatPoint = [number, number, number];

const toast = {
  error: (message: string) => alert(message),
  success: (message: string) => alert(message),
};

const ensureDrawReadableAreaPatch = () => {
  const geom = (L as any).GeometryUtil;
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

const normalizePolygon = (raw: any): LatLngTuple[][] | null => {
  if (!raw) return null;
  let data = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }

  // ✅ Aceitar GeoJSON (compatível com zonas salvas em outros módulos)
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const asAny: any = data;
    const geom = asAny.type === 'Feature' ? asAny.geometry : asAny;
    const fromGeo = geojsonToPolygon(geom);
    if (fromGeo && fromGeo.length) return fromGeo;
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) return null;

  const firstAsPoint = toLatLngTuple(data[0]);
  if (firstAsPoint) {
    const ring = data.map(toLatLngTuple).filter(Boolean) as LatLngTuple[];
    return ring.length ? [ring] : null;
  }

  const rings: LatLngTuple[][] = [];
  for (const ringRaw of data) {
    if (!Array.isArray(ringRaw)) continue;
    const ring = ringRaw.map(toLatLngTuple).filter(Boolean) as LatLngTuple[];
    if (ring.length) rings.push(ring);
  }

  return rings.length ? rings : null;
};

const serializeLatLngs = (latlngs: any): LatLngTuple[][] => {
  if (!Array.isArray(latlngs) || latlngs.length === 0) return [];

  const firstAsPoint = toLatLngTuple(latlngs[0]);
  if (firstAsPoint) {
    const ring = latlngs.map(toLatLngTuple).filter(Boolean) as LatLngTuple[];
    return ring.length ? [ring] : [];
  }

  const rings: LatLngTuple[][] = [];
  for (const ringRaw of latlngs) {
    if (!Array.isArray(ringRaw)) continue;
    const ring = ringRaw.map(toLatLngTuple).filter(Boolean) as LatLngTuple[];
    if (ring.length) rings.push(ring);
  }
  return rings;
};

const geojsonToPolygon = (geojson: any): LatLngTuple[][] | null => {
  if (!geojson || typeof geojson !== 'object') return null;
  const coords = geojson.coordinates;
  if (!Array.isArray(coords) || coords.length === 0) return null;

  if (geojson.type === 'Polygon') {
    return coords
      .map((ring: any[]) =>
        Array.isArray(ring) ? ring.map((pt: any) => [Number(pt[1]), Number(pt[0])] as LatLngTuple) : []
      )
      .filter((ring: LatLngTuple[]) => ring.length > 0);
  }

  if (geojson.type === 'MultiPolygon') {
    const first = coords[0];
    if (!Array.isArray(first)) return null;
    return first
      .map((ring: any[]) =>
        Array.isArray(ring) ? ring.map((pt: any) => [Number(pt[1]), Number(pt[0])] as LatLngTuple) : []
      )
      .filter((ring: LatLngTuple[]) => ring.length > 0);
  }

  return null;
};

const ringFromPolygon = (polygon: LatLngTuple[][] | null): LatLngTuple[] => {
  if (!polygon || !polygon.length) return [];
  const ring = polygon[0] || [];
  return ring.length ? ring : [];
};

const closeRing = (ring: LatLngTuple[]) => {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
};

const bboxFromRing = (ring: LatLngTuple[]) => {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of ring) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return { minLat, maxLat, minLng, maxLng };
};

const bboxIntersects = (a: any, b: any) =>
  a.minLat <= b.maxLat &&
  a.maxLat >= b.minLat &&
  a.minLng <= b.maxLng &&
  a.maxLng >= b.minLng;

const orientation = (p: LatLngTuple, q: LatLngTuple, r: LatLngTuple) => {
  const val = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
  if (val === 0) return 0;
  return val > 0 ? 1 : 2;
};

const onSegment = (p: LatLngTuple, q: LatLngTuple, r: LatLngTuple) =>
  q[1] <= Math.max(p[1], r[1]) &&
  q[1] >= Math.min(p[1], r[1]) &&
  q[0] <= Math.max(p[0], r[0]) &&
  q[0] >= Math.min(p[0], r[0]);

const segmentsIntersect = (p1: LatLngTuple, q1: LatLngTuple, p2: LatLngTuple, q2: LatLngTuple) => {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
};

const pointInPolygon = (point: LatLngTuple, ring: LatLngTuple[]) => {
  let inside = false;
  const x = point[1];
  const y = point[0];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1];
    const yi = ring[i][0];
    const xj = ring[j][1];
    const yj = ring[j][0];
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

const polygonsOverlap = (a: LatLngTuple[][] | null, b: LatLngTuple[][] | null) => {
  const ringA = closeRing(ringFromPolygon(a));
  const ringB = closeRing(ringFromPolygon(b));
  if (ringA.length < 3 || ringB.length < 3) return false;
  const bboxA = bboxFromRing(ringA);
  const bboxB = bboxFromRing(ringB);
  if (!bboxIntersects(bboxA, bboxB)) return false;

  for (let i = 0; i < ringA.length - 1; i++) {
    const a1 = ringA[i];
    const a2 = ringA[i + 1];
    for (let j = 0; j < ringB.length - 1; j++) {
      const b1 = ringB[j];
      const b2 = ringB[j + 1];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }

  if (pointInPolygon(ringA[0], ringB)) return true;
  if (pointInPolygon(ringB[0], ringA)) return true;
  return false;
};

const preferredPlaceTypes = new Set([
  'neighbourhood',
  'suburb',
  'quarter',
  'city_district',
  'borough',
]);

const poiClasses = new Set([
  'amenity',
  'tourism',
  'shop',
  'building',
  'highway',
  'leisure',
  'natural',
]);

const areaKeywords = new Set([
  'bairro',
  'setor',
  'zona',
  'distrito',
  'regiao',
  'vila',
  'jardim',
  'loteamento',
  'condominio',
]);

const searchStopWords = new Set([
  'bairro',
  'setor',
  'zona',
  'distrito',
  'regiao',
  'rua',
  'avenida',
  'av',
  'praca',
  'praça',
  'vila',
  'jardim',
  'jd',
  'loteamento',
  'condominio',
  'condominio',
  'cidade',
  'municipio',
  'municipio',
]);

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const getCityName = (item: any) => {
  const address = item?.address ?? {};
  return (
    address.city ??
    address.town ??
    address.village ??
    address.hamlet ??
    address.locality ??
    address.municipality ??
    address.county ??
    ''
  );
};

const getScopeCity = (scope: string) => {
  const raw = String(scope || '').split(',')[0]?.trim() || '';
  return normalizeText(raw);
};

const extractTokens = (term: string) => {
  const normalized = normalizeText(term);
  return normalized
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !searchStopWords.has(t));
};

const isAreaIntent = (term: string) => {
  const normalized = normalizeText(term);
  for (const keyword of areaKeywords) {
    if (normalized.includes(keyword)) return true;
  }
  return false;
};

const itemMatchesTokens = (item: any, tokens: string[]) => {
  if (!tokens.length) return true;
  const address = item?.address ?? {};
  const hay = normalizeText(
    [
      item?.name,
      item?.display_name,
      address.neighbourhood,
      address.suburb,
      address.quarter,
      address.city_district,
      address.borough,
      address.locality,
    ]
      .filter(Boolean)
      .join(' ')
  );
  return tokens.every((token) => hay.includes(token));
};

const itemMatchesScopeCity = (item: any, scopeCity: string) => {
  if (!scopeCity) return true;
  const city = normalizeText(String(getCityName(item) || ''));
  return city.includes(scopeCity);
};

const pickBestNominatimResult = (results: any[], term: string, scope: string) => {
  if (!Array.isArray(results) || results.length === 0) return null;
  const normalizedTerm = normalizeText(term);
  const scopeNormalized = normalizeText(scope).split(',')[0]?.trim() || '';
  const scored = results.map((item) => {
    const hasPolygon = !!geojsonToPolygon(item?.geojson);
    const isBoundary = item?.class === 'boundary' || item?.type === 'administrative';
    const isPlace = item?.class === 'place' && preferredPlaceTypes.has(item?.type);
    const isPoi = poiClasses.has(item?.class);
    const importance = Number(item?.importance ?? item?.place_rank ?? 0) || 0;
    const city = normalizeText(String(getCityName(item) || ''));
    let score = importance;

    if (hasPolygon) score += 5;
    if (isBoundary) score += 6;
    if (isPlace) score += 4;
    if (item?.class === 'place' && item?.type === 'neighbourhood') score += 2;
    if (isPoi) score -= 4;
    if (scopeNormalized && city) {
      if (city.includes(scopeNormalized)) score += 2;
      else score -= 2;
    }
    if (normalizedTerm && normalizeText(String(item?.display_name || '')).includes(normalizedTerm)) {
      score += 1;
    }

    return { item, score, hasPolygon, isBoundary, isPlace };
  });

  const preferred = scored.filter((r) => r.hasPolygon && (r.isBoundary || r.isPlace));
  if (preferred.length) {
    preferred.sort((a, b) => b.score - a.score);
    return preferred[0].item;
  }

  const withPolygon = scored.filter((r) => r.hasPolygon);
  if (withPolygon.length) {
    withPolygon.sort((a, b) => b.score - a.score);
    return withPolygon[0].item;
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0].item;
};

const HeatmapLayer: React.FC<{ enabled: boolean; points: HeatPoint[] }> = ({ enabled, points }) => {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    const heatFactory = (L as any).heatLayer;
    if (!enabled || !heatFactory) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!points.length) return;
    layerRef.current = heatFactory(points, { radius: 22, blur: 16, maxZoom: 17 }).addTo(map);

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [enabled, points, map]);

  return null;
};

const MapResizeHandler: React.FC = () => {
  const map = useMap();

  useEffect(() => {
    const refresh = () => {
      const container = map.getContainer?.();
      if (!container || !container.isConnected) return;
      if (!(map as any)._loaded) return;
      map.invalidateSize();
    };
    map.whenReady(() => refresh());
    requestAnimationFrame(refresh);
    const timeoutId = setTimeout(refresh, 200);
    const longTimeoutId = setTimeout(refresh, 800);
    const handleResize = () => refresh();
    window.addEventListener('resize', handleResize);
    let observer: ResizeObserver | null = null;
    const container = map.getContainer();
    if (typeof ResizeObserver !== 'undefined' && container) {
      observer = new ResizeObserver(() => refresh());
      observer.observe(container);
    }

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(longTimeoutId);
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
    };
  }, [map]);

  return null;
};

const MapRefSetter: React.FC<{ mapRef: React.MutableRefObject<L.Map | null> }> = ({ mapRef }) => {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);

  return null;
};

// ⚠️ REMOVIDO: Sem depósito automático. Usuário deve sempre selecionar manualmente.


export const DeliverySettingsModal: React.FC<DeliverySettingsModalProps> = ({ onClose }) => {

  const [zones, setZones] = useState<Database['public']['Tables']['delivery_zones']['Row'][]>([]);
  const [zonePricing, setZonePricing] = useState<Database['public']['Tables']['zone_pricing']['Row'][]>([]);
  const [depositsOnline, setDepositsOnline] = useState<Deposito[]>([]);
  const [loading, setLoading] = useState(false);
  // Carregar zonas e precificação do Supabase via service
  useEffect(() => {
    let cancelled = false;
    if (!isOpen) return;
    (async () => {
      try {
        setLoading(true);
        const { zones: loadedZones, pricing: loadedPricing } = await deliveryService.listDeliveryZones();
        if (cancelled) return;
        setZones(loadedZones);
        setZonePricing(loadedPricing);
      } catch (error) {
        console.error('Erro ao carregar zonas de entrega', error);
        toast.error('Erro ao carregar zonas de entrega.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  const [settingsMode, setSettingsMode] = useState<'map' | 'pricing'>('map');
  const [selectedDepositId, setSelectedDepositId] = useState<string>(''); // ⚠️ VAZIO: Usuário seleciona manualmente
  const [freeShippingValue, setFreeShippingValue] = useState('0');

  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const [zoneForm, setZoneForm] = useState<Partial<DeliveryZone>>({
    name: '',
    color: '#f97316',
  });
  const [sectorName, setSectorName] = useState('');
  const [pricingDrafts, setPricingDrafts] = useState<Record<string, string>>({});
  const [zoneFormFee, setZoneFormFee] = useState<string>(''); // ⚠️ NOVO: Taxa temporária durante criação
  const [pricingNotice, setPricingNotice] = useState<string | null>(null);
  const [pricingSavingId, setPricingSavingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false); // ⚠️ FIXADO: Adicionado valor à desestruturação

  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState(DEFAULT_SCOPE);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNotice, setSearchNotice] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [newZonePolygon, setNewZonePolygon] = useState<LatLngTuple[][] | null>(null);
  const [polygonDirty, setPolygonDirty] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [drawReady, setDrawReady] = useState(false);
  const [EditControlComp, setEditControlComp] = useState<React.ComponentType<any> | null>(null);
  const ordersRaw = useLiveQuery(() => db.service_orders?.toArray(), []);

  const mapRef = useRef<L.Map | null>(null);
  const drawnItemsRef = useRef<any>(null);

  // Carregar depósitos via serviço (online)
  useEffect(() => {
    let mounted = true;
    depositService
      .getAll()
      .then((rows) => {
        if (!mounted) return;
        const mapped = rows.map((d: any) => ({
          id: d.id,
          nome: d.name,
          ativo: d.active,
          endereco: d.address,
          cor: d.color,
          require_stock_audit: d.require_stock_audit,
        } as Deposito));
        setDepositsOnline(mapped);
      })
      .catch((err) => {
        console.error('Erro ao carregar depósitos', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await import('leaflet-draw/dist/leaflet.draw.js');
        // Garantir que plugins registrem Event
        const hasDraw = !!(L as any)?.Draw?.Event;
        if (!mounted) return;
        if (hasDraw) {
          const mod = await import('react-leaflet-draw');
          setEditControlComp(() => mod.EditControl);
          setDrawReady(true);
          ensureDrawReadableAreaPatch();
        } else {
          // Fallback: não renderiza edit control, mas não quebra
          console.warn('leaflet-draw não expôs L.Draw.Event; ferramentas de desenho desativadas');
          setDrawReady(false);
        }
      } catch (err) {
        console.error('Erro ao carregar ferramentas de desenho', err);
        if (mounted) setDrawReady(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // ⚠️ REMOVIDO: Sem inicialização automática de depósito
  // Usuário DEVE selecionar manualmente cada vez

  useEffect(() => {
    if (!selectedZoneId && zones.length > 0 && !isCreatingZone) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zones, selectedZoneId, isCreatingZone]);

  useEffect(() => {
    const currentDeposit = deposits.find((d) => d.id === selectedDepositId);
    if (!currentDeposit) return;
    const value =
      (currentDeposit as any).free_shipping_min_value ??
      (currentDeposit as any).freeShippingMinValue ??
      (currentDeposit as any).freeShippingMin ??
      0;
    setFreeShippingValue(String(Number(value) || 0));
  }, [deposits, selectedDepositId]);

  useEffect(() => {
    const zone = zones.find((z) => z.id === selectedZoneId);
    if (!zone) {
      if (!isCreatingZone) {
        setNewZonePolygon(null);
        setPolygonDirty(false);
        if (drawnItemsRef.current) {
          drawnItemsRef.current.clearLayers();
        }
      }
      return;
    }
    setZoneForm({
      id: zone.id,
      name: zone.name,
      color: zone.color ?? '#f97316',
      depositoId: zone.depositoId ?? null, // ✅ camelCase
    });
    const polygon = normalizePolygon((zone as any).map_polygon);
    setNewZonePolygon(polygon);
    setPolygonDirty(false);
    applyPolygonLayer(polygon, true, zone.color ?? '#f97316');
  }, [zones, selectedZoneId, isCreatingZone]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || null;
  const selectedDeposit = deposits.find((d) => d.id === selectedDepositId) || null;
  const zoneSectors = useMemo(
    () => sectors.filter((s) => s.zone_id === selectedZoneId),
    [sectors, selectedZoneId]
  );
  const otherZones = useMemo(
    () => zones.filter((z) => z.id !== selectedZoneId),
    [zones, selectedZoneId]
  );
  const selectedPolygon = useMemo(
    () => normalizePolygon(selectedZone?.map_polygon),
    [selectedZone]
  );
  const currentDeposit = selectedDeposit;
  const name = zoneForm.name?.trim() ?? '';
  const color = zoneForm.color || '#f97316';
  const isEditingZone = !isCreatingZone && !!selectedZone;
  const zoneBase = isEditingZone ? selectedZone : {};
  const zoneFee = isEditingZone ? Number((selectedZone as any)?.fee ?? 0) || 0 : 0;
  const zonePolygon = isEditingZone ? (selectedPolygon ?? (selectedZone as any)?.map_polygon ?? null) : null;
  const zoneData: Partial<DeliveryZone> = {
    fee: zoneFee,
    ...(zoneBase as any),
    ...zoneForm,
    map_polygon: zonePolygon,
  };
  const fee = zoneForm.id ? String(pricingDrafts[zoneForm.id] ?? '').replace(',', '.') : '';
  const heatPoints = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return (ordersRaw ?? [])
      .filter((o: any) => Number(o?.dataHoraCriacao ?? 0) >= cutoff)
      .map((o: any) => [Number(o.latitude), Number(o.longitude), 0.8] as HeatPoint)
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }, [ordersRaw]);
  const pricingByZoneId = useMemo(() => {
    const map = new Map<string, any>();
    if (!selectedDepositId) return map;
    for (const pricing of zonePricing) {
      if (pricing.depositoId === selectedDepositId) { // ✅ camelCase
        map.set(pricing.zone_id, pricing);
      }
    }
    return map;
  }, [zonePricing, selectedDepositId]);
  const activePricing = selectedZoneId && selectedDepositId ? pricingByZoneId.get(selectedZoneId) : null;
  const selectedZonePrice = activePricing?.price ?? null;

  useEffect(() => {
    if (!selectedDepositId) {
      setPricingDrafts({});
      return;
    }
    const next: Record<string, string> = {};
    for (const zone of zones) {
      const pricing = pricingByZoneId.get(zone.id);
      next[zone.id] = pricing ? String(pricing.price ?? 0) : '';
    }
    setPricingDrafts(next);
    setPricingNotice(null);
  }, [selectedDepositId, zones, pricingByZoneId]);

  const activeZoneName = selectedZone?.name || (isCreatingZone ? 'Nova zona' : 'Nenhuma zona selecionada');
  const activeZoneColor = zoneForm.color || selectedZone?.color || '#f97316';
  const drawShapeOptions = useMemo(
    () => ({ color: activeZoneColor, fillColor: activeZoneColor, fillOpacity: 0.3, weight: 2 }),
    [activeZoneColor]
  );
  const areaStatus = newZonePolygon
    ? (polygonDirty ? 'definida (nao salva)' : 'definida')
    : 'nao definida';
  const activePriceLabel = !selectedDepositId
    ? 'Selecione um deposito'
    : activePricing
      ? `R$ ${Number(activePricing.price || 0).toFixed(2)}`
      : 'Sem preco definido';
  const otherZonePolygons = useMemo(
    () =>
      zones
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
  const overlapZones = useMemo(() => {
    const currentPolygon = newZonePolygon ?? selectedPolygon ?? null;
    if (!currentPolygon) return [];
    return otherZonePolygons
      .filter((zone) => polygonsOverlap(currentPolygon, zone.polygon))
      .map((zone) => zone.name);
  }, [newZonePolygon, selectedPolygon, otherZonePolygons]);

  const applyPolygonLayer = (polygon: LatLngTuple[][] | null, fitBounds: boolean, color?: string) => {
    if (!drawnItemsRef.current) return;
    drawnItemsRef.current.clearLayers();
    if (!polygon || polygon.length === 0) return;
    const shapeColor = color || activeZoneColor;
    const layer = L.polygon(polygon as any, {
      color: shapeColor,
      fillColor: shapeColor,
      fillOpacity: 0.3,
    });
    drawnItemsRef.current.addLayer(layer);
    if (fitBounds && mapRef.current) {
      mapRef.current.fitBounds(layer.getBounds(), { padding: [24, 24] });
    }
  };

  const handleSearch = async () => {
    const term = searchQuery.trim();
    if (!term || !mapRef.current) return;
    setIsSearching(true);
    setSearchError(null);
    setSearchNotice(null);
    try {
      const scope = searchScope.trim() || DEFAULT_SCOPE;
      const scopeCity = getScopeCity(scope);
      const defaultScopeCity = getScopeCity(DEFAULT_SCOPE);
      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          format: 'jsonv2',
          q: `${term}, ${scope}`,
          polygon_geojson: 1,
          addressdetails: 1,
          limit: 8,
          dedupe: 1,
          countrycodes: 'br',
          ...(scopeCity === defaultScopeCity
            ? {
                viewbox: `${DEFAULT_SCOPE_BOUNDS.west},${DEFAULT_SCOPE_BOUNDS.north},${DEFAULT_SCOPE_BOUNDS.east},${DEFAULT_SCOPE_BOUNDS.south}`,
                bounded: 1,
              }
            : {}),
        },
        headers: {
          'Accept-Language': 'pt-BR',
        },
      });
      const results = Array.isArray(data) ? data : [];
      const scopedResults = scopeCity
        ? results.filter((item) => itemMatchesScopeCity(item, scopeCity))
        : results;
      const tokens = extractTokens(term);
      const areaIntent = isAreaIntent(term);
      const boundaryResults = scopedResults.filter((item) => {
        const isBoundaryLike = item?.class === 'boundary' || item?.type === 'administrative';
        const isPlaceLike = item?.class === 'place' && preferredPlaceTypes.has(item?.type);
        return isBoundaryLike || isPlaceLike;
      });
      const tokenResults = tokens.length
        ? boundaryResults.filter((item) => itemMatchesTokens(item, tokens))
        : boundaryResults;
      const candidates = areaIntent
        ? (tokenResults.length ? tokenResults : boundaryResults)
        : scopedResults;
      if (!candidates.length) {
        setSearchNotice('Sem limites oficiais do bairro no alcance. Desenhe a area manualmente.');
        mapRef.current.flyTo([HUB_COORDS.lat, HUB_COORDS.lng], 12);
        return;
      }
      const first = pickBestNominatimResult(candidates, term, scope);
      if (!first) {
        setSearchError('Nenhum resultado dentro do alcance.');
        return;
      }
      const lat = Number(first?.lat);
      const lon = Number(first?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        setSearchError('Localizacao nao encontrada.');
        return;
      }
      const isBoundaryLike = first?.class === 'boundary' || first?.type === 'administrative';
      const isPlaceLike = first?.class === 'place' && preferredPlaceTypes.has(first?.type);
      const allowPolygon = isBoundaryLike || isPlaceLike;
      let polygon = allowPolygon ? geojsonToPolygon(first?.geojson) : null;
      if (!polygon && allowPolygon && Array.isArray(first?.boundingbox) && first.boundingbox.length === 4) {
        const south = Number(first.boundingbox[0]);
        const north = Number(first.boundingbox[1]);
        const west = Number(first.boundingbox[2]);
        const east = Number(first.boundingbox[3]);
        if ([south, north, west, east].every(Number.isFinite)) {
          polygon = [[
            [south, west],
            [south, east],
            [north, east],
            [north, west],
            [south, west],
          ]];
        }
      }

      if (!selectedZoneId && !isCreatingZone) {
        setIsCreatingZone(true);
        if (!zoneForm.name) {
          setZoneForm({ ...zoneForm, name: term });
        }
      }

      if (polygon) {
        setNewZonePolygon(polygon);
        setPolygonDirty(true);
        applyPolygonLayer(polygon, true, activeZoneColor);
      } else {
        mapRef.current.flyTo([lat, lon], 15);
        setSearchNotice('Endereco encontrado, mas sem limite do bairro. Desenhe a area manualmente.');
      }
    } catch (err) {
      setSearchError('Falha ao buscar local.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDrawCreated = (e: any) => {
    const layer = e.layer;
        if (drawnItemsRef.current) { 
          drawnItemsRef.current.clearLayers(); 
          drawnItemsRef.current.addLayer(layer); 
    }
    const polygon = serializeLatLngs(layer.getLatLngs());
    setNewZonePolygon(polygon.length ? polygon : null);
    setPolygonDirty(true);
    if (polygon.length && mapRef.current) {
      const bounds = L.polygon(polygon as any).getBounds();
      mapRef.current.fitBounds(bounds, { padding: [24, 24] });
    }
  };

  const handleDrawEdited = (e: any) => {
    let polygon: LatLngTuple[][] | null = null;
    e.layers.eachLayer((layer: any) => {
      const next = serializeLatLngs(layer.getLatLngs());
      if (next.length) polygon = next;
    });
    if (polygon) {
      setNewZonePolygon(polygon);
      setPolygonDirty(true);
    }
  };

  const handleDrawDeleted = () => {
    setNewZonePolygon(null);
    setPolygonDirty(true);
  };

  useEffect(() => {
    if (!drawnItemsRef.current) return;
    drawnItemsRef.current.eachLayer((layer: any) => {
      if (!layer?.setStyle) return;
      layer.setStyle({
        color: activeZoneColor,
        fillColor: activeZoneColor,
        fillOpacity: 0.3,
      });
    });
  }, [activeZoneColor]);

  useEffect(() => {
    if (!mapRef.current) return;
    applyPolygonLayer(newZonePolygon ?? selectedPolygon ?? null, false);
  }, [newZonePolygon, selectedPolygon]);

  const handleSaveFreeShipping = async () => {
    const current = deposits.find((d) => d.id === selectedDepositId);
    if (!current) {
      toast.error('Selecione um deposito para salvar o frete gratis.');
      return;
    }
    const value = Number(String(freeShippingValue).replace(',', '.')) || 0;
    try {
      await depositService.update(current.id, { free_shipping_min_value: value });
      setDepositsOnline((prev) => {
        if (!prev.length) {
          return [{ ...current, free_shipping_min_value: value }];
        }
        return prev.map((dep) =>
          dep.id === current.id ? { ...dep, free_shipping_min_value: value } : dep
        );
      });
      toast.success('Frete gratis atualizado com sucesso.');
    } catch (error) {
      console.error('Erro ao salvar frete gratis:', error);
      toast.error('Erro ao salvar frete gratis.');
    }
  };

  const handleSaveZone = async () => {
    if (!name) return toast.error('Nome da zona é obrigatório');
    const polygonToSave = newZonePolygon || zonePolygon;
    if (!polygonToSave) {
      return toast.error('Desenhe a área da zona no mapa antes de salvar');
    }
    setSaving(true);
    try {
      // 1. Montar payload da zona
      const zoneId = zoneData?.id ?? crypto.randomUUID();
      const zonePayload: Database['public']['Tables']['delivery_zones']['Insert'] = {
        id: zoneId,
        name,
        color: color || null,
        is_active: true,
        // Adicione outros campos obrigatórios se existirem
        // polygon: polygonToSave, // Se o campo correto for map_polygon, ajuste aqui
        map_polygon: polygonToSave,
      };

      // 2. Upsert da zona via service
      const savedZone = await deliveryService.upsertDeliveryZone(zonePayload);

      // 3. Se existir preço por depósito selecionado, montar payload e chamar upsertZonePricing
      let pricingPayload: Database['public']['Tables']['zone_pricing']['Insert'] | null = null;
      if (selectedDepositId && zoneFormFee != null && !Number.isNaN(Number(zoneFormFee))) {
        pricingPayload = {
          id: `${selectedDepositId}:${zoneId}`,
          zone_id: savedZone.id,
          deposit_id: selectedDepositId,
          price: Number(zoneFormFee),
        };
        await deliveryService.upsertZonePricing(pricingPayload);
      }

      // 4. Atualizar estado local de zonas e precificação
      setZones((prev) => {
        const exists = prev.some((z) => z.id === savedZone.id);
        if (!exists) return [...prev, savedZone];
        return prev.map((z) => (z.id === savedZone.id ? savedZone : z));
      });

      if (pricingPayload) {
        setZonePricing((prev) => {
          const exists = prev.some((p) => p.id === pricingPayload!.id);
          if (!exists) return [...prev, pricingPayload!];
          return prev.map((p) => (p.id === pricingPayload!.id ? pricingPayload! : p));
        });
      }

      setZoneData(savedZone);
      setZonePolygon(polygonToSave);
      setPolygonDirty(false);
      setDirty(false);

      toast.success('Zona salva com sucesso.');
    } catch (error: any) {
      console.error('Erro ao salvar zona:', error);
      toast.error('Erro ao salvar zona.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Excluir esta zona?')) return;
    try {
      await deliveryService.deleteDeliveryZone(zoneId);
      setZones((prev) => prev.filter((z) => z.id !== zoneId));
      setZonePricing((prev) => prev.filter((p) => p.zone_id !== zoneId));
      if (selectedZoneId === zoneId) {
        const next = zones.find((z) => z.id !== zoneId);
        setSelectedZoneId(next?.id || '');
      }
      toast.success('Zona excluída com sucesso.');
    } catch (error) {
      console.error('Erro ao excluir zona:', error);
      toast.error('Erro ao excluir zona.');
    }
  };

  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setIsCreatingZone(false);
    setNewZonePolygon(null);
    setPolygonDirty(false);
    setZoneFormFee(''); // ⚠️ NOVO: Resetar taxa ao selecionar zona existente
    if (drawnItemsRef.current) {
      drawnItemsRef.current.clearLayers();
    }
  };

  const handleSaveZonePricing = async (zoneId: string) => {
    if (!selectedDepositId) {
      setPricingNotice('Selecione um deposito para salvar o preco.');
      return;
    }
    const raw = pricingDrafts[zoneId] ?? '';
    const parsed = Number(String(raw).replace(',', '.'));
    const price = Number.isFinite(parsed) ? parsed : 0;
    setPricingSavingId(zoneId);
    try {
      const pricingPayload = {
        id: `${selectedDepositId}:${zoneId}`,
        zone_id: zoneId,
        depositoId: selectedDepositId, // ✅ camelCase
        price,
      };
      
      // 📦 VALIDAÇÃO: Verificar objeto limpo antes de enviar
      console.log('📦 Salvando Pricing (deve ter apenas depositoId):', pricingPayload);
      const hasLegacyFields = 'deposit_id' in pricingPayload || 'deposito_id' in pricingPayload;
      if (hasLegacyFields) {
        console.error('❌ CONTAMINAÇÃO: Objeto contém campos legados!', pricingPayload);
      }
      
      await upsertZonePricing(pricingPayload as any);
      setPricingNotice(null);
    } catch (err) {
      console.error(err);
      setPricingNotice('Nao foi possivel salvar o preco.');
    } finally {
      setPricingSavingId(null);
    }
  };

  const handleAddSector = async () => {
    if (!selectedZoneId || !sectorName.trim()) return;
    const payload: DeliverySector = {
      id: crypto.randomUUID(),
      zone_id: selectedZoneId,
      name: sectorName.trim(),
    };
    await upsertDeliverySector(payload);
    setSectorName('');
  };

  const handleMoveSector = async (sectorId: string, targetZoneId: string) => {
    if (!targetZoneId) return;
    await moveDeliverySector(sectorId, targetZoneId);
  };

  const handleDeleteSector = async (sectorId: string) => {
    await deleteDeliverySector(sectorId);
  };

  const pricingPanel = (
    <div className="bg-surface border border-bdr rounded-2xl p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-black text-txt-main uppercase">Precificacao por zona</h4>
          <span className="text-xs text-txt-muted">
            Deposito: {selectedDeposit?.nome || 'Nao selecionado'}
          </span>
        </div>
        {/* ✅ Campo de seleção de depósito sempre visível */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-txt-muted uppercase">Selecione o Depósito</label>
          <select
            value={selectedDepositId}
            onChange={(e) => setSelectedDepositId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-bdr bg-app text-txt-main text-sm font-bold"
          >
            <option value="">-- Selecione um depósito --</option>
            {deposits.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nome}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!selectedDepositId && (
        <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
          ⚠️ Selecione um deposito para editar os precos.
        </div>
      )}
      {pricingNotice && <div className="text-xs text-red-500">{pricingNotice}</div>}
      {loading ? (
        <div className="text-xs text-txt-muted">Carregando...</div>
      ) : zones.length === 0 ? (
        <div className="text-xs text-txt-muted italic">Nenhuma zona cadastrada.</div>
      ) : (
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
                      : 'Sem preco'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs text-txt-muted font-bold">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={pricingDrafts[zone.id] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPricingDrafts((prev) => ({ ...prev, [zone.id]: value }));
                      if (pricingNotice) setPricingNotice(null);
                    }}
                    disabled={!selectedDepositId}
                    className="h-9 w-24 px-2 rounded-lg border border-bdr bg-surface text-txt-main text-sm font-bold disabled:opacity-50"
                    placeholder="0,00"
                  />
                </div>
                <button
                  onClick={() => handleSaveZonePricing(zone.id)}
                  disabled={!selectedDepositId || pricingSavingId === zone.id}
                  className="h-9 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {pricingSavingId === zone.id ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-app z-50 flex flex-col animate-in fade-in duration-300">
      <div className="bg-surface border-b border-bdr px-6 py-4 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-orange-500/10 p-2 rounded-xl border border-orange-500/20">
            <Truck className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-txt-main tracking-tight">Configuracao de Entregas</h2>
            <p className="text-xs text-txt-muted font-bold uppercase tracking-widest">Zonas, setores e taxas</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-red-500/10 hover:text-red-500 text-txt-muted rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-app p-6">
        <div className="max-w-[1600px] w-full mx-auto space-y-6">
          <div className="bg-surface border border-bdr rounded-2xl p-5 flex flex-col lg:flex-row gap-6 shadow-sm">
            <div className="flex-1 space-y-2">
              <p className="text-xs font-black text-txt-muted uppercase tracking-widest">Regra global</p>
              <h3 className="text-lg font-black text-txt-main">Frete gratis a partir de</h3>
              <p className="text-xs text-txt-muted">
                Pedidos acima do valor minimo terao taxa zero automaticamente.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              {/* ✅ Sempre mostrar seletor de depósito, mesmo se houver apenas 1 */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-txt-muted uppercase">Deposito</label>
                <select
                  value={selectedDepositId}
                  onChange={(e) => setSelectedDepositId(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-bdr bg-app text-txt-main text-sm font-bold"
                >
                  <option value="">Selecione...</option>
                  {deposits.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-txt-muted uppercase">Valor minimo</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={freeShippingValue}
                    onChange={(e) => setFreeShippingValue(e.target.value)}
                    className="h-9 w-32 px-3 rounded-lg border border-bdr bg-app text-txt-main font-bold text-sm"
                  />
                  <button
                    onClick={handleSaveFreeShipping}
                    className="h-9 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-black uppercase tracking-widest shadow-sm"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsMode('map')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                settingsMode === 'map'
                  ? 'bg-emerald-500 text-white border-emerald-500'
                  : 'bg-surface text-txt-muted border-bdr hover:text-txt-main'
              }`}
            >
              Modo mapa/global
            </button>
            <button
              type="button"
              onClick={() => setSettingsMode('pricing')}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                settingsMode === 'pricing'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-surface text-txt-muted border-bdr hover:text-txt-main'
              }`}
            >
              Modo precificacao
            </button>
            <span className="text-xs text-txt-muted">
              Deposito atual: {selectedDeposit?.nome || 'Nao selecionado'}
            </span>
          </div>

          {settingsMode === 'map' ? (
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
            <div className="bg-surface border border-bdr rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-txt-main uppercase">Zonas cadastradas</h4>
                <button
                  onClick={() => {
                    setZoneForm({ name: '', color: '#f97316' });
                    setSelectedZoneId('');
                    setIsCreatingZone(true);
                    setNewZonePolygon(null);
                    setPolygonDirty(false);
                    setZoneFormFee(''); // ⚠️ NOVO: Resetar taxa
                    if (drawnItemsRef.current) {
                      drawnItemsRef.current.clearLayers();
                    }
                  }}
                  className="px-3 py-1.5 bg-app border border-bdr rounded-lg text-xs font-bold text-txt-muted hover:text-txt-main"
                >
                  Nova zona
                </button>
              </div>
              {loading ? (
                <div className="text-xs text-txt-muted">Carregando...</div>
              ) : zones.length === 0 ? (
                <div className="text-xs text-txt-muted italic">Nenhuma zona cadastrada.</div>
              ) : (
                <div className="space-y-2">
                  {zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`w-full rounded-xl border transition-all ${
                        selectedZoneId === zone.id ? 'border-orange-500 bg-orange-500/10' : 'border-bdr hover:bg-app'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 p-3">
                        <button
                          type="button"
                          onClick={() => handleSelectZone(zone.id)}
                          className="flex-1 text-left"
                        >
                          <div className="text-sm font-black text-txt-main">{zone.name}</div>
                          <div className="text-xs text-txt-muted">
                            {selectedDepositId
                              ? `R$ ${Number(pricingByZoneId.get(zone.id)?.price || 0).toFixed(2)}`
                              : 'Selecione um deposito'}
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-bdr"
                            style={{ backgroundColor: zone.color || '#f97316' }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeleteZone(zone.id)}
                            className="p-1 rounded hover:bg-red-500/10 text-txt-muted hover:text-red-500"
                            aria-label={`Excluir zona ${zone.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface border border-bdr rounded-2xl p-4 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-orange-500" />
                    <h4 className="text-sm font-black text-txt-main uppercase">Detalhes da zona</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-txt-muted uppercase">Nome</label>
                      <input
                        value={zoneForm.name || ''}
                        onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                        className="h-9 px-3 rounded-lg border border-bdr bg-app text-txt-main font-bold text-sm"
                        placeholder="Zona 1"
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-xs font-bold text-txt-muted uppercase">Cor (hex)</label>
                        <input
                          value={zoneForm.color || ''}
                          onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                          className="h-9 px-3 rounded-lg border border-bdr bg-app text-txt-main font-bold text-sm"
                          placeholder="#f97316"
                        />
                      </div>
                      <input
                        type="color"
                        value={zoneForm.color || '#f97316'}
                        onChange={(e) => setZoneForm({ ...zoneForm, color: e.target.value })}
                        className="h-9 w-12 border border-bdr rounded-lg bg-app"
                      />
                    </div>
                    
                    {/* ⚠️ NOVO: Input de taxa durante criação */}
                    {isCreatingZone && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-txt-muted uppercase">Taxa de Entrega (R$)</label>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-txt-muted font-bold">R$</span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={zoneFormFee}
                            onChange={(e) => setZoneFormFee(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-lg border border-bdr bg-app text-txt-main font-bold text-sm"
                            placeholder="0,00"
                          />
                        </div>
                        <div className="text-[10px] text-txt-muted">
                          Taxa padrão para entregas nesta zona. Pode editar depois em "Precificação".
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={handleSaveZone}
                      disabled={saving}
                      className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : (zoneForm.id ? 'Salvar zona' : 'Criar zona')}
                    </button>
                    <div className="text-[11px] text-txt-muted">
                      Salva nome, taxa, cor e area desenhada no mapa.
                    </div>
                  </div>
                </div>

                <div className="bg-surface border border-bdr rounded-2xl p-4 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-txt-main uppercase">Setores da zona</h4>
                    {selectedZone && (
                      <span className="text-xs text-txt-muted">Zona: {selectedZone.name}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={sectorName}
                      onChange={(e) => setSectorName(e.target.value)}
                      placeholder="Adicionar bairro"
                      className="flex-1 h-9 px-3 rounded-lg border border-bdr bg-app text-txt-main text-sm"
                    />
                    <button
                      onClick={handleAddSector}
                      disabled={!selectedZoneId}
                      className="h-9 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {zoneSectors.length === 0 ? (
                      <div className="text-xs text-txt-muted italic">Nenhum setor vinculado.</div>
                    ) : (
                      zoneSectors.map((sector) => (
                        <div
                          key={sector.id}
                          className="flex items-center justify-between gap-2 bg-app border border-bdr rounded-lg px-3 py-2"
                        >
                          <span className="text-sm font-bold text-txt-main">{sector.name}</span>
                          <div className="flex items-center gap-2">
                            {otherZones.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => handleMoveSector(sector.id, e.target.value)}
                                className="h-7 px-2 rounded border border-bdr bg-surface text-xs text-txt-muted"
                              >
                                <option value="">Mover...</option>
                                {otherZones.map((z) => (
                                  <option key={z.id} value={z.id}>
                                    {z.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() => handleDeleteSector(sector.id)}
                              className="p-1 rounded hover:bg-red-500/10 text-txt-muted hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                <div className="bg-surface border border-bdr rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapIcon className="w-4 h-4 text-emerald-500" />
                    <h4 className="text-sm font-black text-txt-main uppercase">Mapa (visual)</h4>
                  </div>
                  {selectedZone && (
                    <div className="flex items-center gap-2 text-xs text-txt-muted">
                      <span className="w-3 h-3 rounded-full border border-bdr" style={{ backgroundColor: selectedZone.color || '#f97316' }} />
                      {selectedZone.name}
                    </div>
                  )}
                </div>
                <div className="mb-3 rounded-lg border border-bdr bg-app px-3 py-2 text-xs text-txt-muted">
                  <div className="font-black text-txt-main">Como usar a marcacao</div>
                  <div>1) Selecione uma zona ou clique "Nova zona".</div>
                  <div>2) Pesquise um bairro/rua para gerar a area automaticamente (quando disponivel).</div>
                  <div>3) Ajuste o alcance se quiser buscar outra cidade.</div>
                  <div>4) Ajuste/desenhe no mapa (ferramentas a direita).</div>
                  <div>5) Clique "Salvar zona" para gravar area, taxa e cor.</div>
                  <div>Dica: use o lapis para editar e a lixeira para apagar.</div>
                  <div>Dica: clique em uma zona no mapa para selecionar.</div>
                  {overlapZones.length > 0 && (
                    <div className="mt-1 text-[11px] font-semibold text-red-500">
                      Aviso: area atual invade {overlapZones.length > 1 ? 'zonas' : 'zona'} {overlapZones.join(', ')}. Ajuste antes de salvar.
                    </div>
                  )}
                  <div className="mt-1 text-txt-main">
                    Zona ativa: {activeZoneName} · Preco deposito: {activePriceLabel} · Area: {areaStatus}
                  </div>
                </div>
                <div className="flex flex-col gap-2 mb-3">
                  <label className="text-xs font-bold text-txt-muted uppercase">Pesquisar Bairro/Rua</label>
                  <div className="flex gap-2">
                    <input
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (searchError) setSearchError(null);
                        if (searchNotice) setSearchNotice(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch();
                      }}
                      className="flex-1 h-9 px-3 rounded-lg border border-bdr bg-app text-txt-main text-sm"
                      placeholder="Ex: Bairro Popular"
                    />
                    <button
                      onClick={handleSearch}
                      disabled={!searchQuery.trim() || isSearching}
                      className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50"
                    >
                      {isSearching ? 'Buscando...' : 'Buscar'}
                    </button>
                  </div>
                  <label className="text-xs font-bold text-txt-muted uppercase">Alcance (cidade/UF)</label>
                  <input
                    value={searchScope}
                    onChange={(e) => setSearchScope(e.target.value)}
                    className="h-9 px-3 rounded-lg border border-bdr bg-app text-txt-main text-sm"
                    placeholder={DEFAULT_SCOPE}
                  />
                  <div className="text-[11px] text-txt-muted">
                    Padrao: {DEFAULT_SCOPE}. Para estender, edite o alcance.
                  </div>
                  {searchError && <div className="text-xs text-red-500">{searchError}</div>}
                  {searchNotice && <div className="text-xs text-amber-500">{searchNotice}</div>}
                </div>
                <div className="relative">
                  <MapContainer
                    center={[HUB_COORDS.lat, HUB_COORDS.lng]}
                    zoom={12}
                    className="w-full h-[360px] md:h-[480px] lg:h-[560px] xl:h-[640px] rounded-xl overflow-hidden border border-bdr"
                  >
                    <TileLayer
                      attribution="&copy; OSM contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapRefSetter mapRef={mapRef} />
                    <MapResizeHandler />
                    {otherZonePolygons.length > 0 && (
                      <Pane name="other-zones" style={{ zIndex: 300 }}>
                        {otherZonePolygons.map((zone) => (
                          <Polygon
                            key={zone.id}
                            positions={zone.polygon as LatLngTuple[][]}
                            pathOptions={{
                              color: zone.color,
                              fillColor: zone.color,
                              fillOpacity: 0.12,
                              weight: 1,
                              dashArray: '4 6',
                              className: 'cursor-pointer',
                            }}
                            eventHandlers={{
                              click: () => handleSelectZone(zone.id),
                            }}
                          >
                            <Tooltip sticky>{zone.name}</Tooltip>
                          </Polygon>
                        ))}
                      </Pane>
                    )}
                    {drawReady && EditControlComp && (
                      <FeatureGroup ref={drawnItemsRef}>
                        <EditControlComp
                          position="topright"
                          onCreated={handleDrawCreated}
                          onEdited={handleDrawEdited}
                          onDeleted={handleDrawDeleted}
                          draw={{
                            polygon: { shapeOptions: drawShapeOptions },
                            rectangle: { shapeOptions: drawShapeOptions },
                            polyline: false,
                            circle: false,
                            circlemarker: false,
                            marker: false,
                          }}
                          edit={{
                            edit: { selectedPathOptions: drawShapeOptions },
                            remove: {},
                          }}
                        />
                      </FeatureGroup>
                    )}
                    <HeatmapLayer enabled={showHeatmap} points={heatPoints} />
                  </MapContainer>
                  <button
                    onClick={() => setShowHeatmap((prev) => !prev)}
                    className="absolute top-3 right-3 px-3 py-1.5 bg-white/90 border border-bdr rounded-lg text-[11px] font-black uppercase tracking-widest text-txt-main shadow-sm"
                  >
                    {showHeatmap ? 'Ocultar Mapa de Calor' : 'Ver Mapa de Calor'}
                  </button>
                </div>
              </div>
              {pricingPanel}
            </div>
          </div>
          </div>
          ) : (
            <div className="max-w-[820px]">{pricingPanel}</div>
          )}
        </div>
      </div>
    </div>
  );
};

