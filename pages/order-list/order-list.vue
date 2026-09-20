<template>
	<view class="page-container order-list-page">
		<view class="order-list-top-sticky">
		<view class="toolbar-wrap">
			<view class="toolbar-card">
				<view class="toolbar-main-row">
					<view class="toolbar-label-group">
						<view class="toolbar-left-actions">
							<view v-if="canManageData" class="merge-mark-btn" :class="{ 'merge-mark-btn-active': isSelectedDateMerged }" @tap="toggleMergeMark">
								<text class="merge-mark-btn-text">{{ isSelectedDateMerged ? '已合并' : '合并' }}</text>
							</view>
							<view v-if="canManageData" class="copy-summary-btn" @tap="openSearchModal">
								<text class="copy-summary-btn-text">搜索</text>
							</view>
						</view>
					</view>
					<view class="toolbar-actions">
						<view class="remark-entry-btn" :class="{ 'remark-entry-btn-active': hasSelectedDateRemark }" @tap="openRemarkModal">
							<text class="remark-entry-btn-text">备注</text>
						</view>
						<view v-if="canManageData" class="batch-entry-btn" @tap="openBatchOrderModal">
							<text class="batch-entry-btn-text">录入订单</text>
						</view>
					<view class="filter-toggle"
						@tap="showExportModal = true">
						<text class="filter-toggle-text">导出</text>
					</view>
					</view>
				</view>
				<view v-if="hasSelectedDateRemark" class="toolbar-remark-inline">
					<text>备注: {{ getSelectedDateRemark() }}</text>
				</view>
			</view>
		</view>

		<view v-if="showExportModal" class="filter-overlay" @tap="showExportModal = false" @touchmove.stop.prevent>
			<view class="filter-panel" @tap.stop @touchmove.stop>
				<view class="filter-header">
					<view>
						<text class="filter-header-title">导出方式</text>
						<text class="filter-header-subtitle">选择当前日账单的导出选项</text>
					</view>
					<text class="filter-header-close" @tap="showExportModal = false">关闭</text>
				</view>
				<view class="export-option-list">
					<view v-for="option in exportOptions" :key="option.value" class="export-option-item" @tap="handleExportOption(option.value)"><text>{{ option.label }}</text></view>
				</view>
			</view>
		</view>

		<!-- 日期选择 -->
		<view class="date-select">
			<view class="date-picker-row">
				<view class="date-shift-btn" @tap="shiftSelectedDate(-1)">
					<text>上一日</text>
				</view>
			<view class="date-picker" @tap="openDatePicker">
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

		<view v-if="showDatePicker" class="filter-overlay" @tap="closeDatePicker" @touchmove.stop.prevent>
			<view class="date-panel" @tap.stop @touchmove.stop>
				<view class="filter-header">
					<view>
						<text class="filter-header-title">账单日期</text>
						<text class="filter-header-subtitle">今天会排在最前面</text>
					</view>
					<text class="filter-header-close" @tap="closeDatePicker">关闭</text>
				</view>
				<scroll-view class="date-list" scroll-y :scroll-into-view="dateScrollIntoView" @touchmove.stop>
					<view v-for="date in availableDates" :key="date" :id="`date-option-${date}`" class="date-item"
						:class="{ 'date-item-active': selectedDate === date }" @tap="selectDate(date)">
						<text class="date-item-text">{{ date }}</text>
						<text
							class="date-item-tag">{{ date === today ? '今日' : selectedDate === date ? '已选' : '' }}</text>
					</view>
				</scroll-view>
			</view>
		</view>

		<!-- 财务汇总 -->
		<view class="financial-grid">
			<view class="fin-item"><view class="fin-label">日结总金额</view><text
					class="fin-value fin-value-red">¥{{ formatMoney(dailySettleSum) }}</text></view>
			<view class="fin-item"><view class="fin-label">月结总金额</view><text
					class="fin-value fin-value-red">¥{{ formatMoney(monthlySettleSum) }}</text></view>
			<view class="fin-item"><view class="fin-label">应收总金额</view><text
					class="fin-value fin-value-red">¥{{ formatMoney(totalAmountSum) }}</text></view>
			<view class="fin-item fin-item-green"><view class="fin-label fin-label-green">实收总金额</view><text
					class="fin-value fin-value-green">¥{{ formatMoney(totalActualSum) }}</text></view>
		</view>

		<!-- 筛选摘要 -->
		<view class="filter-summary" @tap="toggleOrderListExpanded">
			<text>筛选出 <text class="fw-bold">{{ filteredOrders.length }}</text> 笔订单</text>
			<view class="filter-summary-right">
				<text>发水: <text class="fw-bold text-amber">{{ totalDeliveredSum }}</text> 桶</text>
				<text>回桶: <text class="fw-bold">{{ totalReturnedSum }}</text> 个</text>
				<text class="filter-summary-toggle">{{ listExpanded ? '折叠 ▲' : '展开 ▼' }}</text>
			</view>
		</view>
		</view>

		<view class="card detail-card">
			<view class="detail-header" @tap="toggleOrderListExpanded">
				<view class="detail-header-info">
					<text class="detail-header-title">
						{{ selectedDate }} 订单明细
						<text class="detail-header-count">{{ filteredOrders.length }} 笔订单</text>
					</text>
					<view class="detail-header-stats">
						<text class="detail-header-stat">发水: <text class="stat-bold">{{ totalDeliveredSum }}</text> 桶</text>
						<text class="detail-header-stat">回桶: <text class="stat-bold">{{ totalReturnedSum }}</text> 个</text>
						<text class="detail-header-stat">应收款: <text class="stat-bold text-receivable">¥{{ formatMoney(totalAmountSum) }}</text></text>
						<text class="detail-header-stat">已付款: <text class="stat-bold text-emerald">¥{{ formatMoney(totalActualSum) }}</text></text>
					</view>
				</view>
				<text class="detail-arrow">{{ listExpanded ? '折叠' : '展开' }} {{ listExpanded ? '▲' : '▼' }}</text>
			</view>
		</view>

		<!-- 订单列表 -->
		<scroll-view v-if="listExpanded" class="order-list" scroll-y>
			<view v-if="filteredOrders.length === 0" class="empty-state">
				<text class="empty-icon">📦</text>
				<text class="empty-text">该筛选项下暂无配送订单</text>
				<text class="empty-sub">请切换日期或前往「批量录入」新增订单</text>
			</view>

			<view v-else class="detail-days">
			<view v-for="order in filteredOrders" :key="order._id" class="card day-card order-day-card">
				<view class="day-header order-day-header">
					<view class="day-header-main">
						<text class="day-title">{{ order.userName }} <text class="day-count" :class="getDisplaySettlementType(order) === 'monthly' ? 'day-count-monthly' : 'day-count-daily'">({{ getDisplaySettlementType(order) === 'monthly' ? '月结' : '日结' }})</text><text class="day-unit-price"> {{ formatMoney(getUnitPrice(order)) }}/桶</text></text>
					</view>
					<view class="order-status-area order-day-actions">
						<text class="order-status"
							:class="isPaid(order) ? 'status-paid' : 'status-unpaid'">{{ paymentLabel(order) }}</text>
						<view v-if="canManageData" class="order-edit-btn" @tap="openEditModal(order)">编辑</view>
					</view>
				</view>

				<view class="day-stats-row">
					<view class="day-stat">
						<text class="day-stat-label">当日发水</text>
						<text class="day-stat-value">{{ order.quantity }} <text class="day-stat-unit">桶</text></text>
					</view>
					<view class="day-stat">
						<text class="day-stat-label">当日回桶</text>
						<text class="day-stat-value">{{ order.returnedBuckets }} <text class="day-stat-unit">个</text></text>
					</view>
				</view>

				<view class="day-stats-row">
					<view class="day-stat day-stat-blue">
						<text class="day-stat-label">当日应收</text>
						<text class="day-stat-value text-receivable">¥{{ formatMoney(getReceivableAmount(order)) }}</text>
					</view>
					<view class="day-stat day-stat-blue">
						<text class="day-stat-label">当日已付</text>
						<text class="day-stat-value text-emerald">¥{{ formatMoney(getActualPaidAmount(order)) }}</text>
					</view>
				</view>

				<view v-if="order.notes" class="order-notes"><text>📝 备注: {{ order.notes }}</text></view>

				<view v-if="order.logCount > 0 || order.hasPaymentScreenshot" class="order-attachments">
					<text v-if="order.logCount > 0" class="attach-btn" @tap="previewOrderMedia(order, 'logs')">🖼 现场照片
						({{ order.logCount }})</text>
					<text v-if="order.hasPaymentScreenshot" class="attach-btn"
						@tap="previewOrderMedia(order, 'paymentScreenshot')">🖼 付款截图</text>
				</view>
			</view>
			</view>
		</scroll-view>
		<view v-else class="order-list-collapsed">
			<text class="order-list-collapsed-text">订单明细已收起</text>
		</view>

		<view v-if="showEditModal" class="editor-mask" @tap="closeEditModal" @touchmove.stop.prevent>
			<view class="editor-modal" @tap.stop @touchmove.stop>
				<view class="editor-header">
					<view>
						<text class="editor-title">编辑订单</text>
						<text class="editor-subtitle">订单日期：{{ editorOrderDate }}</text>
					</view>
					<text class="editor-close" @tap="closeEditModal">关闭</text>
				</view>
				<scroll-view class="editor-body" scroll-y @touchmove.stop>
					<view class="editor-grid">
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
					<button class="editor-delete-btn" @tap="confirmDeleteOrder">删除</button>
					<button class="editor-save-btn" @tap="submitEditOrder">保存修改</button>
				</view>
			</view>
		</view>

		<view v-if="showBatchOrderModal" class="editor-mask" @tap="closeBatchOrderModal" @touchmove.stop.prevent>
			<view class="batch-modal" @tap.stop @touchmove.stop>
				<view class="editor-header">
					<view>
						<text class="editor-title">当前日期：{{ selectedDate }}</text>
					</view>
					<text class="editor-close" @tap="closeBatchOrderModal">关闭</text>
				</view>
				<scroll-view class="batch-modal-body" scroll-y @touchmove.stop>
					<view v-if="batchOrderError" class="batch-error-banner"><text>{{ batchOrderError }}</text></view>
					<view class="batch-parse-card">
						<textarea class="batch-parse-textarea" :rows="5" maxlength="-1" v-model="batchOrderInputText" auto-height @touchmove.stop
							placeholder="示例：老王 22 33 80 老李 22 44 老陈 33 55 99"
							placeholder-class="input-placeholder" />
						<view class="batch-parse-btns">
							<button class="batch-parse-btn" @tap="handleBatchOrderParse">开始智能解析</button>
							<button class="batch-parse-clear" @tap="clearBatchOrderInput">清空</button>
						</view>
					</view>

					<view v-if="batchOrderItems.length > 0" class="batch-result-card">
						<text class="batch-result-title">解析数据 {{ selectedDate }}</text>
					<view v-for="(item, idx) in sortedBatchOrderItems" :key="item.id || `batch-item-${idx}`" class="batch-result-row">
						<view class="batch-result-main">
							<view class="batch-result-preview-wrap">
								<text class="batch-result-preview-line" :class="isBatchOrderItemDuplicate(item.id) ? 'batch-result-preview-line-duplicate' : 'batch-result-preview-line-unique'">{{ formatBatchOrderPreviewLine(item) }}</text>
								<text class="batch-result-toggle-btn" @tap="toggleBatchOrderExpanded(item.id)">{{ item.expanded ? '收起' : '展开' }}</text>
							</view>
							<view v-if="item.expanded" class="batch-result-form-grid">
									<view class="batch-result-field batch-result-field-name">
										<text class="batch-result-field-label">姓名</text>
										<uni-easyinput :value="item.userName" type="text" :inputBorder="false"
											@input="updateBatchOrderItemField(item.id, 'userName', $event)" />
									</view>
									<view class="batch-result-field">
										<text class="batch-result-field-label">送水数量</text>
										<uni-easyinput :value="String(item.quantity ?? '')" type="number" :inputBorder="false"
											@input="updateBatchOrderItemField(item.id, 'quantity', $event)" />
									</view>
									<view class="batch-result-field">
										<text class="batch-result-field-label">回桶数量</text>
										<uni-easyinput :value="String(item.returnedBuckets ?? '')" type="number" :inputBorder="false"
											@input="updateBatchOrderItemField(item.id, 'returnedBuckets', $event)" />
									</view>
									<view class="batch-result-field">
										<text class="batch-result-field-label">付款金额</text>
										<uni-easyinput :value="String(item.actualAmountReceived ?? '')" type="digit" :inputBorder="false"
											@input="updateBatchOrderItemField(item.id, 'actualAmountReceived', $event)" />
									</view>
								</view>
							</view>
							<view class="batch-result-delete-btn" @tap="deleteBatchOrderRow(item.id)">删除</view>
						</view>
						<button class="batch-result-submit-btn" :class="{ 'btn-disabled': batchOrderItems.length === 0 }"
							:disabled="submittableBatchOrderItems.length === 0" @tap="submitBatchOrdersFromModal">提交这 {{ submittableBatchOrderItems.length }} 笔订单</button>
					</view>
				</scroll-view>
			</view>
		</view>

		<view v-if="showRemarkModal" class="editor-mask" @tap="closeRemarkModal" @touchmove.stop.prevent>
			<view class="remark-modal" @tap.stop @touchmove.stop>
				<view class="editor-header">
					<view>
						<text class="editor-title">备注</text>
						<text class="editor-subtitle">{{ selectedDate }}</text>
					</view>
					<text class="editor-close" @tap="closeRemarkModal">关闭</text>
				</view>
				<view class="remark-modal-body">
					<textarea class="remark-textarea" maxlength="-1" v-model="remarkInput" auto-height @touchmove.stop
						placeholder="请输入备注"
						placeholder-class="input-placeholder" />
				</view>
				<view class="remark-modal-actions">
					<button class="remark-clear-btn" @tap="clearRemark">清空</button>
					<button class="remark-save-btn" @tap="saveRemark">保存</button>
				</view>
			</view>
		</view>

		<view v-if="showSearchModal" class="editor-mask" @tap="closeSearchModal" @touchmove.stop.prevent>
			<view class="search-modal" @tap.stop @touchmove.stop>
				<view class="editor-header">
					<view>
						<text class="editor-title">搜索订单</text>
						<text class="editor-subtitle">{{ selectedDate }} 当前日期订单</text>
					</view>
					<text class="editor-close" @tap="closeSearchModal">关闭</text>
				</view>
				<view class="search-modal-body">
					<uni-easyinput class="editor-input" type="text" v-model="searchKeyword" :inputBorder="false" placeholder="输入客户姓名关键词" />
					<scroll-view class="search-result-list" scroll-y @touchmove.stop>
						<view v-if="!searchKeyword.trim()" class="search-empty-state">
							<text>请输入客户姓名进行搜索</text>
						</view>
						<view v-else-if="searchedOrders.length === 0" class="search-empty-state">
							<text>{{ selectedDate }} 没有匹配的订单</text>
						</view>
						<view v-else v-for="order in searchedOrders" :key="`search-${order._id}`" class="search-order-card">
							<view class="search-order-header">
								<text class="search-order-name">{{ order.userName }}</text>
								<text class="search-order-tag" :class="getDisplaySettlementType(order) === 'monthly' ? 'tag-monthly' : 'tag-daily'">
									{{ getDisplaySettlementType(order) === 'monthly' ? '月结' : '日结' }}
								</text>
							</view>
							<view class="search-order-meta">
								<text>送水: {{ order.quantity }} 桶</text>
								<text>回桶: {{ order.returnedBuckets }} 个</text>
							</view>
							<view class="search-order-meta">
								<text class="text-receivable">应收: ¥{{ formatMoney(getReceivableAmount(order)) }}</text>
								<text :class="getActualPaidAmount(order) >= getReceivableAmount(order) ? 'text-emerald' : 'text-red'">实收: ¥{{ formatMoney(getActualPaidAmount(order)) }}</text>
							</view>
							<view v-if="order.notes" class="search-order-notes"><text>备注: {{ order.notes }}</text></view>
						</view>
					</scroll-view>
				</view>
			</view>
		</view>

		<view v-if="showBatchDuplicateModal" class="duplicate-modal-mask" @tap.stop @touchmove.stop.prevent>
			<view class="duplicate-modal" @tap.stop @touchmove.stop>
				<text class="duplicate-modal-title">以下数据重复提交了</text>
				<scroll-view class="duplicate-modal-list" scroll-y @touchmove.stop>
					<view v-if="batchDuplicateLines.length > 0" class="duplicate-modal-section">
						<text class="duplicate-modal-section-title">重复数据</text>
						<text v-for="(line, idx) in batchDuplicateLines" :key="`duplicate-${idx}`" class="duplicate-modal-line">{{ line }}</text>
					</view>
					<view v-if="batchUniqueLines.length > 0" class="duplicate-modal-section">
						<text class="duplicate-modal-section-title">未重复数据</text>
						<text v-for="(line, idx) in batchUniqueLines" :key="`unique-${idx}`" class="duplicate-modal-line">{{ line }}</text>
					</view>
				</scroll-view>
				<view class="duplicate-modal-actions">
					<view class="duplicate-modal-btn duplicate-modal-btn-muted" @tap="resolveBatchDuplicateModal(false)">关闭</view>
					<view class="duplicate-modal-btn duplicate-modal-btn-primary" @tap="resolveBatchDuplicateModal(true)">提交未重复</view>
				</view>
			</view>
		</view>

		<!-- 图片预览 -->
		<view v-if="previewUrl" class="lightbox" @tap="previewUrl = null" @touchmove.stop.prevent>
			<image :src="previewUrl" mode="widthFix" class="lightbox-img" />
			<text class="lightbox-close">关闭预览</text>
		</view>
	</view>
</template>

<script setup>
	import {
		ref,
		computed,
		nextTick
	} from 'vue'
	import {
		onLoad,
		onShow
	} from '@dcloudio/uni-app'
	import {
		useStore
	} from '../../common/store.js'
	import {
		createUserUnitPriceMap,
		formatMoney,
		getOrderUnitPrice,
		isPotentialName,
		normalizeRecognizedOrderText,
		parseCompactOrderSegments,
		getOrderReceivableAmount,
		getOrderActualReceivedAmount
	} from '../../common/utils.js'
	import {
		exportExcelWorkbook,
		showExcelPreviewShareActions
	} from '../../common/export-excel.js'

	const store = useStore()
	const {
		state,
		addOrders,
		updateOrder,
		deleteOrder,
		setOrderMergeStatus,
		getOrderMedia,
		formatDateTime,
		formatBeijingDateTime,
		formatDate
	} = store
	const DAY_PICKER_MONTH_RANGE = 3
	const ORDER_LIST_SELECTED_DATE_KEY = 'order_list_selected_date'
	const ORDER_LIST_REMARK_MAP_KEY = 'order_list_remark_map'

	const today = computed(() => formatDate(new Date()))
	const canManageData = computed(() => state.currentUser?.userName === 'chen')
	const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))
	const dailyRemarkMap = ref({})
	const dailyMergeMap = ref({})
	const userSettlementTypeMap = computed(() => {
		const map = new Map()
		state.users.filter(user => user && !user.isAdmin).forEach(user => {
			const key = String(user.userName || '').trim()
			if (!key) return
			map.set(key, user.settlementType === 'monthly' ? 'monthly' : 'daily')
		})
		return map
	})
	const selectedDate = ref(today.value)
	const showDatePicker = ref(false)
	const dateScrollIntoView = ref('')
	const shouldRespectRouteDate = ref(false)
	const triggerScrollIntoView = (targetRef, value) => {
		targetRef.value = ''
		nextTick(() => {
			setTimeout(() => {
				targetRef.value = value
			}, 0)
		})
	}

	const restoreSelectedDate = () => {
		const storedDate = String(uni.getStorageSync(ORDER_LIST_SELECTED_DATE_KEY) || '').trim()
		if (!storedDate) {
			selectedDate.value = today.value
			return
		}
		selectedDate.value = storedDate
	}

	const persistSelectedDate = (value) => {
		if (!value) return
		uni.setStorageSync(ORDER_LIST_SELECTED_DATE_KEY, value)
	}

	// 从 URL 接收 date 参数（月度汇总页面跳转时传入）
	onLoad((options) => {
		if (options && options.date) {
			shouldRespectRouteDate.value = true
			selectedDate.value = options.date
			persistSelectedDate(options.date)
			return
		}
		restoreSelectedDate()
	})

	onShow(() => {
		if (shouldRespectRouteDate.value) {
			shouldRespectRouteDate.value = false
		} else {
			restoreSelectedDate()
		}
		// 页面进入不请求服务器：数据只在首页点刷新按钮时全量同步，这里只读本机缓存
		loadMergeStatusMap()
	})
	const settlementFilter = ref('all')
	const paymentFilter = ref('all')
	const showAdvancedFilters = ref(false)
	const showExportModal = ref(false)
	// 订单列表折叠状态持久化
	const ORDER_LIST_EXPANDED_KEY = 'order_list_expanded'
	const readOrderListExpanded = () => {
		try {
			return uni.getStorageSync(ORDER_LIST_EXPANDED_KEY) === true
		} catch (error) {
			return false
		}
	}
	const listExpanded = ref(readOrderListExpanded())
	const previewUrl = ref(null)
	const attachmentLoading = ref(false)
	const showEditModal = ref(false)
	const showBatchOrderModal = ref(false)
	const showRemarkModal = ref(false)
	const showSearchModal = ref(false)
	const remarkInput = ref('')
	const searchKeyword = ref('')
	const batchOrderInputText = ref('')
	const batchOrderItems = ref([])
	const batchOrderError = ref('')
	const showBatchDuplicateModal = ref(false)
	const batchDuplicateLines = ref([])
	const batchUniqueLines = ref([])
	let batchDuplicateModalResolver = null
	const editingOrderId = ref('')
	const editorOrderDate = ref('')
	const editForm = ref({
		userName: '',
		unitPrice: '0',
		quantity: '0',
		returnedBuckets: '0',
		actualAmountReceived: '0',
		notes: ''
	})

	const readRemarkMap = () => {
		try {
			const raw = uni.getStorageSync(ORDER_LIST_REMARK_MAP_KEY)
			if (!raw) return {}
			const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
			return parsed && typeof parsed === 'object' ? parsed : {}
		} catch (error) {
			return {}
		}
	}

	const toggleOrderListExpanded = () => {
		listExpanded.value = !listExpanded.value
		uni.setStorageSync(ORDER_LIST_EXPANDED_KEY, listExpanded.value)
	}

	dailyRemarkMap.value = readRemarkMap()
	const persistRemarkMap = () => {
		uni.setStorageSync(ORDER_LIST_REMARK_MAP_KEY, JSON.stringify(dailyRemarkMap.value))
	}
	// 合并状态只读本机缓存（首页刷新按钮同步时写入），页面进入不请求服务器
	const MERGE_STATUS_CACHE_KEY = 'order_merge_status_cache'
	const persistMergeStatusCache = (mapData) => {
		try {
			const statuses = Object.keys(mapData).map(date => ({ date, isMerged: !!mapData[date] }))
			uni.setStorageSync(MERGE_STATUS_CACHE_KEY, JSON.stringify(statuses))
		} catch (error) {
			// 忽略缓存写入失败
		}
	}
	const loadMergeStatusMap = () => {
		try {
			const raw = uni.getStorageSync(MERGE_STATUS_CACHE_KEY)
			const statuses = raw ? JSON.parse(raw) : []
			dailyMergeMap.value = (Array.isArray(statuses) ? statuses : []).reduce((map, item) => {
				if (item?.date) map[item.date] = !!item.isMerged
				return map
			}, {})
		} catch (error) {
			dailyMergeMap.value = {}
		}
	}
	const getSelectedDateRemark = () => String(dailyRemarkMap.value[selectedDate.value] || '')
	const hasSelectedDateRemark = computed(() => !!getSelectedDateRemark().trim())
	const isSelectedDateMerged = computed(() => !!dailyMergeMap.value[selectedDate.value])
	const openRemarkModal = () => {
		remarkInput.value = getSelectedDateRemark()
		showRemarkModal.value = true
	}
	const closeRemarkModal = () => {
		showRemarkModal.value = false
	}
	const openSearchModal = () => {
		if (!canManageData.value) return
		searchKeyword.value = ''
		showSearchModal.value = true
	}
	const closeSearchModal = () => {
		showSearchModal.value = false
		searchKeyword.value = ''
	}
	const clearRemark = () => {
		remarkInput.value = ''
	}
	const saveRemark = () => {
		const dateKey = String(selectedDate.value || '').trim()
		if (!dateKey) return
		const content = String(remarkInput.value || '').trim()
		if (content) dailyRemarkMap.value = {
			...dailyRemarkMap.value,
			[dateKey]: content
		}
		else {
			const nextMap = {
				...dailyRemarkMap.value
			}
			delete nextMap[dateKey]
			dailyRemarkMap.value = nextMap
		}
		persistRemarkMap()
		showRemarkModal.value = false
	}

	const settleTypes = [{
		value: 'all',
		label: '全部'
	}, {
		value: 'daily',
		label: '日结'
	}, {
		value: 'monthly',
		label: '月结'
	}]
	const paymentTypes = [{
			value: 'all',
			label: '全部'
		}, {
			value: 'paid',
			label: '已付款'
		},
		{
			value: 'unpaid',
			label: '未付款'
		}
	]
	const exportOptions = [
		{ value: 'excel', label: 'Excel' }
	]
	const isPaid = (order) => getOrderActualReceivedAmount(order) > 0
	const getActualPaidAmount = (order) => getOrderActualReceivedAmount(order)
	const getUnitPrice = (order) => getOrderUnitPrice(order, userUnitPriceMap.value)
	const getReceivableAmount = (order) => {
		const receivable = getOrderReceivableAmount(order, userUnitPriceMap.value)
		if (receivable > 0) return receivable
		return getActualPaidAmount(order)
	}
	const getEditOrderUnitPrice = (order) => {
		const orderUnitPrice = Number(order?.unitPrice)
		if (Number.isFinite(orderUnitPrice) && orderUnitPrice > 0) return orderUnitPrice
		const userName = String(order?.userName || '').trim()
		const userUnitPrice = userUnitPriceMap.value.get(userName)
		return Number.isFinite(userUnitPrice) && userUnitPrice >= 0 ? userUnitPrice : 0
	}
	const getDisplaySettlementType = (order) => {
		const userName = String(order?.userName || '').trim()
		if (userSettlementTypeMap.value.has(userName)) {
			return userSettlementTypeMap.value.get(userName)
		}
		return order?.settlementType === 'monthly' ? 'monthly' : 'daily'
	}
	const paymentLabel = (order) => isPaid(order) ? '已付款' : '未付款'
	const sortOrdersForDisplay = (orders = []) => orders.slice().sort((a, b) => {
		const settlementDiff = Number(getDisplaySettlementType(b) === 'monthly') - Number(getDisplaySettlementType(a) === 'monthly')
		if (settlementDiff !== 0) return settlementDiff
		return String(a.userName || '').localeCompare(String(b.userName || ''), 'zh-Hans-CN')
	})
	const buildOrderDuplicateKey = (userName, date, quantity, returnedBuckets) => {
		const normalizedUserName = String(userName || '').trim()
		const normalizedDate = String(date || '').trim()
		return `${normalizedUserName}+${normalizedDate}/${Number(quantity) || 0}-${Number(returnedBuckets) || 0}`
	}
	const existingOrderKeySet = computed(() => new Set(
		state.orders.map(order => order.dedup_key || buildOrderDuplicateKey(order.userName, order.createdDate, order.quantity, order.returnedBuckets))
	))
	const batchOrderDuplicateInfo = computed(() => {
		const countMap = new Map()
		batchOrderItems.value.forEach(item => {
			const key = buildOrderDuplicateKey(item.userName, item.customDate || selectedDate.value, item.quantity, item.returnedBuckets)
			countMap.set(key, (countMap.get(key) || 0) + 1)
		})
		return batchOrderItems.value.reduce((acc, item) => {
			const key = buildOrderDuplicateKey(item.userName, item.customDate || selectedDate.value, item.quantity, item.returnedBuckets)
			acc[item.id] = {
				duplicateInBatch: (countMap.get(key) || 0) > 1,
				duplicateInDatabase: existingOrderKeySet.value.has(key),
				dedupKey: key
			}
			return acc
		}, {})
	})
	const getBatchItemDuplicateFlag = (itemId, field) => {
		const info = batchOrderDuplicateInfo.value[itemId]
		return info ? !!info[field] : false
	}
	const submittableBatchOrderItems = computed(() => batchOrderItems.value.filter(item => !getBatchItemDuplicateFlag(item.id, 'duplicateInBatch') && !getBatchItemDuplicateFlag(item.id, 'duplicateInDatabase')))
	const duplicateBatchOrderItems = computed(() => batchOrderItems.value.filter(item => getBatchItemDuplicateFlag(item.id, 'duplicateInBatch') || getBatchItemDuplicateFlag(item.id, 'duplicateInDatabase')))
	const sortedBatchOrderItems = computed(() => [...duplicateBatchOrderItems.value, ...submittableBatchOrderItems.value])
	const isBatchOrderItemDuplicate = (itemId) => getBatchItemDuplicateFlag(itemId, 'duplicateInBatch') || getBatchItemDuplicateFlag(itemId, 'duplicateInDatabase')

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
			dates.push(formatDate(cursor))
			cursor.setDate(cursor.getDate() + 1)
		}
		return dates.reverse()
	}

	const getRecentDayRangeStart = () => '2026-01-01'

	const availableDates = computed(() => {
		return buildDateRange(getRecentDayRangeStart(), today.value)
	})
	const openDatePicker = () => {
		showDatePicker.value = true
		triggerScrollIntoView(dateScrollIntoView, `date-option-${selectedDate.value}`)
	}
	const closeDatePicker = () => {
		showDatePicker.value = false
		dateScrollIntoView.value = ''
	}
	const selectDate = (date) => {
		selectedDate.value = date
		persistSelectedDate(date)
		closeDatePicker()
	}

	const isNextDayDisabled = computed(() => {
		const currentDate = parseLocalDate(selectedDate.value)
		const todayDate = parseLocalDate(today.value)
		if (!currentDate || !todayDate) return false
		return currentDate.getTime() >= todayDate.getTime()
	})

	const shiftSelectedDate = (offset) => {
		if (offset > 0 && isNextDayDisabled.value) return
		const baseDate = parseLocalDate(selectedDate.value) || parseLocalDate(today.value) || new Date()
		baseDate.setDate(baseDate.getDate() + offset)
		selectedDate.value = formatDate(baseDate)
		persistSelectedDate(selectedDate.value)
	}

	const normalizeOrderDateValue = (value) => {
		const text = String(value || '').trim()
		if (!text) return ''
		const match = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
		if (match) {
			const [, year, month, day] = match
			return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
		}
		const shortMatch = text.match(/^(\d{4}-\d{2}-\d{2})/)
		return shortMatch ? shortMatch[1] : text.slice(0, 10)
	}

	const selectedDateOrders = computed(() => sortOrdersForDisplay(state.orders.filter(o => selectedDate.value ? normalizeOrderDateValue(o.createdDate) === selectedDate.value : true)))
	const searchedOrders = computed(() => {
		const keyword = String(searchKeyword.value || '').trim().toLowerCase()
		if (!keyword) return []
		return selectedDateOrders.value.filter(order => String(order.userName || '').trim().toLowerCase().includes(keyword))
	})
	const filteredOrders = computed(() => selectedDateOrders.value.filter(o => {
		return (settlementFilter.value === 'all' || getDisplaySettlementType(o) === settlementFilter.value) &&
			(paymentFilter.value === 'all' || (paymentFilter.value === 'paid' ? isPaid(o) : !isPaid(o)))
	}))

	const dailySettleSum = computed(() => filteredOrders.value.filter(o => getDisplaySettlementType(o) === 'daily').reduce((s, o) =>
		s + getReceivableAmount(o), 0))
	const monthlySettleSum = computed(() => filteredOrders.value.filter(o => getDisplaySettlementType(o) === 'monthly').reduce((s,
		o) => s + getReceivableAmount(o), 0))
	const totalAmountSum = computed(() => filteredOrders.value.reduce((s, o) => s + getReceivableAmount(o), 0))
	const totalActualSum = computed(() => filteredOrders.value.reduce((s, o) => s + getActualPaidAmount(o), 0))
	const totalDeliveredSum = computed(() => filteredOrders.value.reduce((s, o) => s + o.quantity, 0))
	const totalReturnedSum = computed(() => filteredOrders.value.reduce((s, o) => s + o.returnedBuckets, 0))
	const buildDaySummarySheetRows = () => {
		const headerRow = [
			{ value: '客户', style: 'header' },
			{ value: '发水', style: 'header' },
			{ value: '回桶', style: 'header' },
			{ value: '应收', style: 'header' },
			{ value: '实收', style: 'header' }
		]
		const rows = [
			[{ value: `${selectedDate.value} 日账单汇总`, style: 'title' }],
			['总发水', totalDeliveredSum.value],
			['总回桶', totalReturnedSum.value],
			['日结总金额', dailySettleSum.value],
			['月结总金额', monthlySettleSum.value],
			['应收总金额', totalAmountSum.value],
			['实收总金额', totalActualSum.value],
			['', '', '', '', '']
		]
		const groupedMap = new Map()
		filteredOrders.value.forEach(order => {
			const userName = String(order.userName || '').trim()
			const settlementLabel = getDisplaySettlementType(order) === 'monthly' ? '月结' : '日结'
			const groupKey = `${userName}__${settlementLabel}`
			if (!userName) return
			if (!groupedMap.has(groupKey)) {
				groupedMap.set(groupKey, {
					userName: `${userName}(${settlementLabel})`,
					settlementLabel,
					quantity: 0,
					returnedBuckets: 0,
					receivable: 0,
					actual: 0
				})
			}
			const current = groupedMap.get(groupKey)
			current.quantity += Number(order.quantity) || 0
			current.returnedBuckets += Number(order.returnedBuckets) || 0
			current.receivable = Number((current.receivable + (Number(getReceivableAmount(order)) || 0)).toFixed(2))
			current.actual = Number((current.actual + (Number(getActualPaidAmount(order)) || 0)).toFixed(2))
		})
		rows.push(headerRow)
		const groupedItems = Array.from(groupedMap.values())
		const dailyItems = groupedItems.filter(item => item.settlementLabel === '日结')
		const monthlyItems = groupedItems.filter(item => item.settlementLabel === '月结')
		const buildCustomerRow = (item, isMonthly) => {
			return [
				isMonthly ? { value: item.userName, style: 'monthly' } : item.userName,
				item.quantity,
				item.returnedBuckets,
				item.receivable,
				item.actual
			]
		}
		dailyItems.forEach(item => {
			rows.push(buildCustomerRow(item, false))
		})
		if (dailyItems.length > 0 && monthlyItems.length > 0) {
			rows.push(['', '', '', '', ''])
		}
		monthlyItems.forEach(item => {
			rows.push(buildCustomerRow(item, true))
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
			if (columnIndex === 0) {
				return Math.max(baseWidth - 3, 9)
			}
			if (columnIndex === 1) {
				return Math.max(Math.max(maxLength + 4, 12) - 2, 10)
			}
			return baseWidth
		})
		if (columnWidths[2] !== undefined) {
			columnWidths[1] = columnWidths[2]
		}
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
	const buildDayDetailSheetRows = () => {
		const rows = [[
			'日期', '客户', '结算方式', '单价', '数量', '回桶', '应收', '实收', '备注'
		]]
		filteredOrders.value.forEach(order => {
			rows.push([
				selectedDate.value,
				order.userName || '',
				getDisplaySettlementType(order) === 'monthly' ? '月结' : '日结',
				Number(getUnitPrice(order)) || 0,
				Number(order.quantity) || 0,
				Number(order.returnedBuckets) || 0,
				Number(getReceivableAmount(order)) || 0,
				Number(getActualPaidAmount(order)) || 0,
				order.notes || ''
			])
		})
		return {
			rows,
			columnWidths: [16, 12, 10, 10, 10, 10, 10, 10, 16]
		}
	}
	const handleExportOption = (type) => {
		showExportModal.value = false
		if (type === 'excel') {
			exportExcelWorkbook({
				fileName: `${selectedDate.value}-日账单`,
				sheets: [
					{ name: '汇总', ...buildDaySummarySheetRows() },
					{ name: '明细', ...buildDayDetailSheetRows() }
				]
			}).then(showExcelPreviewShareActions).catch(() => {})
			return
		}
	}

	const resetFilters = () => {
		settlementFilter.value = 'all';
		paymentFilter.value = 'all'
	}
	const toggleMergeMark = () => {
		if (!canManageData.value) return
		const dateKey = String(selectedDate.value || '').trim()
		if (!dateKey) return
		if (!dailyMergeMap.value[dateKey]) {
			setOrderMergeStatus(dateKey, true).then(result => {
				if (!result.success) {
					uni.showModal({
						title: '保存失败',
						content: result.message || '保存合并状态失败',
						showCancel: false
					})
					return
				}
				const nextMap = {
					...dailyMergeMap.value,
					[dateKey]: true
				}
				dailyMergeMap.value = nextMap
				persistMergeStatusCache(nextMap)
			})
			return
		}
		uni.showModal({
			title: '取消合并',
			content: `确认将 ${dateKey} 改回未合并吗？`,
			success: ({ confirm }) => {
				if (!confirm) return
				setOrderMergeStatus(dateKey, false).then(result => {
					if (!result.success) {
						uni.showModal({
							title: '保存失败',
							content: result.message || '保存合并状态失败',
							showCancel: false
						})
						return
					}
					const nextMap = {
						...dailyMergeMap.value
					}
					delete nextMap[dateKey]
					dailyMergeMap.value = nextMap
					persistMergeStatusCache(nextMap)
				})
			}
		})
	}
	const resetBatchOrderModalState = () => {
		batchOrderInputText.value = ''
		batchOrderItems.value = []
		batchOrderError.value = ''
		batchDuplicateLines.value = []
		batchUniqueLines.value = []
		showBatchDuplicateModal.value = false
		batchDuplicateModalResolver = null
	}
	const openBatchOrderModal = () => {
		if (!canManageData.value) return
		resetBatchOrderModalState()
		showBatchOrderModal.value = true
	}
	const closeBatchOrderModal = () => {
		showBatchOrderModal.value = false
		batchOrderError.value = ''
	}
	const clearBatchOrderInput = () => {
		batchOrderInputText.value = ''
		batchOrderError.value = ''
	}
	const formatBatchOrderPreviewLine = (item) => {
		if (!item) return ''
		return [
			String(item.userName || '').trim(),
			Number(item.quantity) || 0,
			Number(item.returnedBuckets) || 0,
			formatMoney(item.actualAmountReceived)
		].join(' ').trim()
	}
	const buildParsedBatchOrderItem = ({
		userName,
		quantity,
		returnedBuckets,
		lineIdx,
		actualAmountReceived,
		actualAmountTouched
	}) => {
		const matchedUser = state.users.find(u => !u.isAdmin && (u.userName && u.userName.toLowerCase().includes(userName.toLowerCase()) || userName.toLowerCase().includes((u.userName || '').split(' ')[0]?.toLowerCase())))
		const finalUnitPrice = matchedUser ? matchedUser.unitPrice : 0
		const settlementType = matchedUser ? matchedUser.settlementType : 'daily'
		const totalAmount = Number((quantity * finalUnitPrice).toFixed(2))
		const finalActualAmount = actualAmountTouched ? Number(actualAmountReceived) : 0
		return {
			id: `parsed-${Date.now()}-${lineIdx}-${Math.random().toString(36).substr(2, 4)}`,
			userName,
			matchedUserId: matchedUser?._id,
			quantity,
			returnedBuckets,
			unitPrice: 0,
			totalAmount,
			actualAmountReceived: finalActualAmount,
			actualAmountTouched: !!actualAmountTouched,
			settlementType,
			customDate: selectedDate.value,
			notes: '',
			expanded: false
		}
	}
	const parseBatchOrderChunk = (userName, tokens, lineIdx) => {
		let quantity = 0,
			returnedBuckets = 0,
			actualAmountReceived = 0,
			hasExplicitAmount = false
		let quantityAssigned = false,
			returnedBucketsAssigned = false
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
		tokens.forEach((t, i) => {
			const match = t.match(/\d+(\.\d+)?/)
			if (match) numberMatches.push({ num: parseFloat(match[0]), token: t, index: i })
		})
		const classified = new Set()

		numberMatches.forEach((match, idx) => {
			const token = match.token.toLowerCase()
			if (token.includes('元') || token.includes('￥') || token.includes('付') || token.includes('款') || token.includes('扫码') || token.includes('收')) {
				actualAmountReceived = match.num
				hasExplicitAmount = true
				classified.add(idx)
			}
		})
		numberMatches.forEach((match, idx) => {
			if (classified.has(idx)) return
			const token = match.token.toLowerCase()
			if (token.includes('回') || token.includes('桶') || token.includes('退')) {
				returnedBuckets = match.num
				returnedBucketsAssigned = true
				classified.add(idx)
			}
		})
		numberMatches.forEach((match, idx) => {
			if (classified.has(idx)) return
			const token = match.token.toLowerCase()
			if (token.includes('送') || token.includes('水') || token.includes('购') || token.includes('买') || token.includes('配')) {
				quantity = match.num
				quantityAssigned = true
				classified.add(idx)
			}
		})
		numberMatches.forEach((match, idx) => {
			if (classified.has(idx)) return
			if (match.token.includes('/')) return
			positionalNumbers.push(match.num)
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

		if (!hasExplicitAmount) actualAmountReceived = 0
		return buildParsedBatchOrderItem({
			userName,
			quantity,
			returnedBuckets,
			actualAmountReceived,
			actualAmountTouched: hasExplicitAmount,
			lineIdx
		})
	}
	const handleBatchOrderParse = () => {
		batchOrderError.value = ''
		if (!batchOrderInputText.value.trim()) {
			batchOrderError.value = '请输入需要解析的文本内容'
			return
		}

		const systemUserNames = state.users.map(u => u.userName && u.userName.trim()).filter(Boolean)
		const normalizedSource = normalizeRecognizedOrderText(batchOrderInputText.value)
		const lines = normalizedSource.split('\n')
		const parsedItems = []

		lines.forEach((line, lineIdx) => {
			const trimmedLine = line.trim()
			if (!trimmedLine) return

			const compactSegments = parseCompactOrderSegments(trimmedLine)
			if (compactSegments.length > 0) {
				compactSegments.forEach((segment, segmentIdx) => {
					parsedItems.push(buildParsedBatchOrderItem({
						userName: segment.name,
						quantity: segment.quantity,
						returnedBuckets: segment.returnedBuckets,
						actualAmountReceived: segment.actualAmountReceived,
						actualAmountTouched: segment.actualAmountTouched,
						lineIdx: `${lineIdx}-${segmentIdx}`
					}))
				})
				return
			}

			const spaceCleanedLine = trimmedLine.replace(/([\(\)（）:,，;；：])/g, ' $1 ').replace(/\s+/g, ' ').trim()
			const tokens = spaceCleanedLine.split(/\s+/).filter(t => t.length > 0)
			let currentChunk = null
			tokens.forEach(token => {
				if (isPotentialName(token, systemUserNames)) {
					if (currentChunk) parsedItems.push(parseBatchOrderChunk(currentChunk.userName, currentChunk.tokens, lineIdx))
					currentChunk = { userName: token.replace(/[\(\)（）:,，：]/g, ''), tokens: [] }
				} else if (currentChunk) {
					currentChunk.tokens.push(token)
				} else {
					currentChunk = { userName: token.replace(/[\(\)（）:,，：]/g, ''), tokens: [] }
				}
			})
			if (currentChunk) parsedItems.push(parseBatchOrderChunk(currentChunk.userName, currentChunk.tokens, lineIdx))
		})

		if (parsedItems.length === 0) {
			batchOrderItems.value = []
			batchOrderError.value = '未能成功解析任何订单，请检查输入格式'
			return
		}
		batchOrderItems.value = parsedItems
	}
	const updateBatchOrderItemField = (id, field, value) => {
		batchOrderItems.value = batchOrderItems.value.map(item => {
			if (item.id !== id) return item
			const oldTotal = Number(item.totalAmount) || 0
			const updated = { ...item, [field]: value }
			if (field === 'quantity' || field === 'unitPrice') {
				updated.totalAmount = Number(((field === 'quantity' ? value : updated.quantity) * (field === 'unitPrice' ? value : updated.unitPrice)).toFixed(2))
				if (!updated.actualAmountTouched || Number(updated.actualAmountReceived) === oldTotal) updated.actualAmountReceived = 0
			}
			if (field === 'userName') {
				const matchedUser = state.users.find(u => !u.isAdmin && (u.userName && u.userName.trim().toLowerCase() === String(value || '').trim().toLowerCase() || (u.userName || '').toLowerCase().includes(String(value || '').toLowerCase())))
				if (matchedUser) {
					updated.matchedUserId = matchedUser._id
					updated.unitPrice = 0
					updated.settlementType = matchedUser.settlementType
					updated.totalAmount = Number((Number(updated.quantity || 0) * matchedUser.unitPrice).toFixed(2))
					if (!updated.actualAmountTouched || Number(updated.actualAmountReceived) === oldTotal) updated.actualAmountReceived = 0
				} else {
					updated.matchedUserId = undefined
				}
			}
			if (field === 'actualAmountReceived') updated.actualAmountTouched = true
			return updated
		})
	}
	const toggleBatchOrderExpanded = (id) => {
		batchOrderItems.value = batchOrderItems.value.map(item => item.id === id ? { ...item, expanded: !item.expanded } : item)
	}
	const deleteBatchOrderRow = (id) => {
		batchOrderItems.value = batchOrderItems.value.filter(item => item.id !== id)
	}
	const showBatchDuplicateAlert = (duplicateOrders = [], uniqueOrders = []) => new Promise((resolve) => {
		batchDuplicateLines.value = duplicateOrders.map(item => `${item.userName || ''} ${Number(item.quantity) || 0} ${Number(item.returnedBuckets) || 0}`.trim()).filter(Boolean)
		batchUniqueLines.value = uniqueOrders.map(item => `${item.userName || ''} ${Number(item.quantity) || 0} ${Number(item.returnedBuckets) || 0}`.trim()).filter(Boolean)
		batchDuplicateModalResolver = resolve
		showBatchDuplicateModal.value = true
	})
	const resolveBatchDuplicateModal = (shouldSubmit) => {
		showBatchDuplicateModal.value = false
		const resolver = batchDuplicateModalResolver
		batchDuplicateModalResolver = null
		batchDuplicateLines.value = []
		batchUniqueLines.value = []
		if (resolver) resolver(!!shouldSubmit)
	}
	const submitBatchOrdersFromModal = async () => {
		batchOrderError.value = ''
		if (batchOrderItems.value.length === 0) {
			batchOrderError.value = '当前没有可提交的订单'
			return
		}
		if (batchOrderItems.value.some(item => !String(item.userName || '').trim())) {
			batchOrderError.value = '所有订单均必须填写客户姓名'
			return
		}
		const invalidIndex = batchOrderItems.value.findIndex(item => {
			return !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 0 ||
				!Number.isInteger(Number(item.returnedBuckets)) || Number(item.returnedBuckets) < 0 ||
				Number(item.unitPrice) < 0 || Number(item.actualAmountReceived) < 0
		})
		if (invalidIndex !== -1) {
			batchOrderError.value = `第 ${invalidIndex + 1} 行存在无效数据：送水数允许为 0，但不能小于 0；请同时检查回桶数、单价和实收金额`
			return
		}

		const now = new Date()
		const duplicateSnapshot = duplicateBatchOrderItems.value.map(item => ({
			userName: String(item.userName || '').trim(),
			quantity: Number(item.quantity) || 0,
			returnedBuckets: Number(item.returnedBuckets) || 0,
			actualAmountReceived: Number(item.actualAmountReceived) || 0,
			createdDate: item.customDate || selectedDate.value
		}))
		const finalOrders = submittableBatchOrderItems.value.map((item, index) => {
			const itemTime = new Date(now.getTime() - index * 1000)
			const order = {
				createdAt: formatBeijingDateTime(itemTime),
				createdDate: selectedDate.value,
				userName: item.userName.trim(),
				quantity: Number(item.quantity),
				returnedBuckets: Number(item.returnedBuckets),
				operator: state.currentUser?.userName || '',
				unitPrice: 0,
				totalAmount: Number(item.totalAmount),
				actualAmountReceived: Number(item.actualAmountReceived),
				logs: [],
				settlementType: item.settlementType,
				notes: String(item.notes || '').trim()
			}
			order.dedup_key = buildOrderDuplicateKey(order.userName, order.createdDate, order.quantity, order.returnedBuckets)
			return order
		})

		if (finalOrders.length === 0) {
			batchOrderError.value = '解析结果全部是重复数据，没有可提交的订单'
			return
		}

		const result = await addOrders(finalOrders)
		if (!result?.success) {
			batchOrderError.value = result?.message || '批量保存失败，请稍后重试'
			if (result?.code === 'DUPLICATE_ORDER' && Array.isArray(result.duplicateOrders) && result.duplicateOrders.length > 0) {
				await showBatchDuplicateAlert(result.duplicateOrders, [])
			}
			return
		}

		const addedCount = Number(result.addedCount || result.count || finalOrders.length) || 0
		resetBatchOrderModalState()
		showBatchOrderModal.value = false
	}
	const previewImage = (url) => {
		previewUrl.value = url
	}
	const openEditModal = (order) => {
		if (!canManageData.value) return
		editingOrderId.value = order?._id || ''
		editorOrderDate.value = String(order?.createdDate || '').trim()
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
	const closeEditModal = () => {
		showEditModal.value = false
		editingOrderId.value = ''
		editorOrderDate.value = ''
	}
	const submitEditOrder = async () => {
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
			confirmColor: '#dc2626',
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
	const previewOrderMedia = async (order, type) => {
		if (!order?._id || attachmentLoading.value) return
		attachmentLoading.value = true
		const result = await getOrderMedia(order._id)
		attachmentLoading.value = false
		if (!result.success) {
			uni.showModal({
				title: '加载失败',
				content: result.message || '附件加载失败',
				showCancel: false
			})
			return
		}
		if (type === 'logs') {
			const firstLog = Array.isArray(result.logs) ? result.logs[0] : ''
			if (firstLog) previewImage(firstLog)
			else uni.showModal({
				title: '暂无图片',
				content: '该订单没有现场照片',
				showCancel: false
			})
			return
		}
		if (result.paymentScreenshot) previewImage(result.paymentScreenshot)
		else uni.showModal({
			title: '暂无图片',
			content: '该订单没有付款截图',
			showCancel: false
		})
	}
</script>

<style lang="scss" scoped>
	.order-list-page {
		min-height: 100vh;
		background: linear-gradient(180deg, #f8fbfa 0%, #f2f6f9 100%);
		display: flex;
		flex-direction: column;
	}

	.order-list-top-sticky {
		position: sticky;
		top: 0;
		z-index: 20;
		background: linear-gradient(180deg, #f8fbfa 0%, #f2f6f9 100%);
		pointer-events: none;
	}

	.toolbar-wrap,
	.filter-overlay,
	.date-select,
	.financial-grid,
	.filter-summary {
		pointer-events: auto
	}

	.card {
		background: #fff;
		border-radius: 18px;
		border: 1px solid #e8eef5;
		box-shadow: 0 8px 22px rgba(15, 23, 42, .04)
	}

	.toolbar-wrap {
		padding: 8px 16px 0
	}

	.toolbar-card {
		background: #fff;
		border: 1px solid #e8eef5;
		border-radius: 18px;
		padding: 10px 12px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		box-shadow: 0 10px 24px rgba(15, 23, 42, .04)
	}

	.toolbar-main-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%
	}

	.toolbar-label-group {
		min-width: 0;
		padding-right: 12px
	}

	.toolbar-left-actions {
		display: flex;
		align-items: center;
		gap: 8px
	}

	.merge-mark-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 7px 12px;
		flex-shrink: 0;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: #f8fafc;
		color: #334155;
		font-size: 10px;
		font-weight: 700
	}

	.merge-mark-btn-active {
		background: #ecfdf5;
		border-color: #86efac;
		color: #15803d
	}

	.merge-mark-btn-text {
		line-height: 1;
		white-space: nowrap
	}

	.copy-summary-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 7px 12px;
		flex-shrink: 0;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: #f8fafc;
		color: #334155;
		font-size: 10px;
		font-weight: 700
	}

	.copy-summary-btn-text {
		line-height: 1;
		white-space: nowrap
	}

	.toolbar-actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-shrink: 0
	}

	.toolbar-remark-inline {
		width: 100%;
		padding: 8px 10px;
		background: #f8fafc;
		border: 1px solid #e8eef5;
		border-radius: 12px;
		font-size: 11px;
		line-height: 1.5;
		color: #f87171;
		box-sizing: border-box
	}

	.toolbar-label {
		display: block;
		font-size: 12px;
		font-weight: 800;
		color: #1e293b
	}

	.batch-entry-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 10px;
		border: 1px solid #a7f3d0;
		border-radius: 12px;
		background: #ecfdf5;
		font-size: 11px;
		font-weight: 700;
		color: #047857;
		flex-shrink: 0
	}

	.remark-entry-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 7px 10px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: #f8fafc;
		font-size: 11px;
		font-weight: 700;
		color: #334155;
		flex-shrink: 0
	}

	.remark-entry-btn-active {
		background: #fff7ed;
		border-color: #fdba74;
		color: #c2410c
	}

	.remark-entry-btn-text {
		line-height: 1
	}

	.batch-entry-btn-icon {
		font-size: 12px;
		line-height: 1
	}

	.batch-entry-btn-text {
		line-height: 1
	}

	.filter-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 10px;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		background: #f8fafc;
		font-size: 11px;
		font-weight: 700;
		color: #334155;
		flex-shrink: 0
	}

	.filter-toggle-icon {
		font-size: 11px
	}

	.filter-toggle-text {
		line-height: 1
	}

	.filter-active {
		background: #ecfdf5;
		border-color: #a7f3d0;
		color: #047857
	}

	.filter-overlay {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, .42);
		z-index: 50;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 20px
	}

	.batch-modal {
		width: 100%;
		max-width: 560px;
		max-height: calc(100vh - 64px);
		background: #fff;
		border-radius: 24px;
		padding: 18px 16px 16px;
		border: 1px solid rgba(226, 232, 240, .9);
		box-shadow: 0 24px 60px rgba(15, 23, 42, .24);
		box-sizing: border-box;
		display: flex;
		flex-direction: column
	}

	.remark-modal {
		width: 100%;
		max-width: 560px;
		background: #fff;
		border-radius: 24px;
		padding: 18px 16px 16px;
		border: 1px solid rgba(226, 232, 240, .9);
		box-shadow: 0 24px 60px rgba(15, 23, 42, .24);
		box-sizing: border-box
	}

	.search-modal {
		width: 100%;
		max-width: 560px;
		max-height: calc(100vh - 64px);
		background: #fff;
		border-radius: 24px;
		padding: 18px 16px 16px;
		border: 1px solid rgba(226, 232, 240, .9);
		box-shadow: 0 24px 60px rgba(15, 23, 42, .24);
		box-sizing: border-box;
		display: flex;
		flex-direction: column
	}

	.search-modal-body {
		padding-top: 4px
	}

	.search-result-list {
		max-height: calc(100vh - 260px);
		margin-top: 12px;
		box-sizing: border-box
	}

	.search-empty-state {
		padding: 32px 12px;
		text-align: center;
		font-size: 12px;
		color: #94a3b8
	}

	.search-order-card {
		padding: 12px;
		border: 1px solid #e8eef5;
		border-radius: 14px;
		background: #fff;
		box-shadow: 0 4px 14px rgba(15, 23, 42, .03)
	}

	.search-order-card+.search-order-card {
		margin-top: 8px
	}

	.search-order-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px
	}

	.search-order-name {
		font-size: 12px;
		font-weight: 800;
		color: #1e293b
	}

	.search-order-tag {
		font-size: 9px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px
	}

	.search-order-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px 14px;
		font-size: 11px;
		color: #64748b
	}

	.search-order-meta+.search-order-meta {
		margin-top: 6px
	}

	.search-order-notes {
		margin-top: 8px;
		padding: 8px 10px;
		background: #f8fafc;
		border: 1px solid #e8eef5;
		border-radius: 10px;
		font-size: 13px;
		line-height: 1.5;
		color: #f87171
	}

	.remark-modal-body {
		padding-top: 4px
	}

	.remark-textarea {
		display: block;
		width: calc(100% - 30px);
		max-width: calc(100% - 30px);
		min-height: 140px;
		padding: 14px;
		background: #eee;
		border: 1px solid #dbe4ee;
		border-radius: 14px;
		font-size: 12px;
		color: #334155;
		line-height: 1.6
	}

	.remark-modal-actions {
		display: flex;
		gap: 10px;
		margin-top: 14px
	}

	.remark-clear-btn,
	.remark-save-btn {
		flex: 1;
		height: 44px;
		line-height: 44px;
		border-radius: 16px;
		font-size: 14px;
		font-weight: 800;
		padding: 0
	}

	.remark-clear-btn {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		color: #475569
	}

	.remark-save-btn {
		background: linear-gradient(135deg, #0f766e, #10b981);
		color: #fff;
		box-shadow: 0 10px 20px rgba(16, 185, 129, .16)
	}

	.batch-modal-body {
		max-height: calc(100vh - 180px);
		padding-top: 2px;
		box-sizing: border-box
	}

	.batch-error-banner {
		padding: 12px;
		background: #fef2f2;
		border: 1px solid #fee2e2;
		border-radius: 12px;
		font-size: 12px;
		color: #dc2626;
		margin-bottom: 12px
	}

	.batch-parse-card,
	.batch-result-card {
		background: #fff;
		border-radius: 18px;
		border: 1px solid #e8eef5;
		box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
		padding: 16px
	}

	.batch-result-card {
		margin-top: 12px
	}

	.batch-result-title {
		display: block;
		font-size: 12px;
		font-weight: 800;
		color: #1e293b;
		margin-bottom: 10px
	}

	.batch-parse-textarea {
		display: block;
		width: calc(100% - 30px);
		max-width: calc(100% - 30px);
		min-height: 140px;
		padding: 14px;
		background: #eee;
		border: 1px solid #dbe4ee;
		border-radius: 14px;
		font-size: 12px;
		font-family: monospace;
		color: #334155;
		line-height: 1.6
	}

	.batch-parse-btns {
		display: flex;
		gap: 8px;
		margin-top: 12px;
		align-items: center
	}

	.batch-parse-btn {
		flex: 1;
		height: 38px;
		line-height: 38px;
		background: linear-gradient(135deg, #0f766e, #10b981);
		color: #fff;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 800;
		box-shadow: 0 8px 16px rgba(16, 185, 129, .14);
		padding: 0
	}

	.batch-parse-clear {
		height: 38px;
		line-height: 38px;
		padding: 0 16px;
		background: #eef2f7;
		border: none;
		color: #64748b;
		border-radius: 18px;
		font-size: 11px;
		font-weight: 700;
		box-shadow: none
	}

	.batch-parse-clear::after {
		border: none
	}

	.batch-result-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 0;
		border-bottom: 1px solid #f1f5f9
	}

	.batch-result-main {
		flex: 1;
		min-width: 0
	}

	.batch-result-preview-wrap {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px
	}

	.batch-result-preview-line {
		display: block;
		flex: 1;
		min-width: 0;
		font-size: 14px;
		font-weight: 800;
		word-break: break-all
	}

	.batch-result-preview-line-duplicate {
		color: #dc2626
	}

	.batch-result-preview-line-unique {
		color: #16a34a
	}

	.batch-result-toggle-btn {
		flex-shrink: 0;
		font-size: 11px;
		font-weight: 700;
		color: #059669;
		background: #ecfdf5;
		padding: 5px 10px;
		border-radius: 10px
	}

	.batch-result-form-grid {
		min-width: 0;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px 8px;
		margin-top: 10px
	}

	.batch-result-field {
		min-width: 0
	}

	.batch-result-field-name {
		grid-column: 1 / -1
	}

	.batch-result-field-label {
		display: block;
		font-size: 10px;
		font-weight: 700;
		color: #64748b;
		margin-bottom: 4px
	}

	.batch-result-line {
		display: block;
		flex: 1;
		min-width: 0;
		font-size: 13px;
		font-weight: 700;
		color: #334155
	}

	.batch-result-delete-btn {
		flex-shrink: 0;
		padding: 6px 10px;
		background: #fff1f2;
		border: 1px solid #fecdd3;
		border-radius: 10px;
		font-size: 12px;
		font-weight: 800;
		color: #dc2626
	}

	.batch-result-submit-btn {
		width: 100%;
		height: 46px;
		margin-top: 14px;
		background: linear-gradient(135deg, #0f766e, #10b981);
		color: #fff;
		border-radius: 16px;
		font-size: 13px;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 10px 20px rgba(16, 185, 129, .16)
	}

	.duplicate-modal-mask {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, .52);
		z-index: 130;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 20px 24px 24px;
		box-sizing: border-box
	}

	.duplicate-modal {
		width: 100%;
		max-width: 560px;
		background: #fff;
		border-radius: 24px;
		padding: 18px 16px 16px;
		border: 1px solid rgba(226, 232, 240, .9);
		box-shadow: 0 24px 60px rgba(15, 23, 42, .24);
		box-sizing: border-box
	}

	.duplicate-modal-title {
		display: block;
		font-size: 15px;
		font-weight: 800;
		color: #1e293b
	}

	.duplicate-modal-list {
		max-height: 320px;
		margin-top: 12px;
		padding: 2px 0 4px
	}

	.duplicate-modal-section+.duplicate-modal-section {
		margin-top: 12px
	}

	.duplicate-modal-section-title {
		display: block;
		font-size: 12px;
		font-weight: 800;
		color: #64748b;
		margin-bottom: 4px
	}

	.duplicate-modal-line {
		display: block;
		padding: 10px 0;
		border-bottom: 1px solid #f1f5f9;
		font-size: 14px;
		font-weight: 700;
		color: #334155
	}

	.duplicate-modal-actions {
		display: flex;
		gap: 10px;
		margin-top: 14px
	}

	.duplicate-modal-btn {
		flex: 1;
		height: 44px;
		border-radius: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 800
	}

	.duplicate-modal-btn-muted {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		color: #475569
	}

	.duplicate-modal-btn-primary {
		background: linear-gradient(135deg, #0f766e, #10b981);
		color: #fff;
		box-shadow: 0 10px 20px rgba(16, 185, 129, .16)
	}

	.btn-disabled {
		opacity: .5
	}

	.filter-panel,
	.date-panel {
		background: #fff;
		border-radius: 20px;
		padding: 18px;
		width: 100%;
		max-width: 380px;
		box-shadow: 0 24px 56px rgba(15, 23, 42, .2)
	}

	.filter-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding-bottom: 10px;
		border-bottom: 1px solid #f1f5f9;
		margin-bottom: 14px;
		gap: 12px
	}

	.filter-header-title {
		display: block;
		font-size: 15px;
		font-weight: 800;
		color: #0f172a
	}

	.filter-header-subtitle {
		display: block;
		font-size: 8px;
		color: #94a3b8;
		margin-top: 4px
	}

	.filter-header-close {
		font-size: 12px;
		font-weight: 700;
		color: #059669;
		background: #ecfdf5;
		padding: 6px 12px;
		border-radius: 10px;
		flex-shrink: 0
	}

	.filter-section {
		margin-bottom: 12px
	}

	.filter-section-label {
		font-size: 10px;
		font-weight: 700;
		color: #94a3b8;
		display: block;
		margin-bottom: 8px;
		text-transform: uppercase
	}

	.filter-btn-group {
		display: flex;
		gap: 8px
	}

	.filter-btn-group-4 {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px
	}

	.filter-btn {
		flex: 1;
		padding: 8px 0;
		border-radius: 10px;
		background: #f8fafc;
		border: 1px solid #f1f5f9;
		text-align: center;
		font-size: 12px;
		font-weight: 600;
		color: #475569
	}

	.filter-btn-active {
		background: #10b981;
		color: #fff
	}

	.filter-btn-active-dark {
		background: #1e293b;
		color: #fff
	}

	.export-option-list {
		display: flex;
		flex-direction: column;
		gap: 8px
	}

	.export-option-item {
		padding: 12px 14px;
		border-radius: 12px;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		font-size: 13px;
		font-weight: 700;
		color: #334155
	}

	.filter-reset {
		text-align: right;
		padding-top: 10px;
		border-top: 1px solid #f8fafc;
		font-size: 10px;
		font-weight: 700;
		color: #94a3b8
	}

	.date-select {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px 16px 5px;
		gap: 12px
	}

	.date-picker-row {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		width: 100%
	}

	.date-shift-btn {
		height: 34px;
		padding: 0 10px;
		border-radius: 12px;
		background: #fff;
		border: 1px solid #e2e8f0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 700;
		color: #334155;
		box-shadow: 0 6px 16px rgba(15, 23, 42, .04);
		flex: 0 0 auto;
		min-width: 0;
		white-space: nowrap
	}

	.date-shift-btn-disabled {
		opacity: .45
	}

	.date-picker {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 14px;
		padding: 8px 12px;
		font-size: 12px;
		font-weight: 700;
		color: #1e293b;
		box-shadow: 0 6px 16px rgba(15, 23, 42, .04);
		flex: 1 1 0;
		width: 0;
		min-width: 0;
		overflow: hidden;
		box-sizing: border-box
	}

	.date-picker-label-wrap {
		flex: 1;
		min-width: 0;
		overflow: hidden
	}

	.date-picker-label {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap
	}

	.date-picker-arrow {
		flex-shrink: 0;
		font-size: 8px;
		color: #94a3b8;
		margin-left: 6px
	}

	.date-list {
		max-height: 320px
	}

	.date-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 4px;
		border-bottom: 1px solid #f8fafc
	}

	.date-item-active {
		color: #059669
	}

	.date-item-text {
		font-size: 13px;
		font-weight: 700;
		color: inherit
	}

	.date-item-tag {
		min-width: 28px;
		text-align: right;
		font-size: 10px;
		font-weight: 700;
		color: #94a3b8
	}

	.financial-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		padding: 12px 16px;
		background: rgba(248, 250, 252, .72);
		border-bottom: 1px solid rgba(226, 232, 240, .6)
	}

	.fin-item {
		background: #fff;
		padding: 10px 6px;
		border-radius: 14px;
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 3px;
		border: 1px solid #edf2f7;
		box-shadow: 0 4px 14px rgba(15, 23, 42, .03)
	}

	.fin-item-green {
		background: rgba(236, 253, 245, .3);
		border: 1px solid rgba(209, 250, 229, .8)
	}

	.fin-label {
		font-size: 9px;
		font-weight: 700;
		color: #94a3b8
	}

	.fin-label-green {
		color: #059669
	}

	.fin-value {
		font-size: 12px;
		font-weight: 900;
		color: #334155;
		font-family: monospace
	}

	.fin-value-red {
		color: #dc2626
	}

	.fin-value-green {
		color: #059669
	}

	.filter-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 8px 16px;
		background: rgba(241, 245, 249, .7);
		border-bottom: 1px solid rgba(226, 232, 240, .4);
		font-size: 11px;
		flex-wrap: wrap;
		color: #64748b
	}

	.filter-summary-right {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		font-weight: 600
	}

	.filter-summary-toggle {
		color: #94a3b8;
		font-weight: 700
	}

	.detail-card {
		margin: 0 16px 0;
		overflow: hidden
	}

	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 16px;
		background: #fff
	}

	.detail-header-info {
		flex: 1
	}

	.detail-header-title {
		font-size: 14px;
		font-weight: 800;
		color: #1e293b;
		display: block
	}

	.detail-header-count {
		font-size: 11px;
		font-weight: 400;
		background: #f1f5f9;
		color: #475569;
		padding: 2px 8px;
		border-radius: 999px;
		font-family: monospace;
		margin-left: 6px
	}

	.detail-header-stats {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px 12px;
		margin-top: 8px
	}

	.detail-header-stat {
		font-size: 12px;
		color: #64748b;
		min-width: 0
	}

	.stat-bold {
		font-weight: 700;
		color: #1e293b
	}

	.text-emerald {
		color: #059669
	}

	.detail-arrow {
		font-size: 12px;
		color: #94a3b8;
		font-weight: 600;
		flex-shrink: 0;
		margin-left: 8px
	}

	.fw-bold {
		font-weight: 700
	}

	.fw-extrabold {
		font-weight: 800
	}

	.text-amber {
		color: #d97706
	}

	.loading-hint {
		text-align: center;
		padding: 40px;
		color: #94a3b8;
		font-size: 13px
	}

	.order-list {
		flex: 1;
		padding: 0 16px 12px;
		box-sizing: border-box
	}

	.detail-days {
		background: rgba(248, 250, 252, .65);
		padding: 12px;
		border-radius: 0 0 18px 18px;
		margin: 0 0 0;
		border: 1px solid #e8eef5;
		border-top: none
	}

	.order-list-collapsed {
		padding: 28px 16px;
		text-align: center;
		color: #94a3b8;
		font-size: 12px;
		background: rgba(248, 250, 252, .56)
	}

	.order-list-collapsed-text {
		display: block
	}

	.empty-state {
		padding: 64px 0;
		text-align: center;
		color: #94a3b8
	}

	.empty-icon {
		font-size: 40px;
		display: block;
		margin-bottom: 8px
	}

	.empty-text {
		font-size: 12px;
		font-weight: 600;
		display: block
	}

	.empty-sub {
		font-size: 10px;
		color: #cbd5e1;
		margin-top: 4px;
		display: block
	}

	.order-day-card {
		padding: 14px;
		margin-bottom: 10px;
		position: relative;
		overflow: hidden;
		box-sizing: border-box
	}

	.day-card {
		border-radius: 16px;
		border: 1px solid #e8eef5;
		box-shadow: 0 4px 14px rgba(15, 23, 42, .03)
	}

	.day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px
	}

	.day-title {
		font-size: 14px;
		font-weight: 800;
		color: #1e293b
	}

	.day-unit-price {
		font-size: 11px;
		font-weight: 700;
		color: #64748b
	}

	.day-count {
		font-size: 11px;
		font-weight: 400;
		color: #94a3b8;
		font-family: monospace
	}

	.day-count-daily {
		color: #059669
	}

	.day-count-monthly {
		color: #dc2626
	}

	.order-day-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-bottom: 10px
	}

	.day-header-main {
		flex: 1;
		min-width: 0
	}

	.order-status-area {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		margin-left: 8px
	}

	.order-day-actions {
		gap: 8px
	}

	.order-status {
		font-size: 11px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 12px
	}

	.status-paid {
		background: #ecfdf5;
		color: #047857
	}

	.status-unpaid {
		background: #fef2f2;
		color: #b91c1c
	}

	.order-edit-btn {
		padding: 4px 10px;
		border-radius: 12px;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		font-size: 11px;
		font-weight: 800;
		color: #2563eb
	}

	.day-stats-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-bottom: 8px
	}

	.day-stat {
		padding: 8px 12px;
		background: rgba(236, 253, 245, .3);
		border-radius: 12px;
		border: 1px solid rgba(209, 250, 229, .4);
		display: flex;
		justify-content: space-between;
		align-items: center
	}

	.day-stat-blue {
		background: rgba(239, 246, 255, .6);
		border: 1px solid #dbeafe
	}

	.day-stat-label {
		font-size: 11px;
		font-weight: 600;
		color: #94a3b8
	}

	.day-stat-value {
		font-size: 14px;
		font-weight: 900;
		color: #1e293b;
		font-family: monospace
	}

	.day-stat-value.text-receivable {
		color: #dc2626
	}

	.day-stat-unit {
		font-size: 11px;
		font-weight: 400;
		color: #94a3b8
	}

	.order-notes {
		margin-top: 8px;
		padding: 10px 12px;
		background: #f8fafc;
		border-radius: 14px;
		border: 1px solid #e8eef5;
		font-size: 14px;
		color: #f87171;
		line-height: 1.5
	}

	.order-attachments {
		display: flex;
		gap: 10px;
		margin-top: 8px;
		flex-wrap: wrap
	}

	.attach-btn {
		font-size: 12px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 12px;
		background: rgba(236, 253, 245, .8);
		border: 1px solid #cfeedd;
		color: #059669
	}

	.editor-mask {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, .52);
		z-index: 120;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 20px 20px 24px;
		box-sizing: border-box
	}

	.editor-modal {
		width: 100%;
		max-width: 560px;
		max-height: 100%;
		background: #fff;
		border-radius: 24px;
		padding: 18px 16px 16px;
		border: 1px solid rgba(226, 232, 240, .9);
		box-shadow: 0 24px 60px rgba(15, 23, 42, .24);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-sizing: border-box
	}

	.editor-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		padding-bottom: 12px;
		border-bottom: 1px solid #f1f5f9
	}

	.editor-title {
		display: block;
		font-size: 16px;
		font-weight: 800;
		color: #0f172a
	}

	.editor-subtitle {
		display: block;
		font-size: 10px;
		color: #94a3b8;
		margin-top: 4px
	}

	.editor-close {
		font-size: 11px;
		font-weight: 800;
		color: #059669;
		background: #ecfdf5;
		padding: 7px 12px;
		border-radius: 999px;
		flex-shrink: 0
	}

	.editor-body {
		flex: 1;
		min-height: 0;
		padding-top: 12px
	}

	.editor-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px
	}

	.editor-field {
		min-width: 0
	}

	.editor-field-full {
		grid-column: 1 / -1
	}

	.editor-label {
		display: block;
		font-size: 10px;
		font-weight: 700;
		color: #64748b;
		margin-bottom: 6px
	}

	.editor-input .uni-easyinput__content {
		border: 1px solid #dbe4ee !important;
		border-radius: 14px;
		background: #eee;
		min-height: 40px;
		padding: 0 12px
	}

	.editor-input .uni-easyinput__content-input {
		height: 40px;
		font-size: 13px;
		color: #1e293b;
		background: transparent
	}

	.editor-footer {
		display: flex;
		gap: 10px;
		padding-top: 14px;
		border-top: 1px solid #f1f5f9;
		margin-top: 12px
	}

	.editor-delete-btn {
		flex: 1;
		height: 44px;
		background: #fff1f2;
		border: 1px solid #fecdd3;
		color: #dc2626;
		border-radius: 16px;
		font-size: 14px;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center
	}

	.editor-delete-btn::after {
		border: none
	}

	.editor-save-btn {
		flex: 1;
		height: 44px;
		background: linear-gradient(135deg, #0f766e, #10b981);
		color: #fff;
		border-radius: 16px;
		font-size: 14px;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 10px 20px rgba(16, 185, 129, .16)
	}

	.editor-save-btn::after {
		border: none
	}

	.lightbox {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, .85);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		z-index: 100;
		padding: 24px
	}

	.lightbox-img {
		max-width: 360px;
		border-radius: 16px;
		border: 2px solid rgba(255, 255, 255, .2)
	}

	.lightbox-close {
		margin-top: 16px;
		padding: 8px 20px;
		background: rgba(255, 255, 255, .2);
		color: #fff;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 600
	}
</style>
