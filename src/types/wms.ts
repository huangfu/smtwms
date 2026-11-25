export type MaterialCategory =
  | 'IC芯片'
  | '阻容感'
  | '连接器'
  | 'PCB光板'
  | '辅料锡膏'
  | '结构件';

export type MsdLevel =
  | 'Level 1'
  | 'Level 2'
  | 'Level 2a'
  | 'Level 3'
  | 'Level 4'
  | 'Level 5a';

export type MsdState = 'SEALED' | 'EXPOSED' | 'BAKING_REQUIRED';

export type WarehouseZone =
  | '电子料主库区'
  | '防潮恒温柜(MSD)'
  | 'PCB板库区'
  | '锡膏冷藏库'
  | '产线暂存区'
  | '待检/隔离区';

export interface Warehouse {
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  managerId: string;
  managerName: string;
  address: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface WarehouseKeeper {
  keeperId: string;
  employeeNo: string;
  name: string;
  role: '仓库主管' | '收料仓管员' | '波次发料员' | 'IQC/MSD专员' | '产线物料员';
  warehouseCode: string;
  phone: string;
  shift: '白班' | '夜班' | '常白班';
  status: 'ACTIVE' | 'INACTIVE';
}

export interface WarehouseBin {
  binCode: string;
  warehouseCode?: string;
  zone: WarehouseZone;
  capacityReels: number;
  keeperName?: string;
  description: string;
}

export interface Supplier {
  supplierCode: string;
  supplierName: string;
  contactName: string;
  phone: string;
  categoryTags: string;
  qualityGrade: 'A级免检' | 'B级抽检' | 'C级加严';
  leadTimeDays: number;
  notes?: string;
}

export interface Customer {
  customerCode: string;
  customerName: string;
  contactName: string;
  phone: string;
  industry: string;
  traceRequirement: string;
  deliveryAddress: string;
}

export type MaterialOwnershipType =
  | 'SELF_PURCHASED'
  | 'CUSTOMER_CONSIGNED'
  | 'VMI_CONSIGNED';

export type PackagingCarrierType =
  | 'REEL'
  | 'TRAY'
  | 'TUBE'
  | 'BAG_BOTTLE'
  | 'CUT_TAPE'
  | 'BULK';

export interface PackagingSpec {
  packagingCode: string;
  packagingName: string;
  carrierType: PackagingCarrierType;
  reelDiameter: string;
  tapeWidthMm: number;
  pitchMm: number;
  defaultSpq: number;
  allowSplit: boolean;
  allowMerge: boolean;
  description: string;
}

export interface BarcodeRule {
  ruleId: string;
  ruleName: string;
  supplierCode: string;
  supplierName: string;
  formatType: 'KEY_VALUE' | 'DELIMITED_ORDER';
  delimiter: '|' | ';' | ',';
  fieldMap: {
    reelIdKey?: string;
    mpnKey?: string;
    lotKey?: string;
    dateCodeKey?: string;
    qtyKey?: string;
  };
  sampleBarcode: string;
  enabled: boolean;
}

export type ZebraPrinterMode = 'LAN_TCP' | 'BROWSER_PRINT' | 'DRIVER_PRINT';

export interface ZebraPrinterConfig {
  mode: ZebraPrinterMode;
  host: string;
  port: number;
  browserPrintUrl: string;
  selectedDeviceName?: string;
  darkness: number;
  printSpeed: number;
}

export type LabelBarcodeType = 'CODE128' | 'CODE39' | 'QR' | 'DATAMATRIX';

export type LabelPaperPreset = '50x30mm' | '70x40mm' | '100x60mm' | 'CUSTOM';

export type LabelElementKey =
  | 'header'
  | 'mpnQty'
  | 'lotDcBin'
  | 'ownership'
  | 'packagingMpq'
  | 'supplier'
  | 'barcode'
  | 'composite'
  | 'footer';

export type LabelElementKind = 'BUILTIN' | 'TEXT' | 'BARCODE' | 'BOX';

export type LabelFontScale = 'COMPACT' | 'STANDARD' | 'LARGE';

export type LabelElementRotation = 'N' | 'R' | 'I' | 'B';

export type LabelFontFamily = '0' | 'D' | 'B';

export type LabelTextAlign = 'LEFT' | 'CENTER' | 'RIGHT';

export type BarcodeHriPosition = 'NONE' | 'BOTTOM' | 'TOP' | 'LEFT' | 'RIGHT' | 'CUSTOM';

export interface LabelElementLayout {
  key: string;
  kind?: LabelElementKind;
  label?: string;
  visible: boolean;
  xMm: number;
  yMm: number;
  fontSizeMm: number;
  widthMm?: number;
  rotation?: LabelElementRotation;
  /** 自定义文本内容模板（支持 {{MPN}} / {{REEL_ID}} 等变量） */
  contentTemplate?: string;
  fontFamily?: LabelFontFamily;
  bold?: boolean;
  invert?: boolean;
  textAlign?: LabelTextAlign;
  /** 条码元素专属属性（主条码与自定义新增条码共用） */
  barcodeType?: LabelBarcodeType;
  barcodeContent?: string;
  moduleWidthDots?: number;
  hriPosition?: BarcodeHriPosition;
  hriTextTemplate?: string;
  hriFontSizeMm?: number;
  hriFontFamily?: LabelFontFamily;
  hriBold?: boolean;
  hriInvert?: boolean;
  hriAlign?: LabelTextAlign;
  hriOffsetXMm?: number;
  hriOffsetYMm?: number;
  /** 线条/边框元素线宽 (mm) */
  borderThicknessMm?: number;
}

export interface LabelTemplate {
  templateId: string;
  templateName: string;
  paperSize: LabelPaperPreset;
  customWidthMm?: number;
  customHeightMm?: number;
  dpi?: number;
  /** 整体打印 X 轴偏移校准 (mm，支持正负微调) */
  offsetXMm?: number;
  /** 整体打印 Y 轴偏移校准 (mm，支持正负微调) */
  offsetYMm?: number;
  barcodeType?: LabelBarcodeType;
  zplMode?: 'VISUAL' | 'CUSTOM_ZPL';
  elementOrder?: string[];
  elementLayouts?: LabelElementLayout[];
  fontScale?: LabelFontScale;
  barcodeHeightMm?: number;
  customZpl?: string;
  headerTitle: string;
  footerNote: string;
  showFields: {
    mpn: boolean;
    skuCode: boolean;
    ownership: boolean;
    packagingMpq: boolean;
    supplier: boolean;
    lotDateCode: boolean;
    binMsd: boolean;
    compositeBarcode: boolean;
  };
  isDefault: boolean;
}

export interface MaterialSku {
  materialKey?: string;
  skuCode: string;
  mpn: string;
  name: string;
  ownershipType?: MaterialOwnershipType;
  ownerCode?: string;
  ownerName?: string;
  /** 业务对应客户（空/undefined 代表通用共享，所有客户工单均可发料；指定客户则仅限对应客户工单发料） */
  customerCode?: string;
  customerName?: string;
  manufacturer: string;
  category: MaterialCategory;
  packageType: string;
  packagingCode?: string;
  packagingName?: string;
  mpq?: number;
  supplierCode?: string;
  supplierName?: string;
  unit: 'PCS' | '张' | '瓶' | '卷';
  msdLevel: MsdLevel;
  safetyStock: number;
  defaultBin: string;
}

export type BomItemRole = 'MAIN' | 'SPECIAL_MAIN' | 'SUBSTITUTE';

export interface BomItem {
  lineId?: string;
  skuCode: string;
  qtyPerBoard: number;
  attritionRate: number;
  designators: string;
  itemRole?: BomItemRole;
  substituteForSku?: string;
  substitutePriority?: number;
  substituteRatio?: number;
  remark?: string;
}

export interface BomMaster {
  bomId: string;
  productCode: string;
  productName: string;
  version: string;
  customerCode?: string;
  customerName?: string;
  processType: string;
  status: 'ACTIVE' | 'DRAFT';
  items: BomItem[];
  updatedAt: string;
}

export type AsnStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';

export type AsnWorkflowStage =
  | 'SUPPLIER_DELIVERY'
  | 'ASN_REGISTERED'
  | 'RECEIVING'
  | 'IQC_INSPECTION'
  | 'PUTAWAY'
  | 'INVENTORY_UPDATED'
  | 'INFO_SYNCED';

export type ScanTabBucket = 'SCANNED' | 'IN_PROGRESS' | 'UNSCANNED';

export type AsnIqcStatus = 'PENDING' | 'PASSED' | 'FAILED';

export interface AsnLine {
  lineId: string;
  skuCode: string;
  mpn: string;
  expectedQty: number;
  receivedQty: number;
  iqcPassedQty?: number;
  iqcRejectedQty?: number;
  iqcStatus?: AsnIqcStatus;
  iqcNote?: string;
  putawayQty?: number;
  putawayReelIds?: string[];
  scanCount?: number;
  lastScannedAt?: string;
  lotNumber?: string;
  dateCode?: string;
  targetBin?: string;
}

export interface AsnOrder {
  asnNo: string;
  poNo: string;
  supplierCode: string;
  supplierName: string;
  warehouseCode: string;
  expectedDate: string;
  purchaser: string;
  source: 'MANUAL' | 'UPLOAD_CSV';
  status: AsnStatus;
  workflowStage?: AsnWorkflowStage;
  deliveryNoteNo?: string;
  carrierName?: string;
  arrivedAt?: string;
  receivingCompletedAt?: string;
  iqcCompletedAt?: string;
  putawayCompletedAt?: string;
  inventoryUpdatedAt?: string;
  syncedAt?: string;
  syncChannel?: string;
  syncRefNo?: string;
  notes?: string;
  createdAt: string;
  lines: AsnLine[];
}

export type ReelStatus =
  | 'IN_STOCK'
  | 'ALLOCATED'
  | 'ISSUED_TO_LINE'
  | 'DEPLETED'
  | 'SCRAPPED';

export interface ReelItem {
  reelId: string;
  parentReelId?: string;
  materialKey?: string;
  skuCode: string;
  mpn: string;
  lotNumber: string;
  dateCode: string;
  supplier: string;
  ownershipType?: MaterialOwnershipType;
  ownerCode?: string;
  ownerName?: string;
  customerCode?: string;
  customerName?: string;
  packagingCode?: string;
  mpq?: number;
  receiptDocNo: string;
  asnNo?: string;
  initialQty: number;
  qty: number;
  issuedQty: number;
  binCode: string;
  msdLevel: MsdLevel;
  msdState: MsdState;
  msdOpenAt?: string;
  status: ReelStatus;
  workOrderId?: string;
  receivedAt: string;
  updatedAt: string;
}

export type WorkOrderStatus =
  | 'PLANNED'
  | 'WAVED'
  | 'ISSUING'
  | 'IN_PRODUCTION'
  | 'COMPLETED';

export interface WorkOrder {
  workOrderId: string;
  productCode: string;
  productName: string;
  bomId?: string;
  customerCode?: string;
  customerName?: string;
  lineName: string;
  targetQty: number;
  status: WorkOrderStatus;
  waveId?: string;
  bom: BomItem[];
  issuedBySku: Record<string, number>;
  replenishedBySku: Record<string, number>;
  returnedBySku: Record<string, number>;
  createdAt: string;
}

export interface WaveAllocation {
  id: string;
  skuCode: string;
  mpn: string;
  customerCode?: string;
  customerName?: string;
  reelId: string;
  binCode: string;
  dateCode: string;
  lotNumber: string;
  requiredQty: number;
  pickedQty: number;
  status: 'PENDING' | 'PICKED';
}

export interface WaveOrder {
  waveId: string;
  name: string;
  workOrderIds: string[];
  status: 'OPEN' | 'PICKING' | 'COMPLETED';
  allocations: WaveAllocation[];
  createdAt: string;
  completedAt?: string;
}

export type TraceActionType =
  | 'INBOUND'
  | 'WAVE_ALLOCATE'
  | 'WAVE_ISSUE'
  | 'GENERAL_OUTBOUND'
  | 'REPLENISH'
  | 'RETURN'
  | 'MSD_BAKE'
  | 'SCRAP'
  | 'CYCLE_COUNT';

export interface TraceEvent {
  eventId: string;
  timestamp: string;
  action: TraceActionType;
  reelId: string;
  skuCode: string;
  mpn: string;
  lotNumber: string;
  dateCode: string;
  qtyDelta: number;
  balanceAfter: number;
  fromBin?: string;
  toBin?: string;
  workOrderId?: string;
  waveId?: string;
  lineOrStation?: string;
  docNo: string;
  reason?: string;
  operator: string;
}

export interface CycleCountLine {
  reelId: string;
  skuCode: string;
  mpn: string;
  binCode: string;
  bookQty: number;
  countedQty: number | null;
  variance: number;
  adjusted: boolean;
}

export interface CycleCountTask {
  countId: string;
  title: string;
  zoneFilter: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  lines: CycleCountLine[];
  createdAt: string;
  completedAt?: string;
}

export interface ScrapRecord {
  scrapId: string;
  timestamp: string;
  reelId: string;
  skuCode: string;
  mpn: string;
  lotNumber: string;
  qty: number;
  reason: string;
  disposition: string;
  workOrderId?: string;
  operator: string;
}

export interface WmsState {
  printerConfig?: ZebraPrinterConfig;
  warehouses: Warehouse[];
  keepers: WarehouseKeeper[];
  suppliers: Supplier[];
  customers: Customer[];
  packagingSpecs: PackagingSpec[];
  barcodeRules: BarcodeRule[];
  labelTemplates: LabelTemplate[];
  boms: BomMaster[];
  asns: AsnOrder[];
  materials: MaterialSku[];
  bins: WarehouseBin[];
  reels: ReelItem[];
  workOrders: WorkOrder[];
  waves: WaveOrder[];
  cycleCounts: CycleCountTask[];
  scrapRecords: ScrapRecord[];
  traceEvents: TraceEvent[];
}
