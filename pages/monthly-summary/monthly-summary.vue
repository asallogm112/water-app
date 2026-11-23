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
            <view class="summary-export-btn" @tap="showExportModal = true"><text>导出</text></view>
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
              <text class="summary-item-value text-receivable-dark">¥{{ formatMoney(stats.totalReceivable) }}</text>
            </view>
            <view class="summary-item summary-item-green-dark">
              <view class="summary-item-label">实收金额</view>
              <text class="summary-item-value">¥{{ formatMoney(stats.totalActualReceived) }}</text>
            </view>
          </view>

          <!-- 日结/月结 拆分 -->
          <view class="split-row">
            <view class="split-item">
              <text class="split-label">日结单应收:</text>
              <text class="split-value split-value-red">¥{{ formatMoney(stats.dailyReceivable) }}</text>
            </view>
            <view class="split-item">
              <text class="split-label">月结单应收:</text>
              <text class="split-value split-value-red">¥{{ formatMoney(stats.monthlyReceivable) }}</text>
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
                <view class="month-header-stat"><text class="month-header-stat-label">发水:</text><text class="stat-bold month-header-stat-value">{{ m.quantity }} 桶</text></view>
                <view class="month-header-stat"><text class="month-header-stat-label">回桶:</text><text class="stat-bold month-header-stat-value">{{ m.returnedBuckets }} 个</text></view>
                <view class="month-header-stat"><text class="month-header-stat-label">应收款:</text><text class="stat-bold text-receivable month-header-stat-value">¥{{ formatMoney(m.totalAmount) }}</text></view>
                <view class="month-header-stat"><text class="month-header-stat-label">已付款:</text><text class="stat-bold text-emerald month-header-stat-value">¥{{ formatMoney(m.actualAmount) }}</text></view>
              </view>
            </view>
            <text class="month-arrow">{{ expandedMonths[m.month] ? '折叠' : '展开' }} {{ expandedMonths[m.month] ? '▲' : '▼' }}</text>
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
                  <text class="day-stat-value text-receivable">¥{{ formatMoney(day.totalAmount) }}</text>
                </view>
                <view class="day-stat day-stat-blue">
                  <text class="day-stat-label">当日已付</text>
                  <text class="day-stat-value text-emerald">¥{{ formatMoney(day.actualAmount) }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

    <!-- 每日账单图画布：离屏绘制，用户不可见 -->
    <canvas type="2d" id="dailyBillCanvas" class="offscreen-canvas"></canvas>

    <view v-if="showExportModal" class="export-modal-mask" @tap="showExportModal = false" @touchmove.stop.prevent>
      <view class="export-modal" @tap.stop @touchmove.stop>
        <view class="export-modal-header">
          <text class="export-modal-title">导出方式</text>
          <text class="export-modal-close" @tap="showExportModal = false">关闭</text>
        </view>
        <view class="export-option-list">
          <view v-for="option in exportOptions" :key="option.value" class="export-option-item" @tap="handleExportOption(option.value)">
            <text>{{ option.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 账单图预览：默认全选，点图原生放大，勾选框切换选中 -->
    <view v-if="showBillPreview" class="preview-mask" @touchmove.stop.prevent>
      <view class="preview-panel" @tap.stop>
        <view class="preview-header">
          <text class="preview-title">账单图预览</text>
          <text class="preview-close" @tap="showBillPreview = false">关闭</text>
        </view>
        <view class="preview-toolbar">
          <text class="preview-count">共 {{ billPreviewFiles.length }} 张 · 已选 {{ billPreviewFiles.filter(item => item.selected).length }} 张</text>
          <view class="preview-select-actions">
            <text class="preview-select-btn" @tap="selectAllBillPreviews(true)">全选</text>
            <text class="preview-select-btn" @tap="selectAllBillPreviews(false)">全不选</text>
          </view>
        </view>
        <scroll-view class="preview-list" scroll-y>
          <view
            v-for="(item, index) in billPreviewFiles"
            :key="item.path"
            class="preview-item"
            :class="{ 'preview-item-unchecked': !item.selected }"
          >
            <view class="preview-thumb" @tap="previewBillImage(index)">
              <image class="preview-image" :src="item.path" mode="aspectFill" />
              <text class="preview-zoom-hint">点图放大</text>
            </view>
            <view class="preview-item-footer" @tap="toggleBillPreviewItem(index)">
              <text class="preview-item-label">{{ item.label }}</text>
              <view class="preview-checkbox" :class="{ 'preview-checkbox-checked': item.selected }">
                <text v-if="item.selected" class="preview-check-mark">✓</text>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="preview-footer">
          <view class="preview-export-btn" :class="{ 'btn-disabled': billPreviewSaving }" @tap="saveSelectedBillImages">
            <text>{{ billPreviewSaving ? '保存中…' : '导出所选到相册' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useStore } from '../../common/store.js'
import { createUserUnitPriceMap, formatMoney, formatExportMoney, getOrderReceivableAmount, getOrderActualReceivedAmount } from '../../common/utils.js'
import { exportExcelWorkbook, showExcelPreviewShareActions } from '../../common/export-excel.js'
import { generateDailyBillImageFiles, saveBillImageFiles } from '../../common/daily-bill-image.js'

const store = useStore()
const { state } = store
const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))
const CALENDAR_START_MONTH = '2000-01'
const MONTHLY_SUMMARY_SELECTED_MONTH_KEY = 'monthly_summary_selected_month'
// 月份折叠状态持久化
const MONTHLY_SUMMARY_EXPANDED_KEY = 'monthly_summary_expanded_map'

const readExpandedMonths = () => {
  try {
    const raw = uni.getStorageSync(MONTHLY_SUMMARY_EXPANDED_KEY)
    if (!raw) return {}
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

const persistExpandedMonths = () => {
  uni.setStorageSync(MONTHLY_SUMMARY_EXPANDED_KEY, JSON.stringify(expandedMonths.value))
}

const selectedMonth = ref('ALL')
const expandedMonths = ref(readExpandedMonths())
const showExportModal = ref(false)
const showBillPreview = ref(false)
const billPreviewFiles = ref([])
const billPreviewSaving = ref(false)
const currentMonth = computed(() => store.formatDate(new Date()).substring(0, 7))
const exportOptions = [
  { value: 'excel', label: 'Excel' },
  { value: 'daily-image', label: '图片' }
]

const restoreSelectedMonth = () => {
  const storedMonth = String(uni.getStorageSync(MONTHLY_SUMMARY_SELECTED_MONTH_KEY) || '').trim()
  if (!storedMonth) {
    selectedMonth.value = 'ALL'
    return
  }
  if (storedMonth === 'ALL') {
    selectedMonth.value = 'ALL'
    return
  }
  selectedMonth.value = storedMonth
}

const persistSelectedMonth = (value) => {
  if (!value) return
  uni.setStorageSync(MONTHLY_SUMMARY_SELECTED_MONTH_KEY, value)
}

restoreSelectedMonth()

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

const monthList = computed(() => {
  return buildMonthRange(CALENDAR_START_MONTH, currentMonth.value)
})

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
  persistSelectedMonth(selectedMonth.value)
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
    persistSelectedMonth(selectedMonth.value)
    return
  }
  if (offset < 0 && selectedMonth.value === 'ALL') {
    selectedMonth.value = latestMonth
    persistSelectedMonth(selectedMonth.value)
    return
  }
  const activeMonth = selectedMonth.value === 'ALL' ? latestMonth : selectedMonth.value
  const parsed = parseMonthString(activeMonth)
  if (!parsed) {
    selectedMonth.value = latestMonth
    persistSelectedMonth(selectedMonth.value)
    return
  }
  const baseDate = new Date(parsed.year, parsed.month - 1, 1)
  baseDate.setMonth(baseDate.getMonth() + offset)
  selectedMonth.value = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}`
  persistSelectedMonth(selectedMonth.value)
}

const filteredOrders = computed(() =>
  state.orders.filter(o => {
    if (!state.currentUser?.isAdmin && o.userName !== state.currentUser?.userName) return false
    if (selectedMonth.value !== 'ALL' && !o.createdDate?.startsWith(selectedMonth.value)) return false
    return true
  })
)

const getReceivableAmount = (order) => getOrderReceivableAmount(order, userUnitPriceMap.value)
const getActualAmount = (order) => getOrderActualReceivedAmount(order)

const buildMonthlySummarySheetRows = () => {
  const title = selectedMonth.value === 'ALL'
    ? (state.currentUser?.isAdmin ? '平台月度账单汇总' : '个人月度消费汇总')
    : `${selectedMonth.value.replace('-', '年')}月 汇总核算`
  const headerRow = [
    { value: '月份', style: 'header' },
    { value: '发水', style: 'header' },
    { value: '回桶', style: 'header' },
    { value: '应收', style: 'header' },
    { value: '实收', style: 'header' }
  ]
  const rows = [
    [{ value: title, style: 'title' }],
    ['总发水', stats.value.totalQuantity],
    ['总回桶', stats.value.totalReturnedBuckets],
    ['总欠桶', stats.value.totalQuantity - stats.value.totalReturnedBuckets],
    ['总应收', Number(formatExportMoney(stats.value.totalReceivable))],
    ['总实收', Number(formatExportMoney(stats.value.totalActualReceived))],
    ['', '', '', '', ''],
    headerRow
  ]
  sortedMonthGroups.value
    .filter(group => group.totalAmount - group.actualAmount > 5)
    .forEach(group => {
      rows.push([formatMonth(group.month), group.quantity, group.returnedBuckets, Number(formatExportMoney(group.totalAmount)), Number(formatExportMoney(group.actualAmount))])
    })
  const getCellDisplayLength = (cell) => {
    const value = cell && typeof cell === 'object' && !Array.isArray(cell) ? cell.value : cell
    const text = String(value ?? '')
    let length = 0
    for (const char of text) {
      length += /[\u0000-\u00ff]/.test(char) ? 1 : 2
    }
    return length
  }
  const columnWidths = headerRow.map((_, columnIndex) => {
    const maxLength = rows.reduce((max, row) => {
      const cells = Array.isArray(row) ? row : [row]
      return Math.max(max, getCellDisplayLength(cells[columnIndex]))
    }, 0)
    const baseWidth = Math.max(maxLength + 4, 12)
    if (columnIndex === 0 || columnIndex === 1) {
      return Math.max(baseWidth - 2, 10)
    }
    return baseWidth
  })
  return {
    rows,
    defaultRowHeight: 27,
    columnWidths,
    rowHeights: {
      1: 32,
      8: 20
    },
    merges: [
      { start: 'A1', end: 'E1' }
    ]
  }
}

const sortBillOrders = (orders = []) => orders.slice().sort((a, b) => {
  const aDebt = getReceivableAmount(a) - getActualAmount(a)
  const bDebt = getReceivableAmount(b) - getActualAmount(b)
  return bDebt - aDebt
})

const buildMonthlyBillSummary = (days) => {
  const personMap = new Map()
  const totals = { quantity: 0, returned: 0, receivable: 0, actual: 0 }
  days.forEach(day => {
    day.rows.forEach(row => {
      if (!personMap.has(row.name)) {
        personMap.set(row.name, { name: row.name, quantity: 0, returned: 0, receivable: 0, actual: 0 })
      }
      const person = personMap.get(row.name)
      person.quantity += row.quantity
      person.returned += row.returned
      person.receivable += row.receivable
      person.actual += row.actual
      totals.quantity += row.quantity
      totals.returned += row.returned
      totals.receivable += row.receivable
      totals.actual += row.actual
    })
  })
  const round = (value) => Number(Number(value).toFixed(2))
  const persons = Array.from(personMap.values())
    .map(person => ({
      name: person.name,
      quantity: person.quantity,
      returned: person.returned,
      debt: round(person.receivable - person.actual),
      debtBuckets: person.quantity - person.returned
    }))
    .filter(person => person.debt > 5)
    .sort((a, b) => b.debt - a.debt)
  return {
    persons,
    totals: {
      quantity: totals.quantity,
      returned: totals.returned,
      receivable: round(totals.receivable),
      actual: round(totals.actual),
      debt: round(totals.receivable - totals.actual)
    }
  }
}

const buildDailyBillDays = () => {
  const group = monthGroups.value[selectedMonth.value]
  if (!group || !group.days) return []
  return Object.values(group.days)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(day => ({
      date: day.date,
      quantity: day.quantity,
      returnedBuckets: day.returnedBuckets,
      totalAmount: day.totalAmount,
      actualAmount: day.actualAmount,
      rows: sortBillOrders(day.orders).map(order => ({
        name: order.userName || '',
        quantity: Number(order.quantity) || 0,
        returned: Number(order.returnedBuckets) || 0,
        receivable: getReceivableAmount(order),
        actual: getActualAmount(order)
      })).filter(row => row.receivable - row.actual > 5)
    }))
}

const exportDailyImages = async () => {
  if (selectedMonth.value === 'ALL') {
    uni.showToast({ title: '请先选择具体月份', icon: 'none' })
    return
  }
  const days = buildDailyBillDays()
  if (days.length === 0) {
    uni.showToast({ title: '该月份暂无账单数据', icon: 'none' })
    return
  }
  const summary = buildMonthlyBillSummary(days)
  uni.showLoading({ title: '生成账单图 0/' + (days.length + 1), mask: true })
  try {
    const files = await generateDailyBillImageFiles({
      selector: '#dailyBillCanvas',
      monthLabel: formatMonth(selectedMonth.value),
      days,
      summary,
      onProgress: (done, total) => {
        uni.showLoading({ title: `生成账单图 ${done}/${total}`, mask: true })
      }
    })
    billPreviewFiles.value = files
    showBillPreview.value = true
  } catch (error) {
    uni.showToast({ title: error?.message || '生成账单图失败', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

const previewBillImage = (index) => {
  const urls = billPreviewFiles.value.map(item => item.path)
  if (urls.length === 0) return
  uni.previewImage({ current: index, urls })
}

const toggleBillPreviewItem = (index) => {
  const item = billPreviewFiles.value[index]
  if (item) item.selected = !item.selected
}

const selectAllBillPreviews = (selected) => {
  billPreviewFiles.value.forEach(item => { item.selected = selected })
}

const saveSelectedBillImages = async () => {
  if (billPreviewSaving.value) return
  const selectedCount = billPreviewFiles.value.filter(item => item.selected).length
  if (selectedCount === 0) {
    uni.showToast({ title: '请至少选择一张图片', icon: 'none' })
    return
  }
  billPreviewSaving.value = true
  uni.showLoading({ title: `保存 0/${selectedCount}`, mask: true })
  try {
    const saved = await saveBillImageFiles(billPreviewFiles.value, (done, total) => {
      uni.showLoading({ title: `保存 ${done}/${total}`, mask: true })
    })
    showBillPreview.value = false
    uni.showToast({ title: `已保存 ${saved} 张到相册`, icon: 'success' })
  } catch (error) {
    uni.showToast({ title: error?.message || '保存到相册失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    billPreviewSaving.value = false
  }
}

const handleExportOption = (type) => {
  showExportModal.value = false
  if (type === 'excel') {
    exportExcelWorkbook({
      fileName: selectedMonth.value === 'ALL' ? '月账单汇总' : `${selectedMonth.value}-月账单`,
      sheets: [
        { name: '汇总', ...buildMonthlySummarySheetRows() }
      ]
    }).then(showExcelPreviewShareActions).catch(() => {})
    return
  }
  if (type === 'daily-image') {
    exportDailyImages()
    return
  }
}

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
  persistExpandedMonths()
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

.offscreen-canvas { position: fixed; left: -9999px; top: -9999px; width: 750px; height: 2000px; }

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
.summary-export-btn { display: flex; align-items: center; justify-content: center; padding: 6px 12px; background: #f8fafc; border: 1px solid #dbe4ee; border-radius: 12px; font-size: 11px; font-weight: 700; color: #334155; }

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
.month-header-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; margin-top: 8px; }
.month-header-stat { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-width: 0; font-size: 12px; color: #64748b; }
.month-header-stat-label { flex-shrink: 0; color: #64748b; }
.month-header-stat-value { min-width: 0; white-space: nowrap; text-align: right; }
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

.export-modal-mask { position: fixed; inset: 0; background: rgba(15,23,42,.52); z-index: 120; display: flex; align-items: flex-start; justify-content: center; padding: 20px 20px 24px; box-sizing: border-box; }
.export-modal { width: 100%; max-width: 420px; background: #fff; border-radius: 24px; padding: 18px 16px 16px; border: 1px solid rgba(226,232,240,.9); box-shadow: 0 24px 60px rgba(15,23,42,.24); box-sizing: border-box; }
.export-modal-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 12px; }
.export-modal-title { font-size: 15px; font-weight: 800; color: #1e293b; }
.export-modal-close { font-size: 11px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 7px 12px; border-radius: 999px; }
.export-option-list { display: flex; flex-direction: column; gap: 8px; }
.export-option-item { padding: 12px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; font-size: 13px; font-weight: 700; color: #334155; }

.preview-mask { position: fixed; inset: 0; background: rgba(15,23,42,.62); z-index: 130; }
.preview-panel { width: 100%; height: 100vh; background: #f8fafc; display: flex; flex-direction: column; box-sizing: border-box; }
.preview-header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; background: #fff; border-bottom: 1px solid #e2e8f0; }
.preview-title { font-size: 16px; font-weight: 800; color: #1e293b; }
.preview-close { font-size: 12px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 7px 14px; border-radius: 999px; }
.preview-toolbar { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #fff; border-bottom: 1px solid #e2e8f0; }
.preview-count { font-size: 12px; font-weight: 700; color: #475569; }
.preview-select-actions { display: flex; gap: 8px; }
.preview-select-btn { font-size: 12px; font-weight: 700; color: #0f766e; padding: 6px 12px; border: 1px solid #99f6e4; border-radius: 999px; background: #f0fdfa; }
.preview-list { flex-shrink: 0; height: calc(100vh - 250px); padding: 14px 16px; box-sizing: border-box; }
.preview-item { display: inline-block; width: calc(50% - 7px); margin: 0 14px 14px 0; vertical-align: top; background: #fff; border: 2px solid #10b981; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 18px rgba(15,23,42,.06); box-sizing: border-box; }
.preview-item:nth-child(2n) { margin-right: 0; }
.preview-item-unchecked { border-color: #cbd5e1; opacity: .5; }
.preview-thumb { position: relative; width: 100%; height: 200px; background: #e2e8f0; overflow: hidden; }
.preview-image { width: 100%; height: 100%; display: block; }
.preview-zoom-hint { position: absolute; right: 8px; bottom: 8px; font-size: 10px; font-weight: 700; color: #fff; background: rgba(15,23,42,.55); padding: 3px 8px; border-radius: 999px; }
.preview-item-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-top: 1px solid #f1f5f9; }
.preview-item-label { font-size: 12px; font-weight: 700; color: #334155; }
.preview-checkbox { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; background: #fff; }
.preview-checkbox-checked { border-color: #10b981; background: #10b981; }
.preview-check-mark { color: #fff; font-size: 14px; font-weight: 800; }
.preview-footer { flex-shrink: 0; padding: 12px 16px 20px; background: #fff; border-top: 1px solid #e2e8f0; box-sizing: border-box; }
.preview-export-btn { height: 46px; border-radius: 16px; background: linear-gradient(135deg,#0f766e,#10b981); box-shadow: 0 10px 20px rgba(16,185,129,.16); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #fff; }
.btn-disabled { opacity: .5; }

.safe-bottom { height: 32px; }
</style>
