<template>
	<view class="home-page">
		<view v-if="!state.currentUser" class="empty-state">
			<text class="empty-text">请先登录</text>
			<button class="empty-btn" @tap="goLogin">前往登录</button>
		</view>

		<view v-else class="home-content">

			<!-- 欢迎卡片 -->
			<view class="welcome-card">
				<view class="welcome-header">
					<view>
						<text class="welcome-greeting">
							你好，{{ state.currentUser.userName }}
							<text class="welcome-badge">{{ state.currentUser.isAdmin ? '系统管理员' : '配送客户' }}</text>
						</text>
					</view>
					<view class="refresh-btn" :class="{ 'refresh-btn-spinning': refreshing }" @tap="handleRefresh">
						<text class="refresh-btn-icon">↻</text>
					</view>
				</view>
				<view class="today-summary" @tap="goToOrderList">
					<view class="summary-item">
						<text class="summary-label">今日发水</text>
						<text class="summary-value">{{ todayStats.quantity }} <text class="summary-unit">桶</text></text>
					</view>
					<view class="summary-item summary-item-border">
						<text class="summary-label">今日回桶</text>
						<text class="summary-value">{{ todayStats.returned }} <text class="summary-unit">个</text></text>
					</view>
					<view class="summary-item summary-item-border">
						<text class="summary-label">应收金额</text>
						<text class="summary-value summary-value-red">¥{{ formatMoney(todayStats.receivable) }}</text>
					</view>
					<view class="summary-item">
						<text class="summary-label">实收金额</text>
						<text class="summary-value summary-value-green">¥{{ formatMoney(todayStats.actualReceived) }}</text>
					</view>
				</view>
			</view>

			<view class="menu-section">
				<text class="menu-section-title">常用功能</text>
				<view class="menu-grid">
					<view v-for="item in menuItems" :key="item.key" class="menu-card" @tap="openMenu(item)">
						<view class="menu-icon" :class="item.iconClass">{{ item.icon }}</view>
						<text class="menu-name">{{ item.name }}</text>
						<view v-if="item.badge" class="menu-badge">{{ item.badge }}</view>
					</view>
				</view>
			</view>

			<button v-if="false" class="batch-order-btn" @tap="navigate('batch-order-add')">批量录入订单</button>

			<view class="safe-bottom"></view>
		</view>

		<view v-if="state.dbNotification" class="toast">
			<text class="toast-icon">✓</text>
			<text>{{ state.dbNotification }}</text>
		</view>
	</view>
</template>

<script setup>
	import {
		ref,
		computed
	} from 'vue'
	import {
		onShow
	} from '@dcloudio/uni-app'
	import {
		useStore
	} from '../../common/store.js'
	import {
		createUserUnitPriceMap,
		formatMoney,
		getOrderReceivableAmount,
		getOrderActualReceivedAmount
	} from '../../common/utils.js'

	const store = useStore()
	const {
		state,
		refreshAll
	} = store

	onShow(() => {
		// #ifdef MP-WEIXIN
		uni.hideHomeButton()
		// #endif
	})

	const today = computed(() => store.formatDate(new Date()))
	const userUnitPriceMap = computed(() => createUserUnitPriceMap(state.users))
	const refreshing = ref(false)

	// 点击刷新：去云端强制同步最新数据（客户 + 订单，并重置工资报销的同步标记）
	const handleRefresh = async () => {
		if (refreshing.value) return
		refreshing.value = true
		try {
			const result = await refreshAll()
			if (!result?.success) {
				uni.showToast({ title: result?.message || '同步失败，请稍后重试', icon: 'none' })
			}
		} finally {
			setTimeout(() => {
				refreshing.value = false
			}, 360)
		}
	}

	const todayStats = computed(() => {
		const filteredOrders = state.orders.filter(o => {
			if (!state.currentUser) return false
			return o.createdDate === today.value &&
				(state.currentUser.isAdmin || o.userName === state.currentUser.userName)
		})
		return {
			quantity: filteredOrders.reduce((s, o) => s + o.quantity, 0),
			returned: filteredOrders.reduce((s, o) => s + o.returnedBuckets, 0),
			receivable: filteredOrders.reduce((s, o) => s + getOrderReceivableAmount(o, userUnitPriceMap.value), 0),
			actualReceived: filteredOrders.reduce((s, o) => s + getOrderActualReceivedAmount(o), 0)
		}
	})

	const menuItems = computed(() => {
		const items = [{
				key: 'order-list',
				icon: '📋',
				name: '日账汇总',
				desc: '每日明细',
				iconClass: 'func-icon-emerald',
				action: 'order-list'
			},
			{
				key: 'monthly-summary',
				icon: '📅',
				name: '月度账单',
				desc: '月度核算',
				iconClass: 'func-icon-teal',
				action: 'monthly-summary'
			},
			{
				key: 'user-monthly-summary',
				icon: '👥',
				name: '按人对账',
				desc: '客户账单',
				iconClass: 'func-icon-indigo',
				action: 'user-monthly-summary'
			},
			{
				key: 'stats',
				icon: '📊',
				name: '数据报表',
				desc: '趋势统计',
				iconClass: 'func-icon-purple',
				action: 'stats'
			}
		]
		if (state.currentUser?.isAdmin) {
			items.push({
				key: 'customer-list',
				icon: '📇',
				name: '客户列表',
				desc: '信息查询',
				iconClass: 'func-icon-blue',
				action: 'customer-list'
			})
		}
		if (state.currentUser?.isAdmin) {
			items.push({
				key: 'misc-records',
				icon: '🗂️',
				name: '工资报销',
				desc: '工资报销',
				iconClass: 'func-icon-amber',
				action: 'misc-records'
			})
		}
		items.push({
			key: 'profile',
			icon: '👤',
			name: '个人中心',
			desc: '账户信息',
			iconClass: 'func-icon-rose',
			action: 'profile'
		})
		return items
	})

	const navigate = (tab) => {
		const pageMap = {
			'order-list': '/pages/order-list/order-list',
			'batch-order-add': '/pages/batch-order-add/batch-order-add',
			'stats': '/pages/stats/stats',
			'customer-list': '/pages/customer-list/customer-list',
			'user-add': '/pages/user-add/user-add',
			'profile': '/pages/profile/profile',
			'monthly-summary': '/pages/monthly-summary/monthly-summary',
			'user-monthly-summary': '/pages/user-monthly-summary/user-monthly-summary',
			'misc-records': '/pages/misc-records/misc-records'
			}
		uni.navigateTo({
			url: pageMap[tab]
		})
	}

	const openMenu = (item) => {
		if (item.action === 'order-list') {
			goToOrderList()
			return
		}
		navigate(item.action)
	}

	const goToOrderList = () => uni.navigateTo({
		url: '/pages/order-list/order-list'
	})
	const goLogin = () => uni.reLaunch({
		url: '/pages/login/login'
	})
</script>

<style lang="scss" scoped>
	.home-page {
		min-height: 100vh;
		background: linear-gradient(180deg, #f8fbfa 0%, #f2f6f9 100%);
		display: flex;
		flex-direction: column;
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px;
	}

	.empty-text {
		font-size: 16px;
		color: #94a3b8;
	}

	.empty-btn {
		margin-top: 16px;
		padding: 12px 32px;
		background: linear-gradient(135deg, #0f766e, #10b981);
		color: #fff;
		border-radius: 14px;
		font-size: 14px;
		font-weight: 800;
		box-shadow: 0 10px 20px rgba(16, 185, 129, .16);
	}

	.home-content {
		flex: 1;
		padding: 16px;
		box-sizing: border-box;
	}

	/* 欢迎卡片 */
	.welcome-card {
		background: linear-gradient(135deg, #109579, #14b8a6);
		border-radius: 18px;
		padding: 18px;
		color: #fff;
		box-shadow: 0 14px 28px rgba(16, 185, 129, 0.16);
	}

	.welcome-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.welcome-greeting {
		font-size: 14px;
		font-weight: 700;
	}

	.welcome-badge {
		font-size: 10px;
		background: rgba(255, 255, 255, 0.2);
		padding: 2px 8px;
		border-radius: 999px;
		margin-left: 6px;
	}

	.refresh-btn {
		width: 32px;
		height: 32px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.16);
		border: 1px solid rgba(255, 255, 255, 0.18);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.refresh-btn-icon {
		font-size: 16px;
		font-weight: 700;
		color: #fff;
		line-height: 1;
	}

	.refresh-btn-spinning {
		animation: home-refresh-spin .36s linear;
	}

	@keyframes home-refresh-spin {
		from {
			transform: rotate(0deg);
		}

		to {
			transform: rotate(360deg);
		}
	}

	.today-summary {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin-top: 16px;
		padding-top: 12px;
		border-top: 1px solid rgba(255, 255, 255, 0.2);
		text-align: center;
	}

	.summary-item {
		display: flex;
		flex-direction: column;
	}

	.summary-item-border {
		border-left: 1px solid rgba(255, 255, 255, 0.1);
		border-right: 1px solid rgba(255, 255, 255, 0.1);
	}

	.summary-label {
		font-size: 9px;
		color: rgba(255, 255, 255, 0.7);
	}

	.summary-value {
		font-size: 14px;
		font-weight: 900;
		font-family: monospace;
	}

	.summary-value-red {
		color: #fecaca;
	}

	.summary-value-green {
		color: #bbf7d0;
	}

	.summary-unit {
		font-size: 9px;
		font-weight: 400;
	}

	/* 首页宫格 */
	.menu-section {
		margin-top: 16px;
		flex: 1
	}

	.batch-order-btn {
		position: fixed;
		left: 12px;
		right: 12px;
		bottom: 40px;
		height: 50px;
		border-radius: 14px;
		background: linear-gradient(135deg, #0f766e, #10b981);
		color: #fff;
		font-size: 14px;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 10px 20px rgba(16, 185, 129, .16);
		z-index: 20;
	}

	.menu-section-title {
		font-size: 9px;
		font-weight: 800;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 10px;
		display: block;
		padding-left: 4px;
	}

	.menu-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		width: 100%;
	}

	.menu-card {
		background: #fff;
		border: 1px solid #e8eef5;
		border-radius: 18px;
		min-height: 84px;
		padding: 10px 6px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		position: relative;
		box-shadow: 0 8px 22px rgba(15, 23, 42, .04);
		min-width: 0;
		box-sizing: border-box;
	}

	.menu-card:active {
		background: #f8fafc;
	}

	.menu-icon {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 20px;
		flex-shrink: 0;
	}

	.func-icon-emerald {
		background: #ecfdf5;
	}

	.func-icon-teal {
		background: #f0fdfa;
	}

	.func-icon-indigo {
		background: #eef2ff;
	}

	.func-icon-purple {
		background: #faf5ff;
	}

	.func-icon-blue {
		background: #eff6ff;
	}

	.func-icon-sky {
		background: #f0f9ff;
	}

	.func-icon-amber {
		background: #fffbeb;
	}

	.func-icon-rose {
		background: #fff1f2;
	}

	.menu-name {
		display: block;
		margin-top: 6px;
		font-size: 12px;
		font-weight: 700;
		color: #0f172a;
		line-height: 1.2;
		width: 100%;
	}

	.menu-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		min-width: 16px;
		height: 16px;
		background: #ef4444;
		color: #fff;
		font-size: 9px;
		font-weight: 900;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 4px;
	}

	.safe-bottom {
		height: 114px;
	}

	.toast {
		position: fixed;
		bottom: 32px;
		left: 50%;
		transform: translateX(-50%);
		background: #1e293b;
		color: #fff;
		padding: 10px 16px;
		border-radius: 12px;
		font-size: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		z-index: 999;
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
	}

	.toast-icon {
		background: #10b981;
		border-radius: 50%;
		width: 16px;
		height: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
	}
</style>
