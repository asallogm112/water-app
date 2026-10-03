<template>
  <view class="page-container payment-page">
    <scroll-view class="payment-content" scroll-y>
      <view class="payment-inner">
        <!-- 客户和月份选择（与按人对账一致） -->
        <view class="card filter-card">
          <view class="filter-grid">
            <view class="filter-col">
              <view class="month-picker-row">
                <view class="month-shift-btn" @tap="shiftCustomer(-1)"><text>上一人</text></view>
                <view class="filter-col month-filter-col">
                  <view class="filter-picker" @tap="openCustomerModal">
                    <text>{{ customerLabel }}</text>
                    <text class="picker-arrow">▼</text>
                  </view>
                </view>
                <view class="month-shift-btn" @tap="shiftCustomer(1)"><text>下一人</text></view>
              </view>
            </view>
          </view>

          <view class="month-picker-row">
            <view class="month-shift-btn" @tap="shiftMonth(-1)"><text>上一月</text></view>
            <view class="filter-col month-filter-col">
              <view class="filter-picker" @tap="openMonthModal">
                <text>{{ monthDisplayLabel }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </view>
            <view class="month-shift-btn" :class="{ 'month-shift-btn-disabled': isNextMonthDisabled }" @tap="shiftMonth(1)"><text>下一月</text></view>
          </view>
        </view>

        <!-- 付款汇总 -->
        <view class="card summary-card">
          <view class="summary-header">
            <text class="summary-title">💰 {{ monthDisplayLabel }} · {{ customerLabel }}付款合计</text>
            <view class="summary-header-right">
              <text class="summary-count">{{ filteredRecords.length }} 笔</text>
              <text class="summary-export" @tap="handleExport">导出</text>
            </view>
          </view>
          <view class="summary-grid">
            <view class="summary-item summary-item-emerald">
              <view class="summary-item-label">收款合计</view>
              <text class="summary-item-value text-emerald">¥{{ formatMoney(totalIncrease) }}</text>
            </view>
            <view class="summary-item summary-item-amber">
              <view class="summary-item-label">调减合计</view>
              <text class="summary-item-value text-receivable">¥{{ formatMoney(totalDecrease) }}</text>
            </view>
          </view>
        </view>

        <!-- 付款明细 -->
        <text class="section-title">{{ monthDisplayLabel }} 付款明细</text>

        <view v-if="filteredRecords.length === 0" class="empty-state">
          <text class="empty-icon">💳</text>
          <text>{{ records.length === 0 ? '暂无付款记录' : '当前筛选条件下暂无记录' }}</text>
          <text v-if="records.length === 0" class="empty-hint">数据来自云端，请先在首页点「刷新」同步一次</text>
        </view>

        <view v-for="rec in filteredRecords" :key="rec.id" class="pay-item" @tap="goToOrderRecord(rec)">
          <view class="pay-item-head">
            <view class="pay-date">{{ formatCnDate(rec.paidDate || rec.createdAt) }}</view>
            <text class="pay-delete" @tap.stop="confirmDeleteRecord(rec)">✕</text>
          </view>
          <view class="pay-name">{{ rec.userName }}</view>
          <view class="pay-amount" :class="Number(rec.changeAmount) >= 0 ? 'text-emerald' : 'text-receivable'">{{ payAmountText(rec) }}</view>
          <view v-if="rec.orderDate" class="pay-order">订单 : {{ formatCnDate(rec.orderDate) }}</view>
        </view>
        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

    <!-- 选择人员弹窗（与按人对账一致） -->
    <view v-if="showCustomerModal" class="editor-mask editor-mask-centered" @tap="closeCustomerModal" @touchmove.stop.prevent>
      <view class="editor-modal customer-select-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">选择人员</text>
          </view>
          <text class="editor-close" @tap="closeCustomerModal">关闭</text>
        </view>
        <view class="customer-search-wrap">
          <uni-easyinput
            class="editor-input"
            type="text"
            v-model="customerSearchKeyword"
            :inputBorder="false"
            placeholder="搜索人员"
          />
        </view>
        <scroll-view class="customer-select-list" scroll-y @touchmove.stop>
          <view
            id="customer-option-all"
            class="customer-select-item"
            :class="{ 'customer-select-item-active': selectedCustomer === 'ALL' }"
            @tap="selectCustomer('ALL')"
          >
            <view class="customer-select-main">
              <text class="customer-select-name">全部人员</text>
            </view>
            <text v-if="selectedCustomer === 'ALL'" class="customer-select-check">已选</text>
          </view>
          <view
            v-for="(customer, index) in filteredCustomerList"
            :key="customer.userName"
            :id="`customer-option-${index}`"
            class="customer-select-item"
            :class="{ 'customer-select-item-active': customer.userName === selectedCustomer }"
            @tap="selectCustomer(customer.userName)"
          >
            <view class="customer-select-main">
              <text class="customer-select-name">{{ customer.userName }}</text>
            </view>
            <text v-if="customer.userName === selectedCustomer" class="customer-select-check">已选</text>
          </view>
          <view v-if="filteredCustomerList.length === 0" class="customer-select-empty">
            <text>没有匹配的人员</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 选择月份弹窗（与按人对账一致） -->
    <view v-if="showMonthModal" class="editor-mask editor-mask-centered" @tap="closeMonthModal" @touchmove.stop.prevent>
      <view class="editor-modal customer-select-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">选择月份</text>
          </view>
          <text class="editor-close" @tap="closeMonthModal">关闭</text>
        </view>
        <scroll-view class="customer-select-list" scroll-y @touchmove.stop>
          <view
            class="customer-select-item"
            :class="{ 'customer-select-item-active': selectedMonth === 'ALL' }"
            @tap="selectMonth('ALL')"
          >
            <view class="customer-select-main">
              <text class="customer-select-name">全部月份</text>
            </view>
            <text v-if="selectedMonth === 'ALL'" class="customer-select-check">已选</text>
          </view>
          <view
            v-for="month in monthOptions"
            :key="month"
            class="customer-select-item"
            :class="{ 'customer-select-item-active': month === selectedMonth }"
            @tap="selectMonth(month)"
          >
            <view class="customer-select-main">
              <text class="customer-select-name">{{ formatMonthLabel(month) }}</text>
            </view>
            <text v-if="month === selectedMonth" class="customer-select-check">已选</text>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { formatMoney } from '../../common/utils.js'
import { exportExcelWorkbook, showExcelPreviewShareActions } from '../../common/export-excel.js'
import { useStore } from '../../common/store.js'

// 付款记录本机缓存（由首页刷新按钮全量同步写入）
const PAYMENT_RECORDS_STORAGE_KEY = 'payment_record_cache'

const store = useStore()
const { state, deletePaymentRecord } = store

const records = ref([])
const selectedCustomer = ref('ALL')
// 默认「全部月份」：进页面就能看到全部付款记录，不用先切月份
const selectedMonth = ref('ALL')
const showCustomerModal = ref(false)
const showMonthModal = ref(false)
const customerSearchKeyword = ref('')

function currentMonthText() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const readPaymentRecords = () => {
  try {
    const raw = uni.getStorageSync(PAYMENT_RECORDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!Array.isArray(parsed)) return []
    return parsed.map(item => ({
      id: item._id || item.id,
      userName: String(item.userName || ''),
      orderId: String(item.orderId || ''),
      orderDate: String(item.orderDate || ''),
      beforeAmount: Number(item.beforeAmount) || 0,
      afterAmount: Number(item.afterAmount) || 0,
      changeAmount: Number(item.changeAmount) || 0,
      paidDate: String(item.paidDate || ''),
      remark: String(item.remark || ''),
      createdAt: String(item.createdAt || '')
    }))
  } catch (error) {
    return []
  }
}

// 页面进入不请求服务器：只读本机缓存（数据由首页刷新按钮全量同步）
onShow(() => {
  records.value = readPaymentRecords()
})

// 客户列表（取有付款记录的人）
const customerList = computed(() => {
  const names = new Set()
  records.value.forEach(item => {
    if (item.userName) names.add(item.userName)
  })
  return [...names].sort((a, b) => a.localeCompare(b, 'zh')).map(userName => ({ userName }))
})

const filteredCustomerList = computed(() => {
  const keyword = String(customerSearchKeyword.value || '').trim().toLowerCase()
  if (!keyword) return customerList.value
  return customerList.value.filter(item => item.userName.toLowerCase().includes(keyword))
})

const customerLabel = computed(() => (selectedCustomer.value === 'ALL' ? '全部人员' : selectedCustomer.value))

const customerIndex = computed(() => {
  if (selectedCustomer.value === 'ALL') return 0
  const idx = customerList.value.findIndex(item => item.userName === selectedCustomer.value)
  return idx < 0 ? 0 : idx + 1
})

const shiftCustomer = (offset) => {
  const options = [{ userName: 'ALL' }, ...customerList.value]
  if (options.length === 0) return
  const nextIndex = (customerIndex.value + offset + options.length) % options.length
  selectedCustomer.value = options[nextIndex].userName
}

const openCustomerModal = () => {
  customerSearchKeyword.value = ''
  showCustomerModal.value = true
}
const closeCustomerModal = () => {
  showCustomerModal.value = false
}
const selectCustomer = (userName) => {
  selectedCustomer.value = userName || 'ALL'
  showCustomerModal.value = false
}

// 月份选项（近 24 个月，与按人对账风格一致）
const monthOptions = computed(() => {
  const list = []
  const cursor = new Date()
  cursor.setDate(1)
  for (let i = 0; i < 24; i += 1) {
    list.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() - 1)
  }
  return list
})

const formatMonthLabel = (month) => {
  if (month === 'ALL') return '全部月份'
  const [year, mon] = String(month).split('-')
  return `${year}年${Number(mon)}月`
}

const monthDisplayLabel = computed(() => (selectedMonth.value === 'ALL' ? '全部月份' : formatMonthLabel(selectedMonth.value)))

const isNextMonthDisabled = computed(() => selectedMonth.value >= currentMonthText())

const shiftMonth = (offset) => {
  if (offset > 0 && isNextMonthDisabled.value) return
  const current = selectedMonth.value === 'ALL' ? currentMonthText() : selectedMonth.value
  const [year, mon] = current.split('-').map(Number)
  const d = new Date(year, mon - 1 + offset, 1)
  selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const openMonthModal = () => {
  showMonthModal.value = true
}
const closeMonthModal = () => {
  showMonthModal.value = false
}
const selectMonth = (month) => {
  selectedMonth.value = month || 'ALL'
  showMonthModal.value = false
}

// 记录所属月份：优先付款日期，其次记录时间
const getRecordMonth = (record) => {
  const paidDate = String(record?.paidDate || '').trim()
  if (/^\d{4}-\d{2}/.test(paidDate)) return paidDate.substring(0, 7)
  const createdAt = String(record?.createdAt || '').trim()
  if (/^\d{4}-\d{2}/.test(createdAt)) return createdAt.substring(0, 7)
  return ''
}

const filteredRecords = computed(() => {
  return records.value
    .filter(record => {
      if (selectedCustomer.value !== 'ALL' && record.userName !== selectedCustomer.value) return false
      if (selectedMonth.value !== 'ALL' && getRecordMonth(record) !== selectedMonth.value) return false
      return true
    })
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
})

const totalIncrease = computed(() =>
  filteredRecords.value
    .filter(record => Number(record.changeAmount) > 0)
    .reduce((sum, record) => sum + Number(record.changeAmount || 0), 0)
)
const totalDecrease = computed(() =>
  Math.abs(
    filteredRecords.value
      .filter(record => Number(record.changeAmount) < 0)
      .reduce((sum, record) => sum + Number(record.changeAmount || 0), 0)
  )
)

const formatRecordTime = (record) => {
  const text = String(record?.createdAt || '').trim()
  if (!text) return String(record?.paidDate || '')
  return text.length > 16 ? text.substring(0, 16) : text
}

// 付款日期：YYYY-MM-DD(或带时分) → M月D号
const formatCnDate = (dateStr) => {
  const s = String(dateStr || '').trim()
  if (!s) return ''
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return s
  return `${Number(m[2])}月${Number(m[3])}号`
}

// 付款金额文字：付款220元 / 退款X元（整数去小数，负数视为退款）
const payAmountText = (rec) => {
  const amt = Number(rec?.changeAmount || 0)
  const v = Math.abs(amt)
  const num = Number.isInteger(v) ? String(v) : v.toFixed(2)
  return `${amt >= 0 ? '付款' : '退款'}${num}元`
}

const confirmDeleteRecord = (record) => {
  // 二次确认：明确「删除 / 取消」两个按钮，删除按钮标红，避免误删
  uni.showModal({
    title: '删除付款记录',
    content: `确认删除「${record.userName} ${Number(record.changeAmount) >= 0 ? '+' : '-'}¥${formatMoney(Math.abs(Number(record.changeAmount) || 0))}」这条记录吗？`,
    confirmText: '删除',
    confirmColor: '#dc2626',
    cancelText: '取消',
    success: async ({ confirm }) => {
      if (!confirm) return
      const res = await deletePaymentRecord(record.id)
      if (!res.success) {
        uni.showToast({ title: res.message || '删除失败', icon: 'none' })
        return
      }
      records.value = records.value.filter(item => item.id !== record.id)
      try {
        uni.setStorageSync(PAYMENT_RECORDS_STORAGE_KEY, JSON.stringify(records.value))
      } catch (error) {
        // 忽略缓存写入失败
      }
      uni.showToast({ title: '已删除', icon: 'none' })
    }
  })
}

// 点击付款记录 → 跳转到「按人对账」：定位到该客户 + 该记录所属月份
const goToOrderRecord = (rec) => {
  if (!rec.userName) {
    uni.showToast({ title: '该记录没有关联客户', icon: 'none' })
    return
  }
  const month = getRecordMonth(rec)
  // 用本地存储传递（避免 URL 中文编码在 onLoad 解码时产生乱码）
  try {
    uni.setStorageSync('payment_record_jump_target', JSON.stringify({
      userName: rec.userName,
      month: month || ''
    }))
  } catch (e) { /* 忽略存储失败 */ }
  uni.navigateTo({ url: '/pages/user-monthly-summary/user-monthly-summary' })
}

const handleExport = () => {
  if (filteredRecords.value.length === 0) {
    uni.showToast({ title: '暂无付款记录', icon: 'none' })
    return
  }
  const rows = [[
    { value: '时间', style: 'header' },
    { value: '客户', style: 'header' },
    { value: '变动金额', style: 'header' },
    { value: '修改前', style: 'header' },
    { value: '修改后', style: 'header' },
    { value: '订单日期', style: 'header' },
    { value: '备注', style: 'header' }
  ]]
  filteredRecords.value.forEach(record => {
    const change = Number(record.changeAmount) || 0
    rows.push([
      formatRecordTime(record),
      { value: record.userName || '', style: 'black' },
      { value: `${change >= 0 ? '+' : '-'}${formatMoney(Math.abs(change))}`, style: change >= 0 ? 'green' : 'red' },
      { value: formatMoney(record.beforeAmount), style: 'black' },
      { value: formatMoney(record.afterAmount), style: 'black' },
      { value: record.orderDate || '', style: 'black' },
      { value: record.remark || '', style: 'black' }
    ])
  })
  const fileName = selectedMonth.value === 'ALL'
    ? `付款记录-${customerLabel.value}`
    : `付款记录-${customerLabel.value}-${selectedMonth.value}`
  exportExcelWorkbook({
    fileName,
    sheets: [{ name: '付款记录', rows, defaultRowHeight: 24 }]
  }).then(showExcelPreviewShareActions).catch(() => {})
}
</script>

<style lang="scss" scoped>
.payment-page { min-height: 100vh; background: linear-gradient(180deg, #f8fbfa 0%, #f2f6f9 100%); display: flex; flex-direction: column; }
.payment-content { flex: 1; }
.payment-inner { padding: 16px; }
.card { background: #fff; border-radius: 18px; border: 1px solid #e8eef5; box-shadow: 0 8px 22px rgba(15,23,42,0.04); }

.filter-card { padding: 14px; margin-bottom: 16px; }
.filter-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
.filter-col { }
.filter-picker {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 8px 10px; background: #fff; border: 1px solid #e2e8f0;
  border-radius: 14px; font-size: 12px; font-weight: 700; color: #1e293b; box-sizing: border-box; box-shadow: 0 6px 16px rgba(15,23,42,.04);
}
.picker-arrow { font-size: 8px; color: #94a3b8; }
.month-picker-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 72px; gap: 8px; align-items: center; width: 100%; margin-top: 10px; }
.month-filter-col { min-width: 0; }
.month-shift-btn {
  height: 34px; display: flex; align-items: center; justify-content: center;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  font-size: 11px; font-weight: 700; color: #334155; box-shadow: 0 6px 16px rgba(15,23,42,.04);
}
.month-shift-btn-disabled { opacity: 0.45; }

.summary-card { padding: 18px; margin-bottom: 16px; }
.summary-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 12px; gap: 8px; }
.summary-title { font-size: 14px; font-weight: 700; color: #1e293b; }
.summary-header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.summary-count { font-size: 10px; font-weight: 700; color: #94a3b8; background: #f8fafc; padding: 2px 8px; border-radius: 6px; border: 1px solid #f1f5f9; font-family: monospace; }
.summary-export { font-size: 10px; font-weight: 700; color: #0f766e; padding: 3px 10px; border: 1px solid #99f6e4; border-radius: 999px; background: #f0fdfa; }
.summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.summary-item { padding: 11px 6px; border-radius: 14px; text-align: center; display: flex; flex-direction: column; gap: 3px; box-shadow: 0 4px 14px rgba(15,23,42,0.03); }
.summary-item-emerald { background: rgba(236,253,245,0.5); border: 1px solid rgba(209,250,229,0.6); }
.summary-item-amber { background: rgba(255,251,235,0.5); border: 1px solid rgba(253,230,138,0.6); }
.summary-item-label { font-size: 10px; font-weight: 700; color: #94a3b8; line-height: 1.2; }
.summary-item-value { font-size: 14px; font-weight: 900; color: #1e293b; font-family: monospace; }
.text-emerald { color: #059669; }
.text-receivable { color: #dc2626; }

.section-title { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 4px; margin-bottom: 8px; display: block; }
.empty-state { text-align: center; padding: 32px; font-size: 12px; color: #94a3b8; }
.empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }
.empty-hint { display: block; margin-top: 8px; font-size: 11px; color: #94a3b8; opacity: .85; line-height: 1.5; }

.pay-item { background: #fff; border: 1px solid #e8eef5; border-radius: 14px; padding: 12px; margin-bottom: 8px; box-shadow: 0 8px 22px rgba(15,23,42,0.04); }
.pay-item-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.pay-date { font-size: 13px; font-weight: 600; color: #64748b; }
.pay-amount { font-size: 13px; font-weight: 600; margin-top: 2px; }
.pay-item-body { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
.pay-name { font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 6px; }
.pay-detail { font-size: 11px; color: #64748b; font-family: monospace; }
.pay-order { font-size: 13px; font-weight: 600; color: #475569; margin-top: 2px; }
.pay-item-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 6px; }
.pay-remark { font-size: 11px; color: #a78bfa; flex: 1; min-width: 0; word-break: break-all; margin-top: 4px; }
.pay-delete-row { display: flex; justify-content: flex-end; margin-top: 6px; }
.pay-delete {
  width: 20px; height: 20px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: #f1f5f9; border: 1px solid #e2e8f0;
  color: #94a3b8; font-size: 11px; font-weight: 700; line-height: 1; flex-shrink: 0;
  transition: background .15s ease, color .15s ease, border-color .15s ease;
}
.pay-delete:active { background: #fee2e2; color: #dc2626; border-color: #fecaca; }

.editor-mask { position: fixed; inset: 0; background: rgba(15,23,42,.52); z-index: 120; display: flex; align-items: flex-start; justify-content: center; padding: 20px 20px 24px; box-sizing: border-box; }
.editor-mask-centered { align-items: flex-start; }
.editor-modal { width: 100%; max-width: 560px; max-height: calc(100vh - 64px); background: #fff; border-radius: 24px; padding: 18px 16px 16px; border: 1px solid rgba(226,232,240,.9); box-shadow: 0 24px 60px rgba(15,23,42,.24); box-sizing: border-box; display: flex; flex-direction: column; }
.customer-select-modal { max-width: 420px; }
.editor-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 14px; gap: 12px; }
.editor-title { display: block; font-size: 16px; font-weight: 800; color: #0f172a; }
.editor-close { font-size: 11px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 7px 12px; border-radius: 999px; flex-shrink: 0; }
.editor-input { width: 100%; }
.customer-search-wrap { margin-bottom: 10px; }
.customer-select-list { max-height: min(60vh, 420px); }
.customer-select-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 4px; border-bottom: 1px solid #f1f5f9; }
.customer-select-item-active { color: #059669; }
.customer-select-main { min-width: 0; display: flex; flex-direction: column; }
.customer-select-name { font-size: 14px; font-weight: 700; color: inherit; }
.customer-select-check { flex-shrink: 0; font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 4px 10px; border-radius: 999px; }
.customer-select-empty { padding: 18px 4px; text-align: center; font-size: 12px; color: #94a3b8; }

.safe-bottom { height: 32px; }
</style>
