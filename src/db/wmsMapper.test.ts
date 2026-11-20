import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeedData } from '../data/seedData.ts';
import { normalizeWmsState, saveLabelTemplate } from '../utils/wmsLogic.ts';
import {
  ALL_WMS_SLICE_KEYS,
  detectChangedSlices,
  mapRowsToPartialWmsState,
} from './wmsMapper.ts';

test('detectChangedSlices returns all slices when previous state is null', () => {
  const seed = createSeedData();
  assert.deepEqual(detectChangedSlices(null, seed), ALL_WMS_SLICE_KEYS);
});

test('detectChangedSlices detects only mutated slices after label template save', () => {
  const seed = createSeedData();
  const { state: next } = saveLabelTemplate(seed, {
    templateName: 'Cloud SQL 85x45 模板',
    paperSize: 'CUSTOM',
    customWidthMm: 85,
    customHeightMm: 45,
    dpi: 300,
    offsetXMm: 2.5,
    offsetYMm: -1.5,
    barcodeType: 'CODE128',
    zplMode: 'VISUAL',
    headerTitle: 'SMT-WMS',
    footerNote: 'TEST',
    showFields: {
      mpn: true,
      skuCode: true,
      ownership: true,
      packagingMpq: true,
      supplier: true,
      lotDateCode: true,
      binMsd: true,
      compositeBarcode: true,
    },
    isDefault: false,
  });

  const changed = detectChangedSlices(seed, next);
  assert.deepEqual(changed, ['labelTemplates']);
});

test('mapRowsToPartialWmsState preserves custom ZPL fields and relational records losslessly', () => {
  const seed = createSeedData();
  const { state: mutated } = saveLabelTemplate(seed, {
    templateName: '600dpi 定制标',
    paperSize: 'CUSTOM',
    customWidthMm: 85,
    customHeightMm: 45,
    dpi: 600,
    offsetXMm: -2,
    offsetYMm: 1.5,
    barcodeType: 'CODE39',
    zplMode: 'VISUAL',
    headerTitle: 'CUSTOM',
    footerNote: 'FOOT',
    showFields: {
      mpn: true,
      skuCode: true,
      ownership: true,
      packagingMpq: true,
      supplier: true,
      lotDateCode: true,
      binMsd: true,
      compositeBarcode: true,
    },
    isDefault: false,
  });

  const mapped = mapRowsToPartialWmsState({
    printerConfig: mutated.printerConfig ?? null,
    warehouses: mutated.warehouses as unknown as Array<Record<string, unknown>>,
    keepers: mutated.keepers as unknown as Array<Record<string, unknown>>,
    bins: mutated.bins as unknown as Array<Record<string, unknown>>,
    suppliers: mutated.suppliers as unknown as Array<Record<string, unknown>>,
    customers: mutated.customers as unknown as Array<Record<string, unknown>>,
    packagingSpecs: mutated.packagingSpecs as unknown as Array<Record<string, unknown>>,
    barcodeRules: mutated.barcodeRules as unknown as Array<Record<string, unknown>>,
    labelTemplates: mutated.labelTemplates as unknown as Array<Record<string, unknown>>,
    materials: mutated.materials as unknown as Array<Record<string, unknown>>,
    boms: mutated.boms as unknown as Array<Record<string, unknown>>,
    asns: mutated.asns as unknown as Array<Record<string, unknown>>,
    reels: mutated.reels as unknown as Array<Record<string, unknown>>,
    workOrders: mutated.workOrders as unknown as Array<Record<string, unknown>>,
    waves: mutated.waves as unknown as Array<Record<string, unknown>>,
    cycleCounts: mutated.cycleCounts as unknown as Array<Record<string, unknown>>,
    scrapRecords: mutated.scrapRecords as unknown as Array<Record<string, unknown>>,
    traceEvents: mutated.traceEvents as unknown as Array<Record<string, unknown>>,
  });

  const hydrated = normalizeWmsState(mapped, seed);
  const customTpl = hydrated.labelTemplates.find((t) => t.templateName === '600dpi 定制标');
  assert.ok(customTpl);
  assert.equal(customTpl.paperSize, 'CUSTOM');
  assert.equal(customTpl.customWidthMm, 85);
  assert.equal(customTpl.customHeightMm, 45);
  assert.equal(customTpl.dpi, 600);
  assert.equal(customTpl.offsetXMm, -2);
  assert.equal(customTpl.offsetYMm, 1.5);
  assert.equal(hydrated.reels.length, mutated.reels.length);
  assert.equal(hydrated.materials.length, mutated.materials.length);
  assert.equal(hydrated.boms.length, mutated.boms.length);
});
