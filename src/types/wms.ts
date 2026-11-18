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

export interface MaterialSku {
  skuCode: string;
  mpn: string;
  name: string;
  manufacturer: string;
  category: MaterialCategory;
  packageType: string;
  unit: 'PCS' | '张' | '瓶' | '卷';
  msdLevel: MsdLevel;
  safetyStock: number;
  defaultBin: string;
}

export interface BomItem {
  skuCode: string;
  qtyPerBoard: number;
  attritionRate: number;
  designators: string;
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

export interface AsnLine {
  lineId: string;
  skuCode: string;
  mpn: string;
  expectedQty: number;
  receivedQty: number;
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
  skuCode: string;
  mpn: string;
  lotNumber: string;
  dateCode: string;
  supplier: string;
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
  warehouses: Warehouse[];
  keepers: WarehouseKeeper[];
  suppliers: Supplier[];
  customers: Customer[];
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
