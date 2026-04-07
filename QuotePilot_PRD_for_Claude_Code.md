# LeadSpark PRD — Claude Code 开发指南

> 本文档用于指导 Claude Code 在现有 LeadSpark 项目基础上开发报价助理+客户管理功能。
> 请完整阅读后再开始编码。

---

## 项目背景

### 现有项目信息
- 项目名称：LeadSpark（保持不变）
- 项目路径：/Users/lixinyuan/leadspark/
- 技术栈：Next.js (App Router) + TailwindCSS + shadcn/ui + Supabase
- Supabase 项目 ID：zyglpictixvvpnycvpir
- Supabase URL：https://zyglpictixvvpnycvpir.supabase.co
- 启动命令：NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev
- 已有 API Key：DeepSeek（platform.deepseek.com）、Serper.dev

### 已知技术约束
1. 所有 app/api/ 下的路由文件，Supabase 必须用 service_role_key 创建：
```typescript
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```
2. 国内 Mac 环境必须加 NODE_TLS_REJECT_UNAUTHORIZED=0
3. 前端 Supabase 客户端用 NEXT_PUBLIC_SUPABASE_ANON_KEY

### 产品定位转变
LeadSpark 从原来的"AI获客工具"转变为"AI外贸销售助理"——覆盖从报价到成交到订单交付的全流程。当前 MVP 聚焦报价+客户管理，后续版本加入 AI 邮件助手和订单跟进。

---

## 产品定义

### 一句话定义
LeadSpark —— SOHO 外贸人的 AI 销售助理。帮你算价、做单、管客户、写回复、跟订单。

### 目标用户
SOHO 个人外贸从业者（1人干所有），特征：
- 每天处理 10-50 封客户邮件
- 手动用 Excel 算报价，频繁切换汇率网站
- 用 Word/Excel 模板做报价单和 PI
- 英文能力一般，写回复邮件耗时长
- 没有专业 CRM，用微信/Excel 管理客户
- 经常忘记之前给客户报过什么价，翻文件夹找历史报价

---

## MVP 功能规格（Phase 1，目标 2-3 周）

### 功能 1：智能报价计算器

#### 用户故事
作为外贸业务员，我想输入产品成本和各项费用，一键算出所有贸易术语下的报价，这样不用每次手动算。

#### 输入字段
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| 产品成本 (CNY) | number | 是 | 工厂出厂价，人民币 |
| 数量 | number | 是 | 报价数量 |
| 国内费用 (CNY) | number | 否 | 拖车费+港杂费+报关费等，默认 0 |
| 海运费 (CNY) | number | 否 | 海运费总额，默认 0 |
| 目的港费用 (CNY) | number | 否 | DAP/DPU/DDP 用，默认 0 |
| 保险费率 (%) | number | 否 | CIF/CIP 用，默认 0.3 |
| 期望利润率 (%) | number | 是 | 默认 10 |
| 目标货币 | select | 是 | USD / EUR / GBP，默认 USD |

#### 输出
一键计算并展示所有 11 种贸易术语的报价结果：

**计算公式（全部基于单件成本计算）：**
```
单件成本 = 产品成本 / 数量
单件国内费 = 国内费用 / 数量
单件海运费 = 海运费 / 数量
单件目的港费 = 目的港费用 / 数量
利润系数 = 1 + 利润率/100

EXW = 单件成本 × 利润系数
FCA = (单件成本 + 单件国内费 × 0.3) × 利润系数
FAS = (单件成本 + 单件国内费 × 0.5) × 利润系数
FOB = (单件成本 + 单件国内费) × 利润系数
CFR = (单件成本 + 单件国内费 + 单件海运费) × 利润系数
CPT = CFR（同 CFR）
CIF = (单件成本 + 单件国内费 + 单件海运费) × 利润系数 / (1 - 保险费率/100 × 1.1)
CIP = CIF（同 CIF）
DAP = (单件成本 + 单件国内费 + 单件海运费 + 单件目的港费 × 0.7) × 利润系数
DPU = (单件成本 + 单件国内费 + 单件海运费 + 单件目的港费) × 利润系数
DDP = (单件成本 + 单件国内费 + 单件海运费 + 单件目的港费 × 1.15) × 利润系数
```

所有结果同时显示外币和人民币两种价格。

#### 阶梯报价
支持用户添加两行：散货(LCL)和整柜(FCL)。系统自动计算整柜比散货便宜多少百分比并显示。

#### 实时汇率
调用免费汇率 API（ExchangeRate-API，https://open.er-api.com/v6/latest/CNY），缓存 1 小时。页面显示汇率和更新时间。

#### UI 设计要求
- 顶部：汇率显示区（USD/CNY = X.XXXX，更新于 HH:MM:SS）
- 中部：输入表单（左侧输入，右侧预览结果）
- 下部：11 个贸易术语卡片，每个显示外币价格和人民币价格
- 参考小红书"外贸价格大师"的卡片式布局风格
- 移动端友好，卡片响应式排列

---

### 功能 2：产品库

#### 用户故事
作为外贸业务员，我想把我的产品信息保存起来，报价时快速选择，不用每次重新输入成本。

#### 数据字段
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | uuid | 自动 | 主键 |
| user_id | uuid | 自动 | 关联用户 |
| name | text | 是 | 产品名称 |
| model | text | 否 | 型号/SKU |
| cost_price | numeric | 是 | 成本价 (CNY) |
| unit | text | 否 | 单位（pc/set/kg 等） |
| specs | text | 否 | 规格参数 |
| image_url | text | 否 | 产品图片 URL |
| category | text | 否 | 产品分类 |
| created_at | timestamptz | 自动 | 创建时间 |
| updated_at | timestamptz | 自动 | 更新时间 |

#### 功能点
- 手动添加产品（表单）
- Excel/CSV 批量导入（上传文件，解析后预览确认，再写入数据库）
- 产品列表（搜索、筛选、分页）
- 编辑/删除产品
- 在报价计算器中，可以从产品库快速选择产品，自动填充成本价

#### Excel 导入规范
- 支持 .xlsx 和 .csv
- 必须包含列：产品名称、成本价
- 可选列：型号、单位、规格、分类
- 上传后先展示预览表格，用户确认后再写入
- 使用 SheetJS (xlsx) 库解析

---

### 功能 3：报价单 PDF 生成

#### 用户故事
作为外贸业务员，我想把报价结果一键生成专业的报价单 PDF，直接发给客户。

#### 报价单包含内容（基于真实外贸人反馈，必须完整）
1. **公司信息区**：公司名、Logo、地址、电话、邮箱、网站
2. **客户信息区**：客户公司名、联系人、地址
3. **报价单标题**：QUOTATION 或 PROFORMA INVOICE
4. **报价单编号**：自动生成，格式 LS-YYYYMMDD-XXX
5. **报价日期 + 有效期**：默认有效期 30 天
6. **交易条款**：FOB/CIF/EXW 等（用户选择）
7. **产品明细表**：
   - Item No.
   - Product Name / Description
   - Specification
   - Quantity
   - Unit Price（外币）
   - Amount（外币）
8. **包装方式**：用户填写
9. **总金额**：自动计算
10. **付款条件**：用户填写或选择模板（T/T 30% deposit, 70% before shipment 等）
11. **交货期**：用户填写
12. **备注**：默认包含 "Ocean freight is subject to actual rate at time of shipment"（CIF/CFR 时自动加）
13. **签名区**：公司名 + Authorized Signature

#### 技术实现
- 使用 @react-pdf/renderer 在前端生成 PDF
- 生成后可直接下载，也可预览
- 支持两种格式切换：Quotation / Proforma Invoice
- Logo 从用户设置中读取（Supabase Storage）

---

### 功能 4：客户记录（轻量 CRM）

#### 用户故事
作为外贸业务员，我想每次报价自动关联到客户，以后能看到给每个客户报过什么价、什么时候报的，不用再翻 Excel 文件夹。

#### 客户数据字段
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | uuid | 自动 | 主键 |
| user_id | uuid | 自动 | 关联用户 |
| company_name | text | 是 | 客户公司名 |
| contact_name | text | 否 | 联系人 |
| email | text | 否 | 邮箱 |
| phone | text | 否 | 电话/WhatsApp |
| country | text | 否 | 国家 |
| status | text | 是 | 状态，默认 "new" |
| notes | text | 否 | 备注 |
| created_at | timestamptz | 自动 | 创建时间 |
| updated_at | timestamptz | 自动 | 更新时间 |

#### 客户状态枚举
`new` → `quoted` → `negotiating` → `won` → `lost`

#### 功能点
- 报价时选择已有客户或新建客户
- 客户列表页：按状态筛选、搜索、分页
- 客户详情页：
  - 基本信息卡片
  - **报价时间线**：该客户的所有历史报价记录，按时间倒序排列。每条记录显示：日期、产品、贸易术语、单价、总金额、报价单 PDF 链接
  - 简单备注区（手动添加备注，类似 remark）
- 状态可手动切换（下拉选择）

#### 核心交互
报价计算器页面右上角有"生成报价单"按钮 → 弹出抽屉/弹窗 → 选择客户（下拉搜索，选已有客户或新建）→ 如果选了已有客户，右侧显示"上次报价：2025-12-03，FOB $2.3/pc"提示 → 填写报价单其他信息 → 生成 PDF → 自动保存报价记录到该客户名下

---

### 功能 5：用户设置

#### 公司信息设置
| 字段 | 说明 |
|------|------|
| company_name | 公司名称（英文） |
| company_name_cn | 公司名称（中文，可选） |
| logo | 上传 Logo（存 Supabase Storage） |
| address | 公司地址 |
| phone | 电话 |
| email | 邮箱 |
| website | 网站 |
| default_currency | 默认报价货币 |
| default_payment_terms | 默认付款条件 |
| default_validity | 报价有效天数，默认 30 |

---

## 数据库设计

### 新建表（在 Supabase 中执行）

```sql
-- 用户扩展信息
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT,
  company_name_cn TEXT,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  default_currency TEXT DEFAULT 'USD',
  default_payment_terms TEXT DEFAULT 'T/T 30% deposit, 70% before shipment',
  default_validity INTEGER DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 产品库
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT,
  cost_price NUMERIC NOT NULL,
  unit TEXT DEFAULT 'pc',
  specs TEXT,
  image_url TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 客户
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'quoted', 'negotiating', 'won', 'lost')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 报价记录
CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  quotation_number TEXT NOT NULL,
  trade_term TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange_rate NUMERIC NOT NULL,
  products JSONB NOT NULL,
  -- products 结构: [{name, model, qty, unit, cost_price, unit_price_foreign, amount_foreign}]
  costs JSONB NOT NULL,
  -- costs 结构: {domestic_cost, freight, destination_cost, insurance_rate, profit_rate}
  total_amount_foreign NUMERIC NOT NULL,
  total_amount_cny NUMERIC NOT NULL,
  payment_terms TEXT,
  delivery_time TEXT,
  validity_days INTEGER DEFAULT 30,
  packing TEXT,
  remarks TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 客户备注/Remark
CREATE TABLE customer_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略（所有表都加）
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_remarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data" ON user_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own products" ON products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own customers" ON customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own quotations" ON quotations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own remarks" ON customer_remarks FOR ALL USING (auth.uid() = user_id);
```

---

## 页面结构

```
/                          → Landing page（产品介绍+注册入口）
/login                     → 登录
/register                  → 注册
/dashboard                 → 仪表盘首页（快捷入口）
/quote                     → 报价计算器（核心页面）
/quote/history             → 报价历史列表
/products                  → 产品库列表
/products/import           → Excel 导入
/customers                 → 客户列表
/customers/[id]            → 客户详情（含报价时间线）
/settings                  → 用户设置（公司信息+偏好）
```

---

## API 路由设计

```
POST   /api/exchange-rate        → 获取实时汇率（缓存1小时）
POST   /api/products             → 创建产品
GET    /api/products             → 获取产品列表
PUT    /api/products/[id]        → 更新产品
DELETE /api/products/[id]        → 删除产品
POST   /api/products/import      → Excel 批量导入
POST   /api/customers            → 创建客户
GET    /api/customers            → 获取客户列表
GET    /api/customers/[id]       → 获取客户详情+报价历史
PUT    /api/customers/[id]       → 更新客户
POST   /api/quotations           → 保存报价记录
GET    /api/quotations           → 获取报价历史
GET    /api/quotations/[id]      → 获取单条报价详情
POST   /api/user-profile         → 创建/更新用户配置
GET    /api/user-profile         → 获取用户配置
```

重要：所有 API 路由中 Supabase 客户端必须使用 service_role_key，参见技术约束部分。

---

## 现有代码处理

### 保留
- Next.js 项目结构和配置
- TailwindCSS + shadcn/ui 配置
- Supabase 客户端配置文件
- 认证相关代码（登录/注册）
- 全局样式和布局组件

### 删除或重构
- 原有的"搜索获客"相关页面和 API（Serper 搜索、AI 筛选）
- 原有的客户池/客户管理页面（用新的 customers 表替代）
- 原有的开发信生成功能（V2 再做，当前先删除入口）

### 新增
- /quote 报价计算器页面
- /products 产品库页面（含 Excel 导入）
- /customers 客户管理页面（含报价时间线）
- /settings 用户设置页面
- PDF 生成组件
- 汇率 API

---

## 开发顺序（给 Claude Code 的执行建议）

### 第一步：清理旧代码 + 数据库
1. 删除原有的获客搜索相关页面和 API（Serper 搜索、AI 筛选等），保留项目框架和认证
2. 在 Supabase 中执行上面的 SQL 创建所有新表
3. 确认 RLS 策略生效

### 第二步：用户设置
1. 创建 /settings 页面
2. 实现公司信息表单（含 Logo 上传到 Supabase Storage）
3. API: /api/user-profile

### 第三步：产品库
1. 创建 /products 页面（列表+CRUD）
2. 创建 /products/import 页面（Excel 上传+预览+确认）
3. 安装 xlsx 库用于 Excel 解析
4. API: /api/products, /api/products/import

### 第四步：报价计算器
1. 创建 /quote 页面
2. 实现计算逻辑（所有 11 种贸易术语的公式）
3. 实现产品库下拉选择，选中后自动填充成本价
4. 实现阶梯报价（LCL/FCL 两行）
5. 接入汇率 API
6. API: /api/exchange-rate

### 第五步：客户管理
1. 创建 /customers 页面（列表+搜索+状态筛选）
2. 创建 /customers/[id] 详情页（基本信息+报价时间线+备注区）
3. API: /api/customers

### 第六步：报价单 PDF 生成
1. 安装 @react-pdf/renderer
2. 创建 PDF 模板组件（Quotation 和 Proforma Invoice 两种）
3. 在报价计算器中添加"生成报价单"按钮
4. 弹窗流程：选客户 → 显示上次报价提示 → 填补充信息 → 预览 → 下载 PDF
5. 保存报价记录到 quotations 表
6. API: /api/quotations

### 第七步：Dashboard + 整体优化
1. 创建 /dashboard 页面（显示快捷入口+最近报价+客户统计）
2. 响应式适配
3. 导航栏更新

---

## UI/UX 参考

- 整体风格：简洁专业，白底 + 蓝色主色调
- 参考 shadcn/ui 的 Dashboard 模板
- 报价计算器参考小红书"外贸价格大师"的卡片式布局
- 移动端优先，所有页面在手机上可用
- 中文界面（用户面向国内 SOHO 外贸人）

---

## 后续版本预留（当前不做，但数据结构要兼容）

### V2 功能 — AI 销售助手
- AI 询盘解析：粘贴客户邮件 → AI 提取关键参数 → 自动填入报价计算器
- AI 邮件回复生成：基于报价结果生成英文回复邮件草稿
- AI 议价助手：客户说贵了 → AI 生成议价回复（解释为什么贵+反问需求+有条件让步）
- 客户背景信息：报价时显示客户的历史采购数据

这些功能需要 DeepSeek API，已有 Key，后续接入即可。

### V3 功能 — 订单跟进 + 客户门户（Order in 1）
成交后的订单全流程管理，用户之前已做过基于飞书多维表格的原型，现在要集成到 LeadSpark 中：
- 订单管理：创建订单、关联客户、记录产品明细和金额
- 生产跟进：订单状态流转（已下单→生产中→验货→已出货→已到港→已签收）
- 货运追踪：每个订单关联柜号、船名、ETD/ETA，支持一个客户多个柜子
- 客户专属门户页面：每个客户一个独立链接（无需登录），客户打开能看到：
  - 自己所有订单的列表和状态
  - 每个订单的货运进度时间线
  - 相关文件（PI、合同、提单、装箱单等）
- 自动通知：订单状态变更时自动发邮件通知客户（结合 Resend）
- 装箱单/商业发票 PDF 生成

数据结构预留：quotations 表的记录未来可以转化为 orders 表的记录（报价成交后一键转订单），customers 表已包含所有需要的客户字段。

当前 MVP 先不做 V3，专注做好报价+产品库+客户管理。
