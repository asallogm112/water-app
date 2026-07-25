<template>
  <view class="page-container batch-page">
    <scroll-view class="batch-content" :scroll-y="!showItemsPopup">
      <view class="batch-inner">
        <view v-if="success" class="success-banner">
          <text class="success-icon"></text>
          <view><text class="success-title">批量单录入成功！</text><text class="success-sub">已生成 {{ items.length }} 笔订单，正在跳转…</text></view>
        </view>
        <view v-if="error" class="error-banner"><text>{{ error }}</text></view>

        <!-- 文本解析 -->
        <view class="card parse-card">
          <text class="parse-label">批量订单解析</text>
          <textarea class="parse-textarea" :rows="5" v-model="inputText"
            placeholder="示例：07/22 老王 22 33 80 老李 22 44 老陈 33 55 99"
            placeholder-class="input-placeholder" />
          <view class="parse-btns">
            <button class="parse-btn" @tap="handleParse">开始智能解析</button>
            <button class="parse-clear" @tap="inputText = ''">清空</button>
          </view>
        </view>

        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

    <view v-if="showItemsPopup" class="items-popup-mask" @tap="showItemsPopup = false" @touchmove.stop.prevent>
      <view class="items-popup" :style="itemsPopupStyle" @tap.stop>
        <view class="items-popup-header">
          <view>
            <text class="items-popup-title">解析订单明细</text>
          </view>
          <text class="items-popup-close" @tap="showItemsPopup = false">关闭</text>
        </view>
        <scroll-view class="items-popup-list" :style="itemsPopupListStyle" scroll-y>
          <view v-for="(item, index) in items" :key="item.id" class="item-row">
            <text class="item-line">{{ item.name }} {{ item.quantity }} {{ item.returnedBuckets }} {{ item.actualAmountReceived }}</text>
          </view>
        </scroll-view>
        <view class="items-popup-footer">
          <button class="items-popup-submit" :class="{ 'btn-disabled': items.length === 0 }" :disabled="items.length === 0" @tap="handleSubmitBatch">
            提交这 {{ items.length }} 笔订单
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from '../../common/store.js'
import { parseDateFromText, stripDateText, isPotentialName, normalizeRecognizedOrderText, parseCompactOrderSegments } from '../../common/utils.js'

const store = useStore()
const { state, addOrders } = store

const windowHeight = ref(667)
uni.getSystemInfo({ success: (res) => { windowHeight.value = res.windowHeight || 667 } })

const inputText = ref('')
const items = ref([])
const error = ref('')
const success = ref(false)
const showItemsPopup = ref(false)

const buildDuplicateKey = (date, quantity, returnedBuckets) => {
  const monthKey = String(date || '').substring(0, 7).replace('-', '')
  return [monthKey, Number(quantity) || 0, Number(returnedBuckets) || 0].join('-')
}

const existingOrderKeySet = computed(() => new Set(
  state.orders.map(order => order.dedup_key || buildDuplicateKey(order.createdDate, order.quantity, order.returnedBuckets))
))

const itemsPopupMaxHeight = computed(() => {
  const available = Number(windowHeight.value) - 55
  return `${Math.max(260, available)}px`
})

const itemsPopupListMaxHeight = computed(() => {
  const listHeight = Number(windowHeight.value) - 55 - 126
  return `${Math.max(160, listHeight)}px`
})

const itemsPopupStyle = computed(() => ({
  maxHeight: itemsPopupMaxHeight.value
}))

const itemsPopupListStyle = computed(() => ({
  maxHeight: itemsPopupListMaxHeight.value
}))

const itemDuplicateInfo = computed(() => {
  const countMap = new Map()
  items.value.forEach(item => {
    const key = buildDuplicateKey(item.customDate, item.quantity, item.returnedBuckets)
    countMap.set(key, (countMap.get(key) || 0) + 1)
  })

  return items.value.reduce((acc, item) => {
    const key = buildDuplicateKey(item.customDate, item.quantity, item.returnedBuckets)
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

const showDuplicateAlert = (duplicateOrders = []) => {
  const preview = duplicateOrders.slice(0, 5).map(item => item.dedup_key || buildDuplicateKey(item.createdDate, item.quantity, item.returnedBuckets)).join('\n')
  const extra = duplicateOrders.length > 5 ? `\n等 ${duplicateOrders.length} 条重复记录` : ''
  uni.showModal({
    title: '这个数据重复录入了',
    content: `${preview}${extra}\n重复规则：年月-送水-回桶。`,
    showCancel: false,
    confirmText: '知道了'
  })
}

const handleParse = (showError = true) => {
  error.value = ''
  if (!inputText.value.trim()) { if (showError) error.value = '请输入需要解析的文本内容'; return }

  const systemUserNames = state.users.map(u => u.name && u.name.trim()).filter(Boolean)
  const normalizedSource = normalizeRecognizedOrderText(inputText.value)
  const lines = normalizedSource.split('\n')
  const parsedItems = []
  const detectedDates = new Set()
  lines.forEach(line => {
    const trimmedLine = line.trim()
    if (!trimmedLine) return
    const pureDate = parseDateFromText(trimmedLine.replace(/^日期[:：\s]*/, ''), store.formatDate(new Date()))
    if (pureDate) detectedDates.add(pureDate)
  })
  if (detectedDates.size === 0) {
    if (showError) error.value = '请在文本里写一个日期，例如 07/22 或 07月22'
    items.value = []
    return
  }
  if (detectedDates.size > 1) {
    if (showError) error.value = '当前只支持一个统一日期，请只保留一个日期'
    items.value = []
    return
  }
  const activeDate = Array.from(detectedDates)[0]

  const buildParsedItem = ({ name, quantity, returnedBuckets, customDate, lineIdx, actualAmountReceived, actualAmountTouched }) => {
    const matchedUser = state.users.find(u => !u.isAdmin && (u.name && u.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes((u.name || '').split(' ')[0]?.toLowerCase())))
    const finalUnitPrice = matchedUser ? matchedUser.unitPrice : 0
    const settlementType = matchedUser ? matchedUser.settlementType : 'daily'
    const totalAmount = Number((quantity * finalUnitPrice).toFixed(2))
    const finalActualAmount = actualAmountTouched ? Number(actualAmountReceived) : 0
    return {
      id: `parsed-${Date.now()}-${lineIdx}-${Math.random().toString(36).substr(2,4)}`,
      name,
      matchedUserId: matchedUser?._id,
      quantity,
      returnedBuckets,
      unitPrice: finalUnitPrice,
      totalAmount,
      actualAmountReceived: finalActualAmount,
      actualAmountTouched: !!actualAmountTouched,
      settlementType,
      customDate: activeDate,
      notes: ''
    }
  }

  const parseChunk = (name, tokens, lineIdx, customDate) => {
    let quantity = 0, returnedBuckets = 0, actualAmountReceived = 0, hasExplicitAmount = false
    const numberMatches = []
    tokens.forEach((t, i) => { const m = t.match(/\d+(\.\d+)?/); if (m) numberMatches.push({ num: parseFloat(m[0]), token: t, index: i }) })
    const classified = new Set()

    numberMatches.forEach((m, idx) => {
      const t = m.token.toLowerCase()
      if (t.includes('元') || t.includes('￥') || t.includes('付') || t.includes('款') || t.includes('扫码') || t.includes('收')) { actualAmountReceived = m.num; hasExplicitAmount = true; classified.add(idx) }
    })
    numberMatches.forEach((m, idx) => { if (classified.has(idx)) return; const t = m.token.toLowerCase(); if (t.includes('回') || t.includes('桶') || t.includes('退')) { returnedBuckets = m.num; classified.add(idx) } })
    numberMatches.forEach((m, idx) => { if (classified.has(idx)) return; const t = m.token.toLowerCase(); if (t.includes('送') || t.includes('水') || t.includes('购') || t.includes('买') || t.includes('配')) { quantity = m.num; classified.add(idx) } })
    numberMatches.forEach((m, idx) => { if (classified.has(idx)) return; if (quantity === 0) quantity = m.num; else if (returnedBuckets === 0) returnedBuckets = m.num; else if (!hasExplicitAmount) { actualAmountReceived = m.num; hasExplicitAmount = true } })

    const matchedUser = state.users.find(u => !u.isAdmin && (u.name && u.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes((u.name || '').split(' ')[0]?.toLowerCase())))
    const finalUnitPrice = matchedUser ? matchedUser.unitPrice : 0
    const settlementType = matchedUser ? matchedUser.settlementType : 'daily'

    if (!hasExplicitAmount) actualAmountReceived = 0

    return {
      id: `parsed-${Date.now()}-${lineIdx}-${Math.random().toString(36).substr(2,4)}`,
      name, matchedUserId: matchedUser?._id,
      quantity, returnedBuckets, unitPrice: finalUnitPrice,
      totalAmount: Number((quantity * finalUnitPrice).toFixed(2)),
      actualAmountReceived, actualAmountTouched: hasExplicitAmount, settlementType, customDate: activeDate, notes: ''
    }
  }

  lines.forEach((line, lineIdx) => {
    const trimmedLine = line.trim(); if (!trimmedLine) return
    const pureDate = parseDateFromText(trimmedLine.replace(/^日期[:：\s]*/, ''), activeDate)
    if (pureDate && stripDateText(trimmedLine.replace(/^日期[:：\s]*/, '')) === '') return
    let textToParse = trimmedLine
    const inlineDate = parseDateFromText(trimmedLine, activeDate)
    if (inlineDate) textToParse = stripDateText(trimmedLine)
    if (!textToParse) return

    const compactSegments = parseCompactOrderSegments(textToParse)
    if (compactSegments.length > 0) {
      compactSegments.forEach((segment, segmentIdx) => {
        parsedItems.push(buildParsedItem({
            name: segment.name,
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
      if (isPotentialName(token, systemUserNames)) { if (currentChunk) parsedItems.push(parseChunk(currentChunk.name, currentChunk.tokens, lineIdx, activeDate)); currentChunk = { name: token.replace(/[\(\)（）:,，：]/g, ''), tokens: [] } }
      else { if (currentChunk) currentChunk.tokens.push(token); else currentChunk = { name: token.replace(/[\(\)（）:,，：]/g, ''), tokens: [] } }
    })
    if (currentChunk) parsedItems.push(parseChunk(currentChunk.name, currentChunk.tokens, lineIdx, activeDate))
  })

  if (parsedItems.length === 0) {
    items.value = []
    if (showError) error.value = '未能成功解析任何订单，请检查输入格式'
  }
  else {
    items.value = parsedItems
    showItemsPopup.value = true
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
    if (field === 'name') {
      const matchedUser = state.users.find(u => !u.isAdmin && (u.name && u.name.trim().toLowerCase() === value.trim().toLowerCase() || (u.name || '').toLowerCase().includes(value.toLowerCase())))
      if (matchedUser) {
        updated.matchedUserId = matchedUser._id
        updated.unitPrice = matchedUser.unitPrice
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

const handleDeleteRow = (id) => { items.value = items.value.filter(item => item.id !== id) }

const handleSubmitBatch = async () => {
  error.value = ''
  if (items.value.length === 0) { error.value = '当前没有可提交的订单'; return }
  if (items.value.some(i => !i.name.trim())) { error.value = '所有订单均必须填写客户姓名'; return }
  const invalidIndex = items.value.findIndex(item => {
    const dateValid = /^\d{4}-\d{2}-\d{2}$/.test((item.customDate || '').trim())
    return !dateValid || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isInteger(Number(item.returnedBuckets)) || Number(item.returnedBuckets) < 0 || Number(item.unitPrice) < 0 || Number(item.actualAmountReceived) < 0
  })
  if (invalidIndex !== -1) {
    error.value = `第 ${invalidIndex + 1} 行存在无效数据：请检查日期、送水数、回桶数、单价和实收金额`
    return
  }

  const duplicateOrders = []
  const seenKeys = new Set()
  const now = new Date()
  const finalOrders = items.value.map((item, index) => {
    const targetUser = state.users.find(u => !u.isAdmin && (u.name && u.name.trim().toLowerCase() === item.name.trim().toLowerCase() || u._id === item.matchedUserId))
    const itemTime = new Date(now.getTime() - index * 1000)
    const itemDateStr = item.customDate || store.formatDate(now)
    const order = {
      createdAt: `${itemDateStr} ${store.formatDateTime(itemTime).split(' ')[1]}`,
      createdDate: itemDateStr,
      userName: targetUser ? targetUser.name : item.name.trim(),
      quantity: Number(item.quantity), returnedBuckets: Number(item.returnedBuckets),
      operator: state.currentUser?.name || '',
      unitPrice: Number(item.unitPrice), totalAmount: Number(item.totalAmount),
      actualAmountReceived: Number(item.actualAmountReceived),
      logs: [], settlementType: item.settlementType, notes: item.notes.trim()
    }
    const duplicateKey = buildDuplicateKey(order.createdDate, order.quantity, order.returnedBuckets)
    if (seenKeys.has(duplicateKey) || existingOrderKeySet.value.has(duplicateKey)) {
      duplicateOrders.push({ ...order, dedup_key: duplicateKey })
    }
    seenKeys.add(duplicateKey)
    return order
  })

  if (duplicateOrders.length > 0) {
    error.value = '检测到重复订单，请处理后再提交'
    showDuplicateAlert(duplicateOrders)
    return
  }

  const result = await addOrders(finalOrders)
  if (!result?.success) {
    error.value = result?.message || '批量保存失败，请稍后重试'
    if (result?.code === 'DUPLICATE_ORDER' && Array.isArray(result.duplicateOrders) && result.duplicateOrders.length > 0) {
      showDuplicateAlert(result.duplicateOrders)
    }
    return
  }
  showItemsPopup.value = false
  success.value = true
  setTimeout(() => { success.value = false; goBack() }, 1500)
}

const goBack = () => uni.navigateBack()
</script>

<style lang="scss" scoped>
.batch-page{min-height:100vh;background:linear-gradient(180deg,#f8fbfa 0%,#f1f5f9 100%);display:flex;flex-direction:column}
.batch-content{flex:1}.batch-inner{padding:16px;display:flex;flex-direction:column;gap:14px;box-sizing:border-box}
.success-banner{padding:16px;background:#ecfdf5;border:1px solid #d1fae5;border-radius:12px;display:flex;align-items:center;gap:12px;font-size:12px;color:#065f46;margin-bottom:16px}
.success-icon{width:24px;height:24px;background:#10b981;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.success-title{font-weight:700;display:block}.success-sub{font-size:10px;color:#059669;margin-top:2px;display:block}
.error-banner{padding:12px;background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;font-size:12px;color:#dc2626;margin-bottom:16px}
.card{background:#fff;border-radius:18px;border:1px solid #e8eef5;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.parse-card{padding:18px;background:#fff;border-color:#e8eef5;min-width:0;overflow:hidden}
.parse-label{font-size:11px;font-weight:800;color:#334155;display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.parse-label-hint{font-size:7px;font-weight:700;color:#0f766e;background:#ecfdf5;padding:3px 8px;border-radius:999px}
.parse-textarea{display:block;width:calc(100% - 30px);max-width:calc(100% - 30px);padding:14px;background:#eee;border:1px solid #dbe4ee;border-radius:14px;font-size:12px;font-family:monospace;color:#334155;min-height:116px}
.input-placeholder{color:#cbd5e1}
.parse-btns{display:flex;gap:8px;margin-top:12px;align-items:center}
.parse-btn{flex:1;height:38px;line-height:38px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:12px;font-size:12px;font-weight:800;box-shadow:0 8px 16px rgba(16,185,129,.14);padding:0}
.parse-clear{height:38px;line-height:38px;padding:0 16px;background:#eef2f7;color:#64748b;border-radius:18px;font-size:11px;font-weight:700;box-shadow:none}
.items-popup-mask{position:fixed;inset:0;background:rgba(15,23,42,.52);z-index:120;display:flex;align-items:center;justify-content:center;padding:25px 28px 30px;box-sizing:border-box}
.items-popup{width:100%;max-width:560px;background:#fff;border-radius:24px;padding:18px 16px 16px;box-shadow:0 24px 60px rgba(15,23,42,.24);display:flex;flex-direction:column;border:1px solid rgba(226,232,240,.9);box-sizing:border-box;overflow:hidden}
.items-popup-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid #f1f5f9}
.items-popup-title{display:block;font-size:14px;font-weight:800;color:#1e293b}
.items-popup-close{font-size:11px;font-weight:800;color:#059669;background:#ecfdf5;padding:7px 12px;border-radius:999px;flex-shrink:0}
.items-popup-list{flex:0 1 auto;min-height:0;padding-top:10px;padding-bottom:12px;box-sizing:border-box}
.items-popup-footer{padding-top:12px;border-top:1px solid #f1f5f9;background:#fff}
.items-popup-submit{width:100%;height:46px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:16px;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.item-row{padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;margin-bottom:10px;box-shadow:0 4px 14px rgba(15,23,42,.03)}
.item-line{display:block;font-size:14px;font-weight:700;color:#1e293b}
.btn-disabled{opacity:.5}
.safe-bottom{height:32px}
</style>
