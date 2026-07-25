<template>
	<view class="page-container batch-page">
		<view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
			<view class="nav-content">
				<view class="nav-left"><text class="nav-back" @tap="goBack">‹返回</text></view>
				<text class="nav-title">智能批量录入</text>
			</view>
		</view>

		<scroll-view class="batch-content" scroll-y>
			<view class="batch-inner">
				<view v-if="success" class="success-banner">
					<text class="success-icon">✓</text>
					<view><text class="success-title">批量单录入成功！</text><text class="success-sub">已生成 {{ items.length }}
							笔订单，正在跳转…</text></view>
				</view>
				<view v-if="error" class="error-banner"><text>⚠️ {{ error }}</text></view>

				<!-- 文本解析 -->
				<view class="card parse-card">
					<text class="parse-label">✨ 批量账单与日期文本解析 <text class="parse-label-hint">自动识别日期</text></text>
					<textarea class="parse-textarea" :rows="5" v-model="inputText"
						placeholder="每行一笔：客户名 送水数 回桶数；如：张三 10 5" placeholder-class="input-placeholder" />
					<view class="parse-btns">
						<button class="parse-btn" @tap="handleParse">✨ 开始智能解析</button>
						<button class="parse-clear" @tap="inputText = ''">清空</button>
					</view>
				</view>

				<!-- 订单清单 -->
				<view class="card items-card">
					<view class="items-header">
						<text class="items-title">📋 已解析订单清单 ({{ items.length }}笔)</text>
						<text class="items-add" @tap="handleAddRow">+ 手动添加行</text>
					</view>
					<view v-if="items.length === 0" class="items-empty"><text>暂无已解析的订单行，请在上方输入并点击"开始智能解析"</text></view>

					<view v-else class="items-list">
						<view v-for="(item, index) in items" :key="item.id" class="item-row">
							<view class="item-delete" @tap="handleDeleteRow(item.id)">✕</view>
							<view class="item-header">
								<view class="item-index">{{ index + 1 }}</view>
								<uni-easyinput class="item-name-input" type="text" :value="item.name"
									@input="v => updateItemField(item.id, 'name', v)" placeholder="客户名称"
									:inputBorder="false" />
								<text class="item-match-tag"
									:class="item.matchedUserId ? 'match-yes' : 'match-no'">{{ item.matchedUserId ? '匹配客户' : '散客' }}</text>
								<text v-if="getItemDuplicateFlag(item.id, 'duplicateInDatabase')"
									class="item-match-tag duplicate-db">库中重复</text>
								<text v-else-if="getItemDuplicateFlag(item.id, 'duplicateInBatch')"
									class="item-match-tag duplicate-batch">本批重复</text>
								<view class="item-date">
									<text>📅</text>
									<uni-easyinput class="item-date-input" type="text" :value="item.customDate"
										@input="v => updateItemField(item.id, 'customDate', v)" :inputBorder="false" />
								</view>
							</view>
							<view class="item-grid">
								<view class="item-grid-cell"><text class="item-grid-label">送水</text><uni-easyinput
										class="item-grid-easy" type="number" :value="String(item.quantity)"
										@input="v => updateItemField(item.id, 'quantity', parseInt(v) || 0)"
										:inputBorder="false" /></view>
								<view class="item-grid-cell"><text class="item-grid-label">回桶</text><uni-easyinput
										class="item-grid-easy" type="number" :value="String(item.returnedBuckets)"
										@input="v => updateItemField(item.id, 'returnedBuckets', parseInt(v) || 0)"
										:inputBorder="false" /></view>
								<view class="item-grid-cell"><text class="item-grid-label">单价(元)</text><uni-easyinput
										class="item-grid-easy" type="digit" :value="String(item.unitPrice)"
										@input="v => updateItemField(item.id, 'unitPrice', parseFloat(v) || 0)"
										:inputBorder="false" /></view>
								<view class="item-grid-cell"><text class="item-grid-label">实收金额</text><uni-easyinput
										class="item-grid-easy" type="digit" :value="String(item.actualAmountReceived)"
										@input="v => updateItemField(item.id, 'actualAmountReceived', parseFloat(v) || 0)"
										:inputBorder="false" /></view>
							</view>
							<view class="item-footer">
								<text class="item-total">应收小计: <text
										class="text-emerald">¥{{ item.totalAmount }}</text></text>
								<text class="item-date-display">日期: {{ item.customDate }}</text>
							</view>
						</view>
					</view>
				</view>

				<button class="btn-submit-batch" :class="{ 'btn-disabled': items.length === 0 }"
					:disabled="items.length === 0" @tap="handleSubmitBatch">
					✓ 确认提交这 {{ items.length }} 笔订单
				</button>
				<view class="safe-bottom"></view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
	import {
		computed,
		ref
	} from 'vue'
	import {
		useStore
	} from '../../common/store.js'
	import {
		parseDateFromText,
		isPotentialName
	} from '../../common/utils.js'

	const store = useStore()
	const {
		state,
		addOrders
	} = store

	const statusBarHeight = ref(20)
	uni.getSystemInfo({
		success: (res) => {
			statusBarHeight.value = res.statusBarHeight || 20
		}
	})

	const inputText = ref('')
	const items = ref([])
	const error = ref('')
	const success = ref(false)

	const buildDuplicateKey = (date, name, quantity, returnedBuckets) => [date || '', (name || '').trim().toLowerCase(),
		Number(quantity) || 0, Number(returnedBuckets) || 0
	].join('|')

	const existingOrderKeySet = computed(() => new Set(
		state.orders.map(order => buildDuplicateKey(order.createdDate, order.userName, order.quantity, order
			.returnedBuckets))
	))

	const itemDuplicateInfo = computed(() => {
		const countMap = new Map()
		items.value.forEach(item => {
			const key = buildDuplicateKey(item.customDate, item.name, item.quantity, item.returnedBuckets)
			countMap.set(key, (countMap.get(key) || 0) + 1)
		})

		return items.value.reduce((acc, item) => {
			const key = buildDuplicateKey(item.customDate, item.name, item.quantity, item.returnedBuckets)
			acc[item.id] = {
				duplicateInBatch: (countMap.get(key) || 0) > 1,
				duplicateInDatabase: existingOrderKeySet.value.has(key)
			}
			return acc
		}, {})
	})

	const getItemDuplicateFlag = (itemId, field) => {
		const info = itemDuplicateInfo.value[itemId]
		return info ? !!info[field] : false
	}

	const showDuplicateAlert = (duplicateOrders = []) => {
		const preview = duplicateOrders.slice(0, 5).map(item =>
			`${item.createdDate} ${item.userName} 送${item.quantity} 回${item.returnedBuckets}`).join('\n')
		const extra = duplicateOrders.length > 5 ? `\n等 ${duplicateOrders.length} 条重复记录` : ''
		uni.showModal({
			title: '发现重复订单',
			content: `${preview}${extra}\n请检查后再提交。`,
			showCancel: false,
			confirmText: '知道了'
		})
	}

	const handleParse = (showError = true) => {
		error.value = ''
		if (!inputText.value.trim()) {
			if (showError) error.value = '请输入需要解析的文本内容';
			return
		}

		const systemUserNames = state.users.map(u => u.name && u.name.trim()).filter(Boolean)
		const lines = inputText.value.split('\n')
		const parsedItems = []
		let activeDate = store.formatDate(new Date())

		const parseChunk = (name, tokens, lineIdx, customDate) => {
			let quantity = 0,
				returnedBuckets = 0,
				actualAmountReceived = 0,
				hasExplicitAmount = false
			const numberMatches = []
			tokens.forEach((t, i) => {
				const m = t.match(/\d+(\.\d+)?/);
				if (m) numberMatches.push({
					num: parseFloat(m[0]),
					token: t,
					index: i
				})
			})
			const classified = new Set()

			numberMatches.forEach((m, idx) => {
				const t = m.token.toLowerCase()
				if (t.includes('元') || t.includes('￥') || t.includes('付') || t.includes('款') || t.includes(
						'扫码') || t.includes('收')) {
					actualAmountReceived = m.num;
					hasExplicitAmount = true;
					classified.add(idx)
				}
			})
			numberMatches.forEach((m, idx) => {
				if (classified.has(idx)) return;
				const t = m.token.toLowerCase();
				if (t.includes('回') || t.includes('桶') || t.includes('退')) {
					returnedBuckets = m.num;
					classified.add(idx)
				}
			})
			numberMatches.forEach((m, idx) => {
				if (classified.has(idx)) return;
				const t = m.token.toLowerCase();
				if (t.includes('送') || t.includes('水') || t.includes('购') || t.includes('买') || t.includes(
						'配')) {
					quantity = m.num;
					classified.add(idx)
				}
			})
			numberMatches.forEach((m, idx) => {
				if (classified.has(idx)) return;
				if (quantity === 0) quantity = m.num;
				else if (returnedBuckets === 0) returnedBuckets = m.num;
				else if (!hasExplicitAmount) {
					actualAmountReceived = m.num;
					hasExplicitAmount = true
				}
			})

			const matchedUser = state.users.find(u => !u.isAdmin && (u.name && u.name.toLowerCase().includes(name
				.toLowerCase()) || name.toLowerCase().includes((u.name || '').split(' ')[0]
				?.toLowerCase())))
			let finalUnitPrice = matchedUser ? matchedUser.unitPrice : 0
			let settlementType = matchedUser ? matchedUser.settlementType : 'daily'

			// Bug修复: 未指定实收金额时默认等于应收金额（而不是0）
			if (!hasExplicitAmount) actualAmountReceived = Number((quantity * finalUnitPrice).toFixed(2))

			return {
				id: `parsed-${Date.now()}-${lineIdx}-${Math.random().toString(36).substr(2,4)}`,
				name,
				matchedUserId: matchedUser?._id,
				quantity,
				returnedBuckets,
				unitPrice: finalUnitPrice,
				totalAmount: Number((quantity * finalUnitPrice).toFixed(2)),
				actualAmountReceived,
				settlementType,
				customDate,
				notes: ''
			}
		}

		lines.forEach((line, lineIdx) => {
			const trimmedLine = line.trim();
			if (!trimmedLine) return
			const pureDate = parseDateFromText(trimmedLine.replace(/^日期[:：\s]*/, ''))
			if (pureDate && trimmedLine.replace(/(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)|(\d{1,2}[-/.月]\d{1,2}日?)/,
					'').trim() === '') {
				activeDate = pureDate;
				return
			}
			let lineDate = activeDate
			const inlineDate = parseDateFromText(trimmedLine);
			let textToParse = trimmedLine
			if (inlineDate) {
				lineDate = inlineDate;
				activeDate = inlineDate;
				textToParse = trimmedLine.replace(
					/(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?)|(\d{1,2}[-/.月]\d{1,2}日?)/, ' ').trim()
			}
			if (!textToParse) return
			const spaceCleanedLine = textToParse.replace(/([\(\)（）:,，;；：])/g, ' $1 ').replace(/\s+/g, ' ')
				.trim()
			const tokens = spaceCleanedLine.split(/\s+/).filter(t => t.length > 0)
			let currentChunk = null
			tokens.forEach(token => {
				if (isPotentialName(token, systemUserNames)) {
					if (currentChunk) parsedItems.push(parseChunk(currentChunk.name, currentChunk
						.tokens, lineIdx, lineDate));
					currentChunk = {
						name: token.replace(/[\(\)（）:,，：]/g, ''),
						tokens: []
					}
				} else {
					if (currentChunk) currentChunk.tokens.push(token);
					else currentChunk = {
						name: token.replace(/[\(\)（）:,，：]/g, ''),
						tokens: []
					}
				}
			})
			if (currentChunk) parsedItems.push(parseChunk(currentChunk.name, currentChunk.tokens, lineIdx,
				lineDate))
		})

		if (parsedItems.length === 0) {
			items.value = []
			if (showError) error.value = '未能成功解析任何订单，请检查输入格式'
		} else items.value = parsedItems
	}

	const updateItemField = (id, field, value) => {
		items.value = items.value.map(item => {
			if (item.id !== id) return item
			const updated = {
				...item,
				[field]: value
			}
			if (field === 'quantity' || field === 'unitPrice') updated.totalAmount = Number(((field ===
				'quantity' ? value : updated.quantity) * (field === 'unitPrice' ? value : updated
				.unitPrice)).toFixed(2))
			if (field === 'name') {
				const matchedUser = state.users.find(u => !u.isAdmin && (u.name && u.name.trim()
				.toLowerCase() === value.trim().toLowerCase() || (u.name || '').toLowerCase().includes(
						value.toLowerCase())))
				if (matchedUser) {
					updated.matchedUserId = matchedUser._id;
					updated.unitPrice = matchedUser.unitPrice;
					updated.settlementType = matchedUser.settlementType;
					updated.totalAmount = Number((updated.quantity * matchedUser.unitPrice).toFixed(2))
				}
			}
			return updated
		})
	}

	const handleAddRow = () => items.value.push({
		id: `manual-${Date.now()}`,
		name: '',
		quantity: 0,
		returnedBuckets: 0,
		unitPrice: 0,
		totalAmount: 0,
		actualAmountReceived: 0,
		settlementType: 'daily',
		customDate: store.formatDate(new Date()),
		notes: ''
	})
	const handleDeleteRow = (id) => {
		items.value = items.value.filter(item => item.id !== id)
	}

	const handleSubmitBatch = async () => {
		error.value = ''
		if (items.value.length === 0) {
			error.value = '当前没有可提交的订单';
			return
		}
		if (items.value.some(i => !i.name.trim())) {
			error.value = '所有订单均必须填写客户姓名';
			return
		}

		const duplicateOrders = []
		const seenKeys = new Set()
		const now = new Date()
		const finalOrders = items.value.map((item, index) => {
			const targetUser = state.users.find(u => !u.isAdmin && (u.name && u.name.trim()
			.toLowerCase() === item.name.trim().toLowerCase() || u._id === item.matchedUserId))
			const itemTime = new Date(now.getTime() - index * 1000)
			const itemDateStr = item.customDate || store.formatDate(now)
			const order = {
				createdAt: `${itemDateStr} ${store.formatDateTime(itemTime).split(' ')[1]}`,
				createdDate: itemDateStr,
				userName: targetUser ? targetUser.name : item.name.trim(),
				quantity: Number(item.quantity),
				returnedBuckets: Number(item.returnedBuckets),
				operator: state.currentUser?.name || '',
				unitPrice: Number(item.unitPrice),
				totalAmount: Number(item.totalAmount),
				actualAmountReceived: Number(item.actualAmountReceived),
				logs: [],
				settlementType: item.settlementType,
				auditStatus: state.currentUser?.isAdmin ? 'approved' : 'pending',
				notes: item.notes.trim()
			}
			const duplicateKey = buildDuplicateKey(order.createdDate, order.userName, order.quantity, order
				.returnedBuckets)
			if (seenKeys.has(duplicateKey) || existingOrderKeySet.value.has(duplicateKey)) {
				duplicateOrders.push(order)
			}
			seenKeys.add(duplicateKey)
			return order
		})

		if (duplicateOrders.length > 0) {
			error.value = '检测到重复订单，请处理后再提交'
			showDuplicateAlert(duplicateOrders)
			return
		}

		const result = await addOrders(finalOrders)
		if (!result?.success) {
			error.value = result?.message || '批量保存失败，请稍后重试'
			return
		}
		success.value = true
		setTimeout(() => {
			success.value = false;
			goBack()
		}, 1500)
	}

	const goBack = () => uni.navigateBack()
</script>

<style lang="scss" scoped>
	.batch-page {
		min-height: 100vh;
		background: #f7f8fa;
		display: flex;
		flex-direction: column
	}

	.nav-bar {
		background: #fff;
		border-bottom: 1px solid #f1f5f9
	}

	.nav-content {
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px
	}

	.nav-left {
		width: 64px
	}

	.nav-title {
		font-size: 14px;
		font-weight: 600;
		color: #1e293b
	}

	.nav-back {
		font-size: 14px;
		font-weight: 600;
		color: #475569
	}

	.batch-content {
		flex: 1
	}

	.batch-inner {
		padding: 16px
	}

	.success-banner {
		padding: 16px;
		background: #ecfdf5;
		border: 1px solid #d1fae5;
		border-radius: 12px;
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 12px;
		color: #065f46;
		margin-bottom: 16px
	}

	.success-icon {
		width: 24px;
		height: 24px;
		background: #10b981;
		color: #fff;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		flex-shrink: 0
	}

	.success-title {
		font-weight: 700;
		display: block
	}

	.success-sub {
		font-size: 10px;
		color: #059669;
		margin-top: 2px;
		display: block
	}

	.error-banner {
		padding: 12px;
		background: #fef2f2;
		border: 1px solid #fee2e2;
		border-radius: 12px;
		font-size: 12px;
		color: #dc2626;
		margin-bottom: 16px
	}

	.card {
		background: #fff;
		border-radius: 16px;
		border: 1px solid #f1f5f9;
		box-shadow: 0 1px 2px rgba(0, 0, 0, .03)
	}

	.parse-card {
		padding: 16px;
		margin-bottom: 16px
	}

	.parse-label {
		font-size: 11px;
		font-weight: 700;
		color: #64748b;
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px
	}

	.parse-label-hint {
		font-size: 9px;
		font-weight: 600;
		color: #6366f1;
		background: #eef2ff;
		padding: 2px 6px;
		border-radius: 4px
	}

	.parse-textarea {
		width: 100%;
		padding: 12px;
		background: rgba(248, 250, 252, .5);
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		font-size: 12px;
		font-family: monospace;
		color: #334155
	}

	.input-placeholder {
		color: #cbd5e1
	}

	.parse-btns {
		display: flex;
		gap: 8px;
		margin-top: 12px
	}

	.parse-btn {
		flex: 1;
		padding: 10px;
		background: #4f46e5;
		color: #fff;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 700
	}

	.parse-clear {
		padding: 10px 16px;
		background: #f1f5f9;
		color: #475569;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 700
	}

	.items-card {
		padding: 16px;
		margin-bottom: 16px
	}

	.items-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 12px;
		border-bottom: 1px solid #f1f5f9
	}

	.items-title {
		font-size: 12px;
		font-weight: 700;
		color: #1e293b
	}

	.items-add {
		font-size: 10px;
		color: #059669;
		font-weight: 700
	}

	.items-empty {
		padding: 32px 0;
		text-align: center;
		font-size: 12px;
		color: #94a3b8
	}

	.items-list {
		max-height: 350px;
		overflow-y: auto
	}

	.item-row {
		padding: 12px;
		background: rgba(248, 250, 252, .5);
		border: 1px solid #e8ecf0;
		border-radius: 12px;
		margin-bottom: 12px;
		position: relative
	}

	.item-delete {
		position: absolute;
		right: 8px;
		top: 8px;
		padding: 6px;
		color: #cbd5e1;
		font-size: 13px;
		z-index: 2
	}

	.item-delete:active {
		color: #ef4444
	}

	.item-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding-right: 30px;
		margin-bottom: 10px
	}

	.item-index {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #e2e8f0;
		font-size: 10px;
		font-weight: 700;
		color: #475569;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0
	}

	.item-name-input {
		width: 80px;
		padding: 4px 8px;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
		color: #1e293b
	}

	.item-match-tag {
		font-size: 8px;
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 800
	}

	.match-yes {
		background: #ecfdf5;
		color: #059669;
		border: 1px solid #d1fae5
	}

	.match-no {
		background: #fffbeb;
		color: #d97706;
		border: 1px solid #fef3c7
	}

	.duplicate-db {
		background: #fef2f2;
		color: #dc2626;
		border: 1px solid #fecaca
	}

	.duplicate-batch {
		background: #fff7ed;
		color: #ea580c;
		border: 1px solid #fdba74
	}

	.item-date {
		display: flex;
		align-items: center;
		gap: 4px;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 2px 8px;
		font-size: 11px;
		margin-left: auto
	}

	.item-date-input {
		width: 80px;
		font-size: 10px;
		font-weight: 700;
		color: #334155;
		background: transparent
	}

	.item-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 8px
	}

	.item-grid-label {
		font-size: 9px;
		color: #94a3b8;
		display: block;
		margin-bottom: 2px
	}

	.item-grid-input {
		width: 100%;
		padding: 4px 6px;
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 700;
		font-family: monospace;
		color: #1e293b;
		box-sizing: border-box
	}

	.item-footer {
		display: flex;
		justify-content: space-between;
		margin-top: 8px;
		padding: 6px 8px;
		background: rgba(241, 245, 249, .6);
		border-radius: 8px;
		font-size: 10px
	}

	.item-total {
		color: #64748b
	}

	.text-emerald {
		color: #059669;
		font-weight: 700
	}

	.item-date-display {
		color: #94a3b8
	}

	.btn-submit-batch {
		width: 100%;
		padding: 12px;
		background: #059669;
		color: #fff;
		border-radius: 16px;
		font-size: 12px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px
	}

	.btn-disabled {
		opacity: .5
	}

	.safe-bottom {
		height: 32px
	}
</style>
