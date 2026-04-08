import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Calculator,
  FileText,
  Package,
  Users,
  Sparkles,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  Clock,
  Search,
} from 'lucide-react'

export default async function LandingPage() {
  // 已登录用户直接进 Dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">LeadSpark</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2"
            >
              登录
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
            >
              免费注册
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Sparkles className="w-4 h-4" />
          专为 SOHO 外贸人设计
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
          外贸报价，从此不再<br />
          <span className="text-blue-600">费时费力</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          LeadSpark 帮你一键算出所有贸易术语报价、生成专业报价单 PDF、
          管理客户跟进记录——一个工具替代 Excel + Word + 汇率网站。
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            免费注册，马上使用
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-8 py-3.5 rounded-xl text-base transition-colors"
          >
            已有账号，登录
          </Link>
        </div>
      </section>

      {/* ── Pain Points ────────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-3">
            你现在是这样报价的吗？
          </h2>
          <p className="text-gray-500 text-center mb-12">这些痛点，每个 SOHO 外贸人都懂</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Calculator, text: '手动用 Excel 算报价，EXW、FOB、CIF 各种公式来回切' },
              { icon: RefreshCw, text: '每次报价都要去汇率网站查汇率，刷新一遍才放心' },
              { icon: FileText, text: '用 Word 模板做报价单，格式乱、容易出错，客户观感差' },
              { icon: Search, text: '报价单发出去就找不到了，客户问上次报多少完全记不住' },
              { icon: Users, text: '客户用微信/Excel 管理，状态、历史全靠记忆，容易遗漏' },
              { icon: Clock, text: '一封英文报价邮件要写半小时，还怕语法出错' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-gray-200">
                <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-red-400" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-3">
            一个工具，解决全部问题
          </h2>
          <p className="text-gray-500 text-center mb-14">LeadSpark 覆盖报价全流程</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                icon: Calculator,
                color: 'bg-blue-600',
                title: '智能报价计算器',
                desc: '输入成本和费用，一键算出 EXW / FOB / CIF / DDP 等全部 11 种贸易术语的单价。实时汇率，结果即时显示。',
                points: ['11 种贸易术语一键对比', '实时 CNY 汇率换算', 'LCL/FCL 阶梯报价'],
              },
              {
                icon: FileText,
                color: 'bg-green-600',
                title: '专业报价单 PDF',
                desc: '报价算好后直接生成专业英文报价单，包含公司 Logo、产品明细、付款条件、签名栏，一键发给客户。',
                points: ['Quotation & Proforma Invoice 两种格式', '自动带入公司 Logo 和信息', '支持一键下载 PDF'],
              },
              {
                icon: Package,
                color: 'bg-purple-600',
                title: '产品库管理',
                desc: '把产品成本价存入产品库，报价时直接选择，无需每次重新输入。支持 Excel 批量导入。',
                points: ['产品成本一次录入，反复使用', 'Excel/CSV 批量导入', '分类筛选，快速检索'],
              },
              {
                icon: Users,
                color: 'bg-orange-500',
                title: '客户跟进 CRM',
                desc: '每次报价自动关联客户，随时查看给每个客户的历史报价记录。状态追踪从新客到成交全覆盖。',
                points: ['报价记录自动关联客户', '客户状态追踪（询价→成交）', '备注和跟进记录'],
              },
            ].map((f, i) => (
              <div key={i} className="border border-gray-200 rounded-2xl p-7 hover:shadow-md transition-shadow">
                <div className={`w-11 h-11 ${f.color} rounded-xl flex items-center justify-center mb-4`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm mb-4 leading-relaxed">{f.desc}</p>
                <ul className="space-y-1.5">
                  {f.points.map((p, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-12">三步完成一次报价</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: '输入成本', desc: '填入产品成本和运费，选择目标货币' },
              { step: '02', title: '一键计算', desc: '自动算出所有贸易术语的报价结果' },
              { step: '03', title: '生成 PDF', desc: '选择客户，填写信息，下载专业报价单' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-lg font-bold mb-3">
                  {s.step}
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{s.title}</h4>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            现在就开始，完全免费
          </h2>
          <p className="text-gray-500 mb-8">注册后即可使用所有功能，无需绑定信用卡</p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-xl text-base transition-colors"
          >
            免费注册 LeadSpark
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-semibold text-gray-700">LeadSpark</span>
          </div>
          <p className="text-sm text-gray-400">SOHO 外贸人的 AI 报价助理</p>
          <div className="flex gap-4 text-sm text-gray-400">
            <Link href="/login" className="hover:text-gray-600">登录</Link>
            <Link href="/signup" className="hover:text-gray-600">注册</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
