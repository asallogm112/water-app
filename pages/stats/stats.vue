<template>
  <view class="page-container stats-page">
    <scroll-view class="stats-content" scroll-y>
      <view class="stats-inner">
        <!-- 时间尺度切换 -->
        <view class="card filter-card">
          <view class="toggle-group">
            <view class="toggle-btn" :class="{ 'toggle-active': timeScale === 'day' }" @tap="timeScale = 'day'"><text>按日查看</text></view>
            <view class="toggle-btn" :class="{ 'toggle-active': timeScale === 'month' }" @tap="timeScale = 'month'"><text>按月查看</text></view>
          </view>
          <view class="date-select-row">
            <view class="date-shift-btn" @tap="shiftTime(-1)"><text>{{ timeScale === 'day' ? '上一日' : '上一月' }}</text></view>
            <picker class="date-picker-wrap" mode="selector" :range="timeScale === 'day' ? availableDays : availableMonths" :value="timeScale === 'day' ? dayIndex : monthIndex" @change="onTimeChange">
              <view class="date-picker-display"><text>{{ timeScale === 'day' ? dayDisplayLabel : monthDisplayLabel }}</text><text class="picker-arrow">▼</text></view>
            </picker>
            <view class="date-shift-btn" :class="{ 'date-shift-btn-disabled': timeScale === 'day' ? isNextDayDisabled : isNextMonthDisabled }" @tap="shiftTime(1)"><text>{{ timeScale === 'day' ? '下一日' : '下一月' }}</text></view>
          </view>
        </view>

        <!-- 视角提示 -->
        <view class="perspective-hint">
          <text>📊 统计口径: 仅计入"已通过"审核的订单</text>
          <text class="perspective-badge">{{ state.currentUser?.isAdmin ? '全局视角' : '个人视角' }}</text>
        </view>

        <!-- 指标网格 -->
        <view class="metrics-grid">
          <view class="metric-card"><text class="metric-icon-bg">📈</text><text class="metric-label">所有销售总金额</text><text class="metric-value">¥{{ totalSales.toLocaleString() }}</text><text class="metric-sub">共 {{ scaleFilteredOrders.length }} 笔订单</text></view>
          <view class="metric-card"><text class="metric-icon-bg">🏦</text><text class="metric-label">{{ timeScale === 'day' ? '日实收金额' : '月实收金额' }}</text><text class="metric-value metric-blue">¥{{ actualReceivedAmount.toLocaleString() }}</text><text class="metric-sub">占应收比: {{ totalSales > 0 ? Math.round((actualReceivedAmount / totalSales) * 100) : 0 }}%</text></view>
          <view class="metric-card"><text class="metric-icon-bg">📦</text><text class="metric-label">发货数量</text><text class="metric-value metric-amber">{{ totalDelivered }} <text class="metric-unit">桶</text></text><text class="metric-sub">均价: {{ totalDelivered > 0 ? (totalSales / totalDelivered).toFixed(1) : 0 }} 元/桶</text></view>
          <view class="metric-card"><text class="metric-icon-bg">🔄</text><text class="metric-label">回桶数量</text><text class="metric-value">{{ totalReturned }} <text class="metric-unit">个</text></text><text class="metric-sub" :class="unreturnedBuckets > 0 ? 'text-red' : 'text-emerald'">{{ unreturnedBuckets > 0 ? `滞留未回桶: ${unreturnedBuckets} 个` : '空桶全部回收' }}</text></view>
        </view>

        <!-- 趋势图 -->
        <view class="card chart-card">
          <text class="chart-title">{{ timeScale === 'day' ? '近期每日销售额趋势 (元)' : '各月份销售总收入趋势 (元)' }}</text>
          <view v-if="chartData.length > 0" class="chart-area">
            <view class="chart-bars">
              <view v-for="(d, i) in chartData" :key="i" class="chart-bar-col">
                <view class="chart-bar-tooltip">¥{{ d.value }} ({{ d.qty }}桶)</view>
                <view class="chart-bar" :style="{ height: Math.max(10, Math.round((d.value / maxChartValue) * 100)) + '%' }"><text class="chart-bar-label">{{ d.value > 0 ? Math.round(d.value) : '' }}</text></view>
                <text class="chart-bar-x">{{ d.label }}</text>
              </view>
            </view>
          </view>
          <view v-else class="chart-empty"><text>暂无趋势图数据 — 录入配送单后将在此显示</text></view>
        </view>

        <!-- 客户排行 (仅管理员) -->
        <view v-if="state.currentUser?.isAdmin && leaderboardData.length > 0" class="card leaderboard-card">
          <text class="leaderboard-title">当前周期大客户订单贡献</text>
          <view class="leaderboard-list">
            <view v-for="(item, idx) in leaderboardData" :key="item.name" class="leaderboard-item">
              <view class="leaderboard-left"><text class="leaderboard-rank">#{{ idx + 1 }}</text><text class="leaderboard-name">{{ item.name }}</text></view>
              <view class="leaderboard-right"><text class="leaderboard-revenue">¥{{ item.revenue }}</text><text class="leaderboard-detail">{{ item.qty }} 桶 | {{ item.count }} 次配送</text></view>
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

const timeScale = ref('day')
const today = computed(() => store.formatDate(new Date()))
const currentMonth = computed(() => today.value.substring(0, 7))
const selectedDay = ref(store.formatDate(new Date()))
const selectedMonth = ref(store.formatDate(new Date()).substring(0, 7))
const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))

const roleFilteredOrders = computed(() => state.orders.filter(o => state.currentUser?.isAdmin || o.userName === state.currentUser?.name))

const availableDays = computed(() =>
  [...new Set(roleFilteredOrders.value.map(o => o.createdDate).filter(Boolean))].sort((a, b) => b.localeCompare(a))
)
const availableMonths = computed(() =>
  [...new Set(roleFilteredOrders.value.map(o => o.createdDate ? o.createdDate.substring(0, 7) : null).filter(Boolean))].sort((a, b) => b.localeCompare(a))
)

const activeDay = computed(() => selectedDay.value || (availableDays.value[0] || today.value))
const activeMonth = computed(() => selectedMonth.value || (availableMonths.value[0] || currentMonth.value))
const dayIndex = computed(() => Math.max(0, availableDays.value.indexOf(activeDay.value)))
const monthIndex = computed(() => Math.max(0, availableMonths.value.indexOf(activeMonth.value)))
const dayDisplayLabel = computed(() => activeDay.value)
const monthDisplayLabel = computed(() => activeMonth.value.replace('-', '年') + '月')

const isNextDayDisabled = computed(() => activeDay.value >= today.value)
const isNextMonthDisabled = computed(() => activeMonth.value >= currentMonth.value)

const parseMonthString = (value) => {
  const parts = String(value || '').split('-').map(Number)
  if (parts.length !== 2 || parts.some(num => !Number.isFinite(num))) return null
  return { year: parts[0], month: parts[1] }
}

const onTimeChange = (e) => {
  if (timeScale.value === 'day') selectedDay.value = availableDays.value[e.detail.value]
  else selectedMonth.value = availableMonths.value[e.detail.value]
}

const shiftTime = (offset) => {
  if (timeScale.value === 'day') {
    if (offset > 0 && isNextDayDisabled.value) return
    const baseDate = new Date(activeDay.value)
    if (Number.isNaN(baseDate.getTime())) return
    baseDate.setDate(baseDate.getDate() + offset)
    selectedDay.value = store.formatDate(baseDate)
    return
  }
  if (offset > 0 && isNextMonthDisabled.value) return
  const parsed = parseMonthString(activeMonth.value)
  if (!parsed) return
  const baseDate = new Date(parsed.year, parsed.month - 1, 1)
  baseDate.setMonth(baseDate.getMonth() + offset)
  selectedMonth.value = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`
}

const scaleFilteredOrders = computed(() => roleFilteredOrders.value.filter(o => {
  if (timeScale.value === 'day') return o.createdDate === activeDay.value
  return o.createdDate && o.createdDate.startsWith(activeMonth.value)
}))

const totalSales = computed(() => scaleFilteredOrders.value.reduce((s, o) => s + getOrderReceivableAmount(o, userUnitPriceMap.value), 0))
const actualReceivedAmount = computed(() => scaleFilteredOrders.value.reduce((s, o) => s + getOrderActualReceivedAmount(o), 0))
const totalDelivered = computed(() => scaleFilteredOrders.value.reduce((s, o) => s + o.quantity, 0))
const totalReturned = computed(() => scaleFilteredOrders.value.reduce((s, o) => s + o.returnedBuckets, 0))
const unreturnedBuckets = computed(() => Math.max(0, totalDelivered.value - totalReturned.value))

const chartData = computed(() => {
  if (timeScale.value === 'day') {
    const dates = [...availableDays.value].slice(0, 5).reverse()
    return dates.map(date => {
      const dayOrders = roleFilteredOrders.value.filter(o => o.createdDate === date)
      return { label: date.substring(5), value: dayOrders.reduce((s, o) => s + getOrderReceivableAmount(o, userUnitPriceMap.value), 0), qty: dayOrders.reduce((s, o) => s + o.quantity, 0) }
    })
  } else {
    const months = [...availableMonths.value].slice(0, 5).reverse()
    return months.map(month => {
      const mOrders = roleFilteredOrders.value.filter(o => o.createdDate && o.createdDate.startsWith(month))
      return { label: month, value: mOrders.reduce((s, o) => s + getOrderReceivableAmount(o, userUnitPriceMap.value), 0), qty: mOrders.reduce((s, o) => s + o.quantity, 0) }
    })
  }
})

const maxChartValue = computed(() => Math.max(...chartData.value.map(d => d.value), 100))

const leaderboardData = computed(() => {
  const names = [...new Set(scaleFilteredOrders.value.map(o => o.userName))]
  return names.map(name => {
    const cos = scaleFilteredOrders.value.filter(o => o.userName === name)
    return { name, revenue: cos.reduce((s, o) => s + getOrderReceivableAmount(o, userUnitPriceMap.value), 0), qty: cos.reduce((s, o) => s + o.quantity, 0), count: cos.length }
  }).sort((a, b) => b.revenue - a.revenue)
})

</script>

<style lang="scss" scoped>
.stats-page{min-height:100vh;background:linear-gradient(180deg,#f8fbfa 0%,#f2f6f9 100%);display:flex;flex-direction:column}
.stats-content{flex:1}.stats-inner{padding:16px}
.card{background:#fff;border-radius:18px;border:1px solid #e8eef5;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.filter-card{padding:16px;margin-bottom:16px}
.toggle-group{display:flex;background:#f1f5f9;padding:4px;border-radius:14px;margin-bottom:12px}
.toggle-btn{flex:1;padding:6px 0;border-radius:8px;text-align:center;font-size:12px;font-weight:600;color:#64748b}
.toggle-active{background:#fff;color:#059669;box-shadow:0 6px 14px rgba(15,23,42,.06)}
.date-select-row{display:grid;grid-template-columns:72px minmax(0,1fr) 72px;align-items:center;gap:8px;width:100%}
.date-picker-wrap{min-width:0}
.date-shift-btn{height:34px;padding:0 10px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#334155;box-shadow:0 6px 16px rgba(15,23,42,.04);min-width:0}
.date-shift-btn-disabled{opacity:.45}
.date-picker-display{display:flex;align-items:center;justify-content:space-between;gap:6px;background:#f8fafc;border:1px solid #dbe4ee;border-radius:14px;padding:8px 12px;font-size:12px;font-weight:700;color:#1e293b;box-shadow:inset 0 1px 0 rgba(255,255,255,.7);width:100%;box-sizing:border-box}
.picker-arrow{font-size:8px;color:#94a3b8}
.perspective-hint{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8;padding:0 4px;margin-bottom:12px}
.perspective-badge{background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:999px;font-weight:500}
.metrics-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:16px}
.metric-card{background:#fff;padding:16px;border-radius:18px;border:1px solid #e8eef5;display:flex;flex-direction:column;min-height:108px;position:relative;overflow:hidden;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.metric-icon-bg{position:absolute;right:-16px;bottom:-16px;font-size:64px;opacity:.1}
.metric-label{font-size:10px;font-weight:700;color:#94a3b8}
.metric-value{font-size:18px;font-weight:900;color:#1e293b;font-family:monospace;margin-top:8px}
.metric-value.metric-blue{color:#2563eb}.metric-value.metric-amber{color:#d97706}
.metric-unit{font-size:12px;font-weight:500;color:#94a3b8}
.metric-sub{font-size:10px;color:#94a3b8;margin-top:2px}
.metric-sub.text-red{color:#ef4444;font-weight:600}.metric-sub.text-emerald{color:#059669;font-weight:600}
.chart-card{padding:18px;margin-bottom:16px}
.chart-title{font-size:10px;font-weight:700;color:#334155;display:block;margin-bottom:12px}
.chart-area{padding-top:8px}
.chart-bars{display:flex;align-items:flex-end;justify-content:space-between;height:144px;padding:0 12px 8px;border-bottom:1px solid #eef2f7}
.chart-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;position:relative}
.chart-bar-tooltip{position:absolute;bottom:calc(100% - 24px);background:#1e293b;color:#fff;font-size:9px;padding:2px 6px;border-radius:6px;white-space:nowrap;opacity:0;z-index:10}
.chart-bar-col:active .chart-bar-tooltip{opacity:1}
.chart-bar{width:32px;border-radius:10px 10px 0 0;background:linear-gradient(180deg,#34d399 0%,#109579 100%);display:flex;align-items:flex-start;justify-content:center;padding-top:4px;min-height:10px;box-shadow:0 6px 14px rgba(16,185,129,.16)}
.chart-bar-label{font-size:7px;color:rgba(255,255,255,.9);font-weight:700}
.chart-bar-x{font-size:9px;color:#94a3b8;font-family:monospace;margin-top:4px}
.chart-empty{height:112px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#94a3b8}
.leaderboard-card{padding:18px;margin-bottom:16px}
.leaderboard-title{font-size:10px;font-weight:700;color:#334155;display:block;margin-bottom:8px}
.leaderboard-item{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:#f8fafc;border:1px solid #e8eef5;border-radius:14px;margin-bottom:6px}
.leaderboard-left{display:flex;align-items:center;gap:8px;font-size:12px}
.leaderboard-rank{font-weight:700;color:#94a3b8;font-family:monospace}
.leaderboard-name{color:#334155;font-weight:500}
.leaderboard-right{text-align:right}
.leaderboard-revenue{font-weight:700;color:#1e293b;font-size:12px;font-family:monospace;display:block}
.leaderboard-detail{font-size:10px;color:#94a3b8}
.safe-bottom{height:32px}
</style>
