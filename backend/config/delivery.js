const DELIVERY_STATUS_STEPS = [
  {
    key: "pending",
    title: "Order received",
    description: "We received your order and will confirm stock, delivery zone, and the route.",
  },
  {
    key: "confirmed",
    title: "Confirmed by nursery",
    description: "Our team confirms the plants, final delivery fee, and delivery date by phone or WhatsApp.",
  },
  {
    key: "preparing",
    title: "Plants being prepared",
    description: "Plants are selected, watered, cleaned, wrapped, and loaded carefully for transport.",
  },
  {
    key: "scheduled",
    title: "Delivery scheduled",
    description: "A delivery date and time slot are reserved for your order.",
  },
  {
    key: "out_for_delivery",
    title: "Out for delivery",
    description: "The delivery boy is on the way in the nursery owner's own vehicle and will call before arrival.",
  },
  {
    key: "delivered",
    title: "Delivered",
    description: "Your plants were handed over successfully.",
  },
  {
    key: "cancelled",
    title: "Cancelled",
    description: "This order was cancelled.",
  },
];

const DELIVERY_TIME_SLOTS = [
  { id: "morning", label: "Morning (9:00 AM - 12:00 PM)" },
  { id: "afternoon", label: "Afternoon (1:00 PM - 4:00 PM)" },
  { id: "evening", label: "Evening (4:30 PM - 6:30 PM)" },
];

const DELIVERY_ZONES = [
  {
    id: "zone_a",
    name: "Zone A - Batalawatta / Battaramulla / Pelawatta / Thalawathugoda / Malabe",
    fee: 400,
    leadTimeLabel: "Same day or next day",
    defaultLeadDays: 0,
    sameDayEligible: true,
    defaultTimeSlot: "afternoon",
    areas: ["Batalawatta", "Battaramulla", "Pelawatta", "Thalawathugoda", "Malabe"],
  },
  {
    id: "zone_b",
    name: "Zone B - Rajagiriya / Kotte / Nawala / Koswatta / Athurugiriya",
    fee: 650,
    leadTimeLabel: "Within 1 working day",
    defaultLeadDays: 1,
    sameDayEligible: false,
    defaultTimeSlot: "afternoon",
    areas: ["Rajagiriya", "Kotte", "Nawala", "Koswatta", "Athurugiriya"],
  },
  {
    id: "zone_c",
    name: "Zone C - Nugegoda / Maharagama / Pannipitiya / Kaduwela / Homagama",
    fee: 900,
    leadTimeLabel: "Within 1 - 2 working days",
    defaultLeadDays: 1,
    sameDayEligible: false,
    defaultTimeSlot: "morning",
    areas: ["Nugegoda", "Maharagama", "Pannipitiya", "Kaduwela", "Homagama"],
  },
  {
    id: "zone_d",
    name: "Zone D - Colombo City / Dehiwala / Mt. Lavinia / Kelaniya / Wattala",
    fee: 1250,
    leadTimeLabel: "Within 1 - 2 working days",
    defaultLeadDays: 2,
    sameDayEligible: false,
    defaultTimeSlot: "morning",
    areas: ["Colombo 1 - 15", "Dehiwala", "Mount Lavinia", "Kelaniya", "Wattala"],
  },
];

export const DELIVERY_CONFIG = {
  serviceTitle: "Batalawatta Team Delivery",
  serviceType: "Own vehicle delivery",
  vehicleNote: "Plants are delivered using the nursery owner's own vehicle and a delivery boy for safer handling.",
  baseLocation: "Batalawatta, Battaramulla",
  minimumRecommendedOrder: 3000,
  sameDayCutoffHour: 12,
  sameDayCutoffLabel: "12:00 PM",
  contactBeforeArrival: true,
  issueReportWindowHours: 24,
  timeSlots: DELIVERY_TIME_SLOTS,
  stages: DELIVERY_STATUS_STEPS,
  zones: DELIVERY_ZONES,
  policies: [
    "Delivery fee is calculated by delivery zone and shown at checkout.",
    "Preferred delivery date/time is subject to route confirmation by the nursery.",
    "The delivery boy will call before arrival when the order is out for delivery.",
    "For delicate or tall plants, we transport them upright and hand-carry them where possible.",
    "Any delivery issue or damage should be reported within 24 hours with a clear photo.",
  ],
};

const STATUS_INDEX = DELIVERY_STATUS_STEPS.reduce((acc, item, idx) => {
  acc[item.key] = idx;
  return acc;
}, {});

function pad(value) {
  return String(value).padStart(2, "0");
}

function isIsoDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
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

export function formatDateISO(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateLong(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-LK", { year: "numeric", month: "short", day: "numeric" });
}

export function getZoneById(zoneId) {
  return DELIVERY_ZONES.find((zone) => zone.id === zoneId) || DELIVERY_ZONES[0];
}

export function getTimeSlotById(slotId) {
  return DELIVERY_TIME_SLOTS.find((slot) => slot.id === slotId) || DELIVERY_TIME_SLOTS[1];
}

export function getStatusMeta(status) {
  return DELIVERY_STATUS_STEPS.find((step) => step.key === status) || DELIVERY_STATUS_STEPS[0];
}

export function getStatusIndex(status) {
  return STATUS_INDEX[status] ?? 0;
}

export function getPublicDeliveryConfig() {
  return {
    serviceTitle: DELIVERY_CONFIG.serviceTitle,
    serviceType: DELIVERY_CONFIG.serviceType,
    vehicleNote: DELIVERY_CONFIG.vehicleNote,
    baseLocation: DELIVERY_CONFIG.baseLocation,
    minimumRecommendedOrder: DELIVERY_CONFIG.minimumRecommendedOrder,
    sameDayCutoffHour: DELIVERY_CONFIG.sameDayCutoffHour,
    sameDayCutoffLabel: DELIVERY_CONFIG.sameDayCutoffLabel,
    contactBeforeArrival: DELIVERY_CONFIG.contactBeforeArrival,
    issueReportWindowHours: DELIVERY_CONFIG.issueReportWindowHours,
    policies: [...DELIVERY_CONFIG.policies],
    timeSlots: DELIVERY_TIME_SLOTS.map((slot) => ({ ...slot })),
    stages: DELIVERY_STATUS_STEPS.map((step) => ({ ...step })),
    zones: DELIVERY_ZONES.map((zone) => ({ ...zone })),
  };
}

export function estimateDelivery({ zoneId, preferredDate = "", preferredTimeSlot = "" } = {}) {
  const zone = getZoneById(zoneId);
  const timeSlot = getTimeSlotById(preferredTimeSlot || zone.defaultTimeSlot);
  const now = new Date();

  let estimatedDate = "";
  if (isIsoDateString(preferredDate)) {
    const chosen = new Date(`${preferredDate}T00:00:00`);
    const today = startOfToday();
    estimatedDate = formatDateISO(chosen < today ? today : chosen);
  } else if (zone.sameDayEligible && now.getHours() < DELIVERY_CONFIG.sameDayCutoffHour) {
    estimatedDate = formatDateISO(now);
  } else {
    estimatedDate = formatDateISO(addDays(now, zone.defaultLeadDays || 1));
  }

  return {
    estimatedDate,
    estimatedDateLabel: formatDateLong(estimatedDate),
    estimatedTimeSlot: timeSlot.id,
    estimatedTimeSlotLabel: timeSlot.label,
    estimatedWindowLabel: `${formatDateLong(estimatedDate)} • ${timeSlot.label}`,
    leadTimeLabel: zone.leadTimeLabel,
  };
}

export function createTimelineEntry(status, note = "", updatedBy = "system") {
  const meta = getStatusMeta(status);
  return {
    status,
    title: meta.title,
    note: String(note || "").trim(),
    updatedBy,
    at: new Date(),
  };
}

export function normalizeTimeline(status, timeline = [], createdAt = new Date()) {
  if (Array.isArray(timeline) && timeline.length) {
    return timeline
      .map((entry) => ({
        status: entry.status || status,
        title: entry.title || getStatusMeta(entry.status || status).title,
        note: entry.note || "",
        updatedBy: entry.updatedBy || "system",
        at: entry.at || createdAt,
      }))
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  }

  const meta = getStatusMeta(status);
  return [
    {
      status,
      title: meta.title,
      note: "",
      updatedBy: "system",
      at: createdAt,
    },
  ];
}
