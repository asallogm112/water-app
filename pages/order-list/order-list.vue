<template>
	<view class="page-container order-list-page">
		<view class="toolbar-wrap">
			<view class="toolbar-card">
				<view class="toolbar-label-group">
					<text class="toolbar-label">筛选条件</text>
				</view>
				<view class="filter-toggle"
					:class="{ 'filter-active': showAdvancedFilters || settlementFilter !== 'all' || paymentFilter !== 'all' }"
					@tap="showAdvancedFilters = !showAdvancedFilters">
					<text class="filter-toggle-icon">☰</text>
					<text class="filter-toggle-text">筛选</text>
				</view>
			</view>
		</view>

		<view v-if="showAdvancedFilters" class="filter-overlay" @tap="showAdvancedFilters = false">
			<view class="filter-panel" @tap.stop>
				<view class="filter-header">
					<view>
						<text class="filter-header-title">订单筛选</text>
						<text class="filter-header-subtitle">选择需要查看的账单范围</text>
					</view>
					<text class="filter-header-close" @tap="showAdvancedFilters = false">完成</text>
				</view>
				<view class="filter-section">
					<text class="filter-section-label">结算方式</text>
					<view class="filter-btn-group">
						<view v-for="t in settleTypes" :key="t.value" class="filter-btn"
							:class="{ 'filter-btn-active': settlementFilter === t.value }"
							@tap="settlementFilter = t.value"><text>{{ t.label }}</text></view>
					</view>
				</view>
				<view class="filter-section">
					<text class="filter-section-label">付款状态</text>
					<view class="filter-btn-group filter-btn-group-4">
						<view v-for="s in paymentTypes" :key="s.value" class="filter-btn"
							:class="{ 'filter-btn-active-dark': paymentFilter === s.value }"
							@tap="paymentFilter = s.value"><text>{{ s.label }}</text></view>
					</view>
				</view>
				<view class="filter-reset" @tap="resetFilters"><text>重置所有筛选器</text></view>
			</view>
		</view>

		<!-- 日期选择 -->
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

		<view v-if="showDatePicker" class="filter-overlay" @tap="showDatePicker = false">
			<view class="date-panel" @tap.stop>
				<view class="filter-header">
					<view>
						<text class="filter-header-title">账单日期</text>
						<text class="filter-header-subtitle">今天会排在最前面</text>
					</view>
					<text class="filter-header-close" @tap="showDatePicker = false">关闭</text>
				</view>
				<scroll-view class="date-list" scroll-y>
					<view v-for="date in availableDates" :key="date" class="date-item"
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
					class="fin-value fin-value-red">¥{{ dailySettleSum }}</text></view>
			<view class="fin-item"><view class="fin-label">月结总金额</view><text
					class="fin-value fin-value-red">¥{{ monthlySettleSum }}</text></view>
			<view class="fin-item"><view class="fin-label">应收总金额</view><text
					class="fin-value fin-value-red">¥{{ totalAmountSum }}</text></view>
			<view class="fin-item fin-item-green"><view class="fin-label fin-label-green">实收总金额</view><text
					class="fin-value fin-value-green">¥{{ totalActualSum }}</text></view>
		</view>

		<!-- 筛选摘要 -->
		<view class="filter-summary">
			<text>筛选出 <text class="fw-bold">{{ filteredOrders.length }}</text> 笔订单</text>
			<view class="filter-summary-right">
				<text>发水: <text class="fw-bold text-amber">{{ totalDeliveredSum }}</text> 桶</text>
				<text>回桶: <text class="fw-bold">{{ totalReturnedSum }}</text> 个</text>
			</view>
		</view>

		<view class="card detail-card">
			<view class="detail-header" @tap="listExpanded = !listExpanded">
				<view class="detail-header-info">
					<text class="detail-header-title">
						{{ selectedDate }} 订单明细
						<text class="detail-header-count">{{ filteredOrders.length }} 笔订单</text>
					</text>
					<view class="detail-header-stats">
						<text class="detail-header-stat">发水: <text class="stat-bold">{{ totalDeliveredSum }}</text> 桶</text>
						<text class="detail-header-stat">回桶: <text class="stat-bold">{{ totalReturnedSum }}</text> 个</text>
						<text class="detail-header-stat">应收款: <text class="stat-bold text-receivable">¥{{ totalAmountSum }}</text></text>
						<text class="detail-header-stat">已付款: <text class="stat-bold text-emerald">¥{{ totalActualSum }}</text></text>
					</view>
				</view>
				<text class="detail-arrow">{{ listExpanded ? '折叠' : '展开' }} {{ listExpanded ? '▲' : '▼' }}</text>
			</view>
		</view>

		<!-- 加载中 -->
		<view v-if="state.loading" class="loading-hint"><text>⏳ 加载中…</text></view>

		<!-- 订单列表 -->
		<scroll-view v-else-if="listExpanded" class="order-list" scroll-y>
			<view v-if="filteredOrders.length === 0" class="empty-state">
				<text class="empty-icon">📦</text>
				<text class="empty-text">该筛选项下暂无配送订单</text>
				<text class="empty-sub">请切换日期或前往「批量录入」新增订单</text>
			</view>

			<view v-else class="detail-days">
			<view v-for="order in filteredOrders" :key="order._id" class="card day-card order-day-card">
				<view class="day-header order-day-header">
					<view class="day-header-main">
						<text class="day-title">● {{ order.userName }} <text class="day-count">({{ order.settlementType === 'monthly' ? '月结' : '日结' }})</text></text>
					</view>
					<view class="order-status-area order-day-actions">
						<text class="order-status"
							:class="isPaid(order) ? 'status-paid' : 'status-unpaid'">{{ paymentLabel(order) }}</text>
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
						<text class="day-stat-value text-receivable">¥{{ getReceivableAmount(order) }}</text>
					</view>
					<view class="day-stat day-stat-blue">
						<text class="day-stat-label">当日已付</text>
						<text class="day-stat-value text-emerald">¥{{ getActualPaidAmount(order) }}</text>
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

		<!-- 图片预览 -->
		<view v-if="previewUrl" class="lightbox" @tap="previewUrl = null">
			<image :src="previewUrl" mode="widthFix" class="lightbox-img" />
			<text class="lightbox-close">关闭预览</text>
		</view>
	</view>
</template>

<script setup>
	import {
		ref,
		computed
	} from 'vue'
	import {
		onLoad
	} from '@dcloudio/uni-app'
	import {
		useStore
	} from '../../common/store.js'
	import {
		createUserUnitPriceMap,
		getOrderReceivableAmount,
		getOrderActualReceivedAmount
	} from '../../common/utils.js'

	const store = useStore()
	const {
		state,
		getOrderMedia,
		formatDate
	} = store

	const today = computed(() => formatDate(new Date()))
	const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))
	const selectedDate = ref(today.value)
	const showDatePicker = ref(false)

	// 从 URL 接收 date 参数（月度汇总页面跳转时传入）
	onLoad((options) => {
		if (options && options.date) {
			selectedDate.value = options.date
		}
	})
	const settlementFilter = ref('all')
	const paymentFilter = ref('all')
	const showAdvancedFilters = ref(false)
	const listExpanded = ref(false)
	const previewUrl = ref(null)
	const attachmentLoading = ref(false)

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

	const isPaid = (order) => getOrderActualReceivedAmount(order) > 0
	const getActualPaidAmount = (order) => getOrderActualReceivedAmount(order)
	const getReceivableAmount = (order) => getOrderReceivableAmount(order, userUnitPriceMap.value)
	const paymentLabel = (order) => isPaid(order) ? '已付款' : '未付款'

	const availableDates = computed(() => {
		const dates = [...new Set(state.orders.map(o => o.createdDate).filter(Boolean))]
		return dates.sort((a, b) => {
			if (a === today.value) return -1
			if (b === today.value) return 1
			return b.localeCompare(a)
		})
	})
	const selectDate = (date) => {
		selectedDate.value = date
		showDatePicker.value = false
	}

	const parseLocalDate = (value) => {
		const parts = String(value || '').split('-').map(Number)
		if (parts.length !== 3 || parts.some(num => !Number.isFinite(num))) return null
		return new Date(parts[0], parts[1] - 1, parts[2])
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
	}

	const roleFilteredOrders = computed(() =>
		state.orders.filter(o => state.currentUser?.isAdmin || o.userName === state.currentUser?.name)
	)

	const filteredOrders = computed(() => roleFilteredOrders.value
		.filter(o => {
			return (selectedDate.value ? o.createdDate === selectedDate.value : true) &&
				(settlementFilter.value === 'all' || o.settlementType === settlementFilter.value) &&
				(paymentFilter.value === 'all' || (paymentFilter.value === 'paid' ? isPaid(o) : !isPaid(o)))
		})
		.sort((a, b) => {
			const paidDiff = Number(isPaid(b)) - Number(isPaid(a))
			if (paidDiff !== 0) return paidDiff
			return String(a.userName || '').localeCompare(String(b.userName || ''), 'zh-Hans-CN')
		}))

	const dailySettleSum = computed(() => filteredOrders.value.filter(o => o.settlementType === 'daily').reduce((s, o) =>
		s + getReceivableAmount(o), 0))
	const monthlySettleSum = computed(() => filteredOrders.value.filter(o => o.settlementType === 'monthly').reduce((s,
		o) => s + getReceivableAmount(o), 0))
	const totalAmountSum = computed(() => filteredOrders.value.reduce((s, o) => s + getReceivableAmount(o), 0))
	const totalActualSum = computed(() => filteredOrders.value.reduce((s, o) => s + getActualPaidAmount(o), 0))
	const totalDeliveredSum = computed(() => filteredOrders.value.reduce((s, o) => s + o.quantity, 0))
	const totalReturnedSum = computed(() => filteredOrders.value.reduce((s, o) => s + o.returnedBuckets, 0))

	const resetFilters = () => {
		settlementFilter.value = 'all';
		paymentFilter.value = 'all'
	}
	const previewImage = (url) => {
		previewUrl.value = url
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
		align-items: center;
		justify-content: space-between;
		box-shadow: 0 10px 24px rgba(15, 23, 42, .04)
	}

	.toolbar-label-group {
		min-width: 0;
		padding-right: 12px
	}

	.toolbar-label {
		display: block;
		font-size: 12px;
		font-weight: 800;
		color: #1e293b
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
		align-items: center;
		justify-content: center;
		padding: 20px
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
		padding: 12px 16px 10px;
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
		padding: 8px 16px;
		background: rgba(241, 245, 249, .7);
		border-bottom: 1px solid rgba(226, 232, 240, .4);
		font-size: 11px;
		color: #64748b
	}

	.filter-summary-right {
		display: flex;
		gap: 12px;
		font-weight: 600
	}

	.detail-card {
		margin: 0 12px 0;
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
		padding: 0 12px 12px;
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

	.day-count {
		font-size: 11px;
		font-weight: 400;
		color: #94a3b8;
		font-family: monospace
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
		font-size: 12px;
		color: #64748b;
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
