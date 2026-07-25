<template>
  <view class="page-container user-monthly-page">
    <scroll-view class="user-monthly-content" scroll-y>
      <view class="user-monthly-inner">
        <!-- 客户和月份选择 -->
        <view class="card filter-card">
          <view class="filter-grid">
            <view class="filter-col">
              <template v-if="state.currentUser?.isAdmin">
                <view class="month-picker-row">
                  <view class="month-shift-btn" :class="{ 'month-shift-btn-disabled': isPrevCustomerDisabled }" @tap="shiftCustomer(-1)"><text>上一人</text></view>
                  <view class="filter-col month-filter-col">
                    <picker mode="selector" :range="customerNames" :value="customerIndex" @change="onCustomerChange">
                      <view class="filter-picker">
                        <text>{{ customerNames[customerIndex] }}</text>
                        <text class="picker-arrow">▼</text>
                      </view>
                    </picker>
                  </view>
                  <view class="month-shift-btn" :class="{ 'month-shift-btn-disabled': isNextCustomerDisabled }" @tap="shiftCustomer(1)"><text>下一人</text></view>
                </view>
              </template>
              <template v-else>
                <view class="filter-picker filter-picker-locked">
                  <text>{{ state.currentUser?.name }} (本人)</text>
                  <text class="locked-tag">已锁定</text>
                </view>
              </template>
            </view>
          </view>

          <view class="month-picker-row">
            <view class="month-shift-btn" @tap="shiftMonth(-1)"><text>上一月</text></view>
            <view class="filter-col month-filter-col">
              <picker mode="selector" :range="monthOptions" :value="monthSelIndex" @change="onMonthChange">
                <view class="filter-picker">
                  <text>{{ monthDisplayLabel }}</text>
                  <text class="picker-arrow">▼</text>
                </view>
              </picker>
            </view>
            <view class="month-shift-btn" :class="{ 'month-shift-btn-disabled': isNextMonthDisabled }" @tap="shiftMonth(1)"><text>下一月</text></view>
          </view>
        </view>

        <!-- 选中客户卡片 -->
        <view v-if="selectedCustomerObj" class="card customer-card">
          <view class="customer-card-top">
            <view>
              <text class="customer-name">{{ selectedCustomerObj.name }}</text>
              <text class="customer-settle">结算模式：{{ selectedCustomerObj.settlementType === 'monthly' ? '月结客户' : '日结客户' }}</text>
            </view>
            <view class="customer-price">
              <text class="customer-price-label">专享水价</text>
              <text class="customer-price-value">¥{{ selectedCustomerObj.unitPrice }}/桶</text>
            </view>
          </view>
          <view v-if="selectedCustomerObj.phone || selectedCustomerObj.address" class="customer-contact">
            <text v-if="selectedCustomerObj.phone">📱 {{ selectedCustomerObj.phone }}</text>
            <text v-if="selectedCustomerObj.address">📍 {{ selectedCustomerObj.address }}</text>
          </view>
        </view>

        <!-- 客户账单汇总 -->
        <view class="card customer-summary">
          <view class="customer-summary-header">
            <text class="customer-summary-title">
              💰 「{{ activeCustomerDisplayName }}」{{ selectedMonth !== 'ALL' ? selectedMonth + '月' : '全期' }}账单汇总
            </text>
            <text class="customer-summary-count">{{ customerStats.orderCount }} 笔单据</text>
          </view>

          <view class="summary-grid">
            <view class="summary-item summary-item-emerald">
              <view class="summary-item-label">累计送水</view>
              <text class="summary-item-value">{{ customerStats.totalWater }} <text class="summary-item-unit">桶</text></text>
            </view>
            <view class="summary-item summary-item-amber">
              <view class="summary-item-label">累计回桶</view>
              <text class="summary-item-value">{{ customerStats.totalReturned }} <text class="summary-item-unit">个</text></text>
            </view>
            <view class="summary-item summary-item-blue">
              <view class="summary-item-label text-receivable">应收金额</view>
              <text class="summary-item-value text-receivable-dark">¥{{ customerStats.totalReceivable }}</text>
            </view>
            <view class="summary-item summary-item-green-dark">
              <view class="summary-item-label">实收/已付</view>
              <text class="summary-item-value">¥{{ customerStats.totalPaid }}</text>
            </view>
          </view>
        </view>

        <!-- 月度明细 -->
        <text class="section-title">「{{ activeCustomerDisplayName }}」各月份个人账单明细</text>

        <view v-if="monthlyGroups.length === 0" class="empty-state">
          <text class="empty-icon">📄</text>
          <text>暂无「{{ activeCustomerDisplayName }}」的配送账单记录</text>
        </view>

        <view v-for="mg in monthlyGroups" :key="mg.month" class="card month-card">
          <view class="month-header" @tap="toggleMonth(mg.month)">
            <view class="month-header-info">
              <view class="month-header-title-row">
                <text class="month-header-title-text">📅 {{ formatMonth(mg.month) }}</text>
                <text class="month-header-order-count">{{ mg.orders.length }} 笔送水记录</text>
              </view>
              <view class="month-header-stats">
                <text class="month-header-stat">送水: <text class="stat-bold">{{ mg.water }}</text> 桶</text>
                <text class="month-header-stat">回桶: <text class="stat-bold">{{ mg.returned }}</text> 个</text>
                <text class="month-header-stat">应收: <text class="stat-bold text-receivable">¥{{ mg.receivable }}</text></text>
                <text class="month-header-stat">实收: <text class="stat-bold text-emerald">¥{{ mg.paid }}</text></text>
              </view>
            </view>
            <text class="month-arrow">{{ expandedMonths[mg.month] ? '折叠' : '展开' }} {{ expandedMonths[mg.month] ? '▲' : '▼' }}</text>
          </view>

          <view v-if="expandedMonths[mg.month]" class="month-orders">
            <view v-for="ord in mg.orders" :key="ord._id" class="order-item">
              <view class="order-item-header">
                <text class="order-item-date">{{ ord.createdDate }}</text>
                <text class="order-item-tag" :class="ord.settlementType === 'monthly' ? 'tag-monthly' : 'tag-daily'">
                  {{ ord.settlementType === 'monthly' ? '月结' : '日结' }}
                </text>
                <text class="order-item-price">单价: ¥{{ getUnitPrice(ord) }}/桶</text>
              </view>

              <view class="order-item-grid">
                <view class="order-item-row">
                  <view class="order-item-cell order-item-cell-half">
                    <text class="order-item-cell-label">发水</text>
                    <text class="order-item-cell-value">{{ ord.quantity }} 桶</text>
                  </view>
                  <view class="order-item-cell order-item-cell-half">
                    <text class="order-item-cell-label">回桶</text>
                    <text class="order-item-cell-value">{{ ord.returnedBuckets }} 个</text>
                  </view>
                </view>
                <view class="order-item-row">
                  <view class="order-item-cell order-item-cell-half order-item-cell-accent">
                    <text class="order-item-cell-label">应收</text>
                    <text class="order-item-cell-value text-receivable">¥{{ getReceivableAmount(ord) }}</text>
                  </view>
                  <view class="order-item-cell order-item-cell-half order-item-cell-accent">
                    <text class="order-item-cell-label">实收</text>
                    <text class="order-item-cell-value" :class="getActualAmount(ord) >= getReceivableAmount(ord) ? 'text-emerald' : 'text-red'">
                      ¥{{ getActualAmount(ord) }}
                    </text>
                  </view>
                </view>
              </view>

              <view v-if="ord.notes" class="order-item-notes">
                <text>备注: {{ ord.notes }}</text>
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
import { ref, computed, watch } from 'vue'
import { useStore } from '../../common/store.js'
import { createUserUnitPriceMap, getOrderUnitPrice, getOrderReceivableAmount, getOrderActualReceivedAmount } from '../../common/utils.js'

const store = useStore()
const { state } = store
const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))

const selectedUser = ref('')
const selectedMonth = ref('ALL')
const expandedMonths = ref({})

const customerList = computed(() => {
  const map = new Map()
  state.users.filter(u => !u.isAdmin).forEach(u => {
    map.set(u.name, {
      username: u.username, name: u.name, phone: u.phone,
      address: u.address, unitPrice: u.unitPrice, settlementType: u.settlementType
    })
  })
  state.orders.forEach(o => {
    if (o.userName && !map.has(o.userName)) {
      map.set(o.userName, { name: o.userName, settlementType: o.settlementType, unitPrice: o.unitPrice })
    }
  })
  return Array.from(map.values())
})

const customerNames = computed(() => customerList.value.map(c => `${c.name} (${c.settlementType === 'monthly' ? '月结' : '日结'})`))

// 默认选中客户
watch(customerList, (list) => {
  if (!state.currentUser?.isAdmin) {
    selectedUser.value = state.currentUser?.name
  } else if (list.length > 0 && !selectedUser.value) {
    selectedUser.value = list[0].name
  }
}, { immediate: true })

const customerIndex = computed(() => {
  const idx = customerList.value.findIndex(c => c.name === selectedUser.value)
  return idx >= 0 ? idx : 0
})

const isPrevCustomerDisabled = computed(() => !state.currentUser?.isAdmin || customerList.value.length === 0 || customerIndex.value <= 0)
const isNextCustomerDisabled = computed(() => !state.currentUser?.isAdmin || customerList.value.length === 0 || customerIndex.value >= customerList.value.length - 1)

const onCustomerChange = (e) => {
  const cust = customerList.value[e.detail.value]
  if (cust) selectedUser.value = cust.name
}

const shiftCustomer = (offset) => {
  if (!state.currentUser?.isAdmin) return
  if (offset < 0 && isPrevCustomerDisabled.value) return
  if (offset > 0 && isNextCustomerDisabled.value) return
  const nextIndex = customerIndex.value + offset
  const cust = customerList.value[nextIndex]
  if (cust) selectedUser.value = cust.name
}

const monthList = computed(() => {
  const sourceOrders = state.orders.filter(o => {
    if (!state.currentUser?.isAdmin && o.userName !== state.currentUser?.name) return false
    if (selectedUser.value && o.userName !== selectedUser.value) return false
    return true
  })
  return [...new Set(sourceOrders.map(o => o.createdDate?.substring(0, 7)).filter(Boolean))].sort((a, b) => b.localeCompare(a))
})

const monthOptions = computed(() => ['全部月份', ...monthList.value])
const monthSelIndex = computed(() => {
  if (selectedMonth.value === 'ALL') return 0
  const idx = monthList.value.indexOf(selectedMonth.value)
  return idx >= 0 ? idx + 1 : 0
})
const monthDisplayLabel = computed(() => selectedMonth.value === 'ALL' ? '全部月份' : formatMonth(selectedMonth.value))

const onMonthChange = (e) => {
  selectedMonth.value = e.detail.value === 0 ? 'ALL' : monthList.value[e.detail.value - 1]
}

const isNextMonthDisabled = computed(() => selectedMonth.value === 'ALL')

const parseMonthString = (value) => {
  const parts = String(value || '').split('-').map(Number)
  if (parts.length !== 2 || parts.some(num => !Number.isFinite(num))) return null
  return { year: parts[0], month: parts[1] }
}

const shiftMonth = (offset) => {
  if (offset > 0 && isNextMonthDisabled.value) return
  const latestMonth = monthList.value[0]
  if (!latestMonth) return
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

const selectedCustomerObj = computed(() => {
  if (!selectedUser.value) return null
  return customerList.value.find(c => c.name === selectedUser.value) || null
})

const activeCustomerDisplayName = computed(() => selectedCustomerObj.value?.name || selectedUser.value || '全部客户')

const filteredOrders = computed(() =>
  state.orders.filter(o => {
    if (!state.currentUser?.isAdmin && o.userName !== state.currentUser?.name) return false
    if (selectedUser.value && o.userName !== selectedUser.value) return false
    if (selectedMonth.value !== 'ALL' && !o.createdDate?.startsWith(selectedMonth.value)) return false
    return true
  })
)

const getUnitPrice = (order) => getOrderUnitPrice(order, userUnitPriceMap.value)
const getReceivableAmount = (order) => getOrderReceivableAmount(order, userUnitPriceMap.value)
const getActualAmount = (order) => getOrderActualReceivedAmount(order)

const customerStats = computed(() => {
  let w = 0, r = 0, receivable = 0, paid = 0
  filteredOrders.value.forEach(o => {
    w += o.quantity; r += o.returnedBuckets
    receivable += getReceivableAmount(o)
    paid += getActualAmount(o)
  })
  return {
    totalWater: w, totalReturned: r,
    totalReceivable: Number(receivable.toFixed(2)),
    totalPaid: Number(paid.toFixed(2)),
    unpaidBalance: Number((receivable - paid).toFixed(2)),
    orderCount: filteredOrders.value.length
  }
})

const monthlyGroups = computed(() => {
  const groups = {}
  filteredOrders.value.forEach(ord => {
    const mKey = ord.createdDate?.substring(0, 7)
    if (!groups[mKey]) {
      groups[mKey] = { month: mKey, water: 0, returned: 0, receivable: 0, paid: 0, unpaid: 0, orders: [] }
    }
    const receivable = getReceivableAmount(ord)
    const actual = getActualAmount(ord)
    groups[mKey].water += ord.quantity
    groups[mKey].returned += ord.returnedBuckets
    groups[mKey].receivable += receivable
    groups[mKey].paid += actual
    groups[mKey].orders.push(ord)
  })
  Object.values(groups).forEach(g => {
    g.unpaid = Number((g.receivable - g.paid).toFixed(2))
    g.receivable = Number(g.receivable.toFixed(2))
    g.paid = Number(g.paid.toFixed(2))
    g.orders.sort((a, b) => b.createdAt?.localeCompare(a.createdAt || ''))
  })
  return Object.values(groups).sort((a, b) => b.month?.localeCompare(a.month || ''))
})

const toggleMonth = (monthKey) => {
  expandedMonths.value = { ...expandedMonths.value, [monthKey]: !expandedMonths.value[monthKey] }
}

const formatMonth = (m) => { if (!m) return ''; const [y, mm] = m.split('-'); return `${y}年${mm}月` }

</script>

<style lang="scss" scoped>
.user-monthly-page { min-height: 100vh; background: linear-gradient(180deg, #f8fbfa 0%, #f2f6f9 100%); display: flex; flex-direction: column; }
.user-monthly-content { flex: 1; }
.user-monthly-inner { padding: 16px; }

.card { background: #fff; border-radius: 18px; border: 1px solid #e8eef5; box-shadow: 0 8px 22px rgba(15,23,42,0.04); }

.filter-card { padding: 14px; margin-bottom: 16px; }
.filter-grid { display: grid; grid-template-columns: 1fr; gap: 8px; }
.filter-col { }
.filter-label { font-size: 10px; font-weight: 700; color: #64748b; display: block; margin-bottom: 4px; }
.filter-picker {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 8px 10px; background: #f8fafc; border: 1px solid #dbe4ee;
  border-radius: 14px; font-size: 12px; font-weight: 700; color: #1e293b; box-sizing: border-box; box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
}
.filter-picker-locked { background: #f1f5f9; }
.locked-tag { font-size: 9px; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
.picker-arrow { font-size: 8px; color: #94a3b8; }
.month-picker-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 72px; gap: 8px; align-items: center; width: 100%; margin-top: 10px; }
.month-filter-col { min-width: 0; }
.month-shift-btn {
  height: 36px; display: flex; align-items: center; justify-content: center;
  background: #f8fafc; border: 1px solid #dbe4ee; border-radius: 14px;
  font-size: 11px; font-weight: 700; color: #475569;
}
.month-shift-btn-disabled { opacity: 0.45; }

.customer-card { padding: 16px; margin-bottom: 16px; background: #f8fafc; border-color: #e3ebf3; }
.customer-card-top { display: flex; align-items: center; gap: 12px; }
.customer-name { font-size: 12px; font-weight: 700; color: #1e293b; }
.customer-settle { font-size: 10px; color: #475569; font-weight: 600; display: block; margin-top: 2px; }
.customer-price { margin-left: auto; text-align: right; }
.customer-price-label { font-size: 9px; color: #94a3b8; font-weight: 600; display: block; }
.customer-price-value { font-size: 12px; font-weight: 900; color: #059669; font-family: monospace; }
.customer-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(226,232,240,0.6); font-size: 10px; color: #475569; }

.customer-summary { padding: 18px; margin-bottom: 16px; }
.customer-summary-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 12px; }
.customer-summary-title { font-size: 10px; font-weight: 700; color: #1e293b; }
.customer-summary-count { font-size: 10px; font-weight: 700; color: #94a3b8; background: #f8fafc; padding: 2px 8px; border-radius: 6px; border: 1px solid #f1f5f9; font-family: monospace; }

.summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; }
.summary-item { padding: 11px 6px; border-radius: 14px; text-align: center; display: flex; flex-direction: column; gap: 3px; box-shadow: 0 4px 14px rgba(15,23,42,0.03); }
.summary-item-emerald { background: rgba(236,253,245,0.5); border: 1px solid rgba(209,250,229,0.6); }
.summary-item-amber { background: rgba(255,251,235,0.5); border: 1px solid rgba(253,230,138,0.6); }
.summary-item-blue { background: rgba(239,246,255,0.5); border: 1px solid rgba(219,234,254,0.6); }
.summary-item-green-dark { background: rgba(248,250,252,0.9); border: 1px solid rgba(226,232,240,0.9); }
.summary-item-label { font-size: 8px; font-weight: 700; color: #94a3b8; line-height: 1.2; }
.text-receivable { color: #dc2626; }
.summary-item-value { font-size: 12px; font-weight: 900; color: #1e293b; font-family: monospace; }
.text-receivable-dark { color: #b91c1c; }
.summary-item-unit { font-size: 9px; font-weight: 400; color: #94a3b8; }

.section-title { font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 4px; margin-bottom: 8px; display: block; }
.empty-state { text-align: center; padding: 32px; font-size: 12px; color: #94a3b8; }
.empty-icon { font-size: 24px; display: block; margin-bottom: 8px; }

.month-card { margin-bottom: 12px; overflow: hidden; }
.month-header { padding: 16px; display: flex; justify-content: space-between; border-bottom: 1px solid #f8fafc; }
.month-header-info { flex: 1; }
.month-header-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.month-header-title-text { font-size: 10px; font-weight: 800; color: #1e293b; }
.month-header-order-count { font-size: 9px; font-weight: 400; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 999px; font-family: monospace; }
.month-header-stats { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; }
.month-header-stat { font-size: 10px; color: #64748b; }
.stat-bold { font-weight: 700; color: #1e293b; }
.text-receivable { color: #dc2626; }
.text-emerald { color: #059669; }
.month-arrow { font-size: 10px; color: #94a3b8; font-weight: 600; flex-shrink: 0; margin-left: 8px; }

.month-orders { background: rgba(248,250,252,0.68); padding: 12px; }
.order-item { background: #fff; padding: 12px; border-radius: 14px; border: 1px solid #e8eef5; margin-bottom: 8px; box-shadow: 0 4px 14px rgba(15,23,42,0.03); }
.order-item-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.order-item-date { font-size: 11px; font-weight: 700; color: #1e293b; font-family: monospace; }
.order-item-tag { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
.tag-monthly { background: #eff6ff; color: #2563eb; }
.tag-daily { background: #f1f5f9; color: #334155; }
.order-item-price { font-size: 9px; color: #94a3b8; font-family: monospace; }

.order-item-grid { display: flex; flex-direction: column; gap: 6px; }
.order-item-row { display: flex; gap: 6px; }
.order-item-cell {
  box-sizing: border-box; text-align: center;
  padding: 7px 6px; background: #f8fafc; border: 1px solid #e8eef5; border-radius: 10px;
}
.order-item-cell-half { width: calc(50% - 3px); }
.order-item-cell-accent { background: rgba(239,246,255,0.6); border-color: #dbeafe; }
.order-item-cell-label { font-size: 8px; color: #94a3b8; display: block; }
.order-item-cell-value { font-size: 10px; font-weight: 900; color: #1e293b; font-family: monospace; }
.order-item-cell-value.text-receivable { color: #dc2626; }
.order-item-cell-value.text-emerald { color: #059669; }
.order-item-cell-value.text-red { color: #e11d48; }

.order-item-notes { margin-top: 8px; padding: 6px 8px; background: rgba(241,245,249,0.7); border-radius: 8px; font-size: 10px; color: #64748b; }

.safe-bottom { height: 32px; }
</style>
