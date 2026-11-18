import { useCallback, useEffect, useState } from 'react';
import { BarcodeLabelModal } from './components/BarcodeLabelModal';
import { DashboardView } from './components/DashboardView';
import { InboundView } from './components/InboundView';
import { InventoryMasterView } from './components/InventoryMasterView';
import { ReplenishReturnView } from './components/ReplenishReturnView';
import { ScrapCountView } from './components/ScrapCountView';
import { Sidebar, type NavKey } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { TraceabilityView } from './components/TraceabilityView';
import { WavePickView } from './components/WavePickView';
import { wmsApi } from './services/wmsApi';
import type { AsnOrder, ReelItem, WmsState } from './types/wms';

export default function App() {
  const [state, setState] = useState<WmsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<NavKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [traceQuery, setTraceQuery] = useState('');
  const [inboundPrefillSku, setInboundPrefillSku] = useState<string | undefined>(undefined);
  const [labelReel, setLabelReel] = useState<ReelItem | null>(null);

  const fetchState = useCallback(async () => {
    try {
      setLoadError(null);
      const res = await wmsApi.getState();
      setState(res.state);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '无法加载仓储数据');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleInspectTrace = (query: string) => {
    setTraceQuery(query);
    setActiveNav('trace');
  };

  const handleGoInboundWithSku = (skuCode: string) => {
    setInboundPrefillSku(skuCode);
    setActiveNav('inbound');
  };

  const handleBakeMsd = async (reelId: string) => {
    const res = await wmsApi.bakeMsdReel({
      reelId,
      operator: 'IQC烘烤专员',
    });
    setState(res.state);
  };

  const handleResetDemo = async () => {
    const res = await wmsApi.resetDemo();
    setState(res.state);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm font-medium text-slate-600">正在加载 SMT-WMS 仓储数据...</div>
      </div>
    );
  }

  if (loadError || !state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-red-700">{loadError || '数据加载异常'}</div>
        <button
          type="button"
          onClick={fetchState}
          className="rounded-md bg-sky-700 px-4 py-2 text-xs font-medium text-white hover:bg-sky-800"
        >
          重试连接
        </button>
      </div>
    );
  }

  const msdAlertCount = state.reels.filter(
    (r) => r.msdState === 'BAKING_REQUIRED' && r.status !== 'SCRAPPED' && r.status !== 'DEPLETED'
  ).length;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        active={activeNav}
        onSelect={setActiveNav}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        msdAlertCount={msdAlertCount}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeNav={activeNav}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickScan={handleInspectTrace}
          onQuickInbound={() => setActiveNav('inbound')}
        />

        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-[1400px]">
            {activeNav === 'dashboard' && (
              <DashboardView
                state={state}
                onNavigate={setActiveNav}
                onGoInboundWithSku={handleGoInboundWithSku}
                onQuickInbound={async (payload) => {
                  const res = await wmsApi.inbound(payload);
                  setState(res.state);
                  return res.payload.reel as ReelItem;
                }}
                onQuickCreateAsn={async (payload) => {
                  const res = await wmsApi.createAsn(payload);
                  setState(res.state);
                  return res.payload.asn as AsnOrder;
                }}
                onOpenLabel={setLabelReel}
                onInspectTrace={handleInspectTrace}
                onBakeMsd={handleBakeMsd}
                onResetDemo={handleResetDemo}
              />
            )}

            {activeNav === 'inbound' && (
              <InboundView
                state={state}
                initialSkuCode={inboundPrefillSku}
                onInbound={async (payload) => {
                  const res = await wmsApi.inbound(payload);
                  setState(res.state);
                  return res.payload.reel as ReelItem;
                }}
                onCreateAsn={async (payload) => {
                  const res = await wmsApi.createAsn(payload);
                  setState(res.state);
                  return res.payload.asn as AsnOrder;
                }}
                onImportAsnCsv={async (payload) => {
                  const res = await wmsApi.importAsnCsv(payload);
                  setState(res.state);
                  return res.payload.asn as AsnOrder;
                }}
                onCancelAsn={async (asnNo) => {
                  const res = await wmsApi.cancelAsn(asnNo);
                  setState(res.state);
                }}
                onOpenLabel={setLabelReel}
                onInspectTrace={handleInspectTrace}
              />
            )}

            {activeNav === 'wave' && (
              <WavePickView
                state={state}
                onCreateWave={async (payload) => {
                  const res = await wmsApi.createWave(payload);
                  setState(res.state);
                  return { shortages: res.payload.shortages };
                }}
                onIssueWaveReel={async (waveId, reelId, operator) => {
                  const res = await wmsApi.issueWaveReel(waveId, { reelId, operator });
                  setState(res.state);
                }}
                onGeneralOutbound={async (payload) => {
                  const res = await wmsApi.generalOutbound(payload);
                  setState(res.state);
                }}
              />
            )}

            {activeNav === 'replenish' && (
              <ReplenishReturnView
                state={state}
                onReplenish={async (payload) => {
                  const res = await wmsApi.replenish(payload);
                  setState(res.state);
                }}
                onReturn={async (payload) => {
                  const res = await wmsApi.productionReturn(payload);
                  setState(res.state);
                  return res.payload.reel as ReelItem;
                }}
                onOpenLabel={setLabelReel}
              />
            )}

            {activeNav === 'scrapCount' && (
              <ScrapCountView
                state={state}
                onScrap={async (payload) => {
                  const res = await wmsApi.scrap(payload);
                  setState(res.state);
                }}
                onCreateCycleCount={async (payload) => {
                  const res = await wmsApi.createCycleCount(payload);
                  setState(res.state);
                }}
                onReconcileCycleCount={async (countId, payload) => {
                  const res = await wmsApi.reconcileCycleCount(countId, payload);
                  setState(res.state);
                }}
              />
            )}

            {activeNav === 'trace' && (
              <TraceabilityView
                state={state}
                initialQuery={traceQuery}
                onOpenLabel={setLabelReel}
              />
            )}

            {activeNav === 'master' && (
              <InventoryMasterView
                state={state}
                onOpenLabel={setLabelReel}
                onInspectTrace={handleInspectTrace}
                onBakeMsd={handleBakeMsd}
                onAddMaterial={async (mat) => {
                  const res = await wmsApi.addMaterial(mat);
                  setState(res.state);
                }}
                onSaveBom={async (bom) => {
                  const res = await wmsApi.saveBom(bom);
                  setState(res.state);
                }}
                onAddWarehouse={async (wh) => {
                  const res = await wmsApi.addWarehouse(wh);
                  setState(res.state);
                }}
                onAddBin={async (bin) => {
                  const res = await wmsApi.addBin(bin);
                  setState(res.state);
                }}
                onAddKeeper={async (keeper) => {
                  const res = await wmsApi.addKeeper(keeper);
                  setState(res.state);
                }}
                onAddSupplier={async (sup) => {
                  const res = await wmsApi.addSupplier(sup);
                  setState(res.state);
                }}
                onAddCustomer={async (cus) => {
                  const res = await wmsApi.addCustomer(cus);
                  setState(res.state);
                }}
                onAddWorkOrder={async (wo) => {
                  const res = await wmsApi.addWorkOrder(wo);
                  setState(res.state);
                }}
              />
            )}
          </div>
        </main>
      </div>

      <BarcodeLabelModal reel={labelReel} onClose={() => setLabelReel(null)} />
    </div>
  );
}
