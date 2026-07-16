import { PrismaClient, HeadType, Segment, AllowedType, DepRate } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)


// ── Account Heads (from Excel BUDGET/Actual sheets) ──────────────────────────
// Mirrors the exact row structure of the Excel P&L
const accountHeads = [
  // ── REVENUE ───────────────────────────────────────────────────────────────
  { code: 'SALES_TOTAL',  name: 'Sales Accounts',          type: 'REVENUE' as HeadType,           segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 10, parentId: null },
  { code: 'SALES_MFG',   name: 'MFG & Lab',                type: 'REVENUE' as HeadType,           segment: 'MFG_LAB' as Segment,      allowedType: 'PRORATED' as AllowedType, sortOrder: 11, parentId: 'SALES_TOTAL' },
  { code: 'SALES_DND',   name: 'D & D Sales',              type: 'REVENUE' as HeadType,           segment: 'DND' as Segment,          allowedType: 'PRORATED' as AllowedType, sortOrder: 12, parentId: 'SALES_TOTAL' },

  // ── COGS ──────────────────────────────────────────────────────────────────
  { code: 'COGS_TOTAL',  name: 'Cost of Sales',            type: 'COGS' as HeadType,              segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 20, parentId: null },
  { code: 'OPEN_STOCK',  name: 'Opening Stock',            type: 'COGS' as HeadType,              segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 21, parentId: 'COGS_TOTAL' },
  { code: 'PURCH_TOTAL', name: 'Add: Purchase Accounts',   type: 'COGS' as HeadType,              segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 22, parentId: 'COGS_TOTAL' },
  { code: 'PURCH_RM',    name: 'RM',                       type: 'COGS' as HeadType,              segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 23, parentId: 'PURCH_TOTAL' },
  { code: 'PURCH_SC',    name: 'S/C',                      type: 'COGS' as HeadType,              segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 24, parentId: 'PURCH_TOTAL' },
  { code: 'PURCH_CON',   name: 'CON',                      type: 'COGS' as HeadType,              segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 25, parentId: 'PURCH_TOTAL' },
  { code: 'CLOSE_STOCK', name: 'Less: Closing Stock',      type: 'COGS' as HeadType,              segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 26, parentId: 'COGS_TOTAL' },
  { code: 'CONSUMPTION', name: 'Consumption',              type: 'COGS' as HeadType,              segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 27, parentId: 'COGS_TOTAL' },

  // ── DIRECT EXPENSES ───────────────────────────────────────────────────────
  { code: 'DIREXP_TOTAL',name: 'Direct Expenses',          type: 'DIRECT_EXPENSE' as HeadType,    segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 30, parentId: null },
  { code: 'DIWALI_BON',  name: 'Diwali Bonus',            type: 'DIRECT_EXPENSE' as HeadType,    segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 31, parentId: 'DIREXP_TOTAL' },
  { code: 'ELECTRICITY', name: 'Electricity Charges',     type: 'DIRECT_EXPENSE' as HeadType,    segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 32, parentId: 'DIREXP_TOTAL' },
  { code: 'EMP_SAL',     name: 'Emp Salary Paid',         type: 'DIRECT_EXPENSE' as HeadType,    segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 33, parentId: 'DIREXP_TOTAL' },
  { code: 'STAFF_WELF',  name: 'Staff Welfare',           type: 'DIRECT_EXPENSE' as HeadType,    segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 34, parentId: 'DIREXP_TOTAL' },

  // ── GROSS PROFIT (computed, no budget/actuals entry) ─────────────────────
  { code: 'GROSS_PROFIT',name: 'Gross Profit',             type: 'INDIRECT_INCOME' as HeadType,   segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 40, parentId: null },

  // ── INDIRECT INCOME (FIXED — always equals budget, no proration) ──────────
  { code: 'INDINC_TOTAL',name: 'Indirect Incomes',         type: 'INDIRECT_INCOME' as HeadType,   segment: 'CONSOLIDATED' as Segment, allowedType: 'FIXED' as AllowedType,    sortOrder: 50, parentId: null },
  { code: 'MACH_RENT_EMI',name:'Machine Rent - EMI',       type: 'INDIRECT_INCOME' as HeadType,   segment: 'CONSOLIDATED' as Segment, allowedType: 'FIXED' as AllowedType,    sortOrder: 51, parentId: 'INDINC_TOTAL' },
  { code: 'OTHER_INC',   name: 'Other Income',             type: 'INDIRECT_INCOME' as HeadType,   segment: 'CONSOLIDATED' as Segment, allowedType: 'FIXED' as AllowedType,    sortOrder: 52, parentId: 'INDINC_TOTAL' },

  // ── INDIRECT EXPENSES (all PRORATED) ──────────────────────────────────────
  { code: 'INDEXP_TOTAL',name: 'Indirect Expenses',        type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 60, parentId: null },
  { code: 'PARTNER_SAL', name: 'Partners Salary Paid',    type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 61, parentId: 'INDEXP_TOTAL' },
  { code: 'POOJA_EXP',   name: 'Pooja Expenses',          type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 62, parentId: 'INDEXP_TOTAL' },
  { code: 'BLDG_RENT',   name: 'Building Rent',           type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 63, parentId: 'INDEXP_TOTAL' },
  { code: 'MACH_RENT',   name: 'Machine Rent',            type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 64, parentId: 'INDEXP_TOTAL' },
  { code: 'TRANSPORT',   name: 'Transport Charges',       type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 65, parentId: 'INDEXP_TOTAL' },
  { code: 'AMC',         name: 'AMC Charges',             type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 66, parentId: 'INDEXP_TOTAL' },
  { code: 'AUDIT_FEE',   name: 'Audit Fee',               type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 67, parentId: 'INDEXP_TOTAL' },
  { code: 'BANK_CHG',    name: 'Bank Charges',            type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 68, parentId: 'INDEXP_TOTAL' },
  { code: 'BIZ_PROMO',   name: 'Business Promotion',      type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 69, parentId: 'INDEXP_TOTAL' },
  { code: 'COMMISSION',  name: 'Commission',              type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 70, parentId: 'INDEXP_TOTAL' },
  { code: 'DEPR',        name: 'Depreciation',            type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 71, parentId: 'INDEXP_TOTAL' },
  { code: 'DOC_CHG',     name: 'Document Charges',        type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 72, parentId: 'INDEXP_TOTAL' },
  { code: 'DONATION',    name: 'Donation',                type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 73, parentId: 'INDEXP_TOTAL' },
  { code: 'DRINK_WATER', name: 'Drinking Water',          type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 74, parentId: 'INDEXP_TOTAL' },
  { code: 'EMI_BOUNCE',  name: 'EMI Bouncing Charges',    type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 75, parentId: 'INDEXP_TOTAL' },
  { code: 'FOOD_EXP',    name: 'Food Expenses',           type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 76, parentId: 'INDEXP_TOTAL' },
  { code: 'GST_LATE',    name: 'GST Late Fee',            type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 77, parentId: 'INDEXP_TOTAL' },
  { code: 'HAND_LOAN',   name: 'Hand Loan Interest - Selva', type: 'INDIRECT_EXPENSE' as HeadType, segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 78, parentId: 'INDEXP_TOTAL' },
  { code: 'HOUSEKEEP',   name: 'Housekeeping Salary',     type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 79, parentId: 'INDEXP_TOTAL' },
  { code: 'INSURANCE',   name: 'Insurance Charges',       type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 80, parentId: 'INDEXP_TOTAL' },
  { code: 'INT_LOAN',    name: 'Interest on Loan',        type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 81, parentId: 'INDEXP_TOTAL' },
  { code: 'LAB_CHG',     name: 'Labour Charges-Design',   type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 82, parentId: 'INDEXP_TOTAL' },
  { code: 'MEDICAL',     name: 'Medical Expenses - Emp',  type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 83, parentId: 'INDEXP_TOTAL' },
  { code: 'OFFICE_MAINT',name: 'Office Maintenance',      type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 84, parentId: 'INDEXP_TOTAL' },
  { code: 'PETROL',      name: 'Petrol Expenses',         type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 85, parentId: 'INDEXP_TOTAL' },
  { code: 'POSTAGE',     name: 'Postage & Courier',       type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 86, parentId: 'INDEXP_TOTAL' },
  { code: 'PRINT_STAT',  name: 'Printing & Stationery',  type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 87, parentId: 'INDEXP_TOTAL' },
  { code: 'PROC_FEE',    name: 'Processing Fee',          type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 88, parentId: 'INDEXP_TOTAL' },
  { code: 'REP_COMP',    name: 'Repairs - Computer',      type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 89, parentId: 'INDEXP_TOTAL' },
  { code: 'REP_ELEC',    name: 'Repairs - Electricals & Plumbing', type: 'INDIRECT_EXPENSE' as HeadType, segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 90, parentId: 'INDEXP_TOTAL' },
  { code: 'REP_MACH',    name: 'Repairs - Machine',       type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 91, parentId: 'INDEXP_TOTAL' },
  { code: 'REP_MAINT',   name: 'Repairs & Maintenance',   type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 92, parentId: 'INDEXP_TOTAL' },
  { code: 'TDS_LATE',    name: 'TDS Late Fee & Interest',  type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 93, parentId: 'INDEXP_TOTAL' },
  { code: 'TELEPHONE',   name: 'Telephone Charges',       type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 94, parentId: 'INDEXP_TOTAL' },
  { code: 'TRAVEL',      name: 'Travelling & Conveyance', type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 95, parentId: 'INDEXP_TOTAL' },
  { code: 'OTHERS_EXP',  name: 'Others Expenses',         type: 'INDIRECT_EXPENSE' as HeadType,  segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 96, parentId: 'INDEXP_TOTAL' },

  // ── NET PROFIT (computed) ─────────────────────────────────────────────────
  { code: 'NET_PROFIT',  name: 'Nett Profit',             type: 'INDIRECT_INCOME' as HeadType,   segment: 'CONSOLIDATED' as Segment, allowedType: 'PRORATED' as AllowedType, sortOrder: 100, parentId: null },
]

// ── 46 Assets from Excel Depreciation sheet (rows 5–50) ──────────────────────
// openingWdv = column C "WDV as on 01.04.2026"
// rateEnum: FIFTEEN = 15%, FORTY = 40%
const assets = [
  { name: 'CHAIN HOIST 2TON',                    category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 36125.00 },
  { name: 'DIAL CALIPER',                         category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 3887.90 },
  { name: 'LAPTOP',                               category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 9540.00 },
  { name: 'MILLING MACHINE',                      category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 72250.00 },
  { name: 'STEPPER MODEL CNC EDM',                category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 711662.50 },
  { name: '10 KVA AUTO TRANSFORMER',              category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 17701.25 },
  { name: 'Mitutoyo Depth Mic 0-150mm',           category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 6290.00 },
  { name: 'Electrical Fittings',                  category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 49606.85 },
  { name: 'Computer & Accessories (1)',            category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 17402.40 },
  { name: 'Magnetic Drill Machine SWC-65 WT',     category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 45293.10 },
  { name: 'BAKER DIGITAL VERNIER 150MM',          category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 4356.25 },
  { name: 'Acer 24" Led Monitor',                 category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 3457.80 },
  { name: 'Computer & Accessories (2)',            category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 21355.80 },
  { name: 'AIDA 110 TON PRESS MACHINE',           category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 1105000.00 },
  { name: '7.5 ELGI COMPRESSOR WITH MOTOR',       category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 46750.00 },
  { name: 'MET COM TABLE',                        category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 3234.25 },
  { name: 'Camera & Accessories',                 category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 23247.50 },
  { name: 'Computer & Accessories (3)',            category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 2244.00 },
  { name: 'LASERJET PRINTER',                     category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 15321.60 },
  { name: 'Electrical Fittings (2)',               category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 42927.40 },
  { name: 'LIFTING MACHINERY',                    category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 42365.00 },
  { name: 'Vertical Lathe Machine',               category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 1313500.00 },
  { name: 'Air Conditioner',                      category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 43475.00 },
  { name: 'Computer - 1 (Design-1)',              category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 4800.00 },
  { name: 'Computer - 3 (Design-3)',              category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 4000.00 },
  { name: 'Computer - 5 (Accounts-5)',            category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 4000.00 },
  { name: 'Computer - 6 (Accounts-6)',            category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 4000.00 },
  { name: 'Computer - 7 (Production-1)',          category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 9600.00 },
  { name: 'Computer - 8 (Production-2)',          category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 3200.00 },
  { name: 'Table - 10 (Wirecut)',                 category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 462.50 },
  { name: 'Table - 1 (Design-1)',                 category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 925.00 },
  { name: 'Table - 2 (Design-2)',                 category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 1850.00 },
  { name: 'Table - 3 (Accounts-1)',               category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 925.00 },
  { name: 'Table - 4 (Marketing-1)',              category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 1850.00 },
  { name: 'Table - 5 (Production-1)',             category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 462.50 },
  { name: 'Table - 7 (BM Table-1)',               category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 7400.00 },
  { name: 'Table - 8 (BM Table-2)',               category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 7400.00 },
  { name: 'Table - 9 (Surface Table-1)',          category: 'Furniture',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 1850.00 },
  { name: 'Okomoto Small Surface Grinding',       category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 64750.00 },
  { name: 'Small Lathe 4.5 Feet',                 category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 37000.00 },
  { name: 'HP - Printer',                         category: 'Computer',   rateEnum: 'FORTY' as DepRate,   openingWdv: 1200.00 },
  { name: 'TVS XL100 - Grey',                     category: 'Vehicle',    rateEnum: 'FIFTEEN' as DepRate, openingWdv: 23125.00 },
  { name: 'TVS XL100 - RED',                      category: 'Vehicle',    rateEnum: 'FIFTEEN' as DepRate, openingWdv: 24050.00 },
  { name: 'VTL Stablizer',                        category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 39775.00 },
  { name: 'S & T Wirecut Stablizer',              category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 37000.00 },
  { name: 'ROYAL SCISSORS LIFT TABLE',            category: 'Machinery',  rateEnum: 'FIFTEEN' as DepRate, openingWdv: 23125.00 },
]

async function main() {
  console.log('🌱 Seeding MIS database...')

  // 1. Create Financial Year 2026-2027
  console.log('  → Financial Year...')
  const fy = await prisma.financialYear.upsert({
    where: { label: '2026-2027' },
    update: {},
    create: {
      label:     '2026-2027',
      startDate: new Date('2026-04-01'),
      endDate:   new Date('2027-03-31'),
      isActive:  true,
    },
  })

  // 2. Create 12 Periods (April=1 to March=12) — all OPEN initially
  console.log('  → Periods (12 months)...')
  for (let month = 1; month <= 12; month++) {
    await prisma.period.upsert({
      where: { financialYearId_month: { financialYearId: fy.id, month } },
      update: {},
      create: { financialYearId: fy.id, month, status: 'OPEN' },
    })
  }

  // 3. Seed Account Heads (two passes: parents first, then children)
  console.log('  → Account Heads...')
  // Pass 1: top-level heads (no parent)
  const headIdMap: Record<string, string> = {}
  for (const h of accountHeads.filter(h => h.parentId === null)) {
    const head = await prisma.accountHead.upsert({
      where: { code: h.code },
      update: {},
      create: {
        code:        h.code,
        name:        h.name,
        type:        h.type,
        segment:     h.segment,
        allowedType: h.allowedType,
        sortOrder:   h.sortOrder,
      },
    })
    headIdMap[h.code] = head.id
  }
  // Pass 2: child heads (have parent)
  for (const h of accountHeads.filter(h => h.parentId !== null)) {
    const head = await prisma.accountHead.upsert({
      where: { code: h.code },
      update: {},
      create: {
        code:        h.code,
        name:        h.name,
        type:        h.type,
        segment:     h.segment,
        allowedType: h.allowedType,
        sortOrder:   h.sortOrder,
        parentId:    headIdMap[h.parentId!],
      },
    })
    headIdMap[h.code] = head.id
  }

  // 4. Seed 46 Assets + AssetYearBalance for FY 2026-2027
  console.log('  → Assets (46 from Excel Depreciation sheet)...')
  for (const a of assets) {
    // Asset has no unique name constraint — use findFirst to avoid duplicates on re-seed
    let asset = await prisma.asset.findFirst({ where: { name: a.name } })
    if (!asset) {
      asset = await prisma.asset.create({
        data: {
          name:         a.name,
          category:     a.category,
          rateEnum:     a.rateEnum,
          purchaseDate: new Date('2020-01-01'), // approximate — exact date not in Excel
          isActive:     true,
        },
      })
    }

    // Create AssetYearBalance with opening WDV from Excel column C
    await prisma.assetYearBalance.upsert({
      where: { assetId_financialYearId: { assetId: asset.id, financialYearId: fy.id } },
      update: {},
      create: {
        assetId:         asset.id,
        financialYearId: fy.id,
        openingWdv:      a.openingWdv,
        annualDepr:      null, // computed at year-end
        closingWdv:      null,
        monthlyDepr:     null,
      },
    })
  }

  // 5. Create default Admin user
  console.log('  → Admin user...')
  const hashedPassword = await bcrypt.hash('admin@mis123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@mis.local' },
    update: {},
    create: {
      name:     'MIS Admin',
      email:    'admin@mis.local',
      password: hashedPassword,
      role:     'ADMIN',
    },
  })

  console.log('✅ Seed complete!')
  console.log(`   FY: ${fy.label} (id: ${fy.id})`)
  console.log(`   Account Heads: ${Object.keys(headIdMap).length}`)
  console.log(`   Assets: ${assets.length}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
