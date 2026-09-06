<template>
  <view class="page-container misc-page">
    <scroll-view class="misc-content" scroll-y>
      <view class="misc-inner">
        <!-- 月份筛选卡片 -->
        <view class="card filter-card">
          <view class="filter-top-row">
            <text class="section-label">记录月份</text>
            <view class="action-group">
              <view class="customer-copy-btn" @tap="openBatchAdd"><text class="customer-copy-btn-text">批量录入</text></view>
              <view class="customer-copy-btn" @tap="handleExport"><text class="customer-copy-btn-text">导出</text></view>
            </view>
          </view>
          <view class="month-picker-row">
            <view class="month-shift-btn" @tap="shiftMonth(-1)"><text>上一月</text></view>
            <picker class="month-filter-col filter-col" mode="selector" :range="availableMonths" :value="monthIndex" @change="onMonthChange">
              <view class="filter-picker"><text>{{ monthDisplayLabel }}</text><text class="picker-arrow">▼</text></view>
            </picker>
            <view class="month-shift-btn" :class="{ 'month-shift-btn-disabled': isNextMonthDisabled }" @tap="shiftMonth(1)"><text>下一月</text></view>
          </view>
        </view>

        <!-- 当月汇总 -->
        <view class="card summary-card">
          <view class="summary-header">
            <text class="summary-title">💰 {{ monthDisplayLabel }} 工资报销汇总</text>
            <text class="summary-count">{{ monthRecords.length }} 条</text>
          </view>
          <view class="summary-grid">
            <view class="summary-item summary-item-amber">
              <view class="summary-item-label">工资合计</view>
              <text class="summary-item-value">¥{{ formatMoney(sumByType('工资')) }}</text>
            </view>
            <view class="summary-item summary-item-expense">
              <view class="summary-item-label">报销合计</view>
              <text class="summary-item-value text-receivable-dark">¥{{ formatMoney(sumByType('报销')) }}</text>
            </view>
          </view>
        </view>

        <!-- 记录明细 -->
        <text class="section-title">{{ monthDisplayLabel }} 记录明细</text>

        <view v-if="shownRecords.length === 0" class="empty-state">
          <text class="empty-icon">📄</text>
          <text>本月暂无记录</text>
        </view>

        <!-- 当前选中类型的列表 -->
        <view v-for="rec in shownRecords" :key="rec.id" class="misc-item" @tap="openEdit(rec)">
          <view class="misc-item-header">
            <text class="misc-type" :class="rec.type === '报销' ? 'misc-type-0' : 'misc-type-1'">{{ rec.type }}</text>
            <text class="misc-name">{{ rec.name }}</text>
            <text class="misc-amount" :class="rec.type === '报销' ? 'text-receivable-dark' : ''">¥{{ formatMoney(rec.amount) }}</text>
          </view>
          <text v-if="rec.desc" class="misc-desc">{{ rec.desc }}</text>
        </view>
        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

    <!-- 编辑弹窗 -->
    <view v-if="showModal" class="editor-mask" @tap="closeModal" @touchmove.stop.prevent>
      <view class="editor-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">{{ editingId ? '编辑记录' : '新增记录' }}</text>
            <text class="editor-subtitle">{{ monthDisplayLabel }} · 工资 / 报销</text>
          </view>
          <text class="editor-close" @tap="closeModal">关闭</text>
        </view>
        <scroll-view class="editor-body" scroll-y @touchmove.stop>
          <view v-if="!editingId" class="type-picker-row">
            <view v-for="t in typeOptions" :key="t" class="type-chip" :class="[form.type === t ? 'type-chip-on type-chip-on-' + (t === '报销' ? '0' : '1') : '']" @tap="form.type = t">
              <text>{{ t }}</text>
            </view>
          </view>
          <view class="editor-grid">
            <view class="editor-field editor-field-full">
              <text class="editor-label">姓名</text>
              <uni-easyinput class="editor-input" type="text" v-model="form.name" :inputBorder="false" placeholder="谁报销 / 谁工资" />
            </view>
            <view v-if="form.type === '报销'" class="editor-field editor-field-full">
              <text class="editor-label">报销内容</text>
              <uni-easyinput class="editor-input" type="text" v-model="form.desc" :inputBorder="false" placeholder="事项内容，如：买 1 个气阀 100 元" />
            </view>
            <view v-if="form.type === '报销' && editingId" class="editor-field editor-field-full">
              <text class="editor-label">金额（元）</text>
              <uni-easyinput class="editor-input" type="digit" v-model="form.amount" :inputBorder="false" placeholder="如：100" />
            </view>
            <view v-else-if="form.type === '工资'" class="editor-field editor-field-full">
              <text class="editor-label">工资说明</text>
              <uni-easyinput class="editor-input" type="text" v-model="form.desc" :inputBorder="false" placeholder="选填，如：8 月工资" />
            </view>
            <view v-if="form.type === '工资'" class="editor-field editor-field-full">
              <text class="editor-label">工资金额（元）</text>
              <uni-easyinput class="editor-input" type="digit" v-model="form.amount" :inputBorder="false" placeholder="如：5000" />
            </view>
          </view>
          <!-- 记录月份：编辑时可改，新增默认当前月 -->
          <view class="editor-field editor-field-full">
            <text class="editor-label">记录月份</text>
            <picker class="editor-month-picker" mode="selector" :range="availableMonths" :value="editMonthIndex" @change="onEditMonthChange">
              <view class="editor-month-display"><text>{{ form.month }}</text><text class="picker-arrow">▼</text></view>
            </picker>
          </view>
        </scroll-view>
        <view class="editor-footer">
          <button v-if="editingId" class="editor-delete-btn" @tap="confirmDelete">删除</button>
          <button class="editor-save-btn" @tap="saveRecord">{{ editingId ? '保存修改' : '添加记录' }}</button>
        </view>
      </view>
    </view>

    <!-- 批量录入弹窗 -->
    <view v-if="showBatchModal" class="editor-mask" @tap="closeBatch" @touchmove.stop.prevent>
      <view class="editor-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">批量录入{{ batchType }}</text>
            <text class="editor-subtitle">{{ monthDisplayLabel }} · 参照订单批量录入</text>
          </view>
          <text class="editor-close" @tap="closeBatch">关闭</text>
        </view>

        <scroll-view class="batch-modal-body" scroll-y @touchmove.stop>
          <!-- 类型切换 -->
          <view class="type-picker-row">
            <view v-for="(t, ti) in typeOptions" :key="t" class="type-chip" :class="[batchType === t ? 'type-chip-on type-chip-on-' + ti : '']" @tap="switchBatchType(t)">
              <text>{{ t }}</text>
            </view>
          </view>

          <view v-if="batchError" class="error-banner"><text>{{ batchError }}</text></view>

          <!-- 报销：姓名统一；工资：每行带姓名 -->
          <view v-if="batchType === '报销'" class="parse-field">
            <text class="parse-field-label">姓名（本批统一）</text>
            <uni-easyinput class="parse-name-input" type="text" v-model="batchName" :inputBorder="false" placeholder="谁报销" />
          </view>

          <!-- 解析输入卡片 -->
          <view class="card parse-card">
            <text class="parse-label">{{ batchType === '报销' ? '批量报销解析' : '批量工资解析' }}</text>
            <textarea class="parse-textarea" :rows="6" maxlength="-1" v-model="batchText"
              :placeholder="batchType === '报销'
                ? '买 1 个气阀 100 元\n1 个电风扇 150 元\n买螺丝 20 元\n买 3 个气缸 100 元'
                : '张三 5200\n李四 5500\n王五 6380'" placeholder-class="input-placeholder" />
            <view class="parse-btns">
              <button class="parse-btn" @tap="parseBatch">开始智能解析</button>
              <button class="parse-clear" @tap="batchText = ''">清空</button>
            </view>
          </view>

          <!-- 解析结果 -->
          <view v-if="batchItems.length > 0" class="result-stack">
            <view class="card result-card">
              <text class="result-title">解析数据 · 共 {{ batchItems.length }} 条</text>
              <view v-for="item in batchItems" :key="item.id" class="result-row">
                <view class="result-main">
                  <view class="result-preview-wrap">
                    <text class="result-preview-line" :class="isBatchItemDuplicate(item.id) ? 'result-preview-line-duplicate' : 'result-preview-line-unique'">{{ formatBatchPreviewLine(item) }}</text>
                  </view>
                  <text v-if="isBatchItemDuplicate(item.id)" class="batch-dup-hint">{{ isBatchItemDuplicate(item.id, 'duplicateInBatch') ? '本次重复，已禁止' : '本月已存在，已禁止' }}</text>
                </view>
                <view class="result-delete-btn" @tap="removeBatchItem(item.id)">删除</view>
              </view>
              <view v-if="duplicateBatchItems.length > 0" class="batch-dup-summary">检测到 {{ duplicateBatchItems.length }} 条重复，已禁止录入</view>
              <button class="result-submit-btn" :class="{ 'btn-disabled': submittableBatchItems.length === 0 }" :disabled="submittableBatchItems.length === 0" @tap="submitBatch">提交这 {{ submittableBatchItems.length }} 条{{ batchType }}</button>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { formatMoney } from '../../common/utils.js'
import { exportExcelWorkbook, showExcelPreviewShareActions } from '../../common/export-excel.js'

const STORAGE_KEY = 'misc_records_v2'
// 记住上次录入的人名，下次新增默认沿用
const LAST_NAME_KEY = 'misc_last_person'
// 记住上次选择的月份
const SELECTED_MONTH_KEY = 'misc_selected_month'

const readSelectedMonth = () => {
  try {
    const saved = String(uni.getStorageSync(SELECTED_MONTH_KEY) || '').trim()
    if (/^\d{4}-\d{2}$/.test(saved)) return saved
    return ''
  } catch (error) {
    return ''
  }
}

const readLastName = () => {
  try {
    return String(uni.getStorageSync(LAST_NAME_KEY) || '').trim()
  } catch (error) {
    return ''
  }
}

const typeOptions = ['工资', '报销']

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const readRecords = () => {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}

const records = ref(readRecords())
// 默认上次选中的月份，无缓存则当前月
const selectedMonth = ref(readSelectedMonth() || currentMonth())
const showModal = ref(false)
const editingId = ref('')
const form = ref({ type: '报销', name: '', desc: '', amount: '', month: '' })

const availableMonths = computed(() => {
  const list = []
  const cur = new Date()
  for (let y = 2024; y <= cur.getFullYear(); y += 1) {
    const maxM = y === cur.getFullYear() ? cur.getMonth() + 1 : 12
    for (let m = 1; m <= maxM; m += 1) {
      list.push(`${y}-${String(m).padStart(2, '0')}`)
    }
  }
  return list.reverse()
})

const monthIndex = computed(() => Math.max(0, availableMonths.value.indexOf(selectedMonth.value)))
const monthDisplayLabel = computed(() => `${selectedMonth.value.replace('-', '年')}月`)
const monthShort = computed(() => `${Number(selectedMonth.value.split('-')[1])}月份`)
const isNextMonthDisabled = computed(() => selectedMonth.value >= currentMonth())

const monthRecords = computed(() => {
  return records.value
    .filter(r => String(r.month || '').substring(0, 7) === selectedMonth.value)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh'))
})

const groupByType = (type) => monthRecords.value.filter(r => r.type === type)

// 当月全部记录（工资+报销，按姓名排序）
const shownRecords = computed(() => monthRecords.value)

const sumByType = (type) => monthRecords.value
  .filter(r => r.type === type)
  .reduce((s, r) => s + (Number(r.amount) || 0), 0)

const persistSelectedMonth = (month) => {
  try {
    uni.setStorageSync(SELECTED_MONTH_KEY, month || '')
  } catch (error) {
    // 忽略
  }
}

const onMonthChange = (e) => {
  selectedMonth.value = availableMonths.value[e.detail.value]
  persistSelectedMonth(selectedMonth.value)
}

const shiftMonth = (offset) => {
  if (offset > 0 && isNextMonthDisabled.value) return
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const d = new Date(y, m - 1 + offset, 1)
  const target = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (availableMonths.value.includes(target)) {
    selectedMonth.value = target
    persistSelectedMonth(target)
  }
}

const openAdd = () => {
  editingId.value = ''
  // 默认沿用上次录入的人名；月份默认当前选中的月份
  form.value = { type: '工资', name: readLastName(), desc: '', amount: '', month: selectedMonth.value }
  showModal.value = true
}

const openEdit = (rec) => {
  editingId.value = rec.id
  form.value = {
    type: rec.type,
    name: rec.name || '',
    desc: rec.desc || '',
    amount: String(rec.amount),
    month: String(rec.month || '').substring(0, 7) || selectedMonth.value
  }
  showModal.value = true
}

// 编辑弹窗月份选择
const editMonthIndex = computed(() => Math.max(0, availableMonths.value.indexOf(form.value.month)))
const onEditMonthChange = (e) => {
  form.value.month = availableMonths.value[e.detail.value]
}

const closeModal = () => {
  showModal.value = false
  editingId.value = ''
}

const persist = () => {
  uni.setStorageSync(STORAGE_KEY, JSON.stringify(records.value))
}

// 从整段文字里提取金额（总价）：优先 "数字元"，其次行尾数字
const extractAmountFromText = (text) => {
  const str = String(text || '')
  // 匹配 "xx元 / xx块钱 / xx元整" 这类明确金额
  const withUnit = str.match(/(\d+(?:\.\d+)?)\s*(?:元|块钱|元整)/)
  if (withUnit) return Number(withUnit[1])
  // 行尾数字（如 "... 100"）
  const tail = str.match(/(\d+(?:\.\d+)?)\s*$/)
  if (tail) return Number(tail[1])
  return null
}

const saveRecord = () => {
  const type = form.value.type
  const name = String(form.value.name || '').trim()
  const desc = String(form.value.desc || '').trim()
  // 报销：新增时金额从内容文字自动提取；编辑时用独立金额框（可修改）
  // 工资：金额用输入的金额框
  const original = editingId.value ? records.value.find(r => r.id === editingId.value) : null
  const amount = type === '报销'
    ? (original ? Number(form.value.amount) : extractAmountFromText(desc))
    : Number(form.value.amount)
  if (!name) {
    uni.showToast({ title: '请填写姓名', icon: 'none' })
    return
  }
  if (type === '报销' && !original && !desc) {
    uni.showToast({ title: '请填写报销内容（含金额）', icon: 'none' })
    return
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    uni.showToast({ title: type === '报销' ? '报销内容里找不到金额，如：电风扇 150 元' : '请填写工资金额', icon: 'none' })
    return
  }
  // 记住本次人名，下次新增默认沿用
  uni.setStorageSync(LAST_NAME_KEY, name)
  // 月份：新增默认当前选中月；编辑时用弹窗里选的月份（可改）
  const month = String(form.value.month || '').substring(0, 7) || selectedMonth.value
  const payload = { type, name, month, desc, amount }
  // 保存后切到该月查看，并记忆
  selectedMonth.value = month
  persistSelectedMonth(month)
  if (editingId.value) {
    records.value = records.value.map(r => (r.id === editingId.value ? { ...r, ...payload } : r))
  } else {
    records.value = [{ id: `misc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...payload }, ...records.value]
  }
  persist()
  closeModal()
}

// ---------- 批量录入 ----------
const showBatchModal = ref(false)
const batchType = ref('报销')
const batchName = ref('')
const batchText = ref('')
const batchItems = ref([])
const batchError = ref('')

// 归一化物品描述：去掉数量/量词/购买词/空格/金额单位，只留物品核心词
// 例如 "买 1 个气阀 100 元" → "气阀"；"1个电风扇 150" → "电风扇"
const normalizeItem = (desc) => String(desc || '')
  .replace(/(\d+(?:\.\d+)?)\s*(?:个|只|台|根|条|张|瓶|斤|件|支|桶)/g, '')   // 数量+量词
  .replace(/(\d+(?:\.\d+)?)\s*(?:元|块钱|元整)?/g, '')                        // 金额
  .replace(/\s+/g, '')                                                          // 空格
  .replace(/^买|^购买|^购入|^购置|^采购/g, '')                                  // 购买词
  .trim()

// 重复判定（更智能）：
// - 报销：同月 + 同人 + 物品核心词相同 + 金额相同 → 重复
// - 工资：同月 + 同人 + 金额相同 → 重复（每人每月只录一次）
const buildBatchDedupKey = (type, month, name, desc, amount) => {
  const parts = [
    String(type || '').trim(),
    String(month || '').trim(),
    String(name || '').trim(),
    Number(amount) || 0
  ]
  if (type === '报销') parts.push(normalizeItem(desc))
  return parts.join('|')
}

// 本月已有记录的去重 key 集合
const existingRecordKeySet = computed(() => new Set(
  records.value
    .filter(r => String(r.month || '').substring(0, 7) === selectedMonth.value)
    .map(r => buildBatchDedupKey(r.type, r.month, r.name, r.desc, r.amount))
))

const batchItemDuplicateInfo = computed(() => {
  const countMap = new Map()
  batchItems.value.forEach(item => {
    const key = buildBatchDedupKey(item.type, item.month, item.name, item.desc, item.amount)
    countMap.set(key, (countMap.get(key) || 0) + 1)
  })
  return batchItems.value.reduce((acc, item) => {
    const key = buildBatchDedupKey(item.type, item.month, item.name, item.desc, item.amount)
    acc[item.id] = {
      duplicateInBatch: (countMap.get(key) || 0) > 1,
      duplicateInDatabase: existingRecordKeySet.value.has(key)
    }
    return acc
  }, {})
})

const isBatchItemDuplicate = (id, field) => {
  const info = batchItemDuplicateInfo.value[id]
  if (!info) return false
  if (field) return !!info[field]
  return !!info.duplicateInBatch || !!info.duplicateInDatabase
}

const duplicateBatchItems = computed(() => batchItems.value.filter(item => isBatchItemDuplicate(item.id)))
const submittableBatchItems = computed(() => batchItems.value.filter(item => !isBatchItemDuplicate(item.id)))

const openBatchAdd = () => {
  batchType.value = '报销'
  // 姓名默认沿用上次，不用每行都填
  batchName.value = readLastName()
  batchText.value = ''
  batchItems.value = []
  batchError.value = ''
  showBatchModal.value = true
}

const closeBatch = () => {
  showBatchModal.value = false
  batchItems.value = []
  batchError.value = ''
}

// 切换类型：清空已解析内容和输入
const switchBatchType = (type) => {
  if (batchType.value === type) return
  batchType.value = type
  batchText.value = ''
  batchItems.value = []
  batchError.value = ''
}

// 去掉文本末尾的金额片段，得到纯内容描述
const stripAmountText = (text) => String(text || '')
  .replace(/(\d+(?:\.\d+)?)\s*(?:元|块钱|元整)\s*$/, '')
  .replace(/(\d+(?:\.\d+)?)\s*$/, '')
  .trim()

const parseBatch = () => {
  batchError.value = ''
  batchItems.value = []
  const isReimburse = batchType.value === '报销'
  const source = String(batchText.value || '').trim()
  if (!source) {
    batchError.value = '请输入要批量录入的内容'
    return
  }
  // 报销：姓名取姓名框，每行只需写事项+金额；没填姓名直接提示
  if (isReimburse && !String(batchName.value || '').trim()) {
    batchError.value = '请先在上方填写姓名'
    return
  }
  const lines = source.split('\n').map(l => l.trim()).filter(Boolean)
  const parsed = []
  let invalidLine = 0
  lines.forEach((line, index) => {
    // 报销：姓名统一取姓名框，每行只写东西和金额
    // 工资：每行自带姓名 + 金额（如 张三 5200）
    let name = ''
    let amountText = line
    let desc = ''
    if (isReimburse) {
      name = String(batchName.value || '').trim()
    } else {
      const m = line.match(/^([^\s\d]+)\s+(.+)$/)
      if (m) {
        name = m[1].trim()
        amountText = m[2].trim()
      }
    }
    const amount = extractAmountFromText(amountText || line)
    if (!name) {
      batchError.value = `第 ${index + 1} 行缺少姓名`
      invalidLine = invalidLine || (index + 1)
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      invalidLine = invalidLine || (index + 1)
      return
    }
    if (isReimburse) desc = stripAmountText(line)
    parsed.push({
      id: `batch-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      type: batchType.value,
      month: selectedMonth.value,
      name,
      desc,
      amount: Number(amount)
    })
  })
  if (invalidLine && !batchError.value) {
    batchError.value = `第 ${invalidLine} 行解析失败，报销请写：买 1 个气阀 100 元；工资请写：张三 5200`
  }
  batchItems.value = parsed
  if (parsed.length > 0 && duplicateBatchItems.value.length > 0) {
    uni.showToast({ title: `检测到 ${duplicateBatchItems.value.length} 条重复，已禁止录入`, icon: 'none' })
  }
}

// 预览行文案：报销显示 姓名 东西 金额；工资显示 姓名 金额
const formatBatchPreviewLine = (item) => {
  if (item.type === '工资') return `${item.name || ''} ${Math.round((Number(item.amount) || 0) * 100) / 100}元`
  const descText = String(item.desc || '').trim()
  const alreadyHasAmount = /元|块钱/.test(descText) || /\d\s*$/.test(descText)
  return descText
    ? alreadyHasAmount ? `${item.name || ''} ${descText}` : `${item.name || ''} ${descText} ${Math.round((Number(item.amount) || 0) * 100) / 100}元`
    : `${item.name || ''} ${Math.round((Number(item.amount) || 0) * 100) / 100}元`
}

const removeBatchItem = (id) => {
  batchItems.value = batchItems.value.filter(item => item.id !== id)
}

const submitBatch = () => {
  const items = submittableBatchItems.value
  if (items.length === 0) {
    batchError.value = duplicateBatchItems.value.length > 0
      ? '全部为重复数据，没有可录入的记录'
      : '请先解析内容'
    return
  }
  const newRecords = items.map(item => ({
    id: `misc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: item.type,
    name: item.name,
    month: item.month,
    desc: item.desc,
    amount: item.amount
  }))
  records.value = [...newRecords, ...records.value]
  persist()
  if (newRecords[0]?.name) uni.setStorageSync(LAST_NAME_KEY, String(newRecords[0].name))
  const skipped = duplicateBatchItems.value.length
  batchText.value = ''
  batchItems.value = []
  batchError.value = ''
  uni.showToast({
    title: skipped > 0 ? `已录入 ${newRecords.length} 条，跳过重复 ${skipped} 条` : `已录入 ${newRecords.length} 条`,
    icon: 'none'
  })
  if (skipped === 0) closeBatch()
}

const confirmDelete = () => {
  uni.showModal({
    title: '删除记录',
    content: '确认删除这条记录吗？',
    success: ({ confirm }) => {
      if (!confirm) return
      records.value = records.value.filter(r => r.id !== editingId.value)
      persist()
      closeModal()
    }
  })
}

// 按姓名汇总
const sumByName = (list) => {
  const map = new Map()
  list.forEach(r => {
    const name = r.name || ''
    map.set(name, (map.get(name) || 0) + (Number(r.amount) || 0))
  })
  return [...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0], 'zh')))
}

// 列宽自动计算（参照其它导出）
const getCellDisplayLength = (cell) => {
  const value = cell && typeof cell === 'object' && !Array.isArray(cell) ? cell.value : cell
  const text = String(value ?? '')
  let length = 0
  for (const char of text) {
    length += /[\u0000-\u00ff]/.test(char) ? 1 : 2
  }
  return length
}
const calcAutoWidths = (rows, columnCount) => {
  return Array.from({ length: columnCount }, (_, col) => {
    const max = rows.reduce((m, row) => {
      const cells = Array.isArray(row) ? row : [row]
      return Math.max(m, getCellDisplayLength(cells[col] ?? ''))
    }, 0)
    return Math.max(max + 4, 10)
  })
}

// 单 sheet：先工资段，再报销段（不切 tab）
const buildCombinedSheetRows = () => {
  const reimburse = groupByType('报销')
  const salary = groupByType('工资')
  const rows = []
  const merges = []
  let rowIndex = 1 // 行号从 1 开始（标题占第 1 行）

  // 顶部大标题
  rows.push([{ value: `${monthShort.value} 工资报销记录`, style: 'title' }])
  merges.push({ start: `A${rowIndex}`, end: `C${rowIndex}` })
  rowIndex += 1
  rows.push(['', '', ''])
  rowIndex += 1

  // ===== 工资段 =====
  if (salary.length > 0) {
    const sTotal = salary.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    rows.push([{ value: `${monthShort.value} 工资`, style: 'header' }, '', ''])
    merges.push({ start: `A${rowIndex}`, end: `C${rowIndex}` })
    rowIndex += 1
    rows.push([{ value: `工资合计: ${Math.round(sTotal * 100) / 100} 元`, style: 'monthly' }, '', ''])
    merges.push({ start: `A${rowIndex}`, end: `C${rowIndex}` })
    rowIndex += 1
    rows.push([
      { value: '姓名', style: 'header' },
      { value: '事项', style: 'header' },
      { value: '金额(元)', style: 'header' }
    ])
    rowIndex += 1
    salary.forEach(rec => {
      rows.push([
        { value: rec.name || '', style: 'monthly' },
        '工资',
        { value: Number((Number(rec.amount) || 0).toFixed(2)), style: 'red' }
      ])
    })
    rowIndex += salary.length
    rows.push(['', '', ''])
    rowIndex += 1
  }

  // ===== 报销段 =====
  if (reimburse.length > 0) {
    const rTotal = reimburse.reduce((s, r) => s + (Number(r.amount) || 0), 0)
    // 段标题 + 总计（各合并整行）
    rows.push([{ value: `${monthShort.value} 报销`, style: 'header' }, '', ''])
    merges.push({ start: `A${rowIndex}`, end: `C${rowIndex}` })
    rowIndex += 1
    rows.push([{ value: `报销总计: ${Math.round(rTotal * 100) / 100} 元`, style: 'monthly' }, '', ''])
    merges.push({ start: `A${rowIndex}`, end: `C${rowIndex}` })
    rowIndex += 1
    // 表头
    rows.push([
      { value: '姓名', style: 'header' },
      { value: '事项', style: 'header' },
      { value: '金额(元)', style: 'header' }
    ])
    rowIndex += 1
    reimburse.forEach(rec => {
      // 报销：金额已有独立"金额(元)"列，事项列不再拼金额（并剥离存储里可能残留的金额文字）
      const itemText = stripAmountText(rec.desc)
      rows.push([
        { value: rec.name || '', style: 'monthly' },
        itemText || '—',
        { value: Number((Number(rec.amount) || 0).toFixed(2)), style: 'red' }
      ])
    })
    rowIndex += reimburse.length
  }

  const columnWidths = calcAutoWidths(rows, 3)
  return {
    rows,
    defaultRowHeight: 27,
    columnWidths,
    rowHeights: { 1: 32 },
    merges
  }
}

const handleExport = () => {
  if (monthRecords.value.length === 0) {
    uni.showToast({ title: '本月暂无记录', icon: 'none' })
    return
  }
  exportExcelWorkbook({
    fileName: `${selectedMonth.value} 工资报销`,
    sheets: [
      { name: '工资报销', ...buildCombinedSheetRows() }
    ]
  }).then(showExcelPreviewShareActions).catch(() => {})
}
</script>

<style lang="scss" scoped>
.misc-page { min-height: 100vh; background: linear-gradient(180deg, #f8fbfa 0%, #f2f6f9 100%); display: flex; flex-direction: column; }
.misc-content { flex: 1; }
.misc-inner { padding: 16px; }
.card { background: #fff; border-radius: 18px; border: 1px solid #e8eef5; box-shadow: 0 8px 22px rgba(15,23,42,0.04); }

.filter-card { padding: 14px; margin-bottom: 16px; }
.filter-top-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.section-label { font-size: 10px; font-weight: 700; color: #64748b; }
.action-group { display: flex; align-items: center; gap: 8px; }
.customer-copy-btn { display: flex; align-items: center; justify-content: center; padding: 7px 12px; background: #f8fafc; border: 1px solid #dbe4ee; border-radius: 12px; }
.customer-copy-btn-text { font-size: 11px; font-weight: 700; color: #334155; line-height: 1; }
.month-picker-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 72px; gap: 8px; align-items: center; width: 100%; margin-top: 12px; }
.month-filter-col { min-width: 0; }
.filter-col { min-width: 0; }
.filter-picker {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 8px 10px; background: #f8fafc; border: 1px solid #dbe4ee;
  border-radius: 14px; font-size: 12px; font-weight: 700; color: #1e293b; box-sizing: border-box; box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
}
.picker-arrow { font-size: 8px; color: #94a3b8; }
.month-shift-btn {
  height: 34px; display: flex; align-items: center; justify-content: center;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  font-size: 11px; font-weight: 700; color: #334155; box-shadow: 0 6px 16px rgba(15,23,42,.04);
}
.month-shift-btn-disabled { opacity: 0.45; }

.summary-card { padding: 18px; margin-bottom: 16px; }
.summary-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 12px; }
.summary-title { font-size: 14px; font-weight: 700; color: #1e293b; }
.summary-count { font-size: 10px; font-weight: 700; color: #94a3b8; background: #f8fafc; padding: 2px 8px; border-radius: 6px; border: 1px solid #f1f5f9; font-family: monospace; }
.summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.summary-item { padding: 11px 6px; border-radius: 14px; text-align: center; display: flex; flex-direction: column; gap: 3px; box-shadow: 0 4px 14px rgba(15,23,42,0.03); }
.summary-item-expense { background: rgba(254,242,242,0.6); border: 1px solid rgba(254,202,202,0.6); }
.summary-item-amber { background: rgba(255,251,235,0.5); border: 1px solid rgba(253,230,138,0.6); }
.summary-item-label { font-size: 8px; font-weight: 700; color: #94a3b8; line-height: 1.2; }
.summary-item-value { font-size: 13px; font-weight: 900; color: #1e293b; font-family: monospace; }
.text-receivable-dark { color: #b91c1c; }

.section-title { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 4px; margin-bottom: 8px; display: block; }
.empty-state { text-align: center; padding: 32px; font-size: 12px; color: #94a3b8; }
.empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }

.misc-type { font-size: 9px; font-weight: 800; color: #fff; border-radius: 6px; padding: 2px 8px; flex-shrink: 0; }
.misc-type-0 { background: #7c3aed; }
.misc-type-1 { background: #ea580c; }

.misc-item { background: #fff; border-radius: 14px; border: 1px solid #e8eef5; box-shadow: 0 6px 16px rgba(15,23,42,0.03); padding: 12px; margin-bottom: 8px; }
.misc-item-header { display: flex; align-items: center; gap: 8px; }
.misc-name { font-size: 13px; font-weight: 800; color: #0f172a; }
.misc-amount { margin-left: auto; font-size: 14px; font-weight: 900; font-family: monospace; flex-shrink: 0; }
.misc-desc { display: block; margin-top: 6px; font-size: 12px; color: #475569; word-break: break-all; }
.safe-bottom { height: 32px; }

.editor-mask { position: fixed; inset: 0; background: rgba(15,23,42,.52); z-index: 120; display: flex; align-items: flex-start; justify-content: center; padding: 20px 20px 24px; box-sizing: border-box; }
.editor-modal { width: 100%; max-width: 560px; max-height: calc(100vh - 64px); background: #fff; border-radius: 24px; padding: 18px 16px 16px; border: 1px solid rgba(226,232,240,.9); box-shadow: 0 24px 60px rgba(15,23,42,.24); box-sizing: border-box; display: flex; flex-direction: column; }
.editor-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 14px; gap: 12px; }
.editor-title { display: block; font-size: 16px; font-weight: 800; color: #0f172a; }
.editor-subtitle { display: block; font-size: 10px; color: #94a3b8; margin-top: 4px; }
.editor-close { font-size: 11px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 7px 12px; border-radius: 999px; flex-shrink: 0; }
.editor-body { max-height: calc(100vh - 220px); }
.type-picker-row { display: flex; gap: 8px; margin-bottom: 14px; }
.type-chip { flex: 1; text-align: center; padding: 8px 0; background: #f1f5f9; border-radius: 12px; font-size: 12px; font-weight: 700; color: #64748b; border: 1px solid transparent; }
.type-chip-on { color: #fff; }
.type-chip-on-0 { background: #7c3aed; }
.type-chip-on-1 { background: #ea580c; }
.editor-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.editor-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.editor-field-full { grid-column: 1 / -1; }
.editor-label { font-size: 10px; font-weight: 700; color: #64748b; }
.editor-month-picker { width: 100%; }
.editor-month-display { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 13px; font-weight: 700; color: #1e293b; box-shadow: 0 6px 16px rgba(15,23,42,.04); }
.editor-month-display .picker-arrow { font-size: 8px; color: #94a3b8; }
.editor-input { width: 100%; }
.editor-input .uni-easyinput__content { border: 1px solid #dbe4ee; border-radius: 14px; background: #eee; }
.editor-input .uni-easyinput__content-input { font-size: 13px; color: #1e293b; }
.editor-footer { display: flex; gap: 10px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
.editor-delete-btn { flex: 1; height: 44px; line-height: 44px; font-size: 13px; font-weight: 800; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 0; }
.editor-save-btn { flex: 2; height: 44px; line-height: 44px; font-size: 14px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #0f766e, #10b981); border-radius: 16px; padding: 0; box-shadow: 0 10px 20px rgba(16,185,129,.16); }

/* 批量录入：完全参照批量录入订单(batch-order-add)样式 */
.batch-modal-body { max-height: calc(100vh - 160px); box-sizing: border-box; }
.error-banner { padding: 12px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; font-size: 12px; color: #dc2626; margin-bottom: 12px; }
.parse-field { margin-bottom: 10px; }
.parse-field-label { display: block; font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 5px; }
.parse-name-input { width: 100%; }
.parse-name-input .uni-easyinput__content { border: 1px solid #dbe4ee; border-radius: 14px; background: #eee; }
.parse-name-input .uni-easyinput__content-input { font-size: 13px; color: #1e293b; }
.parse-card { padding: 18px; background: #fff; border-color: #e8eef5; min-width: 0; overflow: hidden; margin-bottom: 12px; }
.parse-label { display: block; font-size: 12px; font-weight: 800; color: #1e293b; margin-bottom: 10px; }
.parse-textarea { display: block; width: calc(100% - 30px); max-width: calc(100% - 30px); height: 140px; padding: 14px; background: #eee; border: 1px solid #dbe4ee; border-radius: 14px; font-size: 12px; font-family: monospace; color: #334155; line-height: 1.6; }
.parse-btns { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
.parse-btn { flex: 1; height: 38px; line-height: 38px; background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; border-radius: 12px; font-size: 12px; font-weight: 800; box-shadow: 0 8px 16px rgba(16,185,129,.14); padding: 0; }
.parse-clear { height: 38px; line-height: 38px; padding: 0 16px; background: #eef2f7; border: none; color: #64748b; border-radius: 18px; font-size: 11px; font-weight: 700; box-shadow: none; }

.result-stack { display: flex; flex-direction: column; gap: 12px; }
.result-card { padding: 16px; }
.result-title { display: block; font-size: 12px; font-weight: 800; color: #1e293b; margin-bottom: 10px; }
.result-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
.result-main { flex: 1; min-width: 0; }
.result-preview-wrap { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.result-preview-line { display: block; flex: 1; min-width: 0; font-size: 14px; font-weight: 800; word-break: break-all; }
.result-preview-line-duplicate { color: #dc2626; }
.result-preview-line-unique { color: #16a34a; }
.result-delete-btn { flex-shrink: 0; padding: 6px 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; font-size: 12px; font-weight: 800; color: #dc2626; }
.result-submit-btn { width: 100%; height: 46px; margin-top: 14px; background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; border-radius: 16px; font-size: 13px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px rgba(16,185,129,.16); }
.btn-disabled { opacity: .5; }
.batch-dup-hint { display: block; margin-top: 4px; font-size: 11px; font-weight: 800; color: #dc2626; }
.batch-dup-summary { display: block; font-size: 11px; font-weight: 700; color: #dc2626; margin-top: 6px; }
</style>
