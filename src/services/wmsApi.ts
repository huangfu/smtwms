import type {
  AsnOrder,
  BomItem,
  Customer,
  MaterialSku,
  Supplier,
  WarehouseBin,
  WarehouseKeeper,
  WmsState,
} from '../types/wms';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `请求失败 (${res.status})`);
  }
  return json as T;
}

export interface ApiResponse<P = unknown> {
  ok: true;
  state: WmsState;
  payload: P;
}

export const wmsApi = {
  getState: () => request<ApiResponse>('/api/wms/state'),

  resetDemo: () =>
    request<ApiResponse>('/api/wms/reset', {
      method: 'POST',
    }),

  inbound: (body: {
    skuCode: string;
    lotNumber: string;
    dateCode: string;
    supplier: string;
    qty: number;
    binCode: string;
    receiptDocNo?: string;
    asnNo?: string;
    asnLineId?: string;
    reelId?: string;
    operator: string;
    reason?: string;
  }) =>
    request<ApiResponse<{ reel: unknown }>>('/api/wms/inbound', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  generalOutbound: (body: {
    reelId: string;
    qty: number;
    targetDept: string;
    reason: string;
    operator: string;
  }) =>
    request<ApiResponse>('/api/wms/outbound', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createWave: (body: { name: string; workOrderIds: string[]; operator: string }) =>
    request<ApiResponse<{ wave: unknown; shortages: { skuCode: string; mpn: string; shortageQty: number }[] }>>(
      '/api/wms/waves',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),

  issueWaveReel: (waveId: string, body: { reelId: string; operator: string }) =>
    request<ApiResponse>(`/api/wms/waves/${encodeURIComponent(waveId)}/issue`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  replenish: (body: {
    workOrderId: string;
    reelId: string;
    qty: number;
    reason: string;
    station: string;
    operator: string;
  }) =>
    request<ApiResponse>('/api/wms/replenish', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  productionReturn: (body: {
    workOrderId: string;
    reelId: string;
    returnQty: number;
    toBin: string;
    reason: string;
    operator: string;
    splitChildReel?: boolean;
  }) =>
    request<ApiResponse<{ reel: unknown }>>('/api/wms/return', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  bakeMsdReel: (body: { reelId: string; operator: string; ovenNotes?: string }) =>
    request<ApiResponse>('/api/wms/msd-bake', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  scrap: (body: {
    reelId: string;
    qty: number;
    reason: string;
    disposition: string;
    workOrderId?: string;
    operator: string;
  }) =>
    request<ApiResponse>('/api/wms/scrap', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createCycleCount: (body: { title: string; zoneFilter: string }) =>
    request<ApiResponse>('/api/wms/cycle-counts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  reconcileCycleCount: (
    countId: string,
    body: { counts: Record<string, number>; operator: string }
  ) =>
    request<ApiResponse>(`/api/wms/cycle-counts/${encodeURIComponent(countId)}/reconcile`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  addMaterial: (body: MaterialSku) =>
    request<ApiResponse>('/api/wms/materials', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  addWorkOrder: (body: {
    workOrderId?: string;
    productCode: string;
    productName: string;
    bomId?: string;
    customerCode?: string;
    customerName?: string;
    lineName: string;
    targetQty: number;
    bom: BomItem[];
  }) =>
    request<ApiResponse>('/api/wms/work-orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  addWarehouse: (body: {
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
    managerId: string;
    address: string;
  }) =>
    request<ApiResponse>('/api/wms/warehouses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  addBin: (body: WarehouseBin) =>
    request<ApiResponse>('/api/wms/bins', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  addKeeper: (
    body: Omit<WarehouseKeeper, 'keeperId' | 'status'> & { keeperId?: string }
  ) =>
    request<ApiResponse>('/api/wms/keepers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  addSupplier: (body: Supplier) =>
    request<ApiResponse>('/api/wms/suppliers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  addCustomer: (body: Customer) =>
    request<ApiResponse>('/api/wms/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  saveBom: (body: {
    bomId?: string;
    productCode: string;
    productName: string;
    version: string;
    customerCode?: string;
    processType: string;
    status?: 'ACTIVE' | 'DRAFT';
    items: BomItem[];
  }) =>
    request<ApiResponse>('/api/wms/boms', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createAsn: (body: {
    asnNo?: string;
    poNo: string;
    supplierCode: string;
    warehouseCode: string;
    expectedDate: string;
    purchaser: string;
    notes?: string;
    lines: {
      skuCode: string;
      expectedQty: number;
      lotNumber?: string;
      dateCode?: string;
      targetBin?: string;
    }[];
  }) =>
    request<ApiResponse<{ asn: AsnOrder }>>('/api/wms/asns', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  importAsnCsv: (body: {
    csvText: string;
    warehouseCode?: string;
    purchaser?: string;
    notes?: string;
  }) =>
    request<ApiResponse<{ asn: AsnOrder }>>('/api/wms/asns/import-csv', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  cancelAsn: (asnNo: string) =>
    request<ApiResponse>(`/api/wms/asns/${encodeURIComponent(asnNo)}/cancel`, {
      method: 'POST',
    }),
};
