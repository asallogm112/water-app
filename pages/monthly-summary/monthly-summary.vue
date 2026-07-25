<template>
  <view class="page-container monthly-page">
    <scroll-view class="monthly-content" scroll-y>
      <view class="monthly-inner">
        <!-- 月份过滤 -->
        <view class="card filter-card">
          <view class="month-picker-row">
            <view class="month-shift-btn" @tap="shiftMonth(-1)"><text>上一月</text></view>
            <picker mode="selector" :range="monthOptions" :value="monthIndex" @change="onMonthChange">
              <view class="month-picker">
                <text>{{ monthDisplayLabel }}</text>
                <text class="picker-arrow">▼</text>
              </view>
            </picker>
            <view class="month-shift-btn" :class="{ 'month-shift-btn-disabled': isNextMonthDisabled }" @tap="shiftMonth(1)"><text>下一月</text></view>
          </view>
        </view>

        <!-- 汇总统计 -->
        <view class="card summary-card">
          <view class="summary-header">
            <text class="summary-header-title">
              💳 {{ selectedMonth !== 'ALL' ? selectedMonth.replace('-', '年') + '月 汇总核算' : (state.currentUser?.isAdmin ? '平台月度账单汇总' : '个人月度消费汇总') }}
            </text>
            <text class="summary-header-count">共 {{ stats.orderCount }} 笔配送</text>
          </view>

          <view class="summary-grid">
            <view class="summary-item summary-item-emerald">
              <view class="summary-item-label">发水数量</view>
              <text class="summary-item-value">{{ stats.totalQuantity }} <text class="summary-item-unit">桶</text></text>
            </view>
            <view class="summary-item summary-item-amber">
              <view class="summary-item-label">回桶数量</view>
              <text class="summary-item-value">{{ stats.totalReturnedBuckets }} <text class="summary-item-unit">个</text></text>
            </view>
            <view class="summary-item summary-item-blue">
              <view class="summary-item-label text-receivable">应收总额</view>
              <text class="summary-item-value text-receivable-dark">¥{{ stats.totalReceivable }}</text>
            </view>
            <view class="summary-item summary-item-green-dark">
              <view class="summary-item-label">实收金额</view>
              <text class="summary-item-value">¥{{ stats.totalActualReceived }}</text>
            </view>
          </view>

          <!-- 日结/月结 拆分 -->
          <view class="split-row">
            <view class="split-item">
              <text class="split-label">日结单应收:</text>
              <text class="split-value split-value-red">¥{{ stats.dailyReceivable }}</text>
            </view>
            <view class="split-item">
              <text class="split-label">月结单应收:</text>
              <text class="split-value split-value-red">¥{{ stats.monthlyReceivable }}</text>
            </view>
          </view>
        </view>

        <!-- 月度明细列表 -->
        <text class="section-title">按月汇总明细</text>

        <view v-if="sortedMonthGroups.length === 0" class="empty-state">
          <text>无历史配送数据</text>
        </view>

        <view v-for="m in sortedMonthGroups" :key="m.month" class="card month-card">
          <!-- 月份头部 -->
          <view class="month-header" @tap="toggleMonth(m.month)">
            <view class="month-header-info">
              <text class="month-header-title">
                {{ formatMonth(m.month) }}
                <text class="month-header-count">{{ m.orderCount }} 笔订单</text>
              </text>
              <view class="month-header-stats">
                <text class="month-header-stat">发水: <text class="stat-bold">{{ m.quantity }}</text> 桶</text>
                <text class="month-header-stat">回桶: <text class="stat-bold">{{ m.returnedBuckets }}</text> 个</text>
                <text class="month-header-stat">应收款: <text class="stat-bold text-receivable">¥{{ m.totalAmount }}</text></text>
                <text class="month-header-stat">已付款: <text class="stat-bold text-emerald">¥{{ m.actualAmount }}</text></text>
              </view>
            </view>
            <text class="month-arrow">{{ expandedMonths[m.month] ? '折叠' : '展开按日列表' }} {{ expandedMonths[m.month] ? '▲' : '▼' }}</text>
          </view>

          <!-- 按日展开 -->
          <view v-if="expandedMonths[m.month]" class="month-days">
            <view v-for="day in getSortedDays(m)" :key="day.date" class="card day-card">
              <view class="day-header">
                <text class="day-title">● {{ formatDay(day.date) }} <text class="day-count">({{ day.orders.length }}单)</text></text>
                <text class="day-link" @tap="navigateToOrderList(day.date)">查看当日明细 ›</text>
              </view>

              <view class="day-stats-row">
                <view class="day-stat">
                  <text class="day-stat-label">当日发水</text>
                  <text class="day-stat-value">{{ day.quantity }} <text class="day-stat-unit">桶</text></text>
                </view>
                <view class="day-stat">
                  <text class="day-stat-label">当日回桶</text>
                  <text class="day-stat-value">{{ day.returnedBuckets }} <text class="day-stat-unit">个</text></text>
                </view>
              </view>

              <view class="day-stats-row">
                <view class="day-stat day-stat-blue">
                  <text class="day-stat-label">当日应收</text>
                  <text class="day-stat-value text-receivable">¥{{ day.totalAmount }}</text>
                </view>
                <view class="day-stat day-stat-blue">
                  <text class="day-stat-label">当日已付</text>
                  <text class="day-stat-value text-emerald">¥{{ day.actualAmount }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="safe-bottom"></view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../../common/store.js'
import { createUserUnitPriceMap, getOrderReceivableAmount, getOrderActualReceivedAmount } from '../../common/utils.js'

const store = useStore()
const { state } = store
const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))

const selectedMonth = ref('ALL')
const expandedMonths = ref({})
const currentMonth = computed(() => store.formatDate(new Date()).substring(0, 7))

const monthList = computed(() =>
  [...new Set(state.orders.map(o => o.createdDate?.substring(0, 7)).filter(Boolean))].sort((a, b) => b.localeCompare(a))
)

const monthOptions = computed(() => ['全部月份', ...monthList.value])
const monthIndex = computed(() => {
  if (selectedMonth.value === 'ALL') return 0
  const idx = monthList.value.indexOf(selectedMonth.value)
  return idx >= 0 ? idx + 1 : 0
})
const monthDisplayLabel = computed(() => selectedMonth.value === 'ALL' ? '全部月份' : formatMonth(selectedMonth.value))

const onMonthChange = (e) => {
  const val = e.detail.value
  selectedMonth.value = val === 0 ? 'ALL' : monthList.value[val - 1]
}

const isNextMonthDisabled = computed(() => {
  return selectedMonth.value === 'ALL'
})

const parseMonthString = (value) => {
  const parts = String(value || '').split('-').map(Number)
  if (parts.length !== 2 || parts.some(num => !Number.isFinite(num))) return null
  return { year: parts[0], month: parts[1] }
}

const shiftMonth = (offset) => {
  if (offset > 0 && isNextMonthDisabled.value) return
  const latestMonth = monthList.value[0] || currentMonth.value
  if (offset > 0 && selectedMonth.value === latestMonth) {
    selectedMonth.value = 'ALL'
    return
  }
  if (offset < 0 && selectedMonth.value === 'ALL') {
    selectedMonth.value = latestMonth
    return
  }
  const activeMonth = selectedMonth.value === 'ALL' ? latestMonth : selectedMonth.value
  const parsed = parseMonthString(activeMonth)
  if (!parsed) {
    selectedMonth.value = latestMonth
    return
  }
  const baseDate = new Date(parsed.year, parsed.month - 1, 1)
  baseDate.setMonth(baseDate.getMonth() + offset)
  selectedMonth.value = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`
}

const filteredOrders = computed(() =>
  state.orders.filter(o => {
    if (!state.currentUser?.isAdmin && o.userName !== state.currentUser?.name) return false
    if (selectedMonth.value !== 'ALL' && !o.createdDate?.startsWith(selectedMonth.value)) return false
    return true
  })
)

const getReceivableAmount = (order) => getOrderReceivableAmount(order, userUnitPriceMap.value)
const getActualAmount = (order) => getOrderActualReceivedAmount(order)

const stats = computed(() => {
  let q = 0, r = 0, receivable = 0, actual = 0, daily = 0, monthly = 0
  filteredOrders.value.forEach(o => {
    q += o.quantity; r += o.returnedBuckets
    receivable += getReceivableAmount(o)
    actual += getActualAmount(o)
    if (o.settlementType === 'daily') daily += getReceivableAmount(o)
    else monthly += getReceivableAmount(o)
  })
  return {
    totalQuantity: q,
    totalReturnedBuckets: r,
    totalReceivable: Number(receivable.toFixed(2)),
    totalActualReceived: Number(actual.toFixed(2)),
    unpaidBalance: Number((receivable - actual).toFixed(2)),
    dailyReceivable: Number(daily.toFixed(2)),
    monthlyReceivable: Number(monthly.toFixed(2)),
    orderCount: filteredOrders.value.length
  }
})

const monthGroups = computed(() => {
  const groups = {}
  filteredOrders.value.forEach(order => {
    const mKey = order.createdDate?.substring(0, 7)
    if (!groups[mKey]) {
      groups[mKey] = { month: mKey, quantity: 0, returnedBuckets: 0, totalAmount: 0, actualAmount: 0, dailyAmount: 0, monthlyAmount: 0, orderCount: 0, days: {} }
    }
    const receivableAmt = getReceivableAmount(order)
    const actualAmt = getActualAmount(order)
    groups[mKey].quantity += order.quantity
    groups[mKey].returnedBuckets += order.returnedBuckets
    groups[mKey].totalAmount += receivableAmt
    groups[mKey].actualAmount += actualAmt
    groups[mKey].orderCount += 1
    if (order.settlementType === 'daily') groups[mKey].dailyAmount += receivableAmt
    else groups[mKey].monthlyAmount += receivableAmt

    if (!groups[mKey].days[order.createdDate]) {
      groups[mKey].days[order.createdDate] = { date: order.createdDate, quantity: 0, returnedBuckets: 0, totalAmount: 0, actualAmount: 0, orders: [] }
    }
    groups[mKey].days[order.createdDate].quantity += order.quantity
    groups[mKey].days[order.createdDate].returnedBuckets += order.returnedBuckets
    groups[mKey].days[order.createdDate].totalAmount += receivableAmt
    groups[mKey].days[order.createdDate].actualAmount += actualAmt
    groups[mKey].days[order.createdDate].orders.push(order)
  })
  return groups
})

const sortedMonthGroups = computed(() =>
  Object.values(monthGroups.value).sort((a, b) => b.month.localeCompare(a.month))
)

const toggleMonth = (monthKey) => {
  expandedMonths.value = { ...expandedMonths.value, [monthKey]: !expandedMonths.value[monthKey] }
}

const getSortedDays = (m) => Object.values(m.days).sort((a, b) => b.date.localeCompare(a.date))

const formatMonth = (m) => {
  if (!m) return ''
  const [y, mm] = m.split('-')
  return `${y}年${mm}月`
}
const formatDay = (d) => {
  if (!d) return ''
  const [, mm, dd] = d.split('-')
  return `${parseInt(mm)}月${parseInt(dd)}日`
}

const navigateToOrderList = (date) => {
  uni.navigateTo({ url: `/pages/order-list/order-list?date=${date || ''}` })
}

</script>

<style lang="scss" scoped>
.monthly-page { min-height: 100vh; background: linear-gradient(180deg, #f8fbfa 0%, #f2f6f9 100%); display: flex; flex-direction: column; }
.monthly-content { flex: 1; }
.monthly-inner { padding: 16px; }

.card { background: #fff; border-radius: 18px; border: 1px solid #e8eef5; box-shadow: 0 8px 22px rgba(15,23,42,0.04); }

.filter-card { padding: 14px; margin-bottom: 16px; }
.month-picker-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 72px; gap: 8px; align-items: center; width: 100%; }
.month-shift-btn { height: 34px; padding: 0 10px; border-radius: 12px; background: #fff; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #334155; box-shadow: 0 6px 16px rgba(15,23,42,.04); min-width: 0; }
.month-shift-btn-disabled { opacity: .45; }
.month-picker { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 12px; background: #f8fafc; border: 1px solid #dbe4ee; border-radius: 14px; font-size: 14px; font-weight: 700; color: #1e293b; font-family: monospace; box-sizing: border-box; box-shadow: inset 0 1px 0 rgba(255,255,255,.7); }
.picker-arrow { font-size: 10px; color: #94a3b8; }

.summary-card { padding: 18px; margin-bottom: 16px; }
.summary-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 12px; }
.summary-header-title { font-size: 14px; font-weight: 700; color: #1e293b; }
.summary-header-count { font-size: 12px; font-weight: 700; color: #94a3b8; background: #f8fafc; padding: 2px 8px; border-radius: 8px; border: 1px solid #f1f5f9; font-family: monospace; }

.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
.summary-item { padding: 11px 6px; border-radius: 14px; text-align: center; display: flex; flex-direction: column; gap: 3px; box-shadow: 0 4px 14px rgba(15,23,42,0.03); }
.summary-item-emerald { background: rgba(236,253,245,0.5); border: 1px solid rgba(209,250,229,0.6); }
.summary-item-amber { background: rgba(255,251,235,0.5); border: 1px solid rgba(253,230,138,0.6); }
.summary-item-blue { background: rgba(239,246,255,0.5); border: 1px solid rgba(219,234,254,0.6); }
.summary-item-green-dark { background: rgba(248,250,252,0.9); border: 1px solid rgba(226,232,240,0.9); }
.summary-item-label { font-size: 9px; font-weight: 700; color: #94a3b8; }
.text-receivable { color: #dc2626; }
.summary-item-value { font-size: 14px; font-weight: 900; color: #1e293b; font-family: monospace; }
.text-receivable-dark { color: #b91c1c; }
.summary-item-unit { font-size: 11px; font-weight: 400; color: #94a3b8; }

.split-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f1f5f9; }
.split-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: #f8fafc; border-radius: 14px; border: 1px solid #e8eef5; }
.split-label { font-size: 13px; font-weight: 700; color: #64748b; }
.split-value { font-size: 13px; font-weight: 900; color: #1e293b; font-family: monospace; }
.split-value-red { color: #dc2626; }

.section-title { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 4px; margin-bottom: 8px; display: block; }
.empty-state { text-align: center; padding: 32px; font-size: 14px; color: #94a3b8; }

.month-card { margin-bottom: 12px; overflow: hidden; }
.month-header { padding: 16px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f8fafc; }
.month-header-info { flex: 1; }
.month-header-title { font-size: 14px; font-weight: 800; color: #1e293b; display: block; }
.month-header-count { font-size: 11px; font-weight: 400; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 999px; font-family: monospace; margin-left: 6px; }
.month-header-stats { display: flex; flex-wrap: wrap; gap: 6px 12px; margin-top: 8px; }
.month-header-stat { font-size: 12px; color: #64748b; }
.stat-bold { font-weight: 700; color: #1e293b; }
.text-receivable { color: #dc2626; }
.text-emerald { color: #059669; }
.text-red { color: #e11d48; }
.month-arrow { font-size: 12px; color: #94a3b8; font-weight: 600; flex-shrink: 0; margin-left: 8px; }

.month-days { background: rgba(248,250,252,0.65); padding: 12px; }
.day-card { padding: 14px; margin-bottom: 10px; border-radius: 16px; border: 1px solid #e8eef5; box-shadow: 0 4px 14px rgba(15,23,42,0.03); }
.day-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.day-title { font-size: 14px; font-weight: 800; color: #1e293b; }
.day-count { font-size: 11px; font-weight: 400; color: #94a3b8; font-family: monospace; }
.day-link { font-size: 12px; font-weight: 700; color: #059669; background: rgba(236,253,245,0.8); border: 1px solid #cfeedd; padding: 4px 10px; border-radius: 12px; }
.day-stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
.day-stat { padding: 8px 12px; background: rgba(236,253,245,0.3); border-radius: 12px; border: 1px solid rgba(209,250,229,0.4); display: flex; justify-content: space-between; align-items: center; }
.day-stat-blue { background: rgba(239,246,255,0.6); border: 1px solid #dbeafe; }
.day-stat-label { font-size: 11px; font-weight: 600; color: #94a3b8; }
.day-stat-value { font-size: 14px; font-weight: 900; color: #1e293b; font-family: monospace; }
.day-stat-value.text-receivable { color: #dc2626; }
.day-stat-unit { font-size: 11px; font-weight: 400; color: #94a3b8; }

.safe-bottom { height: 32px; }
</style>
