import { useEffect, useState } from 'react'
import { Cookie, Bot, FileText, Filter, QrCode, UserCog } from 'lucide-react'
import { getPrompts, updatePrompt, getEnvConfig, updateEnvConfig, testAiConnection } from '@/api/config'
import QrLoginModal from '@/components/QrLoginModal'

type Tab = 'cookie' | 'ai' | 'prompts' | 'filter'
interface Prompt { name: string; content: string }
interface EnvConfig { API_KEY: string; MODEL_BASE_URL: string; MODEL_NAME: string; COOKIES_STR: string; SKIP_KEYWORDS: string; GLOBAL_MANUAL_MODE: string }

const PROMPT_LABELS: Record<string, string> = {
  classify_prompt: '意图分类',
  price_prompt: '议价策略',
  tech_prompt: '技术支持',
  default_prompt: '通用回复',
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('cookie')
  const [env, setEnv] = useState<EnvConfig>({ API_KEY: '', MODEL_BASE_URL: '', MODEL_NAME: '', COOKIES_STR: '', SKIP_KEYWORDS: '', GLOBAL_MANUAL_MODE: 'false' })
  const [cookieInput, setCookieInput] = useState('')
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null)
  const [promptEditing, setPromptEditing] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [showQr, setShowQr] = useState(false)
  const [aiTesting, setAiTesting] = useState(false)
  const [savingGlobal, setSavingGlobal] = useState(false)

  useEffect(() => {
    getEnvConfig().then((data) => { setEnv(data); setCookieInput(data.COOKIES_STR) }).catch(() => {})
    getPrompts().then((data) => {
      setPrompts(data)
      if (data.length > 0) { setSelectedPrompt(data[0]); setPromptEditing(data[0].content) }
    })
  }, [])

  const showMsg = (msg: string, type: 'success' | 'error' = 'success') => {
    setMessage(msg); setMsgType(type); setTimeout(() => setMessage(''), type === 'error' ? 8000 : 5000)
  }

  const handleSaveCookie = async () => {
    setSaving(true)
    try {
      await updateEnvConfig({ COOKIES_STR: cookieInput })
      showMsg('Cookie 已保存，服务正在重载')
      const fresh = await getEnvConfig()
      setEnv(fresh); setCookieInput(fresh.COOKIES_STR)
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAi = async () => {
    setSaving(true)
    try {
      await updateEnvConfig({ API_KEY: env.API_KEY, MODEL_BASE_URL: env.MODEL_BASE_URL, MODEL_NAME: env.MODEL_NAME })
      showMsg('AI 配置已保存，服务正在重载')
      const fresh = await getEnvConfig()
      setEnv(fresh)
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTestAi = async () => {
    setAiTesting(true)
    const res = await testAiConnection({ api_key: env.API_KEY, base_url: env.MODEL_BASE_URL, model: env.MODEL_NAME })
    if (res.success) showMsg(`连接成功: ${res.reply}`)
    else showMsg(`连接失败: ${res.error}`, 'error')
    setAiTesting(false)
  }

  const handleSavePrompt = async () => {
    if (!selectedPrompt) return
    setSaving(true)
    try {
      await updatePrompt(selectedPrompt.name, promptEditing)
      setPrompts((prev) => prev.map((p) => (p.name === selectedPrompt.name ? { ...p, content: promptEditing } : p)))
      showMsg('提示词已保存')
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveFilter = async () => {
    setSaving(true)
    try {
      await updateEnvConfig({ SKIP_KEYWORDS: env.SKIP_KEYWORDS })
      showMsg('过滤词已保存，服务正在重载')
      const fresh = await getEnvConfig()
      setEnv(fresh)
    } catch (e: any) {
      showMsg(e?.response?.data?.detail || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleGlobalManual = async () => {
    const next = env.GLOBAL_MANUAL_MODE === 'true' ? 'false' : 'true'
    // 乐观更新开关，失败再回滚，避免热重载往返期间界面卡顿
    setEnv((prev) => ({ ...prev, GLOBAL_MANUAL_MODE: next }))
    setSavingGlobal(true)
    try {
      await updateEnvConfig({ GLOBAL_MANUAL_MODE: next })
      showMsg(next === 'true' ? '已开启全局人工模式，AI 将暂停自动回复' : '已关闭全局人工模式，AI 恢复自动回复')
    } catch (e: any) {
      setEnv((prev) => ({ ...prev, GLOBAL_MANUAL_MODE: next === 'true' ? 'false' : 'true' }))
      showMsg(e?.response?.data?.detail || '切换失败', 'error')
    } finally {
      setSavingGlobal(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: typeof Cookie }[] = [
    { key: 'cookie', label: 'Cookie 设置', icon: Cookie },
    { key: 'ai', label: 'AI 配置', icon: Bot },
    { key: 'prompts', label: '提示词编辑', icon: FileText },
    { key: 'filter', label: '消息过滤', icon: Filter },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-50">设置</h2>
        <p className="text-sm text-dark-400 mt-1">配置闲鱼登录、AI 模型、提示词与过滤规则</p>
      </div>

      {/* 全局人工回复开关：开启后所有会话暂停 AI 自动回复，买家消息仍入库供人工处理 */}
      {(() => {
        const on = env.GLOBAL_MANUAL_MODE === 'true'
        return (
          <div className={`card card-body flex items-center gap-4 ${on ? 'border-amber-500/40 bg-amber-500/5' : ''}`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${on ? 'bg-amber-500/15 text-amber-300' : 'bg-dark-800 text-dark-300'}`}>
              <UserCog size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-100">全局人工回复</div>
              <p className="text-xs text-dark-400 mt-0.5">
                {on
                  ? '已开启：暂停 AI 自动回复，买家消息仍会记录，请在对话中手动回复；已配「默认回复」的商品仍会自动发送。'
                  : '关闭中：AI 正常自动回复。开启后仅暂停 AI，商品的「默认回复」不受影响。'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              disabled={savingGlobal}
              onClick={handleToggleGlobalManual}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-amber-500' : 'bg-dark-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        )
      })()}

      {message && (
        <div className={`rounded-xl px-4 py-2.5 text-sm border ${msgType === 'error' ? 'bg-red-500/10 text-red-300 border-red-500/30' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="card !p-1.5 inline-flex flex-wrap gap-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm transition-all ${
              tab === key ? 'bg-primary-500/15 text-primary-300' : 'text-dark-300 hover:text-gray-100 hover:bg-dark-800'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Cookie */}
      {tab === 'cookie' && (
        <div className="card card-body space-y-4 max-w-3xl">
          <div>
            <label className="input-label">Cookie 字符串</label>
            <textarea
              value={cookieInput}
              onChange={(e) => setCookieInput(e.target.value)}
              rows={6}
              className="input font-mono resize-none"
              placeholder="浏览器 F12 → 网络/Application 取整段 Cookie 粘贴这里"
            />
            <p className="input-hint">保存后 websocket 会自动重连，无需重启容器</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSaveCookie} disabled={saving} className="btn btn-primary">
              {saving ? '保存中…' : '保存 Cookie'}
            </button>
            <button onClick={() => setShowQr(true)} className="btn btn-secondary">
              <QrCode size={16} />扫码登录
            </button>
          </div>
        </div>
      )}

      {/* AI */}
      {tab === 'ai' && (
        <div className="card card-body space-y-4 max-w-2xl">
          <div>
            <label className="input-label">API Key</label>
            <input value={env.API_KEY} onChange={(e) => setEnv({ ...env, API_KEY: e.target.value })} className="input" />
          </div>
          <div>
            <label className="input-label">Base URL</label>
            <input value={env.MODEL_BASE_URL} onChange={(e) => setEnv({ ...env, MODEL_BASE_URL: e.target.value })} className="input" />
            <p className="input-hint">OpenAI 兼容接口地址，如 https://dashscope.aliyuncs.com/compatible-mode/v1</p>
          </div>
          <div>
            <label className="input-label">模型名称</label>
            <input value={env.MODEL_NAME} onChange={(e) => setEnv({ ...env, MODEL_NAME: e.target.value })} className="input" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSaveAi} disabled={saving} className="btn btn-primary">
              {saving ? '保存中…' : '保存'}
            </button>
            <button onClick={handleTestAi} disabled={aiTesting} className="btn btn-secondary">
              {aiTesting ? '测试中…' : '测试连接'}
            </button>
          </div>
        </div>
      )}

      {/* Prompts */}
      {tab === 'prompts' && (
        <div className="card card-body">
          <div className="flex gap-4 h-[calc(100vh-20rem)] min-h-[400px]">
            <div className="w-48 space-y-1 border-r border-dark-700/60 pr-3">
              {prompts.map((p) => (
                <button
                  key={p.name}
                  onClick={() => { setSelectedPrompt(p); setPromptEditing(p.content) }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                    selectedPrompt?.name === p.name ? 'bg-primary-500/15 text-primary-300' : 'text-dark-300 hover:bg-dark-800 hover:text-gray-100'
                  }`}
                >
                  {PROMPT_LABELS[p.name] || p.name}
                </button>
              ))}
            </div>
            <div className="flex-1 flex flex-col">
              <textarea
                value={promptEditing}
                onChange={(e) => setPromptEditing(e.target.value)}
                className="input flex-1 font-mono resize-none"
              />
              <button onClick={handleSavePrompt} disabled={saving} className="btn btn-primary mt-3 self-end">
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      {tab === 'filter' && (
        <div className="card card-body space-y-4 max-w-3xl">
          <div>
            <label className="input-label">跳过关键词</label>
            <textarea
              value={env.SKIP_KEYWORDS}
              onChange={(e) => setEnv({ ...env, SKIP_KEYWORDS: e.target.value })}
              rows={6}
              className="input font-mono resize-none"
              placeholder="多个关键词用英文逗号分隔"
            />
            <p className="input-hint leading-relaxed">
              命中任一关键词（子串匹配）的买家消息将被直接忽略，不写入对话历史也不调用 AI。
              <br />常用：<span className="font-mono text-dark-300">快给ta一个评价吧,有蚂蚁森林能量可领</span>
            </p>
          </div>
          <button onClick={handleSaveFilter} disabled={saving} className="btn btn-primary">
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      )}

      {showQr && <QrLoginModal onClose={() => { setShowQr(false); getEnvConfig().then((d) => { setEnv(d); setCookieInput(d.COOKIES_STR) }) }} />}
    </div>
  )
}
