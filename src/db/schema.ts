import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import type {
  AsnLine,
  BarcodeRule,
  BomItem,
  CycleCountLine,
  LabelElementLayout,
  LabelTemplate,
  WaveAllocation,
  ZebraPrinterConfig,
} from '../types/wms.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userCredentials = pgTable('user_credentials', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid')
    .notNull()
    .unique()
    .references(() => users.uid, { onDelete: 'cascade' }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userSessions = pgTable(
  'user_sessions',
  {
    id: serial('id').primaryKey(),
    tokenHash: text('token_hash').notNull().unique(),
    userUid: text('user_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [index('user_sessions_user_uid_idx').on(t.userUid)]
);

export const wmsWorkspaces = pgTable('wms_workspaces', {
  ownerUid: text('owner_uid')
    .primaryKey()
    .references(() => users.uid, { onDelete: 'cascade' }),
  printerConfig: jsonb('printer_config').$type<ZebraPrinterConfig | null>(),
  seededAt: timestamp('seeded_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const warehouses = pgTable(
  'warehouses',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    warehouseCode: text('warehouse_code').notNull(),
    warehouseName: text('warehouse_name').notNull(),
    warehouseType: text('warehouse_type').notNull(),
    managerId: text('manager_id').notNull(),
    managerName: text('manager_name').notNull(),
    address: text('address').notNull(),
    status: text('status').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('warehouses_owner_uid_idx').on(t.ownerUid)]
);

export const warehouseKeepers = pgTable(
  'warehouse_keepers',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    keeperId: text('keeper_id').notNull(),
    employeeNo: text('employee_no').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    warehouseCode: text('warehouse_code').notNull(),
    phone: text('phone').notNull(),
    shift: text('shift').notNull(),
    status: text('status').notNull(),
  },
  (t) => [index('warehouse_keepers_owner_uid_idx').on(t.ownerUid)]
);

export const warehouseBins = pgTable(
  'warehouse_bins',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    binCode: text('bin_code').notNull(),
    warehouseCode: text('warehouse_code'),
    zone: text('zone').notNull(),
    capacityReels: integer('capacity_reels').notNull(),
    keeperName: text('keeper_name'),
    description: text('description').notNull(),
  },
  (t) => [index('warehouse_bins_owner_uid_idx').on(t.ownerUid)]
);

export const suppliers = pgTable(
  'suppliers',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    supplierCode: text('supplier_code').notNull(),
    supplierName: text('supplier_name').notNull(),
    contactName: text('contact_name').notNull(),
    phone: text('phone').notNull(),
    categoryTags: text('category_tags').notNull(),
    qualityGrade: text('quality_grade').notNull(),
    leadTimeDays: integer('lead_time_days').notNull(),
    notes: text('notes'),
  },
  (t) => [index('suppliers_owner_uid_idx').on(t.ownerUid)]
);

export const customers = pgTable(
  'customers',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    customerCode: text('customer_code').notNull(),
    customerName: text('customer_name').notNull(),
    contactName: text('contact_name').notNull(),
    phone: text('phone').notNull(),
    industry: text('industry').notNull(),
    traceRequirement: text('trace_requirement').notNull(),
    deliveryAddress: text('delivery_address').notNull(),
  },
  (t) => [index('customers_owner_uid_idx').on(t.ownerUid)]
);

export const packagingSpecs = pgTable(
  'packaging_specs',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    packagingCode: text('packaging_code').notNull(),
    packagingName: text('packaging_name').notNull(),
    carrierType: text('carrier_type').notNull(),
    reelDiameter: text('reel_diameter').notNull(),
    tapeWidthMm: doublePrecision('tape_width_mm').notNull(),
    pitchMm: doublePrecision('pitch_mm').notNull(),
    defaultSpq: integer('default_spq').notNull(),
    allowSplit: boolean('allow_split').notNull(),
    allowMerge: boolean('allow_merge').notNull(),
    description: text('description').notNull(),
  },
  (t) => [index('packaging_specs_owner_uid_idx').on(t.ownerUid)]
);

export const barcodeRules = pgTable(
  'barcode_rules',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    ruleId: text('rule_id').notNull(),
    ruleName: text('rule_name').notNull(),
    supplierCode: text('supplier_code').notNull(),
    supplierName: text('supplier_name').notNull(),
    formatType: text('format_type').notNull(),
    delimiter: text('delimiter').notNull(),
    fieldMap: jsonb('field_map').$type<BarcodeRule['fieldMap']>().notNull(),
    sampleBarcode: text('sample_barcode').notNull(),
    enabled: boolean('enabled').notNull(),
  },
  (t) => [index('barcode_rules_owner_uid_idx').on(t.ownerUid)]
);

export const labelTemplates = pgTable(
  'label_templates',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    templateId: text('template_id').notNull(),
    templateName: text('template_name').notNull(),
    paperSize: text('paper_size').notNull(),
    customWidthMm: doublePrecision('custom_width_mm'),
    customHeightMm: doublePrecision('custom_height_mm'),
    dpi: integer('dpi'),
    offsetXMm: doublePrecision('offset_x_mm'),
    offsetYMm: doublePrecision('offset_y_mm'),
    barcodeType: text('barcode_type'),
    zplMode: text('zpl_mode'),
    elementOrder: jsonb('element_order').$type<string[] | null>(),
    elementLayouts: jsonb('element_layouts').$type<LabelElementLayout[] | null>(),
    fontScale: text('font_scale'),
    barcodeHeightMm: doublePrecision('barcode_height_mm'),
    customZpl: text('custom_zpl'),
    headerTitle: text('header_title').notNull(),
    footerNote: text('footer_note').notNull(),
    showFields: jsonb('show_fields').$type<LabelTemplate['showFields']>().notNull(),
    isDefault: boolean('is_default').notNull(),
  },
  (t) => [index('label_templates_owner_uid_idx').on(t.ownerUid)]
);

export const materials = pgTable(
  'materials',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    materialKey: text('material_key').notNull(),
    skuCode: text('sku_code').notNull(),
    mpn: text('mpn').notNull(),
    name: text('name').notNull(),
    ownershipType: text('ownership_type'),
    ownerCode: text('owner_code'),
    ownerName: text('owner_name'),
    customerCode: text('customer_code'),
    customerName: text('customer_name'),
    manufacturer: text('manufacturer').notNull(),
    category: text('category').notNull(),
    packageType: text('package_type').notNull(),
    packagingCode: text('packaging_code'),
    packagingName: text('packaging_name'),
    mpq: integer('mpq'),
    supplierCode: text('supplier_code'),
    supplierName: text('supplier_name'),
    unit: text('unit').notNull(),
    msdLevel: text('msd_level').notNull(),
    safetyStock: integer('safety_stock').notNull(),
    defaultBin: text('default_bin').notNull(),
  },
  (t) => [index('materials_owner_uid_idx').on(t.ownerUid)]
);

export const bomMasters = pgTable(
  'bom_masters',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    bomId: text('bom_id').notNull(),
    productCode: text('product_code').notNull(),
    productName: text('product_name').notNull(),
    version: text('version').notNull(),
    customerCode: text('customer_code'),
    customerName: text('customer_name'),
    processType: text('process_type').notNull(),
    status: text('status').notNull(),
    items: jsonb('items').$type<BomItem[]>().notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('bom_masters_owner_uid_idx').on(t.ownerUid)]
);

export const asnOrders = pgTable(
  'asn_orders',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    asnNo: text('asn_no').notNull(),
    poNo: text('po_no').notNull(),
    supplierCode: text('supplier_code').notNull(),
    supplierName: text('supplier_name').notNull(),
    warehouseCode: text('warehouse_code').notNull(),
    expectedDate: text('expected_date').notNull(),
    purchaser: text('purchaser').notNull(),
    source: text('source').notNull(),
    status: text('status').notNull(),
    notes: text('notes'),
    lines: jsonb('lines').$type<AsnLine[]>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('asn_orders_owner_uid_idx').on(t.ownerUid)]
);

export const reels = pgTable(
  'reels',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    reelId: text('reel_id').notNull(),
    parentReelId: text('parent_reel_id'),
    materialKey: text('material_key'),
    skuCode: text('sku_code').notNull(),
    mpn: text('mpn').notNull(),
    lotNumber: text('lot_number').notNull(),
    dateCode: text('date_code').notNull(),
    supplier: text('supplier').notNull(),
    ownershipType: text('ownership_type'),
    ownerCode: text('owner_code'),
    ownerName: text('owner_name'),
    customerCode: text('customer_code'),
    customerName: text('customer_name'),
    packagingCode: text('packaging_code'),
    mpq: integer('mpq'),
    receiptDocNo: text('receipt_doc_no').notNull(),
    asnNo: text('asn_no'),
    initialQty: integer('initial_qty').notNull(),
    qty: integer('qty').notNull(),
    issuedQty: integer('issued_qty').notNull(),
    binCode: text('bin_code').notNull(),
    msdLevel: text('msd_level').notNull(),
    msdState: text('msd_state').notNull(),
    msdOpenAt: text('msd_open_at'),
    status: text('status').notNull(),
    workOrderId: text('work_order_id'),
    receivedAt: text('received_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('reels_owner_uid_idx').on(t.ownerUid)]
);

export const workOrders = pgTable(
  'work_orders',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    workOrderId: text('work_order_id').notNull(),
    productCode: text('product_code').notNull(),
    productName: text('product_name').notNull(),
    bomId: text('bom_id'),
    customerCode: text('customer_code'),
    customerName: text('customer_name'),
    lineName: text('line_name').notNull(),
    targetQty: integer('target_qty').notNull(),
    status: text('status').notNull(),
    waveId: text('wave_id'),
    bom: jsonb('bom').$type<BomItem[]>().notNull(),
    issuedBySku: jsonb('issued_by_sku').$type<Record<string, number>>().notNull(),
    replenishedBySku: jsonb('replenished_by_sku').$type<Record<string, number>>().notNull(),
    returnedBySku: jsonb('returned_by_sku').$type<Record<string, number>>().notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('work_orders_owner_uid_idx').on(t.ownerUid)]
);

export const waveOrders = pgTable(
  'wave_orders',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    waveId: text('wave_id').notNull(),
    name: text('name').notNull(),
    workOrderIds: jsonb('work_order_ids').$type<string[]>().notNull(),
    status: text('status').notNull(),
    allocations: jsonb('allocations').$type<WaveAllocation[]>().notNull(),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (t) => [index('wave_orders_owner_uid_idx').on(t.ownerUid)]
);

export const cycleCounts = pgTable(
  'cycle_counts',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    countId: text('count_id').notNull(),
    title: text('title').notNull(),
    zoneFilter: text('zone_filter').notNull(),
    status: text('status').notNull(),
    lines: jsonb('lines').$type<CycleCountLine[]>().notNull(),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (t) => [index('cycle_counts_owner_uid_idx').on(t.ownerUid)]
);

export const scrapRecords = pgTable(
  'scrap_records',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    scrapId: text('scrap_id').notNull(),
    timestamp: text('timestamp').notNull(),
    reelId: text('reel_id').notNull(),
    skuCode: text('sku_code').notNull(),
    mpn: text('mpn').notNull(),
    lotNumber: text('lot_number').notNull(),
    qty: integer('qty').notNull(),
    reason: text('reason').notNull(),
    disposition: text('disposition').notNull(),
    workOrderId: text('work_order_id'),
    operator: text('operator').notNull(),
  },
  (t) => [index('scrap_records_owner_uid_idx').on(t.ownerUid)]
);

export const traceEvents = pgTable(
  'trace_events',
  {
    id: serial('id').primaryKey(),
    ownerUid: text('owner_uid')
      .notNull()
      .references(() => users.uid, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull(),
    timestamp: text('timestamp').notNull(),
    action: text('action').notNull(),
    reelId: text('reel_id').notNull(),
    skuCode: text('sku_code').notNull(),
    mpn: text('mpn').notNull(),
    lotNumber: text('lot_number').notNull(),
    dateCode: text('date_code').notNull(),
    qtyDelta: integer('qty_delta').notNull(),
    balanceAfter: integer('balance_after').notNull(),
    fromBin: text('from_bin'),
    toBin: text('to_bin'),
    workOrderId: text('work_order_id'),
    waveId: text('wave_id'),
    lineOrStation: text('line_or_station'),
    docNo: text('doc_no').notNull(),
    reason: text('reason'),
    operator: text('operator').notNull(),
  },
  (t) => [index('trace_events_owner_uid_idx').on(t.ownerUid)]
);

export const usersRelations = relations(users, ({ one, many }) => ({
  workspace: one(wmsWorkspaces, {
    fields: [users.uid],
    references: [wmsWorkspaces.ownerUid],
  }),
  warehouses: many(warehouses),
  warehouseKeepers: many(warehouseKeepers),
  warehouseBins: many(warehouseBins),
  suppliers: many(suppliers),
  customers: many(customers),
  packagingSpecs: many(packagingSpecs),
  barcodeRules: many(barcodeRules),
  labelTemplates: many(labelTemplates),
  materials: many(materials),
  bomMasters: many(bomMasters),
  asnOrders: many(asnOrders),
  reels: many(reels),
  workOrders: many(workOrders),
  waveOrders: many(waveOrders),
  cycleCounts: many(cycleCounts),
  scrapRecords: many(scrapRecords),
  traceEvents: many(traceEvents),
}));

export const wmsWorkspacesRelations = relations(wmsWorkspaces, ({ one }) => ({
  owner: one(users, {
    fields: [wmsWorkspaces.ownerUid],
    references: [users.uid],
  }),
}));
