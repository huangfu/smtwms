using SmtWms.Domain.Entities;
using SmtWms.Domain.Repositories;

namespace SmtWms.Application.Services;

/// <summary>
/// 生成标准 SMT 车间初始主数据与示范台账，确保首次登录即可开箱体验。
/// </summary>
public static class WmsSeedFactory
{
    public static WmsWorkspaceSnapshot CreateInitialSnapshot(string ownerUid)
    {
        var now = DateTime.UtcNow;
        var isoNow = now.ToString("O");

        return new WmsWorkspaceSnapshot
        {
            Workspace = new WmsWorkspace
            {
                OwnerUid = ownerUid,
                PrinterConfigJson = """{"mode":"LAN_TCP","host":"192.168.10.88","port":9100,"browserPrintUrl":"http://127.0.0.1:9100","darkness":18,"printSpeed":4}""",
                SeededAtUtc = now,
                UpdatedAtUtc = now,
            },
            Warehouses =
            [
                new WarehouseEntity
                {
                    OwnerUid = ownerUid,
                    WarehouseCode = "WH-SMT-01",
                    WarehouseName = "SMT电子料主仓",
                    WarehouseType = "恒温防静电主仓",
                    ManagerId = "KP-001",
                    ManagerName = "陈志强",
                    Address = "1号厂房2层东区",
                    Status = "ACTIVE",
                    CreatedAt = isoNow,
                },
                new WarehouseEntity
                {
                    OwnerUid = ownerUid,
                    WarehouseCode = "WH-MSD-01",
                    WarehouseName = "MSD防潮恒温烘烤仓",
                    WarehouseType = "湿敏防潮专仓",
                    ManagerId = "KP-002",
                    ManagerName = "林晓燕",
                    Address = "1号厂房2层恒湿间",
                    Status = "ACTIVE",
                    CreatedAt = isoNow,
                },
            ],
            Keepers =
            [
                new WarehouseKeeperEntity
                {
                    OwnerUid = ownerUid,
                    KeeperId = "KP-001",
                    EmployeeNo = "EMP1001",
                    Name = "陈志强",
                    Role = "仓库主管",
                    WarehouseCode = "WH-SMT-01",
                    Phone = "138-0001-1001",
                    Shift = "常白班",
                    Status = "ACTIVE",
                },
                new WarehouseKeeperEntity
                {
                    OwnerUid = ownerUid,
                    KeeperId = "KP-002",
                    EmployeeNo = "EMP1002",
                    Name = "林晓燕",
                    Role = "IQC/MSD专员",
                    WarehouseCode = "WH-MSD-01",
                    Phone = "138-0001-1002",
                    Shift = "白班",
                    Status = "ACTIVE",
                },
            ],
            Bins =
            [
                new WarehouseBinEntity
                {
                    OwnerUid = ownerUid,
                    BinCode = "A-01-01",
                    WarehouseCode = "WH-SMT-01",
                    Zone = "电子料主库区",
                    CapacityReels = 60,
                    KeeperName = "陈志强",
                    Description = "阻容感 0402/0603 标准料架",
                },
                new WarehouseBinEntity
                {
                    OwnerUid = ownerUid,
                    BinCode = "MSD-01-01",
                    WarehouseCode = "WH-MSD-01",
                    Zone = "防潮恒温柜(MSD)",
                    CapacityReels = 40,
                    KeeperName = "林晓燕",
                    Description = "RH<5% 低湿防潮氮气柜",
                },
                new WarehouseBinEntity
                {
                    OwnerUid = ownerUid,
                    BinCode = "LINE-SMT-01",
                    WarehouseCode = "WH-SMT-01",
                    Zone = "产线暂存区",
                    CapacityReels = 30,
                    KeeperName = "陈志强",
                    Description = "SMT-1号线线边备料车",
                },
            ],
            Suppliers =
            [
                new SupplierEntity
                {
                    OwnerUid = ownerUid,
                    SupplierCode = "SUP-ST",
                    SupplierName = "意法半导体(ST)授权代理",
                    ContactName = "周明",
                    Phone = "0755-8601-2201",
                    CategoryTags = "MCU,电源IC",
                    QualityGrade = "A级免检",
                    LeadTimeDays = 14,
                },
                new SupplierEntity
                {
                    OwnerUid = ownerUid,
                    SupplierCode = "SUP-YAGEO",
                    SupplierName = "国巨电子(YAGEO)",
                    ContactName = "王磊",
                    Phone = "0512-6601-8890",
                    CategoryTags = "贴片电阻,贴片电容",
                    QualityGrade = "A级免检",
                    LeadTimeDays = 5,
                },
            ],
            Customers =
            [
                new CustomerEntity
                {
                    OwnerUid = ownerUid,
                    CustomerCode = "CUS-INOVANCE",
                    CustomerName = "汇川工控科技",
                    ContactName = "李工",
                    Phone = "0755-2979-8800",
                    Industry = "工业伺服/PLC",
                    TraceRequirement = "IPC-1782 Level 3 料盘UID全追溯",
                    DeliveryAddress = "苏州吴中制造基地",
                },
            ],
            PackagingSpecs =
            [
                new PackagingSpecEntity
                {
                    OwnerUid = ownerUid,
                    PackagingCode = "PKG-7IN-8MM-5K",
                    PackagingName = "7寸卷盘 8mm带宽 (5000PCS)",
                    CarrierType = "REEL",
                    ReelDiameter = "7寸 (178mm)",
                    TapeWidthMm = 8,
                    PitchMm = 4,
                    DefaultSpq = 5000,
                    AllowSplit = true,
                    AllowMerge = true,
                    Description = "适用于 0402/0603 阻容标准贴片料",
                },
                new PackagingSpecEntity
                {
                    OwnerUid = ownerUid,
                    PackagingCode = "PKG-TRAY-LQFP100",
                    PackagingName = "JEDEC 防静电吸塑盘 (90PCS/盘)",
                    CarrierType = "TRAY",
                    ReelDiameter = "JEDEC Tray",
                    TapeWidthMm = 0,
                    PitchMm = 0,
                    DefaultSpq = 90,
                    AllowSplit = true,
                    AllowMerge = false,
                    Description = "适用于 LQFP100/BGA 高湿敏 IC",
                },
            ],
            BarcodeRules =
            [
                new BarcodeRuleEntity
                {
                    OwnerUid = ownerUid,
                    RuleId = "RULE-STD-KV",
                    RuleName = "标准键值对复合码 (UID|MPN|LOT|DC|QTY)",
                    SupplierCode = "ALL",
                    SupplierName = "通用供应商",
                    FormatType = "KEY_VALUE",
                    Delimiter = "|",
                    FieldMapJson = """{"reelIdKey":"UID","mpnKey":"MPN","lotKey":"LOT","dateCodeKey":"DC","qtyKey":"QTY"}""",
                    SampleBarcode = "UID:RL261119-001|MPN:STM32F407VET6|LOT:L2611A|DC:2645|QTY:500",
                    Enabled = true,
                },
            ],
            LabelTemplates =
            [
                new LabelTemplateEntity
                {
                    OwnerUid = ownerUid,
                    TemplateId = "TPL-001",
                    TemplateName = "标准 70×40mm SMT 料盘主标",
                    PaperSize = "70x40mm",
                    Dpi = 203,
                    OffsetXMm = 0,
                    OffsetYMm = 0,
                    BarcodeType = "CODE128",
                    ZplMode = "VISUAL",
                    FontScale = "STANDARD",
                    BarcodeHeightMm = 10,
                    HeaderTitle = "SMT-WMS 智能电子仓",
                    FooterNote = "FIFO先入先出 · 拆封扫码计时",
                    ShowFieldsJson = """{"mpn":true,"skuCode":true,"ownership":true,"packagingMpq":true,"supplier":true,"lotDateCode":true,"binMsd":true,"compositeBarcode":true}""",
                    IsDefault = true,
                },
            ],
            Materials =
            [
                new MaterialSkuEntity
                {
                    OwnerUid = ownerUid,
                    MaterialKey = "STM32F407VET6::SELF_PURCHASED::SELF",
                    SkuCode = "STM32F407VET6",
                    Mpn = "STM32F407VET6",
                    Name = "32位 ARM Cortex-M4 主控 MCU",
                    OwnershipType = "SELF_PURCHASED",
                    OwnerCode = "SELF",
                    OwnerName = "自购公用料",
                    Manufacturer = "STMicroelectronics",
                    Category = "IC芯片",
                    PackageType = "LQFP-100",
                    PackagingCode = "PKG-TRAY-LQFP100",
                    PackagingName = "JEDEC 防静电吸塑盘 (90PCS/盘)",
                    Mpq = 90,
                    SupplierCode = "SUP-ST",
                    SupplierName = "意法半导体(ST)授权代理",
                    Unit = "PCS",
                    MsdLevel = "Level 3",
                    SafetyStock = 300,
                    DefaultBin = "MSD-01-01",
                },
                new MaterialSkuEntity
                {
                    OwnerUid = ownerUid,
                    MaterialKey = "RC0402FR-0710KL::SELF_PURCHASED::SELF",
                    SkuCode = "RC0402FR-0710KL",
                    Mpn = "RC0402FR-0710KL",
                    Name = "贴片电阻 10KΩ ±1% 0402",
                    OwnershipType = "SELF_PURCHASED",
                    OwnerCode = "SELF",
                    OwnerName = "自购公用料",
                    Manufacturer = "YAGEO",
                    Category = "阻容感",
                    PackageType = "0402",
                    PackagingCode = "PKG-7IN-8MM-5K",
                    PackagingName = "7寸卷盘 8mm带宽 (5000PCS)",
                    Mpq = 5000,
                    SupplierCode = "SUP-YAGEO",
                    SupplierName = "国巨电子(YAGEO)",
                    Unit = "PCS",
                    MsdLevel = "Level 1",
                    SafetyStock = 5000,
                    DefaultBin = "A-01-01",
                },
            ],
            Reels =
            [
                new ReelItemEntity
                {
                    OwnerUid = ownerUid,
                    ReelId = "RL261101-001",
                    MaterialKey = "STM32F407VET6::SELF_PURCHASED::SELF",
                    SkuCode = "STM32F407VET6",
                    Mpn = "STM32F407VET6",
                    LotNumber = "L2610A01",
                    DateCode = "2640",
                    Supplier = "意法半导体(ST)授权代理",
                    OwnershipType = "SELF_PURCHASED",
                    OwnerCode = "SELF",
                    OwnerName = "自购公用料",
                    PackagingCode = "PKG-TRAY-LQFP100",
                    Mpq = 90,
                    ReceiptDocNo = "RCV-20261101-01",
                    InitialQty = 450,
                    Qty = 450,
                    IssuedQty = 0,
                    BinCode = "MSD-01-01",
                    MsdLevel = "Level 3",
                    MsdState = "SEALED",
                    Status = "IN_STOCK",
                    ReceivedAt = isoNow,
                    UpdatedAt = isoNow,
                },
                new ReelItemEntity
                {
                    OwnerUid = ownerUid,
                    ReelId = "RL261102-002",
                    MaterialKey = "RC0402FR-0710KL::SELF_PURCHASED::SELF",
                    SkuCode = "RC0402FR-0710KL",
                    Mpn = "RC0402FR-0710KL",
                    LotNumber = "L2610R02",
                    DateCode = "2641",
                    Supplier = "国巨电子(YAGEO)",
                    OwnershipType = "SELF_PURCHASED",
                    OwnerCode = "SELF",
                    OwnerName = "自购公用料",
                    PackagingCode = "PKG-7IN-8MM-5K",
                    Mpq = 5000,
                    ReceiptDocNo = "RCV-20261102-01",
                    InitialQty = 5000,
                    Qty = 5000,
                    IssuedQty = 0,
                    BinCode = "A-01-01",
                    MsdLevel = "Level 1",
                    MsdState = "SEALED",
                    Status = "IN_STOCK",
                    ReceivedAt = isoNow,
                    UpdatedAt = isoNow,
                },
            ],
            Boms =
            [
                new BomMasterEntity
                {
                    OwnerUid = ownerUid,
                    BomId = "BOM-CTRL-V3",
                    ProductCode = "PCBA-CTRL-V3",
                    ProductName = "工业网关主控板 V3",
                    Version = "V3.2",
                    CustomerCode = "CUS-INOVANCE",
                    CustomerName = "汇川工控科技",
                    ProcessType = "双面SMT回流焊",
                    Status = "ACTIVE",
                    ItemsJson = """[{"lineId":"L1","skuCode":"STM32F407VET6","qtyPerBoard":1,"attritionRate":0.01,"designators":"U1","itemRole":"MAIN"},{"lineId":"L2","skuCode":"RC0402FR-0710KL","qtyPerBoard":8,"attritionRate":0.02,"designators":"R1-R8","itemRole":"MAIN"}]""",
                    UpdatedAt = isoNow,
                },
            ],
            WorkOrders =
            [
                new WorkOrderEntity
                {
                    OwnerUid = ownerUid,
                    WorkOrderId = "WO-20261119-01",
                    ProductCode = "PCBA-CTRL-V3",
                    ProductName = "工业网关主控板 V3",
                    BomId = "BOM-CTRL-V3",
                    CustomerCode = "CUS-INOVANCE",
                    CustomerName = "汇川工控科技",
                    LineName = "SMT-1号线",
                    TargetQty = 200,
                    Status = "PLANNED",
                    BomJson = """[{"lineId":"L1","skuCode":"STM32F407VET6","qtyPerBoard":1,"attritionRate":0.01,"designators":"U1","itemRole":"MAIN"},{"lineId":"L2","skuCode":"RC0402FR-0710KL","qtyPerBoard":8,"attritionRate":0.02,"designators":"R1-R8","itemRole":"MAIN"}]""",
                    IssuedBySkuJson = "{}",
                    ReplenishedBySkuJson = "{}",
                    ReturnedBySkuJson = "{}",
                    CreatedAt = isoNow,
                },
            ],
            TraceEvents =
            [
                new TraceEventEntity
                {
                    OwnerUid = ownerUid,
                    EventId = "EVT-INIT-001",
                    Timestamp = isoNow,
                    Action = "INBOUND",
                    ReelId = "RL261101-001",
                    SkuCode = "STM32F407VET6",
                    Mpn = "STM32F407VET6",
                    LotNumber = "L2610A01",
                    DateCode = "2640",
                    QtyDelta = 450,
                    BalanceAfter = 450,
                    ToBin = "MSD-01-01",
                    DocNo = "RCV-20261101-01",
                    Reason = "初始期初入库",
                    Operator = "陈志强",
                },
            ],
        };
    }
}
