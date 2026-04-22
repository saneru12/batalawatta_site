import DeliverySettings from '../models/DeliverySettings.js';
import { DELIVERY_CONFIG } from './delivery.js';

function cleanText(value) {
  return String(value || '').trim();
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return fallback;
}

function slugify(value, fallback = 'item') {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function uniqueById(list = []) {
  const map = new Map();
  for (const item of list) {
    if (!item?.id) continue;
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

function defaultTimeSlots() {
  return (DELIVERY_CONFIG.timeSlots || []).map((slot, index) => ({
    id: cleanText(slot.id) || `slot_${index + 1}`,
    label: cleanText(slot.label) || `Slot ${index + 1}`,
    startTime: '',
    endTime: '',
    sortOrder: index + 1,
    isActive: true,
  }));
}

function defaultZones() {
  return (DELIVERY_CONFIG.zones || []).map((zone, index) => ({
    id: cleanText(zone.id) || `zone_${index + 1}`,
    name: cleanText(zone.name) || `Zone ${index + 1}`,
    areas: Array.isArray(zone.areas) ? zone.areas.map((area) => cleanText(area)).filter(Boolean) : [],
    fee: toNumber(zone.fee, 0),
    leadTimeLabel: cleanText(zone.leadTimeLabel) || 'To be confirmed',
    defaultLeadDays: toNumber(zone.defaultLeadDays, 1),
    sameDayEligible: Boolean(zone.sameDayEligible),
    sameDayCutoffHour: zone.sameDayEligible ? toNumber(zone.sameDayCutoffHour, DELIVERY_CONFIG.sameDayCutoffHour || 12) : null,
    defaultTimeSlot: cleanText(zone.defaultTimeSlot) || 'afternoon',
    sortOrder: index + 1,
    isActive: true,
    notes: '',
  }));
}

function defaultPolicies() {
  return Array.isArray(DELIVERY_CONFIG.policies)
    ? DELIVERY_CONFIG.policies.map((policy) => cleanText(policy)).filter(Boolean)
    : [];
}

export const DEFAULT_DELIVERY_SETTINGS = {
  serviceTitle: cleanText(DELIVERY_CONFIG.serviceTitle) || 'Batalawatta Team Delivery',
  serviceType: cleanText(DELIVERY_CONFIG.serviceType) || 'Own vehicle delivery',
  vehicleNote: cleanText(DELIVERY_CONFIG.vehicleNote) || 'Plants are delivered using the nursery team\'s own vehicles for safer handling and better quality control.',
  baseLocation: cleanText(DELIVERY_CONFIG.baseLocation) || 'Batalawatta, Battaramulla',
  minimumRecommendedOrder: toNumber(DELIVERY_CONFIG.minimumRecommendedOrder, 3000),
  sameDayCutoffHour: toNumber(DELIVERY_CONFIG.sameDayCutoffHour, 12),
  sameDayCutoffLabel: cleanText(DELIVERY_CONFIG.sameDayCutoffLabel) || '12:00 PM',
  contactBeforeArrival: DELIVERY_CONFIG.contactBeforeArrival !== false,
  issueReportWindowHours: toNumber(DELIVERY_CONFIG.issueReportWindowHours, 24),
  policies: defaultPolicies(),
  timeSlots: defaultTimeSlots(),
  zones: defaultZones(),
  dispatchRules: {
    maxStopsPerBoyPerDay: 10,
    maxStopsPerBoyPerSlot: 4,
    clusterByZone: true,
    autoSuggestRouteSequence: true,
  },
};

export async function ensureDeliverySettings() {
  let settings = await DeliverySettings.findOne({ singletonKey: 'main' });
  if (!settings) {
    settings = await DeliverySettings.create({ singletonKey: 'main', ...DEFAULT_DELIVERY_SETTINGS });
  }
  return settings;
}

function sortByOrder(list = []) {
  return [...list].sort((a, b) => toNumber(a.sortOrder, 0) - toNumber(b.sortOrder, 0));
}

export function listActiveTimeSlots(settingsDoc, options = {}) {
  const includeInactive = Boolean(options.includeInactive);
  const settings = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || {});
  const base = Array.isArray(settings.timeSlots) && settings.timeSlots.length ? settings.timeSlots : defaultTimeSlots();
  const normalized = base.map((slot, index) => ({
    id: cleanText(slot.id) || `slot_${index + 1}`,
    label: cleanText(slot.label) || `Slot ${index + 1}`,
    startTime: cleanText(slot.startTime),
    endTime: cleanText(slot.endTime),
    sortOrder: toNumber(slot.sortOrder, index + 1),
    isActive: slot.isActive !== false,
  }));
  return sortByOrder(includeInactive ? normalized : normalized.filter((slot) => slot.isActive));
}

export function listActiveZones(settingsDoc, options = {}) {
  const includeInactive = Boolean(options.includeInactive);
  const settings = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || {});
  const base = Array.isArray(settings.zones) && settings.zones.length ? settings.zones : defaultZones();
  const normalized = base.map((zone, index) => ({
    id: cleanText(zone.id) || `zone_${index + 1}`,
    name: cleanText(zone.name) || `Zone ${index + 1}`,
    areas: Array.isArray(zone.areas) ? zone.areas.map((area) => cleanText(area)).filter(Boolean) : [],
    fee: toNumber(zone.fee, 0),
    leadTimeLabel: cleanText(zone.leadTimeLabel) || 'To be confirmed',
    defaultLeadDays: Math.max(0, toNumber(zone.defaultLeadDays, 1)),
    sameDayEligible: Boolean(zone.sameDayEligible),
    sameDayCutoffHour: zone.sameDayCutoffHour === null || zone.sameDayCutoffHour === undefined || zone.sameDayCutoffHour === ''
      ? null
      : toNumber(zone.sameDayCutoffHour, DEFAULT_DELIVERY_SETTINGS.sameDayCutoffHour),
    defaultTimeSlot: cleanText(zone.defaultTimeSlot) || '',
    sortOrder: toNumber(zone.sortOrder, index + 1),
    isActive: zone.isActive !== false,
    notes: cleanText(zone.notes),
  }));
  return sortByOrder(includeInactive ? normalized : normalized.filter((zone) => zone.isActive));
}

export function getTimeSlotById(settingsDoc, slotId, options = {}) {
  const list = listActiveTimeSlots(settingsDoc, options);
  return list.find((slot) => slot.id === cleanText(slotId)) || list[0] || null;
}

export function getZoneById(settingsDoc, zoneId, options = {}) {
  const list = listActiveZones(settingsDoc, options);
  return list.find((zone) => zone.id === cleanText(zoneId)) || list[0] || null;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatDateISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateLong(date) {
  const d = new Date(date);
  return d.toLocaleDateString('en-LK', { year: 'numeric', month: 'short', day: 'numeric' });
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function isIsoDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function estimateDelivery(settingsDoc, { zoneId, preferredDate = '', preferredTimeSlot = '' } = {}) {
  const settings = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || DEFAULT_DELIVERY_SETTINGS);
  const zone = getZoneById(settings, zoneId) || defaultZones()[0];
  const timeSlot = getTimeSlotById(settings, preferredTimeSlot || zone?.defaultTimeSlot) || listActiveTimeSlots(settings)[0] || { id: '', label: '' };
  const now = new Date();
  const effectiveCutoffHour = zone?.sameDayCutoffHour === null || zone?.sameDayCutoffHour === undefined
    ? toNumber(settings.sameDayCutoffHour, DEFAULT_DELIVERY_SETTINGS.sameDayCutoffHour)
    : toNumber(zone.sameDayCutoffHour, DEFAULT_DELIVERY_SETTINGS.sameDayCutoffHour);

  let estimatedDate = '';
  if (isIsoDateString(preferredDate)) {
    const chosen = new Date(`${preferredDate}T00:00:00`);
    const today = startOfToday();
    estimatedDate = formatDateISO(chosen < today ? today : chosen);
  } else if (zone?.sameDayEligible && now.getHours() < effectiveCutoffHour) {
    estimatedDate = formatDateISO(now);
  } else {
    estimatedDate = formatDateISO(addDays(now, Math.max(0, toNumber(zone?.defaultLeadDays, 1))));
  }

  return {
    estimatedDate,
    estimatedDateLabel: formatDateLong(estimatedDate),
    estimatedTimeSlot: timeSlot.id,
    estimatedTimeSlotLabel: timeSlot.label,
    estimatedWindowLabel: `${formatDateLong(estimatedDate)} • ${timeSlot.label}`,
    leadTimeLabel: zone?.leadTimeLabel || 'To be confirmed',
  };
}

function normalizePolicies(inputPolicies, fallbackPolicies = []) {
  if (typeof inputPolicies === 'string') {
    return inputPolicies
      .split(/\r?\n/)
      .map((item) => cleanText(item))
      .filter(Boolean);
  }
  if (Array.isArray(inputPolicies)) {
    return inputPolicies.map((item) => cleanText(item)).filter(Boolean);
  }
  return Array.isArray(fallbackPolicies) ? fallbackPolicies.map((item) => cleanText(item)).filter(Boolean) : [];
}

function normalizeTimeSlots(inputSlots = [], fallbackSlots = []) {
  const source = Array.isArray(inputSlots) && inputSlots.length ? inputSlots : fallbackSlots;
  const normalized = source.map((slot, index) => ({
    id: cleanText(slot.id) || slugify(slot.label, `slot_${index + 1}`),
    label: cleanText(slot.label) || `Slot ${index + 1}`,
    startTime: cleanText(slot.startTime),
    endTime: cleanText(slot.endTime),
    sortOrder: toNumber(slot.sortOrder, index + 1),
    isActive: toBoolean(slot.isActive, true),
  }));

  return sortByOrder(uniqueById(normalized));
}

function normalizeZones(inputZones = [], fallbackZones = [], slotIds = []) {
  const allowedSlotIds = new Set(slotIds);
  const source = Array.isArray(inputZones) && inputZones.length ? inputZones : fallbackZones;
  const normalized = source.map((zone, index) => {
    const id = cleanText(zone.id) || slugify(zone.name, `zone_${index + 1}`);
    const defaultSlot = cleanText(zone.defaultTimeSlot);
    const sameDay = toBoolean(zone.sameDayEligible, false);
    const defaultLeadDays = Math.max(0, toNumber(zone.defaultLeadDays, sameDay ? 0 : 1));
    return {
      id,
      name: cleanText(zone.name) || `Zone ${index + 1}`,
      areas: Array.isArray(zone.areas)
        ? zone.areas.map((area) => cleanText(area)).filter(Boolean)
        : String(zone.areas || '')
            .split(',')
            .map((area) => cleanText(area))
            .filter(Boolean),
      fee: Math.max(0, toNumber(zone.fee, 0)),
      leadTimeLabel: cleanText(zone.leadTimeLabel) || (sameDay ? 'Same day or next day' : 'Within 1 - 2 working days'),
      defaultLeadDays,
      sameDayEligible: sameDay,
      sameDayCutoffHour: sameDay
        ? toNumber(zone.sameDayCutoffHour, DEFAULT_DELIVERY_SETTINGS.sameDayCutoffHour)
        : null,
      defaultTimeSlot: allowedSlotIds.has(defaultSlot) ? defaultSlot : (slotIds[0] || ''),
      sortOrder: toNumber(zone.sortOrder, index + 1),
      isActive: toBoolean(zone.isActive, true),
      notes: cleanText(zone.notes),
    };
  });

  return sortByOrder(uniqueById(normalized));
}

export function normalizeDeliverySettingsPayload(payload = {}, existingDoc = null) {
  const existing = existingDoc?.toObject ? existingDoc.toObject() : (existingDoc || DEFAULT_DELIVERY_SETTINGS);
  const timeSlots = normalizeTimeSlots(payload.timeSlots, existing.timeSlots || DEFAULT_DELIVERY_SETTINGS.timeSlots);
  const zones = normalizeZones(
    payload.zones,
    existing.zones || DEFAULT_DELIVERY_SETTINGS.zones,
    timeSlots.map((slot) => slot.id)
  );

  return {
    serviceTitle: cleanText(payload.serviceTitle) || cleanText(existing.serviceTitle) || DEFAULT_DELIVERY_SETTINGS.serviceTitle,
    serviceType: cleanText(payload.serviceType) || cleanText(existing.serviceType) || DEFAULT_DELIVERY_SETTINGS.serviceType,
    vehicleNote: cleanText(payload.vehicleNote) || cleanText(existing.vehicleNote) || DEFAULT_DELIVERY_SETTINGS.vehicleNote,
    baseLocation: cleanText(payload.baseLocation) || cleanText(existing.baseLocation) || DEFAULT_DELIVERY_SETTINGS.baseLocation,
    minimumRecommendedOrder: Math.max(0, toNumber(payload.minimumRecommendedOrder, existing.minimumRecommendedOrder ?? DEFAULT_DELIVERY_SETTINGS.minimumRecommendedOrder)),
    sameDayCutoffHour: Math.max(0, toNumber(payload.sameDayCutoffHour, existing.sameDayCutoffHour ?? DEFAULT_DELIVERY_SETTINGS.sameDayCutoffHour)),
    sameDayCutoffLabel: cleanText(payload.sameDayCutoffLabel) || cleanText(existing.sameDayCutoffLabel) || DEFAULT_DELIVERY_SETTINGS.sameDayCutoffLabel,
    contactBeforeArrival: toBoolean(payload.contactBeforeArrival, existing.contactBeforeArrival ?? DEFAULT_DELIVERY_SETTINGS.contactBeforeArrival),
    issueReportWindowHours: Math.max(1, toNumber(payload.issueReportWindowHours, existing.issueReportWindowHours ?? DEFAULT_DELIVERY_SETTINGS.issueReportWindowHours)),
    policies: normalizePolicies(payload.policies, existing.policies || DEFAULT_DELIVERY_SETTINGS.policies),
    timeSlots,
    zones,
    dispatchRules: {
      maxStopsPerBoyPerDay: Math.max(1, toNumber(payload.dispatchRules?.maxStopsPerBoyPerDay, existing.dispatchRules?.maxStopsPerBoyPerDay ?? DEFAULT_DELIVERY_SETTINGS.dispatchRules.maxStopsPerBoyPerDay)),
      maxStopsPerBoyPerSlot: Math.max(1, toNumber(payload.dispatchRules?.maxStopsPerBoyPerSlot, existing.dispatchRules?.maxStopsPerBoyPerSlot ?? DEFAULT_DELIVERY_SETTINGS.dispatchRules.maxStopsPerBoyPerSlot)),
      clusterByZone: toBoolean(payload.dispatchRules?.clusterByZone, existing.dispatchRules?.clusterByZone ?? DEFAULT_DELIVERY_SETTINGS.dispatchRules.clusterByZone),
      autoSuggestRouteSequence: toBoolean(payload.dispatchRules?.autoSuggestRouteSequence, existing.dispatchRules?.autoSuggestRouteSequence ?? DEFAULT_DELIVERY_SETTINGS.dispatchRules.autoSuggestRouteSequence),
    },
  };
}

function baseConfigFromDoc(settingsDoc) {
  const settings = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || DEFAULT_DELIVERY_SETTINGS);
  return {
    serviceTitle: cleanText(settings.serviceTitle) || DEFAULT_DELIVERY_SETTINGS.serviceTitle,
    serviceType: cleanText(settings.serviceType) || DEFAULT_DELIVERY_SETTINGS.serviceType,
    vehicleNote: cleanText(settings.vehicleNote) || DEFAULT_DELIVERY_SETTINGS.vehicleNote,
    baseLocation: cleanText(settings.baseLocation) || DEFAULT_DELIVERY_SETTINGS.baseLocation,
    minimumRecommendedOrder: Math.max(0, toNumber(settings.minimumRecommendedOrder, DEFAULT_DELIVERY_SETTINGS.minimumRecommendedOrder)),
    sameDayCutoffHour: Math.max(0, toNumber(settings.sameDayCutoffHour, DEFAULT_DELIVERY_SETTINGS.sameDayCutoffHour)),
    sameDayCutoffLabel: cleanText(settings.sameDayCutoffLabel) || DEFAULT_DELIVERY_SETTINGS.sameDayCutoffLabel,
    contactBeforeArrival: settings.contactBeforeArrival !== false,
    issueReportWindowHours: Math.max(1, toNumber(settings.issueReportWindowHours, DEFAULT_DELIVERY_SETTINGS.issueReportWindowHours)),
    policies: normalizePolicies(settings.policies, DEFAULT_DELIVERY_SETTINGS.policies),
  };
}

export function buildPublicDeliveryConfig(settingsDoc) {
  const base = baseConfigFromDoc(settingsDoc);
  return {
    ...base,
    stages: (DELIVERY_CONFIG.stages || []).map((stage) => ({ ...stage })),
    timeSlots: listActiveTimeSlots(settingsDoc).map((slot) => ({ ...slot })),
    zones: listActiveZones(settingsDoc).map((zone) => ({ ...zone })),
  };
}

export function buildAdminDeliveryConfig(settingsDoc) {
  const base = baseConfigFromDoc(settingsDoc);
  const settings = settingsDoc?.toObject ? settingsDoc.toObject() : (settingsDoc || DEFAULT_DELIVERY_SETTINGS);
  return {
    ...base,
    stages: (DELIVERY_CONFIG.stages || []).map((stage) => ({ ...stage })),
    timeSlots: listActiveTimeSlots(settings, { includeInactive: true }).map((slot) => ({ ...slot })),
    zones: listActiveZones(settings, { includeInactive: true }).map((zone) => ({ ...zone })),
    dispatchRules: {
      maxStopsPerBoyPerDay: Math.max(1, toNumber(settings.dispatchRules?.maxStopsPerBoyPerDay, DEFAULT_DELIVERY_SETTINGS.dispatchRules.maxStopsPerBoyPerDay)),
      maxStopsPerBoyPerSlot: Math.max(1, toNumber(settings.dispatchRules?.maxStopsPerBoyPerSlot, DEFAULT_DELIVERY_SETTINGS.dispatchRules.maxStopsPerBoyPerSlot)),
      clusterByZone: settings.dispatchRules?.clusterByZone !== false,
      autoSuggestRouteSequence: settings.dispatchRules?.autoSuggestRouteSequence !== false,
    },
  };
}
