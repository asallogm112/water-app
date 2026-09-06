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
                    <view class="filter-picker" @tap="openCustomerModal">
                      <text>{{ activeCustomerPickerLabel }}</text>
                      <text class="picker-arrow">▼</text>
                    </view>
                  </view>
                  <view class="month-shift-btn" :class="{ 'month-shift-btn-disabled': isNextCustomerDisabled }" @tap="shiftCustomer(1)"><text>下一人</text></view>
                </view>
              </template>
              <template v-else>
                <view class="filter-picker filter-picker-locked">
                  <text>{{ state.currentUser?.userName }} (本人)</text>
                  <text class="locked-tag">已锁定</text>
                </view>
              </template>
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

        <!-- 选中客户卡片 -->
        <view v-if="selectedCustomerObj" class="card customer-card">
          <view class="customer-card-top">
            <view>
              <text class="customer-name">{{ selectedCustomerObj.userName }}</text>
            </view>
            <view v-if="canManageData" class="customer-action-group">
              <view class="customer-copy-btn" :class="{ 'customer-copy-btn-active': hasCustomerRemark }" @tap="openCustomerRemarkModal">
                <text class="customer-copy-btn-text">备注</text>
              </view>
              <view class="customer-copy-btn" @tap="openAddModal()">
                <text class="customer-copy-btn-text">添加</text>
              </view>
              <view class="customer-copy-btn" @tap="openExportModal">
                <text class="customer-copy-btn-text">导出</text>
              </view>
            </view>
          </view>
          <view v-if="hasCustomerRemark || remarkComparisonList.length > 0" class="customer-remark-panel">
            <view class="customer-remark-panel-header" @tap="toggleCustomerRemarkExpanded">
              <text class="customer-remark-panel-title">备注</text>
              <view class="customer-remark-panel-actions">
                <text class="customer-remark-export" @tap.stop="exportRemarkComparison">导出</text>
                <text class="customer-remark-panel-toggle">{{ isCustomerRemarkExpanded ? '折叠 ▲' : '展开 ▼' }}</text>
              </view>
            </view>
            <view v-if="isCustomerRemarkExpanded" class="customer-remark-panel-body" @tap="toggleCustomerRemarkExpanded">
              <text v-if="currentCustomerRemark" class="customer-remark-manual">{{ currentCustomerRemark }}</text>
              <view v-for="item in remarkComparisonList" :key="item.id" class="customer-remark-order">
                <text class="customer-remark-date">{{ item.dateLabel }}</text>
                <view v-if="item.segments" class="customer-remark-values">
                  <text v-for="(line, lineIndex) in item.segments" :key="lineIndex" class="customer-remark-line">
                    <text v-for="(seg, segIndex) in line" :key="segIndex" :class="getRemarkDiffClass(seg)">{{ seg.text }}</text>
                    <text v-if="lineIndex < item.segments.length - 1">，</text>
                  </text>
                </view>
                <text v-else class="customer-remark-raw">{{ item.rawNotes }}</text>
              </view>
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
              <text class="summary-item-value text-receivable-dark">¥{{ formatMoney(customerStats.totalReceivable) }}</text>
            </view>
            <view class="summary-item summary-item-green-dark">
              <view class="summary-item-label">实收/已付</view>
              <text class="summary-item-value">¥{{ formatMoney(customerStats.totalPaid) }}</text>
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
                <text class="month-header-order-count">{{ mg.orders.length }} 条日期记录</text>
              </view>
              <view class="month-header-stats">
                <text class="month-header-stat">送水: <text class="stat-bold">{{ mg.water }}</text> 桶</text>
                <text class="month-header-stat">回桶: <text class="stat-bold">{{ mg.returned }}</text> 个</text>
                <text class="month-header-stat">应收: <text class="stat-bold text-receivable">¥{{ formatMoney(mg.receivable) }}</text></text>
                <text class="month-header-stat">实收: <text class="stat-bold text-emerald">¥{{ formatMoney(mg.paid) }}</text></text>
              </view>
            </view>
            <text class="month-arrow">{{ isOrderMonthExpanded(mg.month) ? '折叠' : '展开' }} {{ isOrderMonthExpanded(mg.month) ? '▲' : '▼' }}</text>
          </view>

          <view v-if="isOrderMonthExpanded(mg.month)" class="month-orders">
              <view v-for="ord in mg.orders" :key="ord._id" class="order-item">
              <view class="order-item-header">
                <text class="order-item-date">{{ ord.createdDate }}</text>
                <text class="order-item-price">单价: ¥{{ formatMoney(getUnitPrice(ord)) }}/桶</text>
                <view v-if="canManageData" class="order-item-edit-btn" @tap="openEditModal(ord)">
                  <text>编辑</text>
                </view>
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
                    <text class="order-item-cell-value text-receivable">¥{{ formatMoney(getReceivableAmount(ord)) }}</text>
                  </view>
                  <view class="order-item-cell order-item-cell-half order-item-cell-accent">
                    <text class="order-item-cell-label">实收</text>
                    <text class="order-item-cell-value" :class="getActualAmount(ord) >= getReceivableAmount(ord) ? 'text-emerald' : 'text-red'">
                      ¥{{ formatMoney(getActualAmount(ord)) }}
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

    <view v-if="showEditModal" class="editor-mask" @tap="closeEditModal" @touchmove.stop.prevent>
      <view class="editor-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">{{ editorMode === 'add' ? '新增订单' : '编辑订单' }}</text>
            <text class="editor-subtitle">{{ editorMode === 'add' ? `当前客户 ${editForm.userName || ''} · ${editorOrderDate}` : `订单日期：${editorOrderDate}` }}</text>
          </view>
          <text class="editor-close" @tap="closeEditModal">关闭</text>
        </view>
        <scroll-view class="editor-body" scroll-y @touchmove.stop>
          <view class="editor-grid">
            <view v-if="editorMode === 'add'" class="editor-field editor-field-full">
              <text class="editor-label">日期</text>
              <uni-easyinput class="editor-input" type="text" v-model="editorOrderDate" :inputBorder="false" placeholder="YYYY-MM-DD" />
            </view>
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
          <button v-if="editorMode === 'edit'" class="editor-delete-btn" @tap="confirmDeleteOrder">删除</button>
          <button class="editor-save-btn" @tap="submitOrderForm">{{ editorMode === 'add' ? '新增订单' : '保存修改' }}</button>
        </view>
      </view>
    </view>

    <view v-if="showCustomerRemarkModal" class="editor-mask" @tap="closeCustomerRemarkModal" @touchmove.stop.prevent>
      <view class="editor-modal customer-remark-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">人员备注</text>
            <text class="editor-subtitle">{{ activeCustomerDisplayName }}</text>
          </view>
          <text class="editor-close" @tap="closeCustomerRemarkModal">关闭</text>
        </view>
        <view class="customer-remark-body">
          <textarea class="customer-remark-textarea" maxlength="-1" v-model="customerRemarkInput" auto-height @touchmove.stop placeholder="请输入备注" placeholder-class="input-placeholder" />
        </view>
        <view class="customer-remark-actions">
          <button class="customer-remark-clear-btn" @tap="clearCustomerRemark">清空</button>
          <button class="customer-remark-save-btn" @tap="saveCustomerRemark">保存</button>
        </view>
      </view>
    </view>

    <view v-if="showBatchAddModal" class="editor-mask" @tap="closeBatchAddModal" @touchmove.stop.prevent>
      <view class="batch-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">录入订单</text>
            <text class="editor-subtitle">支持日期简写: 0623 表示 {{ currentYear }}-06-23</text>
          </view>
          <text class="editor-close" @tap="closeBatchAddModal">关闭</text>
        </view>
        <scroll-view class="batch-modal-body" scroll-y @touchmove.stop>
          <view v-if="batchAddError" class="batch-error-banner"><text>{{ batchAddError }}</text></view>
          <view class="batch-parse-card">
            <textarea
              class="batch-parse-textarea"
              :rows="5"
              maxlength="-1"
              v-model="batchAddInputText"
              auto-height
              @touchmove.stop
              placeholder="示例1：0623 22 3 80&#10;示例2：0829 老王 10 2 50"
              placeholder-class="input-placeholder"
            />
            <view class="batch-parse-btns">
              <button class="batch-parse-btn" @tap="handleBatchAddParse">开始智能解析</button>
              <button class="batch-parse-clear" @tap="clearBatchAddInput">清空</button>
            </view>
          </view>

          <view v-if="batchAddItems.length > 0" class="batch-result-card">
            <text class="batch-result-title">解析数据</text>
            <view v-for="(item, idx) in batchAddItems" :key="item.id || `batch-add-${idx}`" class="batch-result-row">
              <view class="batch-result-main">
                <view class="batch-result-preview-wrap">
                  <text class="batch-result-preview-line">{{ formatBatchAddPreviewLine(item) }}</text>
                  <text class="batch-result-toggle-btn" @tap="toggleBatchAddExpanded(item.id)">{{ item.expanded ? '收起' : '展开' }}</text>
                </view>
                <view v-if="item.expanded" class="batch-result-form-grid">
                  <view class="batch-result-field batch-result-field-name">
                    <text class="batch-result-field-label">日期</text>
                    <uni-easyinput :value="item.createdDate" type="text" :inputBorder="false" @input="updateBatchAddItemField(item.id, 'createdDate', $event)" />
                  </view>
                  <view class="batch-result-field batch-result-field-name">
                    <text class="batch-result-field-label">姓名</text>
                    <uni-easyinput :value="item.userName" type="text" :inputBorder="false" @input="updateBatchAddItemField(item.id, 'userName', $event)" />
                  </view>
                  <view class="batch-result-field">
                    <text class="batch-result-field-label">送水数量</text>
                    <uni-easyinput :value="String(item.quantity ?? '')" type="number" :inputBorder="false" @input="updateBatchAddItemField(item.id, 'quantity', $event)" />
                  </view>
                  <view class="batch-result-field">
                    <text class="batch-result-field-label">回桶数量</text>
                    <uni-easyinput :value="String(item.returnedBuckets ?? '')" type="number" :inputBorder="false" @input="updateBatchAddItemField(item.id, 'returnedBuckets', $event)" />
                  </view>
                  <view class="batch-result-field batch-result-field-name">
                    <text class="batch-result-field-label">付款金额</text>
                    <uni-easyinput :value="String(item.actualAmountReceived ?? '')" type="digit" :inputBorder="false" @input="updateBatchAddItemField(item.id, 'actualAmountReceived', $event)" />
                  </view>
                </view>
              </view>
              <view class="batch-result-delete-btn" @tap="deleteBatchAddRow(item.id)">删除</view>
            </view>
            <button class="batch-result-submit-btn" :class="{ 'btn-disabled': batchAddItems.length === 0 }" :disabled="batchAddItems.length === 0" @tap="submitBatchAddOrders">提交这 {{ batchAddItems.length }} 笔订单</button>
          </view>
        </scroll-view>
      </view>
    </view>

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
        <scroll-view class="customer-select-list" scroll-y :scroll-into-view="customerScrollIntoView" @touchmove.stop>
          <view
            v-for="(customer, index) in filteredCustomerList"
            :key="customer.userName"
            :id="`customer-option-${index}`"
            class="customer-select-item"
            :class="{ 'customer-select-item-active': customer.userName === selectedUser }"
            @tap="selectCustomer(customer.userName)"
          >
            <view class="customer-select-main">
              <text class="customer-select-name">{{ customer.userName }}</text>
            </view>
            <text v-if="customer.userName === selectedUser" class="customer-select-check">已选</text>
          </view>
          <view v-if="filteredCustomerList.length === 0" class="customer-select-empty">
            <text>没有匹配的人员</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="showMonthModal" class="editor-mask editor-mask-centered" @tap="closeMonthModal" @touchmove.stop.prevent>
      <view class="editor-modal customer-select-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">选择月份</text>
          </view>
          <text class="editor-close" @tap="closeMonthModal">关闭</text>
        </view>
        <scroll-view class="customer-select-list" scroll-y :scroll-into-view="monthScrollIntoView" @touchmove.stop>
          <view
            id="month-option-ALL"
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
            v-for="month in monthList"
            :key="month"
            :id="`month-option-${month}`"
            class="customer-select-item"
            :class="{ 'customer-select-item-active': selectedMonth === month }"
            @tap="selectMonth(month)"
          >
            <view class="customer-select-main">
              <text class="customer-select-name">{{ formatMonth(month) }}</text>
            </view>
            <text v-if="selectedMonth === month" class="customer-select-check">已选</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="showExportModal" class="editor-mask" @tap="closeExportModal" @touchmove.stop.prevent>
      <view class="editor-modal export-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <view>
            <text class="editor-title">选择导出方式</text>
            <text class="editor-subtitle">当前客户：{{ activeCustomerDisplayName }}</text>
          </view>
          <text class="editor-close" @tap="closeExportModal">关闭</text>
        </view>
        <view class="export-option-list">
          <view class="export-option-item" @tap="handleExportOption('excel')">
            <text class="export-option-title">Excel</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useStore } from '../../common/store.js'
import { createUserUnitPriceMap, formatMoney, getOrderUnitPrice, getOrderReceivableAmount, getOrderActualReceivedAmount } from '../../common/utils.js'
import { exportExcelWorkbook, showExcelPreviewShareActions } from '../../common/export-excel.js'

const store = useStore()
const { state, addOrder, addOrders, updateOrder, deleteOrder, formatBeijingDateTime, formatDate } = store
const canManageData = computed(() => state.currentUser?.userName === 'chen')
const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))
const CALENDAR_START_MONTH = '2000-01'
const USER_MONTHLY_SELECTED_USER_KEY = 'user_monthly_selected_user'
const USER_MONTHLY_SELECTED_MONTH_KEY = 'user_monthly_selected_month'
const USER_MONTHLY_CUSTOMER_REMARK_MAP_KEY = 'user_monthly_customer_month_remark_map'
const USER_MONTHLY_REMARK_EXPANDED_MAP_KEY = 'user_monthly_remark_expanded_map'
// 订单列表月份折叠状态：key = `${客户}__${月份}`，一一对应持久化
const USER_MONTHLY_ORDERS_EXPANDED_KEY = 'user_monthly_orders_expanded_map'

const selectedUser = ref('')
const selectedMonth = ref('ALL')

const readOrdersExpandedMap = () => {
  try {
    const raw = uni.getStorageSync(USER_MONTHLY_ORDERS_EXPANDED_KEY)
    if (!raw) return {}
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

const persistOrdersExpandedMap = () => {
  uni.setStorageSync(USER_MONTHLY_ORDERS_EXPANDED_KEY, JSON.stringify(ordersExpandedMap.value))
}

const ordersExpandedMap = ref(readOrdersExpandedMap())

const getOrderExpandedKey = (monthKey) => `${selectedUser.value || ''}__${monthKey || ''}`

// 初始化：默认最近一个有数据的月份展开；否则按持久化状态恢复
const isOrderMonthExpanded = (monthKey) => {
  const saved = ordersExpandedMap.value[getOrderExpandedKey(monthKey)]
  if (saved !== undefined) return saved
  return false
}
const showCustomerModal = ref(false)
const showMonthModal = ref(false)
const customerSearchKeyword = ref('')
const customerScrollIntoView = ref('')
const monthScrollIntoView = ref('')
const showExportModal = ref(false)
const showEditModal = ref(false)
const showBatchAddModal = ref(false)
const showCustomerRemarkModal = ref(false)
const customerRemarkInput = ref('')
const customerRemarkMap = ref({})
const customerRemarkExpandedMap = ref({})
const editorMode = ref('edit')
const editorOrderDate = ref('')
const editingOrderId = ref('')
const batchAddInputText = ref('')
const batchAddItems = ref([])
const batchAddError = ref('')
const editForm = ref({
  userName: '',
  unitPrice: '0',
  quantity: '0',
  returnedBuckets: '0',
  actualAmountReceived: '0',
  notes: ''
})

const customerList = computed(() => {
  const map = new Map()
  state.users.filter(u => !u.isAdmin).forEach(u => {
      map.set(u.userName, {
	      userName: u.userName, phone: u.phone,
	      address: u.address, unitPrice: u.unitPrice, settlementType: u.settlementType
	    })
	  })
	  state.orders.forEach(o => {
	    if (o.userName && !map.has(o.userName)) {
	      map.set(o.userName, { userName: o.userName, settlementType: o.settlementType, unitPrice: o.unitPrice })
	    }
	  })
  return Array.from(map.values()).sort((a, b) => {
    const aMonthly = a.settlementType === 'monthly' ? 0 : 1
    const bMonthly = b.settlementType === 'monthly' ? 0 : 1
    if (aMonthly !== bMonthly) return aMonthly - bMonthly
    return String(a.userName || '').localeCompare(String(b.userName || ''), 'en', { sensitivity: 'base' })
  })
})

const readCustomerRemarkMap = () => {
  try {
    const raw = uni.getStorageSync(USER_MONTHLY_CUSTOMER_REMARK_MAP_KEY)
    if (!raw) return {}
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

customerRemarkMap.value = readCustomerRemarkMap()

const persistCustomerRemarkMap = () => {
  uni.setStorageSync(USER_MONTHLY_CUSTOMER_REMARK_MAP_KEY, JSON.stringify(customerRemarkMap.value))
}

const readCustomerRemarkExpandedMap = () => {
  try {
    const raw = uni.getStorageSync(USER_MONTHLY_REMARK_EXPANDED_MAP_KEY)
    if (!raw) return {}
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    return {}
  }
}

customerRemarkExpandedMap.value = readCustomerRemarkExpandedMap()

const persistCustomerRemarkExpandedMap = () => {
  uni.setStorageSync(USER_MONTHLY_REMARK_EXPANDED_MAP_KEY, JSON.stringify(customerRemarkExpandedMap.value))
}

const activeCustomerPickerLabel = computed(() => selectedCustomerObj.value?.userName || '请选择人员')
const filteredCustomerList = computed(() => {
  const keyword = String(customerSearchKeyword.value || '').trim().toLowerCase()
  if (!keyword) return customerList.value
  return customerList.value.filter(customer => String(customer.userName || '').toLowerCase().includes(keyword))
})

// 默认选中客户
watch(customerList, (list) => {
  if (!state.currentUser?.isAdmin) {
    selectedUser.value = state.currentUser?.userName
  } else if (list.length > 0) {
    const storedUser = String(uni.getStorageSync(USER_MONTHLY_SELECTED_USER_KEY) || '').trim()
    if (storedUser && list.some(item => item.userName === storedUser)) {
      selectedUser.value = storedUser
    } else if (!selectedUser.value || !list.some(item => item.userName === selectedUser.value)) {
      selectedUser.value = list[0].userName
    }
  }
}, { immediate: true })

watch(selectedUser, (value) => {
  if (!state.currentUser?.isAdmin) return
  const userName = String(value || '').trim()
  if (!userName) return
  uni.setStorageSync(USER_MONTHLY_SELECTED_USER_KEY, userName)
})

watch(selectedMonth, (value) => {
  const monthValue = String(value || 'ALL').trim() || 'ALL'
  uni.setStorageSync(USER_MONTHLY_SELECTED_MONTH_KEY, monthValue)
})

const customerIndex = computed(() => {
  const idx = customerList.value.findIndex(c => c.userName === selectedUser.value)
  return idx >= 0 ? idx : 0
})

const isPrevCustomerDisabled = computed(() => !state.currentUser?.isAdmin || customerList.value.length === 0 || customerIndex.value <= 0)
const isNextCustomerDisabled = computed(() => !state.currentUser?.isAdmin || customerList.value.length === 0 || customerIndex.value >= customerList.value.length - 1)

const triggerScrollIntoView = (targetRef, value) => {
  targetRef.value = ''
  nextTick(() => {
    setTimeout(() => {
      targetRef.value = value
    }, 0)
  })
}

const openCustomerModal = () => {
  if (!state.currentUser?.isAdmin || customerList.value.length === 0) return
  customerSearchKeyword.value = ''
  showCustomerModal.value = true
  triggerScrollIntoView(customerScrollIntoView, `customer-option-${customerIndex.value}`)
}

const closeCustomerModal = () => {
  showCustomerModal.value = false
  customerSearchKeyword.value = ''
  customerScrollIntoView.value = ''
}

const selectCustomer = (userName) => {
  selectedUser.value = userName
  closeCustomerModal()
}

const shiftCustomer = (offset) => {
  if (!state.currentUser?.isAdmin) return
  if (offset < 0 && isPrevCustomerDisabled.value) return
  if (offset > 0 && isNextCustomerDisabled.value) return
  const nextIndex = customerIndex.value + offset
  const cust = customerList.value[nextIndex]
  if (cust) selectedUser.value = cust.userName
}

const monthList = computed(() => {
  const latestMonth = store.formatDate(new Date()).substring(0, 7)
  const parsedStart = parseMonthString(CALENDAR_START_MONTH)
  const parsedEnd = parseMonthString(latestMonth)
  if (!parsedStart || !parsedEnd) return [latestMonth]
  const result = []
  const cursor = new Date(parsedStart.year, parsedStart.month - 1, 1)
  const endDate = new Date(parsedEnd.year, parsedEnd.month - 1, 1)
  while (cursor.getTime() <= endDate.getTime()) {
    result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return result.reverse()
})

const monthDisplayLabel = computed(() => selectedMonth.value === 'ALL' ? '全部月份' : formatMonth(selectedMonth.value))

const openMonthModal = () => {
  showMonthModal.value = true
  triggerScrollIntoView(monthScrollIntoView, selectedMonth.value === 'ALL' ? 'month-option-ALL' : `month-option-${selectedMonth.value}`)
}

const closeMonthModal = () => {
  showMonthModal.value = false
  monthScrollIntoView.value = ''
}

const selectMonth = (month) => {
  selectedMonth.value = month
  closeMonthModal()
}

const isNextMonthDisabled = computed(() => selectedMonth.value === 'ALL')

const parseMonthString = (value) => {
  const parts = String(value || '').split('-').map(Number)
  if (parts.length !== 2 || parts.some(num => !Number.isFinite(num))) return null
  return { year: parts[0], month: parts[1] }
}

watch(monthList, (list) => {
  const storedMonth = String(uni.getStorageSync(USER_MONTHLY_SELECTED_MONTH_KEY) || '').trim()
  if (storedMonth === 'ALL') {
    selectedMonth.value = 'ALL'
    return
  }
  if (storedMonth && list.includes(storedMonth)) {
    selectedMonth.value = storedMonth
    return
  }
  if (selectedMonth.value !== 'ALL' && !list.includes(selectedMonth.value)) {
    selectedMonth.value = 'ALL'
  }
}, { immediate: true })

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
  return customerList.value.find(c => c.userName === selectedUser.value) || null
})

const activeCustomerDisplayName = computed(() => selectedCustomerObj.value?.userName || selectedUser.value || '全部客户')
const customerRemarkStorageKey = computed(() => JSON.stringify([selectedUser.value || '', selectedMonth.value || 'ALL']))
const currentCustomerRemark = computed(() => String(customerRemarkMap.value[customerRemarkStorageKey.value] || '').trim())
const hasCustomerRemark = computed(() => !!currentCustomerRemark.value)
const isCustomerRemarkExpanded = computed(() => customerRemarkExpandedMap.value[customerRemarkStorageKey.value] !== false)

const openCustomerRemarkModal = () => {
  if (!selectedUser.value) return
  customerRemarkInput.value = currentCustomerRemark.value
  showCustomerRemarkModal.value = true
}

const closeCustomerRemarkModal = () => {
  showCustomerRemarkModal.value = false
}

const clearCustomerRemark = () => {
  customerRemarkInput.value = ''
}

const saveCustomerRemark = () => {
  const storageKey = customerRemarkStorageKey.value
  if (!selectedUser.value) return
  const content = String(customerRemarkInput.value || '').trim()
  if (content) {
    customerRemarkMap.value = { ...customerRemarkMap.value, [storageKey]: content }
  } else {
    const nextMap = { ...customerRemarkMap.value }
    delete nextMap[storageKey]
    customerRemarkMap.value = nextMap
  }
  persistCustomerRemarkMap()
  closeCustomerRemarkModal()
}

const toggleCustomerRemarkExpanded = () => {
  const storageKey = customerRemarkStorageKey.value
  customerRemarkExpandedMap.value = {
    ...customerRemarkExpandedMap.value,
    [storageKey]: !isCustomerRemarkExpanded.value
  }
  persistCustomerRemarkExpandedMap()
}

// 备注对账信息导出为 Excel（预览 / 分享给微信好友）
const exportRemarkComparison = () => {
  if (remarkComparisonList.value.length === 0) {
    uni.showToast({ title: '暂无对账数据', icon: 'none' })
    return
  }
  exportExcelWorkbook({
    fileName: selectedMonth.value === 'ALL'
      ? `${activeCustomerDisplayName.value}-人工对账记录`
      : `${activeCustomerDisplayName.value}-${selectedMonth.value}-人工对账记录`,
    sheets: [
      { name: '备注对账', ...buildRemarkComparisonSheetRows() }
    ]
  }).then(showExcelPreviewShareActions).catch(() => {})
}

const filteredOrders = computed(() =>
  state.orders.filter(o => {
    if (!state.currentUser?.isAdmin && o.userName !== state.currentUser?.userName) return false
    if (selectedUser.value && o.userName !== selectedUser.value) return false
    if (selectedMonth.value !== 'ALL' && !o.createdDate?.startsWith(selectedMonth.value)) return false
    return true
  })
)

const formatRemarkNumber = (value) => {
  const number = Number(value)
  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(2)))
}

const formatRemarkDate = (value) => {
  const matched = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!matched) return String(value || '')
  return `${Number(matched[2])}月${Number(matched[3])}日`
}

const remarkComparisonList = computed(() => {
  const list = []
  monthlyGroups.value.forEach(group => {
    group.orders.forEach(order => {
      const hasSegments = !!order.diffSegments && order.diffSegments.length > 0
      const notes = String(order.notes || '').trim()
      // 能解析出差值 → 显示着色段落
      if (hasSegments) {
        list.push({
          id: order._id,
          date: order.createdDate,
          dateLabel: formatRemarkDate(order.createdDate),
          segments: order.diffSegments,
          rawNotes: ''
        })
        return
      }
      // 能解析出对账条目但差值全为 0（数据没问题）→ 不显示
      if (order.canParseRemark) return
      // 完全解析不出但备注非空 → 原文显示备注
      if (notes) {
        list.push({
          id: order._id,
          date: order.createdDate,
          dateLabel: formatRemarkDate(order.createdDate),
          segments: null,
          rawNotes: notes
        })
      }
    })
  })
  return list.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
})

// 解析备注中的对账数据，格式：名字 拉水数 回桶数（如：老大 0 400，我 0 440）
// 只写一个数字时那是拉水数（如：老大 100），回桶视为 0
// 数字为 0 是占位符，代表该项数据没问题，不计算和显示
// 时间单位字：避免「5月13日」这类日期前缀被误判成对账人
const REMARK_TIME_UNIT_NAMES = ['年', '月', '日', '号', '点', '时', '分', '秒', '周', '天']

// 名字部分排除数字，兼容「老大0 400」这类名字与数字无空格的写法
// 名字后允许可选冒号，兼容「老大: 100」这类写法
// 返回原始数字：first（第一个数字）、second（第二个数字，未写为 null）
const parseRemarkEntries = (notes) => {
  const text = String(notes || '').trim()
  if (!text) return []
  const pattern = /([^\s,，、;；:：\d]+)\s*[:：]?\s*(-?\d+(?:\.\d+)?)(?:\s+(-?\d+(?:\.\d+)?))?/g
  const entries = []
  let matched = pattern.exec(text)
  while (matched) {
    const name = matched[1]
    if (!REMARK_TIME_UNIT_NAMES.includes(name)) {
      const hasTwo = matched[3] !== undefined
      entries.push({
        name,
        first: Number(matched[2]),
        second: hasTwo ? Number(matched[3]) : null
      })
    }
    matched = pattern.exec(text)
  }
  return entries
}

// 备注里只写一个数字时，用「拉水/回桶」关键词判断这个数字属于哪个项目
// 写了「回桶」→ 算回桶；写了「拉水」或没写 → 默认算拉水
const detectSingleRemarkType = (notes) => {
  const text = String(notes || '')
  const hasReturned = /回桶/.test(text)
  const hasWater = /拉水|送水/.test(text)
  if (hasReturned && !hasWater) return '回桶'
  return '拉水'
}

// 统计单个订单备注的对账记录（客户在前与我比较），页面展示与 Excel 导出共用
// 任一方数字为 0 代表该项数据没问题，不计算和显示
// 着色按业务盈亏：拉水客户少记=我们亏钱→红；回桶客户少记=我们占便宜→绿
const buildRemarkDiffRecords = (order) => {
  const entries = parseRemarkEntries(order?.notes)
  if (entries.length === 0) return []
  const other = entries.find(item => item.name !== '我')
  if (!other) return []
  const mine = entries.find(item => item.name === '我')
  // 只写一个数字时，按备注里的「拉水/回桶」关键词决定归属
  const singleType = detectSingleRemarkType(order?.notes)
  // 取某个项目的数值：写了两个数字则 第一个=拉水/第二个=回桶；
  // 只写一个数字则只有指定项目有值，另一项为 0（代表没问题，不计算）
  const pickValue = (entry, type) => {
    if (entry.second !== null) return type === '拉水' ? entry.first : entry.second
    return singleType === type ? entry.first : 0
  }
  // 我的数据优先取备注中的「我」，没有则回退到订单记录
  const myWater = mine ? pickValue(mine, '拉水') : (Number(order?.quantity) || 0)
  const myReturned = mine ? pickValue(mine, '回桶') : (Number(order?.returnedBuckets) || 0)
  const otherWater = pickValue(other, '拉水')
  const otherReturned = pickValue(other, '回桶')
  const records = []
  if (myWater !== 0 && otherWater !== 0 && myWater !== otherWater) {
    const customerLess = otherWater < myWater
    const diff = Math.abs(myWater - otherWater)
    records.push({
      type: '拉水',
      myValue: myWater,
      otherName: other.name,
      otherValue: otherWater,
      diff,
      customerLess,
      tone: customerLess ? 'red' : 'green',
      text: `拉水：${other.name}比我${customerLess ? '少' : '多'}记${formatRemarkNumber(diff)}桶`
    })
  }
  if (myReturned !== 0 && otherReturned !== 0 && myReturned !== otherReturned) {
    const customerLess = otherReturned < myReturned
    const diff = Math.abs(myReturned - otherReturned)
    records.push({
      type: '回桶',
      myValue: myReturned,
      otherName: other.name,
      otherValue: otherReturned,
      diff,
      customerLess,
      tone: customerLess ? 'green' : 'red',
      text: `回桶：${other.name}比我${customerLess ? '少' : '多'}记${formatRemarkNumber(diff)}桶`
    })
  }
  return records
}

// 生成页面展示用的结构化段落，highlight 为 true 的片段（多/少 + 数量）按 tone 着色
const buildRemarkDiffSegments = (order) => buildRemarkDiffRecords(order).map(record => [
  { text: `${record.type}：${record.otherName}比我`, highlight: false },
  { text: record.customerLess ? '少' : '多', highlight: true, tone: record.tone },
  { text: '记', highlight: false },
  { text: formatRemarkNumber(record.diff), highlight: true, tone: record.tone },
  { text: '桶', highlight: false }
])

// 判断备注是否能解析出有效的对账条目（同时含「我」和另一方）
const canParseRemarkOrder = (notes) => {
  const entries = parseRemarkEntries(notes)
  if (entries.length === 0) return false
  return entries.some(item => item.name !== '我') && entries.some(item => item.name === '我')
}

// 差值片段着色：red 红色（我们亏钱），green 绿色（我们占便宜）
const getRemarkDiffClass = (seg) => {
  if (!seg.highlight) return ''
  return seg.tone === 'green' ? 'remark-diff-green' : 'remark-diff-red'
}

const getUnitPrice = (order) => getOrderUnitPrice(order, userUnitPriceMap.value)
const getReceivableAmount = (order) => getOrderReceivableAmount(order, userUnitPriceMap.value)
const getActualAmount = (order) => getOrderActualReceivedAmount(order)
const getEditOrderUnitPrice = (order) => {
  const orderUnitPrice = Number(order?.unitPrice)
  if (Number.isFinite(orderUnitPrice) && orderUnitPrice > 0) return orderUnitPrice
  const userName = String(order?.userName || '').trim()
  const userUnitPrice = userUnitPriceMap.value.get(userName)
  return Number.isFinite(userUnitPrice) && userUnitPrice >= 0 ? userUnitPrice : 0
}
const normalizeDateText = (value) => String(value || '').trim()
const getDefaultAddDate = () => {
  const todayText = formatDate(new Date())
  if (selectedMonth.value === 'ALL') return todayText
  return todayText.startsWith(`${selectedMonth.value}-`) ? todayText : `${selectedMonth.value}-01`
}
const currentYear = computed(() => String(new Date().getFullYear()))
const isNumericToken = (value) => /^-?\d+(?:\.\d+)?$/.test(String(value || '').trim())
const normalizeShortDateToken = (value) => {
  const text = String(value || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  if (!/^\d{4}$/.test(text)) return ''
  const month = Number(text.slice(0, 2))
  const day = Number(text.slice(2, 4))
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${currentYear.value}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
const matchUserForBatchAdd = (userName) => {
  const name = String(userName || '').trim()
  if (!name) return null
  return state.users.find(user => !user.isAdmin && String(user.userName || '').trim() === name) || null
}

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

const dailySummaryList = computed(() => {
  const groups = {}
  filteredOrders.value.forEach(ord => {
    const dateKey = String(ord.createdDate || '').trim()
    if (!dateKey) return
    if (!groups[dateKey]) {
      groups[dateKey] = {
        date: dateKey,
        water: 0,
        returned: 0
      }
    }
    groups[dateKey].water += Number(ord.quantity) || 0
    groups[dateKey].returned += Number(ord.returnedBuckets) || 0
  })
  return Object.values(groups).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
})

const buildCustomerSummarySheetRows = () => {
  const title = selectedMonth.value === 'ALL'
    ? `${activeCustomerDisplayName.value} 对账汇总`
    : `${activeCustomerDisplayName.value} ${selectedMonth.value} 对账汇总`
  const customerUnitPrice = Number(selectedCustomerObj.value?.unitPrice)
  const rows = [
    [{ value: title, style: 'title' }],
    ['单价', Number.isFinite(customerUnitPrice) && customerUnitPrice >= 0 ? customerUnitPrice : 0],
    ['累计送水', customerStats.value.totalWater],
    ['累计回桶', customerStats.value.totalReturned],
    ['应收金额', customerStats.value.totalReceivable],
    ['实收金额', customerStats.value.totalPaid],
    ['', '', '', '', ''],
    [
      { value: '日期', style: 'header' },
      { value: '发水', style: 'header' },
      { value: '回桶', style: 'header' },
      { value: '应收', style: 'header' },
      { value: '实收', style: 'header' }
    ]
  ]
  dailySummaryList.value.forEach(item => {
    const relatedOrders = filteredOrders.value.filter(order => order.createdDate === item.date)
    const receivable = relatedOrders.reduce((sum, order) => sum + getReceivableAmount(order), 0)
    const actual = relatedOrders.reduce((sum, order) => sum + getActualAmount(order), 0)
    rows.push([
      item.date,
      item.water,
      item.returned,
      Number(receivable.toFixed(2)),
      Number(actual.toFixed(2))
    ])
  })
  return {
    rows,
    defaultRowHeight: 27,
    columnWidths: [16, 10, 10, 12, 12],
    rowHeights: {
      1: 32,
      6: 20
    },
    merges: [
      { start: 'A1', end: 'E1' }
    ]
  }
}

const buildCustomerDetailSheetRows = () => {
  const rows = [[
    '月份', '日期', '客户', '结算方式', '单价', '数量', '回桶', '应收', '实收', '备注'
  ]]
  monthlyGroups.value.forEach(group => {
    group.orders.forEach(order => {
      rows.push([
        formatMonth(group.month),
        order.createdDate || '',
        order.userName || '',
        order.settlementType === 'monthly' ? '月结' : '日结',
        Number(getUnitPrice(order)) || 0,
        Number(order.quantity) || 0,
        Number(order.returnedBuckets) || 0,
        Number(getReceivableAmount(order)) || 0,
        Number(getActualAmount(order)) || 0,
        order.notes || ''
      ])
    })
  })
  return {
    rows,
    columnWidths: [12, 16, 12, 10, 10, 10, 10, 10, 10, 16]
  }
}

// 备注对账表格：日期 / 项目 / 我的数量 / 客户名称 / 客户数量 / 差值 / 对账结果
// 颜色逻辑与页面备注一致：tone='red' 红（我们亏钱），tone='green' 绿（我们占便宜）
// 排序：先所有拉水，再所有回桶；同项目内按时间升序
const buildRemarkComparisonSheetRows = () => {
  const rows = [['日期', '项目', '我的数量', '客户名称', '客户数量', '差值', '对账结果']]
  const records = []
  monthlyGroups.value.forEach(group => {
    group.orders.forEach(order => {
      buildRemarkDiffRecords(order).forEach(record => {
        records.push({ date: order.createdDate, record })
      })
    })
  })
  // 先按项目（拉水在前），再按日期升序
  records.sort((a, b) => {
    const typeOrder = (a.record.type === '拉水' ? 0 : 1) - (b.record.type === '拉水' ? 0 : 1)
    if (typeOrder !== 0) return typeOrder
    return String(a.date || '').localeCompare(String(b.date || ''))
  })
  records.forEach(({ date, record }) => {
    const mark = record.customerLess ? '少记' : '多记'
    // 项目列固定颜色：拉水橙色、回桶紫色
    const typeStyle = record.type === '拉水' ? 'orange' : 'purple'
    // 差值和对账结果按盈亏着色：绿=占便宜，红=亏钱
    const diffStyle = record.tone === 'green' ? 'green' : 'red'
    rows.push([
      formatRemarkDate(date),
      { value: record.type, style: typeStyle },
      record.myValue,
      record.otherName,
      record.otherValue,
      { value: `${mark}${formatRemarkNumber(record.diff)}`, style: diffStyle },
      { value: record.text, style: diffStyle }
    ])
  })
  return {
    rows,
    columnWidths: [14, 10, 12, 12, 12, 12, 34]
  }
}

const openExportModal = () => {
  if (!canManageData.value) return
  showExportModal.value = true
}

const closeExportModal = () => {
  showExportModal.value = false
}

const handleExportOption = (type) => {
  showExportModal.value = false
  if (type === 'excel') {
    exportExcelWorkbook({
      fileName: selectedMonth.value === 'ALL'
        ? `${activeCustomerDisplayName.value}-对账单`
        : `${activeCustomerDisplayName.value}-${selectedMonth.value}-对账单`,
      sheets: [
        { name: '汇总', ...buildCustomerSummarySheetRows() },
        { name: '明细', ...buildCustomerDetailSheetRows() }
      ]
    }).then(showExcelPreviewShareActions).catch(() => {})
    return
  }
}

const openEditModal = (order) => {
  if (!canManageData.value) return
  editorMode.value = 'edit'
  editorOrderDate.value = String(order?.createdDate || '').trim()
  editingOrderId.value = order?._id || ''
  editForm.value = {
    userName: order?.userName || '',
    unitPrice: String(getEditOrderUnitPrice(order)),
    quantity: String(order?.quantity ?? 0),
    returnedBuckets: String(order?.returnedBuckets ?? 0),
    actualAmountReceived: String(order?.actualAmountReceived ?? 0),
    notes: order?.notes || ''
  }
  showEditModal.value = true
}

const openAddModal = () => {
  if (!canManageData.value) return
  batchAddInputText.value = ''
  batchAddItems.value = []
  batchAddError.value = ''
  showBatchAddModal.value = true
}

const closeBatchAddModal = () => {
  showBatchAddModal.value = false
  batchAddError.value = ''
}

const clearBatchAddInput = () => {
  batchAddInputText.value = ''
  batchAddError.value = ''
}

const createBatchAddItem = (item, idx) => ({
  id: `batch-add-${Date.now()}-${idx}`,
  createdDate: item.createdDate,
  userName: item.userName,
  quantity: item.quantity,
  returnedBuckets: item.returnedBuckets,
  actualAmountReceived: item.actualAmountReceived,
  expanded: false
})

const handleBatchAddParse = () => {
  const lines = String(batchAddInputText.value || '').split(/\n+/).map(line => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    batchAddError.value = '请先输入要解析的订单内容'
    batchAddItems.value = []
    return
  }
  const parsedItems = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const tokens = line.split(/\s+/).filter(Boolean)
    if (tokens.length < 2) {
      batchAddError.value = `第 ${index + 1} 行格式不正确`
      batchAddItems.value = []
      return
    }
    const createdDate = normalizeShortDateToken(tokens[0])
    if (!createdDate) {
      batchAddError.value = `第 ${index + 1} 行日期格式错误，支持 0623 或 2026-06-23`
      batchAddItems.value = []
      return
    }
    let cursor = 1
    let userName = selectedUser.value || ''
    if (tokens[cursor] && !isNumericToken(tokens[cursor])) {
      userName = String(tokens[cursor] || '').trim()
      cursor += 1
    }
    if (!userName) {
      batchAddError.value = `第 ${index + 1} 行缺少客户姓名`
      batchAddItems.value = []
      return
    }
    const quantity = Number(tokens[cursor] || 0)
    const returnedBuckets = Number(tokens[cursor + 1] || 0)
    const actualAmountReceived = Number(tokens[cursor + 2] || 0)
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
      batchAddError.value = `第 ${index + 1} 行送水数量错误`
      batchAddItems.value = []
      return
    }
    if (!Number.isFinite(returnedBuckets) || returnedBuckets < 0 || !Number.isInteger(returnedBuckets)) {
      batchAddError.value = `第 ${index + 1} 行回桶数量错误`
      batchAddItems.value = []
      return
    }
    if (!Number.isFinite(actualAmountReceived) || actualAmountReceived < 0) {
      batchAddError.value = `第 ${index + 1} 行付款金额错误`
      batchAddItems.value = []
      return
    }
    parsedItems.push(createBatchAddItem({ createdDate, userName, quantity, returnedBuckets, actualAmountReceived }, index))
  }
  batchAddError.value = ''
  batchAddItems.value = parsedItems
}

const formatBatchAddPreviewLine = (item) => [
  item.createdDate,
  item.userName,
  Number(item.quantity) || 0,
  Number(item.returnedBuckets) || 0,
  formatMoney(item.actualAmountReceived)
].join(' ')

const toggleBatchAddExpanded = (id) => {
  batchAddItems.value = batchAddItems.value.map(item => item.id === id ? { ...item, expanded: !item.expanded } : item)
}

const updateBatchAddItemField = (id, field, value) => {
  batchAddItems.value = batchAddItems.value.map(item => item.id === id ? { ...item, [field]: value } : item)
}

const deleteBatchAddRow = (id) => {
  batchAddItems.value = batchAddItems.value.filter(item => item.id !== id)
}

const submitBatchAddOrders = async () => {
  if (batchAddItems.value.length === 0) return
  const orders = []
  for (const item of batchAddItems.value) {
    const createdDate = normalizeShortDateToken(item.createdDate)
    const userName = String(item.userName || '').trim()
    const quantity = Number(item.quantity || 0)
    const returnedBuckets = Number(item.returnedBuckets || 0)
    const actualAmountReceived = Number(item.actualAmountReceived || 0)
    if (!createdDate || !userName) {
      batchAddError.value = '存在未填写完整的订单数据'
      return
    }
    if (!Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(returnedBuckets) || returnedBuckets < 0 || !Number.isFinite(actualAmountReceived) || actualAmountReceived < 0) {
      batchAddError.value = '存在格式不正确的订单数据'
      return
    }
    const matchedUser = matchUserForBatchAdd(userName)
    const unitPrice = Number(matchedUser?.unitPrice ?? selectedCustomerObj.value?.unitPrice ?? 0)
    orders.push({
      createdAt: formatBeijingDateTime(new Date()),
      createdDate,
      userName,
      quantity,
      returnedBuckets,
      operator: state.currentUser?.userName || '',
      unitPrice,
      totalAmount: Number((quantity * unitPrice).toFixed(2)),
      actualAmountReceived,
      logs: [],
      settlementType: matchedUser?.settlementType || selectedCustomerObj.value?.settlementType || 'daily',
      notes: ''
    })
  }
  const result = await addOrders(orders)
  if (!result.success) {
    batchAddError.value = result.message || '批量创建订单失败'
    return
  }
  closeBatchAddModal()
}

const closeEditModal = () => {
  showEditModal.value = false
  editingOrderId.value = ''
  editorMode.value = 'edit'
  editorOrderDate.value = ''
}

const submitOrderForm = async () => {
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
    uni.showModal({ title: '保存失败', content: '送水数量允许为 0，但不能小于 0', showCancel: false })
    return
  }
  if (!Number.isInteger(payload.returnedBuckets) || payload.returnedBuckets < 0) {
    uni.showModal({ title: '保存失败', content: '回桶数量必须是大于或等于 0 的整数', showCancel: false })
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
  if (editorMode.value === 'add') {
    const quantity = Number(payload.quantity || 0)
    const unitPrice = Number(payload.unitPrice || 0)
    const createdDate = normalizeDateText(editorOrderDate.value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(createdDate)) {
      uni.showModal({ title: '新增失败', content: '日期格式必须为 YYYY-MM-DD', showCancel: false })
      return
    }
    const result = await addOrder({
      createdAt: formatBeijingDateTime(new Date()),
      createdDate,
      userName: payload.userName,
      quantity,
      returnedBuckets: Number(payload.returnedBuckets || 0),
      operator: state.currentUser?.userName || '',
      unitPrice,
      totalAmount: Number((quantity * unitPrice).toFixed(2)),
      actualAmountReceived: Number(payload.actualAmountReceived || 0),
      logs: [],
      settlementType: selectedCustomerObj.value?.settlementType || 'daily',
      notes: payload.notes
    })
    if (!result.success) {
      uni.showModal({ title: '新增失败', content: result.message || '创建订单失败', showCancel: false })
      return
    }
    closeEditModal()
    return
  }
  const result = await updateOrder(editingOrderId.value, payload)
  if (!result.success) {
    uni.showModal({ title: '保存失败', content: result.message || '更新订单失败', showCancel: false })
    return
  }
  closeEditModal()
}

const confirmDeleteOrder = () => {
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
      closeEditModal()
    }
  })
}

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
    // 不合并：同一天多笔订单各自单独展示
    g.orders = g.orders.map(order => ({
      _id: order._id,
      createdDate: order.createdDate,
      createdAt: order.createdAt,
      userName: order.userName,
      settlementType: order.settlementType,
      unitPrice: getUnitPrice(order),
      quantity: Number(order.quantity) || 0,
      returnedBuckets: Number(order.returnedBuckets) || 0,
      actualAmountReceived: Number(getActualAmount(order).toFixed(2)),
      totalAmount: Number(getReceivableAmount(order).toFixed(2)),
      notes: order.notes || '',
      sourceOrders: [order]
    })).sort((a, b) => {
      const dateCompare = String(b.createdDate || '').localeCompare(String(a.createdDate || ''))
      if (dateCompare !== 0) return dateCompare
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    })
    // 统计每个订单备注中的对账差值
    g.orders.forEach(order => {
      order.canParseRemark = canParseRemarkOrder(order.notes)
      order.diffSegments = buildRemarkDiffSegments(order)
    })
  })
  return Object.values(groups).sort((a, b) => b.month?.localeCompare(a.month || ''))
})

const toggleMonth = (monthKey) => {
  const storageKey = getOrderExpandedKey(monthKey)
  const nextState = ordersExpandedMap.value[storageKey] !== false
  ordersExpandedMap.value = {
    ...ordersExpandedMap.value,
    [storageKey]: !nextState
  }
  persistOrdersExpandedMap()
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
  width: 100%; padding: 8px 10px; background: #fff; border: 1px solid #e2e8f0;
  border-radius: 14px; font-size: 12px; font-weight: 700; color: #1e293b; box-sizing: border-box; box-shadow: 0 6px 16px rgba(15,23,42,.04);
}
.filter-picker-locked { background: #f1f5f9; }
.locked-tag { font-size: 9px; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
.picker-arrow { font-size: 8px; color: #94a3b8; }
.month-picker-row { display: grid; grid-template-columns: 72px minmax(0, 1fr) 72px; gap: 8px; align-items: center; width: 100%; margin-top: 10px; }
.month-filter-col { min-width: 0; }
.month-shift-btn {
  height: 34px; display: flex; align-items: center; justify-content: center;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  font-size: 11px; font-weight: 700; color: #334155; box-shadow: 0 6px 16px rgba(15,23,42,.04);
}
.month-shift-btn-disabled { opacity: 0.45; }

.customer-card { padding: 16px; margin-bottom: 16px; background: #f8fafc; border-color: #e3ebf3; }
.customer-card-top { display: flex; align-items: center; gap: 12px; }
.customer-name { font-size: 12px; font-weight: 700; color: #1e293b; }
.customer-action-group { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.customer-copy-btn { display: flex; align-items: center; justify-content: center; padding: 7px 12px; background: #f8fafc; border: 1px solid #dbe4ee; border-radius: 12px; }
.customer-copy-btn-active { background: #ecfdf5; border-color: #a7f3d0; }
.customer-copy-btn-text { font-size: 11px; font-weight: 700; color: #334155; line-height: 1; }
.customer-remark-panel { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(226,232,240,0.8); }
.customer-remark-panel-header { display: flex; align-items: center; justify-content: space-between; }
.customer-remark-panel-title { font-size: 11px; font-weight: 800; color: #334155; }
.customer-remark-panel-actions { display: flex; align-items: center; gap: 12px; }
.customer-remark-export { font-size: 10px; font-weight: 700; color: #0f766e; padding: 3px 10px; border: 1px solid #99f6e4; border-radius: 999px; background: #f0fdfa; }
.customer-remark-panel-toggle { font-size: 10px; font-weight: 700; color: #059669; }
.customer-remark-panel-body { padding-top: 10px; }
.customer-remark-manual { display: block; white-space: pre-wrap; font-size: 12px; line-height: 1.6; color: #334155; }
.customer-remark-order { margin-top: 16px; }
.customer-remark-date { display: block; font-size: 12px; line-height: 1.7; font-weight: 800; color: #1e293b; }
.customer-remark-values { font-size: 14px; line-height: 1.7; color: #334155; }
.customer-remark-line { display: block; font-size: 14px; line-height: 1.7; color: #334155; }
.customer-remark-raw { display: block; font-size: 14px; line-height: 1.7; color: #a78bfa; white-space: pre-wrap; word-break: break-all; }
.remark-diff-green { color: #059669; font-weight: 800; }
.remark-diff-red { color: #dc2626; font-weight: 800; }
.customer-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(226,232,240,0.6); font-size: 10px; color: #475569; }

.customer-summary { padding: 18px; margin-bottom: 16px; }
.customer-summary-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 12px; }
.customer-summary-title { font-size: 14px; font-weight: 700; color: #1e293b; }
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

.section-title { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; padding: 0 4px; margin-bottom: 8px; display: block; }
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
.order-item-merge-tag { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 999px; background: #ecfdf5; color: #047857; }
.order-item-price { font-size: 9px; color: #94a3b8; font-family: monospace; }
.order-item-add-btn { padding: 5px 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; font-size: 10px; font-weight: 700; color: #047857; }
.order-item-edit-btn { margin-left: auto; padding: 5px 10px; background: #f8fafc; border: 1px solid #dbe4ee; border-radius: 10px; font-size: 10px; font-weight: 700; color: #334155; }

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

.order-item-notes { margin-top: 8px; padding: 6px 8px; background: rgba(241,245,249,0.7); border-radius: 8px; font-size: 12px; color: #f87171; }


.editor-mask { position: fixed; inset: 0; background: rgba(15,23,42,.52); z-index: 120; display: flex; align-items: flex-start; justify-content: center; padding: 20px 20px 24px; box-sizing: border-box; }
.editor-mask-centered { align-items: flex-start; }
.editor-modal { width: 100%; max-width: 560px; max-height: calc(100vh - 64px); background: #fff; border-radius: 24px; padding: 18px 16px 16px; border: 1px solid rgba(226,232,240,.9); box-shadow: 0 24px 60px rgba(15,23,42,.24); box-sizing: border-box; display: flex; flex-direction: column; }
.batch-modal { width: 100%; max-width: 560px; max-height: calc(100vh - 64px); background: #fff; border-radius: 24px; padding: 18px 16px 16px; border: 1px solid rgba(226,232,240,.9); box-shadow: 0 24px 60px rgba(15,23,42,.24); box-sizing: border-box; display: flex; flex-direction: column; }
.customer-select-modal { max-width: 420px; }
.export-modal { max-width: 420px; }
.editor-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; margin-bottom: 14px; gap: 12px; }
.editor-title { display: block; font-size: 16px; font-weight: 800; color: #0f172a; }
.editor-subtitle { display: block; font-size: 10px; color: #94a3b8; margin-top: 4px; }
.editor-close { font-size: 11px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 7px 12px; border-radius: 999px; flex-shrink: 0; }
.editor-body { max-height: calc(100vh - 220px); box-sizing: border-box; }
.editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; }
.editor-field { min-width: 0; }
.editor-field-full { grid-column: 1 / -1; }
.editor-label { display: block; font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
.editor-footer { display: flex; gap: 10px; padding-top: 14px; border-top: 1px solid #f1f5f9; margin-top: 12px; }
.editor-delete-btn { flex: 1; height: 44px; background: #fff1f2; border: 1px solid #fecdd3; color: #dc2626; border-radius: 16px; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
.editor-save-btn { flex: 1; height: 44px; background: linear-gradient(135deg,#0f766e,#10b981); color: #fff; border-radius: 16px; font-size: 14px; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 20px rgba(16, 185, 129, .16); }
.editor-delete-btn::after,
.editor-save-btn::after { border: none; }

.customer-remark-modal { max-width: 420px; }
.customer-remark-body { padding-bottom: 14px; }
.customer-remark-textarea { display: block; width: calc(100% - 28px); min-height: 128px; padding: 13px; background: #eee; border: 1px solid #dbe4ee; border-radius: 14px; font-size: 15px; color: #334155; line-height: 1.6; }
.customer-remark-actions { display: flex; gap: 10px; padding-top: 14px; border-top: 1px solid #f1f5f9; }
.customer-remark-clear-btn,
.customer-remark-save-btn { flex: 1; height: 42px; line-height: 42px; border-radius: 12px; font-size: 13px; font-weight: 800; }
.customer-remark-clear-btn { background: #f1f5f9; color: #64748b; }
.customer-remark-save-btn { background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; box-shadow: 0 8px 16px rgba(16,185,129,.16); }
.customer-remark-clear-btn::after,
.customer-remark-save-btn::after { border: none; }

.export-option-list { display: flex; flex-direction: column; gap: 10px; }
.export-option-item { padding: 14px 16px; border-radius: 16px; background: #f8fafc; border: 1px solid #dbe4ee; }
.export-option-title { font-size: 13px; font-weight: 700; color: #1e293b; }

.batch-modal-body { max-height: calc(100vh - 180px); padding-top: 2px; box-sizing: border-box; }
.batch-error-banner { padding: 12px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; font-size: 12px; color: #dc2626; margin-bottom: 12px; }
.batch-parse-card,
.batch-result-card { background: #fff; border-radius: 18px; border: 1px solid #e8eef5; box-shadow: 0 8px 22px rgba(15,23,42,0.04); padding: 16px; }
.batch-result-card { margin-top: 12px; }
.batch-result-title { display: block; font-size: 12px; font-weight: 800; color: #1e293b; margin-bottom: 10px; }
.batch-parse-textarea { display: block; width: calc(100% - 30px); max-width: calc(100% - 30px); min-height: 140px; padding: 14px; background: #eee; border: 1px solid #dbe4ee; border-radius: 14px; font-size: 12px; font-family: monospace; color: #334155; line-height: 1.6; }
.batch-parse-btns { display: flex; gap: 8px; margin-top: 12px; align-items: center; }
.batch-parse-btn { flex: 1; height: 38px; line-height: 38px; background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; border-radius: 12px; font-size: 12px; font-weight: 800; box-shadow: 0 8px 16px rgba(16,185,129,.14); padding: 0; }
.batch-parse-clear { height: 38px; line-height: 38px; padding: 0 16px; background: #eef2f7; border: none; color: #64748b; border-radius: 18px; font-size: 11px; font-weight: 700; box-shadow: none; }
.batch-parse-clear::after { border: none; }
.batch-result-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
.batch-result-main { flex: 1; min-width: 0; }
.batch-result-preview-wrap { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.batch-result-preview-line { display: block; flex: 1; min-width: 0; font-size: 14px; font-weight: 800; word-break: break-all; color: #16a34a; }
.batch-result-toggle-btn { flex-shrink: 0; font-size: 11px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 5px 10px; border-radius: 10px; }
.batch-result-form-grid { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 8px; margin-top: 10px; }
.batch-result-field { min-width: 0; }
.batch-result-field-name { grid-column: 1 / -1; }
.batch-result-field-label { display: block; font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px; }
.batch-result-delete-btn { flex-shrink: 0; padding: 6px 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 10px; font-size: 12px; font-weight: 800; color: #dc2626; }
.batch-result-submit-btn { width: 100%; height: 46px; margin-top: 14px; background: linear-gradient(135deg, #0f766e, #10b981); color: #fff; border-radius: 16px; font-size: 13px; font-weight: 800; box-shadow: 0 10px 20px rgba(16,185,129,.16); }
.batch-result-submit-btn::after { border: none; }
.btn-disabled { opacity: .5; }

.customer-search-wrap { margin-bottom: 10px; }
.customer-select-list { max-height: min(60vh, 420px); }
.customer-select-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 4px;
  border-bottom: 1px solid #f1f5f9;
}
.customer-select-item-active { color: #059669; }
.customer-select-main { min-width: 0; display: flex; flex-direction: column; }
.customer-select-name { font-size: 14px; font-weight: 700; color: inherit; }
.customer-select-check {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: #059669;
  background: #ecfdf5;
  padding: 4px 10px;
  border-radius: 999px;
}
.customer-select-empty {
  padding: 18px 4px;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
}

.safe-bottom { height: 32px; }
</style>
