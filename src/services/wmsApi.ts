import type {
  AsnOrder,
  BarcodeRule,
  BomItem,
  Customer,
  LabelTemplate,
  MaterialSku,
  PackagingSpec,
  Supplier,
  WarehouseBin,
  WarehouseKeeper,
  WmsState,
  ZebraPrinterConfig,
} from '../types/wms';

export interface ZebraBrowserPrintDevice {
  name: string;
  deviceType?: string;
  connection?: string;
  uid?: string;
  provider?: string;
  manufacturer?: string;
  version?: number;
}

export interface AuthUserProfile {
  uid: string;
  username: string | null;
  email: string;
  displayName: string | null;
  authProvider: 'google' | 'password';
}

const API_BASE_URL = (
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_BASE_URL ?? ''
)
  .trim()
  .replace(/\/+$/, '');

export function resolveApiUrl(path: string, baseUrl = API_BASE_URL): string {
  if (!baseUrl || /^https?:\/\//i.test(path)) return path;
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  return `${cleanBase}${path.startsWith('/') ? path : `/${path}`}`;
}

let authTokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(provider: () => Promise<string | null>) {
  authTokenProvider = provider;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = authTokenProvider ? await authTokenProvider() : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(resolveApiUrl(url), {
    credentials: 'include',
    ...options,
    headers,
  });
  const json = await res.json().catch(() => ({ ok: false, error: `请求失败 (${res.status})` }));
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
  authRegister: (body: { username: string; password: string; displayName?: string }) =>
    request<{ ok: true; user: AuthUserProfile; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  authLogin: (body: { username: string; password: string }) =>
    request<{ ok: true; user: AuthUserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  authLogout: () =>
    request<{ ok: true }>('/api/auth/logout', {
      method: 'POST',
    }),

  authMe: () => request<{ ok: true; user: AuthUserProfile | null }>('/api/auth/me'),

  authChangePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ ok: true }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getState: () => request<ApiResponse>('/api/wms/state'),

  resetDemo: () =>
    request<ApiResponse>('/api/wms/reset', {
      method: 'POST',
    }),

  inbound: (body: {
    materialKey?: string;
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

  updateMaterial: (originalKey: string, material: MaterialSku) =>
    request<ApiResponse>('/api/wms/materials', {
      method: 'PUT',
      body: JSON.stringify({ originalKey, material }),
    }),

  deleteMaterial: (materialKey: string) =>
    request<ApiResponse>('/api/wms/materials', {
      method: 'DELETE',
      body: JSON.stringify({ materialKey }),
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

  updateWarehouse: (
    code: string,
    body: {
      warehouseName: string;
      warehouseType: string;
      managerId: string;
      address: string;
      status?: 'ACTIVE' | 'MAINTENANCE';
    }
  ) =>
    request<ApiResponse>(`/api/wms/warehouses/${encodeURIComponent(code)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteWarehouse: (code: string) =>
    request<ApiResponse>(`/api/wms/warehouses/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    }),

  addBin: (body: WarehouseBin) =>
    request<ApiResponse>('/api/wms/bins', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateBin: (
    binCode: string,
    body: Omit<WarehouseBin, 'binCode'>
  ) =>
    request<ApiResponse>(`/api/wms/bins/${encodeURIComponent(binCode)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteBin: (binCode: string) =>
    request<ApiResponse>(`/api/wms/bins/${encodeURIComponent(binCode)}`, {
      method: 'DELETE',
    }),

  addKeeper: (
    body: Omit<WarehouseKeeper, 'keeperId' | 'status'> & { keeperId?: string }
  ) =>
    request<ApiResponse>('/api/wms/keepers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateKeeper: (
    keeperId: string,
    body: Omit<WarehouseKeeper, 'keeperId' | 'status'> & { status?: 'ACTIVE' | 'OFF_DUTY' }
  ) =>
    request<ApiResponse>(`/api/wms/keepers/${encodeURIComponent(keeperId)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteKeeper: (keeperId: string) =>
    request<ApiResponse>(`/api/wms/keepers/${encodeURIComponent(keeperId)}`, {
      method: 'DELETE',
    }),

  addSupplier: (body: Supplier) =>
    request<ApiResponse>('/api/wms/suppliers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateSupplier: (code: string, body: Omit<Supplier, 'supplierCode'>) =>
    request<ApiResponse>(`/api/wms/suppliers/${encodeURIComponent(code)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteSupplier: (code: string) =>
    request<ApiResponse>(`/api/wms/suppliers/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    }),

  addCustomer: (body: Customer) =>
    request<ApiResponse>('/api/wms/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateCustomer: (code: string, body: Omit<Customer, 'customerCode'>) =>
    request<ApiResponse>(`/api/wms/customers/${encodeURIComponent(code)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  deleteCustomer: (code: string) =>
    request<ApiResponse>(`/api/wms/customers/${encodeURIComponent(code)}`, {
      method: 'DELETE',
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

  deleteBom: (bomId: string) =>
    request<ApiResponse>(`/api/wms/boms/${encodeURIComponent(bomId)}`, {
      method: 'DELETE',
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

  addPackagingSpec: (body: PackagingSpec) =>
    request<ApiResponse<{ spec: PackagingSpec }>>('/api/wms/packaging-specs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updatePackagingSpec: (code: string, body: PackagingSpec) =>
    request<ApiResponse<{ spec: PackagingSpec }>>(
      `/api/wms/packaging-specs/${encodeURIComponent(code)}`,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      }
    ),

  deletePackagingSpec: (code: string) =>
    request<ApiResponse>(`/api/wms/packaging-specs/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    }),

  saveBarcodeRule: (
    body: Omit<BarcodeRule, 'ruleId' | 'supplierName'> & {
      ruleId?: string;
      supplierName?: string;
    }
  ) =>
    request<ApiResponse<{ rule: BarcodeRule }>>('/api/wms/barcode-rules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteBarcodeRule: (ruleId: string) =>
    request<ApiResponse>(`/api/wms/barcode-rules/${encodeURIComponent(ruleId)}`, {
      method: 'DELETE',
    }),

  saveLabelTemplate: (
    body: Omit<LabelTemplate, 'templateId'> & { templateId?: string }
  ) =>
    request<ApiResponse<{ template: LabelTemplate }>>('/api/wms/label-templates', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  deleteLabelTemplate: (templateId: string) =>
    request<ApiResponse>(`/api/wms/label-templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
    }),

  savePrinterConfig: (body: Partial<ZebraPrinterConfig>) =>
    request<ApiResponse<{ printerConfig: ZebraPrinterConfig }>>('/api/wms/printer-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  testZplPrinter: (body: { host: string; port: number }) =>
    request<{ ok: true; payload: { host: string; port: number; latencyMs: number } }>(
      '/api/wms/print/zpl/test',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),

  sendZplPrint: (body: { host: string; port: number; zpl: string }) =>
    request<{ ok: true; payload: { host: string; port: number; bytesSent: number } }>(
      '/api/wms/print/zpl',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),
};

export async function probeZebraBrowserPrint(
  baseUrl: string
): Promise<ZebraBrowserPrintDevice[]> {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  if (!cleanBase) {
    throw new Error('请先填写本机 Zebra Browser Print 服务地址');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`${cleanBase}/available`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Browser Print 服务返回异常状态 (${res.status})`);
    }
    const data = (await res.json()) as { printer?: ZebraBrowserPrintDevice[] } | ZebraBrowserPrintDevice[];
    const list = Array.isArray(data) ? data : data.printer ?? [];
    return list;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `探测超时：未在本机 ${cleanBase} 检测到 Zebra Browser Print 服务，请确认已启动本地客户端。`
      );
    }
    throw new Error(
      `无法连接本机 Zebra Browser Print (${cleanBase})：请先在操作台电脑安装并启动 Zebra Browser Print 客户端（默认监听 9100/9101）。`
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function sendZebraBrowserPrint(
  baseUrl: string,
  device: ZebraBrowserPrintDevice,
  zpl: string
): Promise<void> {
  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const res = await fetch(`${cleanBase}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ device, data: zpl }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Browser Print 下发失败 (${res.status}) ${txt}`);
  }
}
