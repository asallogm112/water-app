<template>
  <view class="page-container batch-page">
    <scroll-view class="batch-content" :scroll-y="!showDuplicateModal && !showDatePicker">
      <view class="batch-inner">
        <view class="date-select">
          <view class="date-picker-row">
            <view class="date-shift-btn" @tap="shiftSelectedDate(-1)">
              <text>上一日</text>
            </view>
            <view class="date-picker" @tap="showDatePicker = true">
              <view class="date-picker-label-wrap">
                <view class="date-picker-label">{{ selectedDate }}</view>
              </view>
              <view class="date-picker-arrow">▼</view>
            </view>
            <view class="date-shift-btn" :class="{ 'date-shift-btn-disabled': isNextDayDisabled }" @tap="shiftSelectedDate(1)">
              <text>下一日</text>
            </view>
          </view>
        </view>

        <view v-if="success" class="success-banner">
          <text class="success-icon">✓</text>
          <view><text class="success-title">批量单录入成功！</text><text class="success-sub">已生成 {{ successCount }} 笔订单，正在跳转…</text></view>
        </view>
        <view v-if="error" class="error-banner"><text>{{ error }}</text></view>

        <!-- 文本解析 -->
        <view class="card parse-card">
          <text class="parse-label">批量订单解析</text>
          <textarea class="parse-textarea" :rows="5" maxlength="-1" v-model="inputText"
            placeholder="示例：老王 22 33 80 老李 22 44 老陈 33 55 99"
            placeholder-class="input-placeholder" />
          <view class="parse-btns">
            <button class="parse-btn" @tap="handleParse">开始智能解析</button>
            <button class="parse-clear" @tap="inputText = ''">清空</button>
          </view>
        </view>

        <view v-if="items.length > 0" class="result-stack">
          <view class="card result-card">
            <text class="result-title">解析数据{{ parsedDateDisplay ? ` ${parsedDateDisplay}` : '' }}</text>
            <view v-for="(item, idx) in sortedDisplayItems" :key="item.id || `parsed-${idx}`" class="result-row">
              <view class="result-main">
                <view class="result-preview-wrap">
                  <text class="result-preview-line" :class="isItemDuplicate(item.id) ? 'result-preview-line-duplicate' : 'result-preview-line-unique'">{{ formatOrderPreviewLine(item) }}</text>
                  <text class="result-toggle-btn" @tap="toggleItemExpanded(item.id)">{{ item.expanded ? '收起' : '展开' }}</text>
                </view>
                <view v-if="item.expanded" class="result-form-grid">
                  <view class="result-field result-field-name">
                    <text class="result-field-label">姓名</text>
                    <uni-easyinput :value="item.userName" type="text" :inputBorder="false"
                      @input="updateItemField(item.id, 'userName', $event)" />
                  </view>
                  <view class="result-field">
                    <text class="result-field-label">送水数量</text>
                    <uni-easyinput :value="String(item.quantity ?? '')" type="number" :inputBorder="false"
                      @input="updateItemField(item.id, 'quantity', $event)" />
                  </view>
                  <view class="result-field">
                    <text class="result-field-label">回桶数量</text>
                    <uni-easyinput :value="String(item.returnedBuckets ?? '')" type="number" :inputBorder="false"
                      @input="updateItemField(item.id, 'returnedBuckets', $event)" />
                  </view>
                  <view class="result-field">
                    <text class="result-field-label">付款金额</text>
                    <uni-easyinput :value="String(item.actualAmountReceived ?? '')" type="digit" :inputBorder="false"
                      @input="updateItemField(item.id, 'actualAmountReceived', $event)" />
                  </view>
                </view>
              </view>
              <view class="result-delete-btn" @tap="handleDeleteRow(item.id)">删除</view>
            </view>
            <button class="result-submit-btn" :class="{ 'btn-disabled': submittableItems.length === 0 }" :disabled="submittableItems.length === 0" @tap="handleSubmitBatch">提交这 {{ submittableItems.length }} 笔订单</button>
          </view>
        </view>

        <view v-if="submittedOrders.length > 0" class="result-stack">
          <view v-if="submittedOrders.length > 0" class="card result-card">
            <text class="result-title">已提交数据</text>
            <view v-for="(item, idx) in submittedOrders" :key="`submitted-${idx}`" class="result-line">{{ formatOrderPreviewLine(item) }}</view>
          </view>
        </view>

        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

    <view v-if="showDatePicker" class="filter-overlay" @tap="showDatePicker = false" @touchmove.stop.prevent>
      <view class="date-panel" @tap.stop @touchmove.stop>
        <view class="filter-header">
          <view>
            <text class="filter-header-title">订单日期</text>
            <text class="filter-header-subtitle">解析和提交都会使用当前选中日期</text>
          </view>
          <text class="filter-header-close" @tap="showDatePicker = false">关闭</text>
        </view>
        <scroll-view class="date-list" scroll-y @touchmove.stop>
          <view v-for="date in availableDates" :key="date" class="date-item"
            :class="{ 'date-item-active': selectedDate === date }" @tap="selectDate(date)">
            <text class="date-item-text">{{ date }}</text>
            <text class="date-item-tag">{{ date === today ? '今日' : selectedDate === date ? '已选' : '' }}</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="showDuplicateModal" class="duplicate-modal-mask" @tap.stop @touchmove.stop.prevent>
      <view class="duplicate-modal" @tap.stop @touchmove.stop>
        <text class="duplicate-modal-title">以下数据重复提交了</text>
        <scroll-view class="duplicate-modal-list" scroll-y @touchmove.stop>
          <view v-if="duplicateLines.length > 0" class="duplicate-modal-section">
            <text class="duplicate-modal-section-title">重复数据</text>
            <text v-for="(line, idx) in duplicateLines" :key="`duplicate-${idx}`" class="duplicate-modal-line">{{ line }}</text>
          </view>
          <view v-if="uniqueLines.length > 0" class="duplicate-modal-section">
            <text class="duplicate-modal-section-title">未重复数据</text>
            <text v-for="(line, idx) in uniqueLines" :key="`unique-${idx}`" class="duplicate-modal-line">{{ line }}</text>
          </view>
        </scroll-view>
        <view class="duplicate-modal-actions">
          <view class="duplicate-modal-btn duplicate-modal-btn-muted" @tap="resolveDuplicateModal(false)">关闭</view>
          <view class="duplicate-modal-btn duplicate-modal-btn-primary" @tap="resolveDuplicateModal(true)">提交未重复</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useStore } from '../../common/store.js'
import { formatMoney, isPotentialName, normalizeRecognizedOrderText, parseCompactOrderSegments } from '../../common/utils.js'

const store = useStore()
const { state, addOrders } = store
const DAY_PICKER_MONTH_RANGE = 3
const BATCH_ORDER_SELECTED_DATE_KEY = 'batch_order_selected_date'

const inputText = ref('')
const items = ref([])
const error = ref('')
const success = ref(false)
const successCount = ref(0)
const skippedCount = ref(0)
const submittedOrders = ref([])
const skippedDuplicateOrders = ref([])
const showDatePicker = ref(false)
const showDuplicateModal = ref(false)
const duplicateLines = ref([])
const uniqueLines = ref([])
let duplicateModalResolver = null

const today = computed(() => store.formatDate(new Date()))
const selectedDate = ref(today.value)

const buildDuplicateKey = (userName, date, quantity, returnedBuckets) => {
  const normalizedUserName = String(userName || '').trim()
  const normalizedDate = String(date || '').trim()
  return `${normalizedUserName}+${normalizedDate}/${Number(quantity) || 0}-${Number(returnedBuckets) || 0}`
}

const existingOrderKeySet = computed(() => new Set(
  state.orders.map(order => order.dedup_key || buildDuplicateKey(order.userName, order.createdDate, order.quantity, order.returnedBuckets))
))

const parsedDateDisplay = computed(() => items.value[0]?.customDate || selectedDate.value)

const parseLocalDate = (value) => {
  const parts = String(value || '').split('-').map(Number)
  if (parts.length !== 3 || parts.some(num => !Number.isFinite(num))) return null
  return new Date(parts[0], parts[1] - 1, parts[2])
}

const buildDateRange = (startValue, endValue) => {
  const startDate = parseLocalDate(startValue)
  const endDate = parseLocalDate(endValue)
  if (!startDate || !endDate) return [today.value]
  const dates = []
  const cursor = new Date(startDate)
  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(store.formatDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates.reverse()
}

const getRecentDayRangeStart = () => {
  const endDate = parseLocalDate(today.value) || new Date()
  const startDate = new Date(endDate)
  startDate.setMonth(startDate.getMonth() - DAY_PICKER_MONTH_RANGE)
  return store.formatDate(startDate)
}

const availableDates = computed(() => buildDateRange(getRecentDayRangeStart(), today.value))

const isNextDayDisabled = computed(() => {
  const currentDate = parseLocalDate(selectedDate.value)
  const todayDate = parseLocalDate(today.value)
  if (!currentDate || !todayDate) return false
  return currentDate.getTime() >= todayDate.getTime()
})

const selectDate = (date) => {
  selectedDate.value = date
  showDatePicker.value = false
}

const shiftSelectedDate = (offset) => {
  if (offset > 0 && isNextDayDisabled.value) return
  const baseDate = parseLocalDate(selectedDate.value) || parseLocalDate(today.value) || new Date()
  baseDate.setDate(baseDate.getDate() + offset)
  selectedDate.value = store.formatDate(baseDate)
}

const restoreSelectedDate = () => {
  const storedDate = String(uni.getStorageSync(BATCH_ORDER_SELECTED_DATE_KEY) || '').trim()
  if (!storedDate || !availableDates.value.includes(storedDate)) {
    selectedDate.value = today.value
    return
  }
  selectedDate.value = storedDate
}

watch(selectedDate, (value) => {
  if (!value) return
  uni.setStorageSync(BATCH_ORDER_SELECTED_DATE_KEY, value)
})

onShow(() => {
  restoreSelectedDate()
})

const formatOrderPreviewLine = (item) => {
  if (!item) return ''
  return [
    String(item.userName || '').trim(),
    Number(item.quantity) || 0,
    Number(item.returnedBuckets) || 0,
    formatMoney(item.actualAmountReceived)
  ].join(' ').trim()
}

const itemDuplicateInfo = computed(() => {
  const countMap = new Map()
  items.value.forEach(item => {
    const key = buildDuplicateKey(item.userName, item.customDate, item.quantity, item.returnedBuckets)
    countMap.set(key, (countMap.get(key) || 0) + 1)
  })

  return items.value.reduce((acc, item) => {
    const key = buildDuplicateKey(item.userName, item.customDate, item.quantity, item.returnedBuckets)
    acc[item.id] = {
      duplicateInBatch: (countMap.get(key) || 0) > 1,
      duplicateInDatabase: existingOrderKeySet.value.has(key),
      dedupKey: key
    }
    return acc
  }, {})
})

const getItemDuplicateFlag = (itemId, field) => {
  const info = itemDuplicateInfo.value[itemId]
  return info ? !!info[field] : false
}

const submittableItems = computed(() => items.value.filter(item => !getItemDuplicateFlag(item.id, 'duplicateInBatch') && !getItemDuplicateFlag(item.id, 'duplicateInDatabase')))

const duplicateItems = computed(() => items.value.filter(item => getItemDuplicateFlag(item.id, 'duplicateInBatch') || getItemDuplicateFlag(item.id, 'duplicateInDatabase')))

const sortedDisplayItems = computed(() => [...duplicateItems.value, ...submittableItems.value])

const isItemDuplicate = (itemId) => getItemDuplicateFlag(itemId, 'duplicateInBatch') || getItemDuplicateFlag(itemId, 'duplicateInDatabase')

const showDuplicateAlert = (duplicateOrders = [], uniqueOrders = []) => new Promise((resolve) => {
  duplicateLines.value = duplicateOrders.map(item => `${item.userName || ''} ${Number(item.quantity) || 0} ${Number(item.returnedBuckets) || 0}`.trim()).filter(Boolean)
  uniqueLines.value = uniqueOrders.map(item => `${item.userName || ''} ${Number(item.quantity) || 0} ${Number(item.returnedBuckets) || 0}`.trim()).filter(Boolean)
  duplicateModalResolver = resolve
  showDuplicateModal.value = true
})

const resolveDuplicateModal = (shouldSubmit) => {
  showDuplicateModal.value = false
  const resolver = duplicateModalResolver
  duplicateModalResolver = null
  duplicateLines.value = []
  uniqueLines.value = []
  if (resolver) resolver(!!shouldSubmit)
}

const handleParse = (showError = true) => {
  error.value = ''
  submittedOrders.value = []
  skippedDuplicateOrders.value = []
  if (!inputText.value.trim()) { if (showError) error.value = '请输入需要解析的文本内容'; return }

  const systemUserNames = state.users.map(u => u.userName && u.userName.trim()).filter(Boolean)
  const normalizedSource = normalizeRecognizedOrderText(inputText.value)
  const lines = normalizedSource.split('\n')
  const parsedItems = []
  const activeDate = selectedDate.value

  const buildParsedItem = ({ userName, quantity, returnedBuckets, customDate, lineIdx, actualAmountReceived, actualAmountTouched }) => {
    const matchedUser = state.users.find(u => !u.isAdmin && (u.userName && u.userName.toLowerCase().includes(userName.toLowerCase()) || userName.toLowerCase().includes((u.userName || '').split(' ')[0]?.toLowerCase())))
    const finalUnitPrice = matchedUser ? matchedUser.unitPrice : 0
    const settlementType = matchedUser ? matchedUser.settlementType : 'daily'
    const totalAmount = Number((quantity * finalUnitPrice).toFixed(2))
    const finalActualAmount = actualAmountTouched ? Number(actualAmountReceived) : 0
    return {
      id: `parsed-${Date.now()}-${lineIdx}-${Math.random().toString(36).substr(2,4)}`,
      userName,
      matchedUserId: matchedUser?._id,
      quantity,
      returnedBuckets,
      unitPrice: 0,
      totalAmount,
      actualAmountReceived: finalActualAmount,
      actualAmountTouched: !!actualAmountTouched,
      settlementType,
      customDate: activeDate,
      notes: '',
      expanded: false
    }
  }

  const parseChunk = (userName, tokens, lineIdx, customDate) => {
    let quantity = 0, returnedBuckets = 0, actualAmountReceived = 0, hasExplicitAmount = false
    let quantityAssigned = false, returnedBucketsAssigned = false
    const positionalNumbers = []
    tokens.some(token => {
      const slashMatch = String(token || '').trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/)
      if (!slashMatch) return false
      quantity = parseFloat(slashMatch[1]) || 0
      returnedBuckets = parseFloat(slashMatch[2]) || 0
      quantityAssigned = true
      returnedBucketsAssigned = true
      if (slashMatch[3] !== undefined) {
        actualAmountReceived = parseFloat(slashMatch[3]) || 0
        hasExplicitAmount = true
      }
      return true
    })
    const numberMatches = []
    tokens.forEach((t, i) => { const m = t.match(/\d+(\.\d+)?/); if (m) numberMatches.push({ num: parseFloat(m[0]), token: t, index: i }) })
    const classified = new Set()

    numberMatches.forEach((m, idx) => {
      const t = m.token.toLowerCase()
      if (t.includes('元') || t.includes('￥') || t.includes('付') || t.includes('款') || t.includes('扫码') || t.includes('收')) { actualAmountReceived = m.num; hasExplicitAmount = true; classified.add(idx) }
    })
    numberMatches.forEach((m, idx) => {
      if (classified.has(idx)) return
      const t = m.token.toLowerCase()
      if (t.includes('回') || t.includes('桶') || t.includes('退')) {
        returnedBuckets = m.num
        returnedBucketsAssigned = true
        classified.add(idx)
      }
    })
    numberMatches.forEach((m, idx) => {
      if (classified.has(idx)) return
      const t = m.token.toLowerCase()
      if (t.includes('送') || t.includes('水') || t.includes('购') || t.includes('买') || t.includes('配')) {
        quantity = m.num
        quantityAssigned = true
        classified.add(idx)
      }
    })
    numberMatches.forEach((m, idx) => {
      if (classified.has(idx)) return
      if (m.token.includes('/')) return
      positionalNumbers.push(m.num)
    })

    if (positionalNumbers.length > 0) {
      if (!quantityAssigned && positionalNumbers[0] !== undefined) {
        quantity = positionalNumbers[0]
        quantityAssigned = true
      }
      if (!returnedBucketsAssigned && positionalNumbers[1] !== undefined) {
        returnedBuckets = positionalNumbers[1]
        returnedBucketsAssigned = true
      }
      if (!hasExplicitAmount && positionalNumbers[2] !== undefined) {
        actualAmountReceived = positionalNumbers[2]
        hasExplicitAmount = true
      }
    }

    const matchedUser = state.users.find(u => !u.isAdmin && (u.userName && u.userName.toLowerCase().includes(userName.toLowerCase()) || userName.toLowerCase().includes((u.userName || '').split(' ')[0]?.toLowerCase())))
    const finalUnitPrice = matchedUser ? matchedUser.unitPrice : 0
    const settlementType = matchedUser ? matchedUser.settlementType : 'daily'

    if (!quantityAssigned || !returnedBucketsAssigned) return buildParsedItem({ userName, quantity: 0, returnedBuckets: 0, customDate: activeDate, lineIdx, actualAmountReceived: 0, actualAmountTouched: false })
    if (!hasExplicitAmount) actualAmountReceived = 0

    return {
      id: `parsed-${Date.now()}-${lineIdx}-${Math.random().toString(36).substr(2,4)}`,
      userName, matchedUserId: matchedUser?._id,
      quantity, returnedBuckets, unitPrice: 0,
      totalAmount: Number((quantity * finalUnitPrice).toFixed(2)),
      actualAmountReceived, actualAmountTouched: hasExplicitAmount, settlementType, customDate: activeDate, notes: '', expanded: false
    }
  }

  lines.forEach((line, lineIdx) => {
    const trimmedLine = line.trim(); if (!trimmedLine) return
    const textToParse = trimmedLine
    if (!textToParse) return

    const compactSegments = parseCompactOrderSegments(textToParse)
    if (compactSegments.length > 0) {
      compactSegments.forEach((segment, segmentIdx) => {
        parsedItems.push(buildParsedItem({
            userName: segment.name,
            quantity: segment.quantity,
            returnedBuckets: segment.returnedBuckets,
            actualAmountReceived: segment.actualAmountReceived,
            actualAmountTouched: segment.actualAmountTouched,
            customDate: activeDate,
            lineIdx: `${lineIdx}-${segmentIdx}`
          }))
      })
      return
    }

    const spaceCleanedLine = textToParse.replace(/([\(\)（）:,，;；：])/g, ' $1 ').replace(/\s+/g, ' ').trim()
    const tokens = spaceCleanedLine.split(/\s+/).filter(t => t.length > 0)
    let currentChunk = null
    tokens.forEach(token => {
      if (isPotentialName(token, systemUserNames)) {
        if (currentChunk) parsedItems.push(parseChunk(currentChunk.userName, currentChunk.tokens, lineIdx, activeDate))
        currentChunk = { userName: token.replace(/[\(\)（）:,，：]/g, ''), tokens: [] }
      } else if (currentChunk) {
        currentChunk.tokens.push(token)
      } else {
        currentChunk = { userName: token.replace(/[\(\)（）:,，：]/g, ''), tokens: [] }
      }
    })
    if (currentChunk) parsedItems.push(parseChunk(currentChunk.userName, currentChunk.tokens, lineIdx, activeDate))
  })

  if (parsedItems.length === 0) {
    items.value = []
    if (showError) error.value = '未能成功解析任何订单，请检查输入格式'
  }
  else {
    items.value = parsedItems
  }
}

const updateItemField = (id, field, value) => {
  items.value = items.value.map(item => {
    if (item.id !== id) return item
    const oldTotal = Number(item.totalAmount) || 0
    const updated = { ...item, [field]: value }
    if (field === 'quantity' || field === 'unitPrice') {
      updated.totalAmount = Number(((field === 'quantity' ? value : updated.quantity) * (field === 'unitPrice' ? value : updated.unitPrice)).toFixed(2))
      if (!updated.actualAmountTouched || Number(updated.actualAmountReceived) === oldTotal) {
        updated.actualAmountReceived = 0
      }
    }
    if (field === 'userName') {
      const matchedUser = state.users.find(u => !u.isAdmin && (u.userName && u.userName.trim().toLowerCase() === value.trim().toLowerCase() || (u.userName || '').toLowerCase().includes(value.toLowerCase())))
      if (matchedUser) {
        updated.matchedUserId = matchedUser._id
        updated.unitPrice = 0
        updated.settlementType = matchedUser.settlementType
        updated.totalAmount = Number((updated.quantity * matchedUser.unitPrice).toFixed(2))
        if (!updated.actualAmountTouched || Number(updated.actualAmountReceived) === oldTotal) {
          updated.actualAmountReceived = 0
        }
      } else {
        updated.matchedUserId = undefined
      }
    }
    if (field === 'actualAmountReceived') {
      updated.actualAmountTouched = true
    }
    return updated
  })
}

const toggleItemExpanded = (id) => {
  items.value = items.value.map(item => item.id === id ? { ...item, expanded: !item.expanded } : item)
}

const handleDeleteRow = (id) => { items.value = items.value.filter(item => item.id !== id) }

const handleSubmitBatch = async () => {
  error.value = ''
  if (items.value.length === 0) { error.value = '当前没有可提交的订单'; return }
  if (items.value.some(i => !i.userName.trim())) { error.value = '所有订单均必须填写客户姓名'; return }
  const invalidIndex = items.value.findIndex(item => {
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test((item.customDate || '').trim())
    return !dateValid || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 0 || !Number.isInteger(Number(item.returnedBuckets)) || Number(item.returnedBuckets) < 0 || Number(item.unitPrice) < 0 || Number(item.actualAmountReceived) < 0
  })
  if (invalidIndex !== -1) {
    error.value = `第 ${invalidIndex + 1} 行存在无效数据：送水数允许为 0，但不能小于 0；请同时检查日期、回桶数、单价和实收金额`
    return
  }

  const now = new Date()
  const duplicateSnapshot = duplicateItems.value.map(item => {
    return {
      createdDate: item.customDate || selectedDate.value,
      userName: item.userName.trim(),
      quantity: Number(item.quantity),
      returnedBuckets: Number(item.returnedBuckets),
      actualAmountReceived: Number(item.actualAmountReceived)
    }
  })
const finalOrders = submittableItems.value.map((item, index) => {
    const itemTime = new Date(now.getTime() - index * 1000)
    const itemDateStr = item.customDate || store.formatDate(now)
    const order = {
      createdAt: store.formatBeijingDateTime(itemTime),
      createdDate: itemDateStr,
      userName: item.userName.trim(),
      quantity: Number(item.quantity), returnedBuckets: Number(item.returnedBuckets),
      operator: state.currentUser?.userName || '',
      unitPrice: 0, totalAmount: Number(item.totalAmount),
      actualAmountReceived: Number(item.actualAmountReceived),
      logs: [], settlementType: item.settlementType, notes: item.notes.trim()
    }
    const duplicateKey = buildDuplicateKey(order.userName, order.createdDate, order.quantity, order.returnedBuckets)
    order.dedup_key = duplicateKey
    return order
  })

  if (finalOrders.length === 0) {
    error.value = '解析结果全部是重复数据，没有可提交的订单'
    return
  }

  const result = await addOrders(finalOrders)
  if (!result?.success) {
    error.value = result?.message || '批量保存失败，请稍后重试'
    if (result?.code === 'DUPLICATE_ORDER' && Array.isArray(result.duplicateOrders) && result.duplicateOrders.length > 0) {
      await showDuplicateAlert(result.duplicateOrders, [])
    }
    return
  }
  successCount.value = Number(result.addedCount || result.count || finalOrders.length) || 0
  skippedCount.value = 0
  submittedOrders.value = finalOrders
  skippedDuplicateOrders.value = []
  items.value = []
  success.value = true
  setTimeout(() => { success.value = false }, 1500)
}
</script>

<style lang="scss" scoped>
.batch-page{min-height:100vh;background:linear-gradient(180deg,#f8fbfa 0%,#f2f6f9 100%);display:flex;flex-direction:column}
.batch-content{flex:1}.batch-inner{padding:16px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}
.date-select{display:flex;align-items:center;justify-content:center;gap:12px}.date-picker-row{display:flex;align-items:center;gap:6px;min-width:0;width:100%}.date-shift-btn{height:34px;padding:0 10px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#334155;box-shadow:0 6px 16px rgba(15,23,42,.04);flex:0 0 auto;min-width:0;white-space:nowrap}.date-shift-btn-disabled{opacity:.45}.date-picker{display:flex;align-items:center;justify-content:space-between;gap:6px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:8px 12px;font-size:12px;font-weight:700;color:#1e293b;box-shadow:0 6px 16px rgba(15,23,42,.04);flex:1 1 0;width:0;min-width:0;overflow:hidden;box-sizing:border-box}.date-picker-label-wrap{flex:1;min-width:0;overflow:hidden}.date-picker-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.date-picker-arrow{flex-shrink:0;font-size:8px;color:#94a3b8;margin-left:6px}
.success-banner{padding:16px;background:#ecfdf5;border:1px solid #d1fae5;border-radius:12px;display:flex;align-items:center;gap:12px;font-size:12px;color:#065f46;margin-bottom:16px}
.success-icon{width:24px;height:24px;background:#10b981;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.success-title{font-weight:700;display:block}.success-sub{font-size:10px;color:#059669;margin-top:2px;display:block}
.error-banner{padding:12px;background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;font-size:12px;color:#dc2626;margin-bottom:16px}
.card{background:#fff;border-radius:18px;border:1px solid #e8eef5;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.parse-card{padding:18px;background:#fff;border-color:#e8eef5;min-width:0;overflow:hidden}
.parse-label{font-size:11px;font-weight:800;color:#334155;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.parse-label-hint{font-size:9px;font-weight:700;color:#0f766e;background:#ecfdf5;padding:3px 8px;border-radius:999px}
.parse-textarea{display:block;width:calc(100% - 30px);max-width:calc(100% - 30px);height:140px;padding:14px;background:#eee;border:1px solid #dbe4ee;border-radius:14px;font-size:12px;font-family:monospace;color:#334155;line-height:1.6}
.input-placeholder{color:#cbd5e1}
.parse-btns{display:flex;gap:8px;margin-top:12px;align-items:center}
.parse-btn{flex:1;height:38px;line-height:38px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:12px;font-size:12px;font-weight:800;box-shadow:0 8px 16px rgba(16,185,129,.14);padding:0}
.parse-clear{height:38px;line-height:38px;padding:0 16px;background:#eef2f7;border:none;color:#64748b;border-radius:18px;font-size:11px;font-weight:700;box-shadow:none}
.parse-clear::after{border:none}
.result-stack{display:flex;flex-direction:column;gap:12px}.result-card{padding:16px}.result-card-warn{border-color:#fecaca;background:#fffdfd}.result-title{display:block;font-size:12px;font-weight:800;color:#1e293b;margin-bottom:10px}.result-row{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}.result-line{display:block;flex:1;min-width:0;font-size:13px;font-weight:700;color:#334155}.result-main{flex:1;min-width:0}.result-preview-wrap{display:flex;align-items:center;justify-content:space-between;gap:8px}.result-preview-line{display:block;flex:1;min-width:0;font-size:14px;font-weight:800;word-break:break-all}.result-preview-line-duplicate{color:#dc2626}.result-preview-line-unique{color:#16a34a}.result-toggle-btn{flex-shrink:0;font-size:11px;font-weight:700;color:#059669;background:#ecfdf5;padding:5px 10px;border-radius:10px}.result-form-grid{min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 8px;margin-top:10px}.result-field{min-width:0}.result-field-name{grid-column:1 / -1}.result-field-label{display:block;font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px}.result-delete-btn{flex-shrink:0;padding:6px 10px;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;font-size:12px;font-weight:800;color:#dc2626}.result-submit-btn{width:100%;height:46px;margin-top:14px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:16px;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.filter-overlay{position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:20px 20px 24px}.date-panel{background:#fff;border-radius:20px;padding:18px;width:100%;max-width:380px;box-shadow:0 24px 56px rgba(15,23,42,.2)}.filter-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:1px solid #f1f5f9;margin-bottom:14px;gap:12px}.filter-header-title{display:block;font-size:16px;font-weight:800;color:#0f172a}.filter-header-subtitle{display:block;font-size:8px;color:#94a3b8;margin-top:4px}.filter-header-close{font-size:12px;font-weight:700;color:#059669;background:#ecfdf5;padding:6px 12px;border-radius:10px;flex-shrink:0}.date-list{max-height:320px}.date-item{display:flex;align-items:center;justify-content:space-between;padding:12px 4px;border-bottom:1px solid #f8fafc}.date-item-active{color:#059669}.date-item-text{font-size:13px;font-weight:700;color:inherit}.date-item-tag{min-width:28px;text-align:right;font-size:10px;font-weight:700;color:#94a3b8}
.duplicate-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.52);z-index:130;display:flex;align-items:flex-start;justify-content:center;padding:20px 24px 24px;box-sizing:border-box}.duplicate-modal{width:100%;max-width:560px;background:#fff;border-radius:24px;padding:18px 16px 16px;border:1px solid rgba(226,232,240,.9);box-shadow:0 24px 60px rgba(15,23,42,.24);box-sizing:border-box}.duplicate-modal-title{display:block;font-size:15px;font-weight:800;color:#1e293b}.duplicate-modal-list{max-height:320px;margin-top:12px;padding:2px 0 4px}.duplicate-modal-section+.duplicate-modal-section{margin-top:12px}.duplicate-modal-section-title{display:block;font-size:12px;font-weight:800;color:#64748b;margin-bottom:4px}.duplicate-modal-line{display:block;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#334155}.duplicate-modal-actions{display:flex;gap:10px;margin-top:14px}.duplicate-modal-btn{flex:1;height:44px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}.duplicate-modal-btn-muted{background:#f8fafc;border:1px solid #e2e8f0;color:#475569}.duplicate-modal-btn-primary{background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.btn-disabled{opacity:.5}
.safe-bottom{height:32px}
</style>
