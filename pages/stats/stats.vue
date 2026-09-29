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
            <picker v-if="timeScale === 'day'" class="date-picker-wrap" mode="selector" :range="availableDays" :value="dayIndex" @change="onTimeChange">
              <view class="date-picker-display"><text>{{ dayDisplayLabel }}</text><text class="picker-arrow">▼</text></view>
            </picker>
            <view v-else class="date-picker-wrap" @tap="showMonthModal = true">
              <view class="date-picker-display"><text>{{ monthDisplayLabel }}</text><text class="picker-arrow">▼</text></view>
            </view>
            <view class="date-shift-btn" :class="{ 'date-shift-btn-disabled': timeScale === 'day' ? isNextDayDisabled : isNextMonthDisabled }" @tap="shiftTime(1)"><text>{{ timeScale === 'day' ? '下一日' : '下一月' }}</text></view>
          </view>
        </view>

        <!-- 汇总卡片 -->
        <view class="card summary-card">
          <view class="summary-header">
            <text class="summary-title">💰 {{ timeScale === 'day' ? dayDisplayLabel : monthDisplayLabel }} 数据汇总</text>
            <text class="summary-count">{{ scaleFilteredOrders.length }} 笔订单</text>
          </view>
          <view class="summary-grid">
            <view class="summary-item summary-item-blue">
              <view class="summary-item-label text-receivable">销售总额</view>
              <text class="summary-item-value text-receivable-dark">¥{{ formatMoney(totalSales) }}</text>
            </view>
            <view class="summary-item summary-item-emerald">
              <view class="summary-item-label">实收金额</view>
              <text class="summary-item-value text-emerald-dark">¥{{ formatMoney(actualReceivedAmount) }}</text>
            </view>
            <view class="summary-item summary-item-amber">
              <view class="summary-item-label">发货数量</view>
              <text class="summary-item-value">¥{{ totalDelivered }} <text class="summary-item-unit">桶</text></text>
            </view>
            <view class="summary-item summary-item-gray">
              <view class="summary-item-label">回桶数量</view>
              <text class="summary-item-value">{{ totalReturned }} <text class="summary-item-unit">个</text></text>
            </view>
          </view>
        </view>

        <!-- 客户账单 (仅管理员) -->
        <view v-if="state.currentUser?.isAdmin && leaderboardData.length > 0" class="card leaderboard-card">
          <view class="summary-header">
            <text class="summary-title">📋 当前周期客户账单</text>
            <view class="action-group">
              <view class="customer-copy-btn" @tap="handleExportOption"><text class="customer-copy-btn-text">导出</text></view>
            </view>
          </view>
          <view class="leaderboard-list">
            <view v-for="(item, idx) in leaderboardData" :key="item.userName" class="leaderboard-item" @tap="openCustomerOrders(item)">
              <!-- 旧版样式：一行式，左名右金额+备注按钮 -->
              <view class="lb-row">
                <view class="lb-left">
                  <text class="lb-rank">#{{ idx + 1 }}</text>
                  <text class="lb-name">{{ item.userName }}</text>
                </view>
                <view class="lb-right">
                  <view class="lb-money-line"><text class="lb-money-label">应付</text><text class="lb-money-val">¥{{ formatMoney(item.payable) }}</text></view>
                  <view class="lb-money-line"><text class="lb-money-label">待付</text><text class="lb-money-val" :class="item.unpaid === 0 ? 'lb-money-paid' : 'lb-money-unpaid'">¥{{ formatMoney(item.unpaid) }}</text></view>
                </view>
                <view class="customer-copy-btn lb-remark-btn" @tap.stop="openRemarkModal(item.userName)"><text class="customer-copy-btn-text">备注</text></view>
              </view>
              <!-- 备注内容（有才显示） -->
              <view v-if="getCustomerRemark(item.userName)" class="lb-remark-notes">
                <text>备注: {{ getCustomerRemark(item.userName) }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

    <!-- 选择月份弹窗（与按人对账/付款记录一致，第一项即"全部月份"） -->
    <view v-if="showMonthModal" class="editor-mask editor-mask-centered" @tap="showMonthModal = false" @touchmove.stop.prevent>
      <view class="editor-modal customer-select-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">选择月份</text>
          </view>
          <text class="editor-close" @tap="showMonthModal = false">关闭</text>
        </view>
        <scroll-view class="customer-select-list" scroll-y @touchmove.stop>
          <view
            class="customer-select-item"
            :class="{ 'customer-select-item-active': activeMonth === 'ALL' }"
            @tap="selectMonth('ALL')"
          >
            <view class="customer-select-main">
              <text class="customer-select-name">全部月份</text>
            </view>
            <text v-if="activeMonth === 'ALL'" class="customer-select-check">已选</text>
          </view>
          <view
            v-for="month in availableMonths"
            :key="month"
            class="customer-select-item"
            :class="{ 'customer-select-item-active': activeMonth === month }"
            @tap="selectMonth(month)"
          >
            <view class="customer-select-main">
              <text class="customer-select-name">{{ month.replace('-', '年') }}月</text>
            </view>
            <text v-if="activeMonth === month" class="customer-select-check">已选</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 客户订单明细弹窗 -->
    <view v-if="showOrdersModal" class="editor-mask" @tap="closeOrdersModal" @touchmove.stop.prevent>
      <view class="editor-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">{{ activeCustomerName }} 订单明细</text>
            <text class="editor-subtitle">{{ activeOrdersPeriod }} · 共 {{ activeCustomerOrders.length }} 笔</text>
          </view>
          <view class="editor-header-actions">
            <view class="customer-copy-btn" @tap="openCustomerPayments"><text class="customer-copy-btn-text">付款记录</text></view>
            <text class="editor-close" @tap="closeOrdersModal">关闭</text>
          </view>
        </view>
        <scroll-view class="orders-body" scroll-y @touchmove.stop>
          <view v-for="(ord, i) in activeCustomerOrders" :key="i" class="order-row">
            <view class="order-row-head">
              <text class="order-row-date">{{ ord.createdDate }}</text>
              <view v-if="canManageData" class="customer-copy-btn order-row-edit-btn" @tap.stop="openOrderEditModal(ord)"><text class="customer-copy-btn-text">编辑</text></view>
            </view>
            <view class="order-row-grid">
              <text class="order-row-cell">发水 <text class="order-row-cell-strong">{{ ord.quantity }}</text> 桶</text>
              <text class="order-row-cell">回桶 <text class="order-row-cell-strong">{{ ord.returnedBuckets }}</text> 个</text>
              <text class="order-row-cell">应收 <text class="order-row-cell-amount-red">¥{{ formatMoney(ord.receivable) }}</text></text>
              <text class="order-row-cell">实收 <text class="order-row-cell-amount" :class="{ 'order-row-cell-amount-red': Number(ord.receivable) !== Number(ord.paid) }">¥{{ formatMoney(ord.paid) }}</text></text>
            </view>
            <view v-if="ord.notes" class="lb-remark-notes"><text>备注: {{ ord.notes }}</text></view>
          </view>
          <view v-if="activeCustomerOrders.length === 0" class="orders-empty"><text>暂无订单</text></view>
        </scroll-view>
      </view>
    </view>

    <!-- 该客户的付款记录弹窗（数据来自本机付款记录缓存，与「付款记录」页一致） -->
    <view v-if="showCustomerPaymentsModal" class="editor-mask" @tap="showCustomerPaymentsModal = false" @touchmove.stop.prevent>
      <view class="editor-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">{{ activeCustomerName }} 付款记录</text>
            <text class="editor-subtitle">共 {{ customerPaymentRecords.length }} 笔 · 合计 ¥{{ formatMoney(customerPaymentTotal) }}</text>
          </view>
          <text class="editor-close" @tap="showCustomerPaymentsModal = false">关闭</text>
        </view>
        <scroll-view class="orders-body" scroll-y @touchmove.stop>
          <view v-if="customerPaymentRecords.length === 0" class="orders-empty">
            <text>暂无付款记录</text>
            <text class="orders-empty-hint">数据来自云端，请先在首页点「刷新」同步</text>
          </view>
          <view v-for="rec in customerPaymentRecords" :key="rec.id" class="payment-row">
            <view class="payment-row-head">
              <text class="payment-row-time">{{ rec.createdAt || rec.paidDate || '' }}</text>
              <view class="payment-row-head-right">
                <text class="payment-row-amount" :class="Number(rec.changeAmount) >= 0 ? 'text-emerald' : 'text-receivable'">
                  {{ Number(rec.changeAmount) >= 0 ? '+' : '-' }}¥{{ formatMoney(Math.abs(Number(rec.changeAmount) || 0)) }}
                </text>
                <text class="payment-row-delete" @tap.stop="confirmDeletePayment(rec)">🗑</text>
              </view>
            </view>
            <view class="payment-row-body">
              <text class="payment-row-order">订单 {{ rec.orderDate || '-' }}</text>
              <text class="payment-row-change">¥{{ formatMoney(rec.beforeAmount) }} → ¥{{ formatMoney(rec.afterAmount) }}</text>
            </view>
            <view v-if="rec.remark" class="payment-row-remark">备注：{{ rec.remark }}</view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 人员备注弹窗 -->
    <view v-if="showRemarkModal" class="editor-mask" @tap="closeRemarkModal" @touchmove.stop.prevent>
      <view class="editor-modal customer-remark-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">人员备注</text>
            <text class="editor-subtitle">{{ remarkTargetName }} · {{ activeRemarkMonth }}</text>
          </view>
          <text class="editor-close" @tap="closeRemarkModal">关闭</text>
        </view>
        <view class="customer-remark-body">
          <textarea class="customer-remark-textarea" maxlength="-1" v-model="remarkInput" auto-height @touchmove.stop placeholder="请输入备注" placeholder-class="input-placeholder" />
        </view>
        <view class="customer-remark-actions">
          <button class="customer-remark-clear-btn" @tap="remarkInput = ''">清空</button>
          <button class="customer-remark-save-btn" @tap="saveRemark">保存</button>
        </view>
      </view>
    </view>

    <!-- 编辑订单弹窗 -->
    <view v-if="showOrderEditModal" class="editor-mask" @tap="closeOrderEditModal" @touchmove.stop.prevent>
      <view class="editor-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">编辑订单</text>
            <text class="editor-subtitle">订单日期：{{ activeCustomerOrders.find(o => o._id === editingOrderId)?.createdDate || '' }}</text>
          </view>
          <text class="editor-close" @tap="closeOrderEditModal">关闭</text>
        </view>
        <scroll-view class="order-edit-body" scroll-y @touchmove.stop>
          <view class="order-edit-grid">
            <view class="editor-field">
              <text class="editor-label">客户姓名</text>
              <uni-easyinput class="editor-input" type="text" v-model="editForm.userName" :inputBorder="false" />
            </view>
            <view class="editor-field">
              <text class="editor-label">单价</text>
              <uni-easyinput class="editor-input" type="digit" v-model="editForm.unitPrice" :inputBorder="false" />
            </view>
            <view class="editor-field">
              <text class="editor-label">送水数量</text>
              <uni-easyinput class="editor-input" type="number" v-model="editForm.quantity" :inputBorder="false" />
            </view>
            <view class="editor-field">
              <text class="editor-label">回桶数量</text>
              <uni-easyinput class="editor-input" type="number" v-model="editForm.returnedBuckets" :inputBorder="false" />
            </view>
            <view class="editor-field editor-field-full">
              <text class="editor-label">实收金额</text>
              <uni-easyinput class="editor-input" type="digit" v-model="editForm.actualAmountReceived" :inputBorder="false" />
            </view>
            <view class="editor-field editor-field-full">
              <text class="editor-label">备注</text>
              <uni-easyinput class="editor-input" type="text" v-model="editForm.notes" :inputBorder="false" />
            </view>
          </view>
        </scroll-view>
        <view class="editor-footer">
          <button class="editor-delete-btn" @tap="confirmOrderDelete">删除</button>
          <button class="editor-save-btn" @tap="submitOrderEdit">保存修改</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useStore } from '../../common/store.js'
import { createUserUnitPriceMap, formatMoney, getOrderReceivableAmount, getOrderActualReceivedAmount, getOrderUnitPrice } from '../../common/utils.js'
import { exportExcelWorkbook, showExcelPreviewShareActions } from '../../common/export-excel.js'

const store = useStore()
const { state, updateOrder, deleteOrder, deletePaymentRecord } = store

// 编辑权限：与按人对账一致，仅指定账号可编辑
const canManageData = computed(() => state.currentUser?.userName === 'chen')

// 缓存上次的 时间尺度 + 选中日期/月份，下次打开恢复
const STATS_VIEW_KEY = 'delivery_stats_view_cache'
const loadStatsViewCache = () => {
  try {
    const raw = uni.getStorageSync(STATS_VIEW_KEY)
    if (!raw) return {}
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

const viewCache = loadStatsViewCache()
const today = computed(() => store.formatDate(new Date()))
const currentMonth = computed(() => today.value.substring(0, 7))
const timeScale = ref(viewCache.timeScale === 'month' ? 'month' : 'day')
const selectedDay = ref(String(viewCache.selectedDay || store.formatDate(new Date())))
const selectedMonth = ref(String(viewCache.selectedMonth || store.formatDate(new Date()).substring(0, 7)))
const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))
const CALENDAR_START_DATE = '2000-01-01'
const CALENDAR_START_MONTH = '2000-01'

// 与「按人对账」页面共用的人员备注
const CUSTOMER_REMARK_MAP_KEY = 'user_monthly_customer_month_remark_map'
// 付款记录本机缓存（与「付款记录」页共用同一个 key）
const PAYMENT_RECORDS_STORAGE_KEY = 'payment_record_cache'
const remarkMap = ref({})
const showRemarkModal = ref(false)
const remarkTargetName = ref('')
const remarkInput = ref('')

// 客户订单明细弹窗
const showOrdersModal = ref(false)
const activeCustomerName = ref('')
const activeCustomerOrders = ref([])

// 编辑订单弹窗
const showOrderEditModal = ref(false)
const editingOrderId = ref('')
const editForm = ref({ userName: '', unitPrice: '0', quantity: '0', returnedBuckets: '0', actualAmountReceived: '0', notes: '' })
// 编辑单价：优先订单自身单价，否则用用户预设价
const getEditOrderUnitPrice = (order) => {
  const orderUnitPrice = Number(order?.unitPrice)
  if (Number.isFinite(orderUnitPrice) && orderUnitPrice > 0) return orderUnitPrice
  const userName = String(order?.userName || '').trim()
  const customerUnitPrice = Number(state.users?.find(u => u.userName === userName)?.unitPrice)
  if (Number.isFinite(customerUnitPrice) && customerUnitPrice > 0) return customerUnitPrice
  return Number(userUnitPriceMap.value?.[userName]) || 0
}

const roleFilteredOrders = computed(() => state.orders.filter(o => state.currentUser?.isAdmin || o.userName === state.currentUser?.userName))

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

const buildMonthRange = (startValue, endValue) => {
  const start = parseMonthString(startValue)
  const end = parseMonthString(endValue)
  if (!start || !end) return [currentMonth.value]
  const months = []
  const cursor = new Date(start.year, start.month - 1, 1)
  const endDate = new Date(end.year, end.month - 1, 1)
  while (cursor.getTime() <= endDate.getTime()) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months.reverse()
}

const availableDays = computed(() => buildDateRange(CALENDAR_START_DATE, today.value))
const availableMonths = computed(() => buildMonthRange(CALENDAR_START_MONTH, currentMonth.value))

const activeDay = computed(() => selectedDay.value || (availableDays.value[0] || today.value))
const activeMonth = computed(() => selectedMonth.value || (availableMonths.value[0] || currentMonth.value))
const dayIndex = computed(() => Math.max(0, availableDays.value.indexOf(activeDay.value)))
// 月份下拉选项：第一项固定为"全部月份"
const monthOptions = computed(() => ['全部月份', ...availableMonths.value])
const monthIndex = computed(() => {
  if (activeMonth.value === 'ALL') return 0
  const idx = availableMonths.value.indexOf(activeMonth.value)
  return idx >= 0 ? idx + 1 : 0
})
const dayDisplayLabel = computed(() => activeDay.value)
const monthDisplayLabel = computed(() => activeMonth.value === 'ALL' ? '全部月份' : activeMonth.value.replace('-', '年') + '月')

// 备注按月份存取，与「按人对账」页面保持一致（"全部月份"时按当前月存取）
const activeRemarkMonth = computed(() => {
  if (timeScale.value === 'day') return activeDay.value.substring(0, 7)
  return activeMonth.value === 'ALL' ? currentMonth.value : activeMonth.value
})
const activeOrdersPeriod = computed(() => {
  if (timeScale.value === 'day') return activeDay.value
  return activeMonth.value === 'ALL' ? '全部月份' : activeMonth.value
})

const isNextDayDisabled = computed(() => activeDay.value >= today.value)
const isNextMonthDisabled = computed(() => activeMonth.value === 'ALL' || activeMonth.value >= currentMonth.value)

const parseMonthString = (value) => {
  const parts = String(value || '').split('-').map(Number)
  if (parts.length !== 2 || parts.some(num => !Number.isFinite(num))) return null
  return { year: parts[0], month: parts[1] }
}

const onTimeChange = (e) => {
  const val = Number(e.detail.value)
  if (timeScale.value === 'day') selectedDay.value = availableDays.value[val]
  else selectedMonth.value = val === 0 ? 'ALL' : availableMonths.value[val - 1]
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
  // "全部月份"时点上一月 → 回到最新月份
  if (activeMonth.value === 'ALL') {
    selectedMonth.value = availableMonths.value[0] || currentMonth.value
    return
  }
  const parsed = parseMonthString(activeMonth.value)
  if (!parsed) return
  const baseDate = new Date(parsed.year, parsed.month - 1, 1)
  baseDate.setMonth(baseDate.getMonth() + offset)
  selectedMonth.value = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`
}

const persistStatsView = () => {
  uni.setStorageSync(STATS_VIEW_KEY, JSON.stringify({
    timeScale: timeScale.value,
    selectedDay: selectedDay.value,
    selectedMonth: selectedMonth.value
  }))
}

watch([timeScale, selectedDay, selectedMonth], () => {
  persistStatsView()
})

const scaleFilteredOrders = computed(() => roleFilteredOrders.value.filter(o => {
  if (timeScale.value === 'day') return o.createdDate === activeDay.value
  // "全部月份"：不限月份，统计所有订单
  if (activeMonth.value === 'ALL') return !!o.createdDate
  return o.createdDate && o.createdDate.startsWith(activeMonth.value)
}))

const totalSales = computed(() => scaleFilteredOrders.value.reduce((s, o) => s + getOrderReceivableAmount(o, userUnitPriceMap.value), 0))
const actualReceivedAmount = computed(() => scaleFilteredOrders.value.reduce((s, o) => s + getOrderActualReceivedAmount(o), 0))
const totalDelivered = computed(() => scaleFilteredOrders.value.reduce((s, o) => s + o.quantity, 0))
const totalReturned = computed(() => scaleFilteredOrders.value.reduce((s, o) => s + o.returnedBuckets, 0))
const unreturnedBuckets = computed(() => Math.max(0, totalDelivered.value - totalReturned.value))

// 客户账单：应付 / 已付 / 待付
const leaderboardData = computed(() => {
  const usernames = [...new Set(scaleFilteredOrders.value.map(o => o.userName))]
  return usernames.map(userName => {
    const cos = scaleFilteredOrders.value.filter(o => o.userName === userName)
    const payable = cos.reduce((s, o) => s + getOrderReceivableAmount(o, userUnitPriceMap.value), 0)
    const paid = cos.reduce((s, o) => s + getOrderActualReceivedAmount(o), 0)
    return {
      userName,
      payable,
      paid,
      unpaid: Number((payable - paid).toFixed(2)),
      qty: cos.reduce((s, o) => s + o.quantity, 0),
      count: cos.length
    }
  }).sort((a, b) => b.payable - a.payable)
})

// 导出：单表，先是汇总数据，下面直接接客户明细（所有金额红色字体）
const statsSheetName = () => {
  const isDay = timeScale.value === 'day'
  if (isDay) return `${activeDay.value} 账单表`
  return activeMonth.value === 'ALL' ? '全部月份 账单表' : `${activeMonth.value} 账单表`
}

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
  const columnWidths = Array.from({ length: columnCount }, (_, columnIndex) => {
    const maxLength = rows.reduce((max, row) => {
      const cells = Array.isArray(row) ? row : [row]
      return Math.max(max, getCellDisplayLength(cells[columnIndex] ?? ''))
    }, 0)
    return Math.max(maxLength + 4, 10)
  })
  return columnWidths
}

const buildBillSheetRows = () => {
  const isDay = timeScale.value === 'day'
  const periodLabel = isDay ? activeDay.value : (activeMonth.value === 'ALL' ? '全部月份' : activeMonth.value)

  // 汇总区（金额用红色）
  const sumRows = [
    { label: '销售总额', value: formatMoney(totalSales.value) },
    { label: '实收金额', value: formatMoney(actualReceivedAmount.value) },
    { label: '发货数量', value: `${totalDelivered.value} 桶` },
    { label: '回桶数量', value: `${totalReturned.value} 个` },
    { label: '滞留在外桶', value: `${unreturnedBuckets.value} 个` }
  ]

  // 客户明细区（表头 + 逐条个人，金额用红色）
  const customerHeader = [
    { value: '客户', style: 'header' },
    { value: '数量', style: 'header' },
    { value: '单价', style: 'header' },
    { value: '应付', style: 'header' },
    { value: '已付', style: 'header' },
    { value: '待付', style: 'header' }
  ]

  // 标题合并跨 6 列（A1:F1）
  const rows = [
    [{ value: `${periodLabel} 账单表`, style: 'title' }]
  ]
  // 汇总：label 在第1列，值在第2列
  sumRows.forEach(item => {
    const isMoney = item.label === '销售总额' || item.label === '实收金额'
    rows.push([
      item.label,
      isMoney ? { value: item.value, style: 'red' } : item.value
    ])
  })
  // 空行分隔汇总与客户明细
  rows.push(['', '', '', '', '', ''])
  rows.push(customerHeader)
  leaderboardData.value.forEach(item => {
    const unitPrice = item.qty > 0 ? (item.payable / item.qty) : 0
    rows.push([
      item.userName,
      item.qty,
      { value: formatMoney(unitPrice), style: 'red' },
      { value: formatMoney(item.payable), style: 'red' },
      { value: formatMoney(item.paid), style: 'green' },
      { value: formatMoney(item.unpaid), style: 'purple' }
    ])
  })

  const columnWidths = calcAutoWidths(rows, 6)
  return {
    rows,
    defaultRowHeight: 27,
    columnWidths,
    rowHeights: {
      1: 32
    },
    merges: [
      { start: 'A1', end: 'F1' }
    ]
  }
}

const handleExportOption = () => {
  if (scaleFilteredOrders.value.length === 0) {
    uni.showToast({ title: '暂无数据', icon: 'none' })
    return
  }
  exportExcelWorkbook({
    fileName: statsSheetName(),
    sheets: [
      { name: '账单表', ...buildBillSheetRows() }
    ]
  }).then(showExcelPreviewShareActions).catch(() => {})
}

// 备注读写（与「按人对账」共用同一份存储）
const readRemarkMap = () => {
  try {
    const raw = uni.getStorageSync(CUSTOMER_REMARK_MAP_KEY)
    if (!raw) return {}
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

remarkMap.value = readRemarkMap()

const persistRemarkMap = () => {
  uni.setStorageSync(CUSTOMER_REMARK_MAP_KEY, JSON.stringify(remarkMap.value))
}

const getRemarkStorageKey = (userName) => JSON.stringify([userName || '', activeRemarkMonth.value || ''])

const getCustomerRemark = (userName) => String(remarkMap.value[getRemarkStorageKey(userName)] || '').trim()

const openRemarkModal = (userName) => {
  remarkTargetName.value = userName || ''
  remarkInput.value = getCustomerRemark(userName)
  showRemarkModal.value = true
}

const closeRemarkModal = () => {
  showRemarkModal.value = false
}

const saveRemark = () => {
  const storageKey = getRemarkStorageKey(remarkTargetName.value)
  const content = String(remarkInput.value || '').trim()
  if (content) {
    remarkMap.value = { ...remarkMap.value, [storageKey]: content }
  } else {
    const nextMap = { ...remarkMap.value }
    delete nextMap[storageKey]
    remarkMap.value = nextMap
  }
  persistRemarkMap()
  closeRemarkModal()
}

// 点击客户查看完整订单列表
const loadActiveCustomerOrders = () => {
  const orders = scaleFilteredOrders.value
    .filter(o => o.userName === activeCustomerName.value)
    .sort((a, b) => String(b.createdDate || '').localeCompare(String(a.createdDate || '')))
  activeCustomerOrders.value = orders.map(o => ({
    _id: o._id,
    userName: o.userName || '',
    createdDate: o.createdDate,
    quantity: Number(o.quantity) || 0,
    returnedBuckets: Number(o.returnedBuckets) || 0,
    unitPrice: getOrderUnitPrice(o, userUnitPriceMap.value),
    receivable: getOrderReceivableAmount(o, userUnitPriceMap.value),
    paid: getOrderActualReceivedAmount(o),
    notes: o.notes || ''
  }))
}

const openCustomerOrders = (item) => {
  activeCustomerName.value = item?.userName || ''
  loadActiveCustomerOrders()
  showOrdersModal.value = true
}

const closeOrdersModal = () => {
  showOrdersModal.value = false
  activeCustomerOrders.value = []
}

// 月份选择弹窗（与按人对账/付款记录同款，第一项即"全部月份"）
const showMonthModal = ref(false)
const selectMonth = (month) => {
  selectedMonth.value = month || 'ALL'
  showMonthModal.value = false
}

// 该客户的付款记录：读本机缓存（页面进入不请求服务器），按时间倒序
const showCustomerPaymentsModal = ref(false)
const customerPaymentRecords = ref([])
const readPaymentRecordsFromCache = () => {
  try {
    const raw = uni.getStorageSync(PAYMENT_RECORDS_STORAGE_KEY)
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    return []
  }
}
const openCustomerPayments = () => {
  const targetName = String(activeCustomerName.value || '').trim()
  customerPaymentRecords.value = readPaymentRecordsFromCache()
    .filter(item => String(item.userName || '').trim() === targetName)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  showCustomerPaymentsModal.value = true
}
const customerPaymentTotal = computed(() =>
  customerPaymentRecords.value.reduce((sum, item) => sum + Number(item.changeAmount || 0), 0)
)

// 删除后同步更新本机缓存（付款记录页/按人对账共用同一份缓存）
const removePaymentRecordFromCache = (id) => {
  try {
    const raw = uni.getStorageSync(PAYMENT_RECORDS_STORAGE_KEY)
    const list = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : []
    const next = (Array.isArray(list) ? list : []).filter(item => String(item._id || item.id) !== String(id))
    uni.setStorageSync(PAYMENT_RECORDS_STORAGE_KEY, JSON.stringify(next))
  } catch (error) {
    // 忽略缓存写入失败
  }
}

// 删除付款记录（二次确认）
const confirmDeletePayment = (rec) => {
  uni.showModal({
    title: '删除付款记录',
    content: `确认删除「${rec.userName || ''} ${Number(rec.changeAmount) >= 0 ? '+' : '-'}¥${formatMoney(Math.abs(Number(rec.changeAmount) || 0))}」这条记录吗？`,
    confirmText: '删除',
    confirmColor: '#dc2626',
    cancelText: '取消',
    success: async ({ confirm }) => {
      if (!confirm) return
      const res = await deletePaymentRecord(rec.id)
      if (!res?.success) {
        uni.showToast({ title: res?.message || '删除失败', icon: 'none' })
        return
      }
      customerPaymentRecords.value = customerPaymentRecords.value.filter(item => item.id !== rec.id)
      removePaymentRecordFromCache(rec.id)
      uni.showToast({ title: '已删除', icon: 'none' })
    }
  })
}

// 打开编辑弹窗
const openOrderEditModal = (order) => {
  if (!canManageData.value) return
  editingOrderId.value = order?._id || ''
  editForm.value = {
    userName: order?.userName || '',
    unitPrice: String(order?.unitPrice > 0 ? order.unitPrice : getEditOrderUnitPrice(order)),
    quantity: String(order?.quantity ?? 0),
    returnedBuckets: String(order?.returnedBuckets ?? 0),
    actualAmountReceived: String(order?.paid ?? order?.actualAmountReceived ?? 0),
    notes: order?.notes || ''
  }
  showOrderEditModal.value = true
}

const closeOrderEditModal = () => {
  showOrderEditModal.value = false
  editingOrderId.value = ''
}

const submitOrderEdit = async () => {
  const payload = {
    userName: String(editForm.value.userName || '').trim(),
    unitPrice: Number(editForm.value.unitPrice || 0),
    quantity: Number(editForm.value.quantity || 0),
    returnedBuckets: Number(editForm.value.returnedBuckets || 0),
    actualAmountReceived: Number(editForm.value.actualAmountReceived || 0),
    notes: String(editForm.value.notes || '').trim()
  }
  if (!payload.userName) {
    uni.showModal({ title: '保存失败', content: '客户姓名不能为空', showCancel: false })
    return
  }
  if (!Number.isInteger(payload.quantity) || payload.quantity < 0) {
    uni.showModal({ title: '保存失败', content: '送水数量必须大于或等于 0 的整数', showCancel: false })
    return
  }
  if (!Number.isInteger(payload.returnedBuckets) || payload.returnedBuckets < 0) {
    uni.showModal({ title: '保存失败', content: '回桶数量必须大于或等于 0 的整数', showCancel: false })
    return
  }
  if (!Number.isFinite(payload.unitPrice) || payload.unitPrice < 0) {
    uni.showModal({ title: '保存失败', content: '单价必须大于或等于 0', showCancel: false })
    return
  }
  if (!Number.isFinite(payload.actualAmountReceived) || payload.actualAmountReceived < 0) {
    uni.showModal({ title: '保存失败', content: '实收金额必须大于或等于 0', showCancel: false })
    return
  }
  const result = await updateOrder(editingOrderId.value, payload)
  if (!result.success) {
    uni.showModal({ title: '保存失败', content: result.message || '更新订单失败', showCancel: false })
    return
  }
  closeOrderEditModal()
  loadActiveCustomerOrders()
}

const confirmOrderDelete = () => {
  if (!editingOrderId.value) return
  uni.showModal({
    title: '删除订单',
    content: '确认删除这个订单吗？删除后无法恢复。',
    success: async ({ confirm }) => {
      if (!confirm) return
      const result = await deleteOrder(editingOrderId.value)
      if (!result.success) {
        uni.showModal({ title: '删除失败', content: result.message || '删除订单失败', showCancel: false })
        return
      }
      closeOrderEditModal()
      loadActiveCustomerOrders()
    }
  })
}
</script>

<style lang="scss" scoped>
.stats-page{min-height:100vh;background:linear-gradient(180deg,#f8fbfa 0%,#f2f6f9 100%);display:flex;flex-direction:column}
.stats-content{flex:1}.stats-inner{padding:16px}
.card{background:#fff;border-radius:18px;border:1px solid #e8eef5;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.filter-card{padding:14px;margin-bottom:16px}
.toggle-group{display:flex;background:#f1f5f9;padding:4px;border-radius:12px;margin-bottom:12px}
.toggle-btn{flex:1;padding:6px 0;border-radius:9px;text-align:center;font-size:12px;font-weight:700;color:#64748b}
.toggle-active{background:#fff;color:#059669;box-shadow:0 6px 14px rgba(15,23,42,.06)}
.date-select-row{display:grid;grid-template-columns:72px minmax(0,1fr) 72px;align-items:center;gap:8px;width:100%}
.date-picker-wrap{min-width:0}
.date-shift-btn{height:34px;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #e2e8f0;border-radius:12px;font-size:11px;font-weight:700;color:#334155;min-width:0;box-shadow:0 6px 16px rgba(15,23,42,.04)}
.date-shift-btn-disabled{opacity:.45}
.date-picker-display{display:flex;align-items:center;justify-content:space-between;gap:6px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:8px 10px;font-size:12px;font-weight:700;color:#1e293b;box-shadow:0 6px 16px rgba(15,23,42,.04);width:100%;box-sizing:border-box}
.picker-arrow{font-size:8px;color:#94a3b8}

.summary-card{padding:18px;margin-bottom:16px}
.summary-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid #f1f5f9;margin-bottom:12px}
.summary-title{font-size:14px;font-weight:700;color:#1e293b}
.summary-count{font-size:10px;font-weight:700;color:#94a3b8;background:#f8fafc;padding:2px 8px;border-radius:6px;border:1px solid #f1f5f9;font-family:monospace}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.summary-item{padding:11px 6px;border-radius:14px;text-align:center;display:flex;flex-direction:column;gap:3px;box-shadow:0 4px 14px rgba(15,23,42,0.03)}
.summary-item-emerald{background:rgba(236,253,245,0.5);border:1px solid rgba(209,250,229,0.6)}
.summary-item-amber{background:rgba(255,251,235,0.5);border:1px solid rgba(253,230,138,0.6)}
.summary-item-blue{background:rgba(239,246,255,0.5);border:1px solid rgba(219,234,254,0.6)}
.summary-item-gray{background:rgba(248,250,252,0.9);border:1px solid rgba(226,232,240,0.9)}
.summary-item-label{font-size:8px;font-weight:700;color:#94a3b8;line-height:1.2}
.text-receivable{color:#dc2626}
.summary-item-value{font-size:12px;font-weight:900;color:#1e293b;font-family:monospace}
.text-receivable-dark{color:#b91c1c}
.text-emerald-dark{color:#047857}
.summary-item-unit{font-size:9px;font-weight:400;color:#94a3b8}

.leaderboard-card{padding:18px;margin-bottom:16px}
.action-group{display:flex;align-items:center;gap:8px}
.customer-copy-btn{display:flex;align-items:center;justify-content:center;padding:7px 12px;background:#f8fafc;border:1px solid #dbe4ee;border-radius:12px}
.customer-copy-btn-text{font-size:11px;font-weight:700;color:#334155;line-height:1}
.leaderboard-list{display:flex;flex-direction:column;gap:8px}
.leaderboard-item{padding:10px 12px;background:#f8fafc;border:1px solid #e8eef5;border-radius:14px;box-sizing:border-box}
.lb-row{display:flex;align-items:center;gap:10px}
.lb-left{display:flex;align-items:center;gap:8px;flex:1;min-width:0}
.lb-rank{font-size:10px;font-weight:700;color:#94a3b8;font-family:monospace;flex-shrink:0}
.lb-name{font-size:14px;font-weight:700;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lb-right{display:flex;flex-direction:column;gap:2px;text-align:right;flex-shrink:0}
.lb-money-line{display:flex;align-items:center;justify-content:flex-end;gap:6px}
.lb-money-label{font-size:9px;color:#94a3b8}
.lb-money-val{font-size:13px;font-weight:900;color:#1e293b;font-family:monospace}
.lb-money-unpaid{color:#dc2626}
.lb-money-paid{color:#059669}
.lb-remark-btn{flex-shrink:0}
/* 备注内容 */
.lb-remark-notes{margin-top:8px;padding:6px 8px;background:rgba(241,245,249,0.7);border-radius:8px;font-size:12px;color:#f87171;word-break:break-all;line-height:1.5}

/* 弹窗头部按钮组 / 月份选择弹窗（与按人对账、付款记录同款） */
.editor-header-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.editor-mask-centered{align-items:flex-start}
.customer-select-modal{max-width:420px}
.customer-select-list{max-height:min(60vh,420px)}
.customer-select-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 4px;border-bottom:1px solid #f1f5f9}
.customer-select-item-active{color:#059669}
.customer-select-main{min-width:0;display:flex;flex-direction:column}
.customer-select-name{font-size:14px;font-weight:700;color:inherit}
.customer-select-check{flex-shrink:0;font-size:11px;font-weight:700;color:#059669;background:#ecfdf5;padding:4px 10px;border-radius:999px}

/* 客户付款记录行（与「按人对账」的付款记录列表完全一致） */
.payment-row{padding:10px 12px;background:#f8fafc;border:1px solid #e8eef5;border-radius:12px;margin-bottom:8px}
.payment-row-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.payment-row-time{font-size:11px;font-weight:700;color:#64748b;font-family:monospace}
.payment-row-amount{font-size:14px;font-weight:900;font-family:monospace}
.payment-row-body{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px}
.payment-row-order{font-size:11px;color:#475569;font-family:monospace}
.payment-row-change{font-size:11px;color:#64748b;font-family:monospace}
.payment-row-foot{display:flex;align-items:center;gap:8px;margin-top:6px}
.payment-row-remark{font-size:11px;color:#a78bfa;word-break:break-all;flex:1;min-width:0}
.payment-row-head-right{display:flex;align-items:center;gap:8px;flex-shrink:0}
.payment-row-delete{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:24px;height:24px;background:#fff1f2;border:1px solid #fecdd3;border-radius:50%;font-size:13px;line-height:1}
.text-emerald{color:#059669}
.orders-empty-hint{display:block;margin-top:6px;font-size:11px;color:#94a3b8}

.editor-mask{position:fixed;inset:0;background:rgba(15,23,42,.52);z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:20px 20px 24px;box-sizing:border-box}
.editor-modal{width:100%;max-width:560px;max-height:calc(100vh - 64px);background:#fff;border-radius:24px;padding:18px 16px 16px;border:1px solid rgba(226,232,240,.9);box-shadow:0 24px 60px rgba(15,23,42,.24);box-sizing:border-box;display:flex;flex-direction:column}
.customer-remark-modal{max-width:420px}
.editor-header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:1px solid #f1f5f9;margin-bottom:14px;gap:12px}
.editor-title{display:block;font-size:16px;font-weight:800;color:#0f172a}
.editor-subtitle{display:block;font-size:10px;color:#94a3b8;margin-top:4px}
.editor-close{font-size:11px;font-weight:800;color:#059669;background:#ecfdf5;padding:7px 12px;border-radius:999px;flex-shrink:0}
.orders-body{max-height:calc(100vh - 220px);box-sizing:border-box}
.order-row{padding:12px 14px;background:#f8fafc;border:1px solid #e8eef5;border-radius:14px;margin-bottom:10px}
.order-row-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.order-row-date{font-size:12px;font-weight:800;color:#1e293b;font-family:monospace}
.order-row-edit-btn{flex-shrink:0}
.order-row-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px;margin-top:10px}
.order-row-cell{font-size:12px;font-weight:700;color:#64748b}
.order-row-cell-strong{font-weight:800;color:#1e293b}
.order-row-cell-amount{font-weight:800;color:#1e293b;font-family:monospace}
.order-row-cell-amount-red{font-weight:800;color:#dc2626;font-family:monospace}
/* 编辑订单弹窗 */
.order-edit-body{max-height:calc(100vh - 280px);box-sizing:border-box}
.order-edit-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.editor-field{display:flex;flex-direction:column;gap:4px;min-width:0}
.editor-field-full{grid-column:1 / -1}
.editor-label{font-size:10px;color:#94a3b8;font-weight:600}
.editor-input{width:100%}
.editor-input .uni-easyinput__content{border:1px solid #dbe4ee;border-radius:14px;background:#eee;min-height:40px}
.editor-input .uni-easyinput__content-input{font-size:13px;color:#1e293b}
.editor-footer{display:flex;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #f1f5f9}
.editor-delete-btn{flex:1;height:44px;line-height:44px;font-size:13px;font-weight:800;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:14px;padding:0}
.editor-save-btn{flex:2;height:44px;line-height:44px;font-size:14px;font-weight:800;color:#fff;background:linear-gradient(135deg,#0f766e,#10b981);border-radius:16px;padding:0;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.orders-empty{padding:24px;text-align:center;font-size:12px;color:#94a3b8}
.customer-remark-body{min-height:96px}
.customer-remark-textarea{width:100%;min-height:96px;font-size:12px;color:#1e293b;box-sizing:border-box;line-height:1.6}
.customer-remark-actions{display:flex;gap:8px;margin-top:14px}
.customer-remark-clear-btn{flex:1;height:38px;line-height:38px;font-size:12px;font-weight:700;color:#64748b;background:#f1f5f9;border-radius:12px;padding:0}
.customer-remark-save-btn{flex:2;height:38px;line-height:38px;font-size:12px;font-weight:700;color:#fff;background:linear-gradient(135deg,#0f766e,#10b981);border-radius:12px;padding:0}
.safe-bottom{height:32px}
</style>
