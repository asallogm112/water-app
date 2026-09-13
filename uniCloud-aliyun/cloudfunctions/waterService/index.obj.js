const CUSTOMER_COLLECTION = 'user_list'
const ORDER_COLLECTION = 'order_list'
const ADMIN_COLLECTION = 'admin_list'
const ORDER_MERGE_COLLECTION = 'order_merge_status'
const MISC_RECORD_COLLECTION = 'misc_record_list'
const DB_PAGE_SIZE = 500

function normalizeText(value) {
	return typeof value === 'string' ? value.trim() : ''
}

function formatDateTime(date = new Date()) {
	const pad = (n) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function getCustomerUserName(user) {
	return normalizeText(user && (user.userName || user.username || user.name))
}

function getOrderUserName(order) {
	return normalizeText(order && (order.userName || order.username))
}

function normalizeOrderDate(value) {
	const text = normalizeText(value)
	if (!text) return ''
	const match = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/)
	if (match) {
		const [, year, month, day] = match
		return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
	}
	const shortMatch = text.match(/^(\d{4}-\d{2}-\d{2})/)
	return shortMatch ? shortMatch[1] : text.slice(0, 10)
}

function getOrderCreatedDate(order) {
	const createdDate = normalizeOrderDate(order && order.createdDate)
	if (createdDate) return createdDate
	return normalizeOrderDate(order && order.createdAt)
}

function isValidDateString(value) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function sanitizeMergeStatusRecord(record) {
	if (!record) return null
	const date = normalizeOrderDate(record.date || record.createdDate)
	if (!isValidDateString(date)) return null
	return {
		_id: record._id,
		date,
		isMerged: !!record.isMerged,
		updatedAt: normalizeText(record.updatedAt),
		updatedBy: normalizeText(record.updatedBy)
	}
}

function isValidSettlementType(value) {
	return value === 'daily' || value === 'monthly'
}

function sanitizeUser(user) {
	if (!user) return null
	const {
		password,
		...rest
	} = user
 	return {
		...rest,
		userName: getCustomerUserName(user)
	}
}

function sanitizeOrderForList(order) {
	if (!order) return null
	const logs = Array.isArray(order.logs) ? order.logs : []
	const logCount = Number.isInteger(order.logCount) ? order.logCount : logs.length
	const hasPaymentScreenshot = typeof order.hasPaymentScreenshot === 'boolean' ? order.hasPaymentScreenshot : !!order
		.paymentScreenshot
	const dedupKey = normalizeText(order.dedup_key) || buildOrderDedupKey(order)
	return {
		...order,
		createdDate: getOrderCreatedDate(order),
		userName: getOrderUserName(order),
		unitPrice: Number.isFinite(Number(order.unitPrice)) && Number(order.unitPrice) >= 0 ? Number(order.unitPrice) : 0,
		dedup_key: dedupKey,
		logs: [],
		logCount,
		hasPaymentScreenshot,
		paymentScreenshot: ''
	}
}

function buildOrderDedupKey(order) {
	const date = getOrderCreatedDate(order)
	const userName = getOrderUserName(order)
	const quantity = Number(order && order.quantity) || 0
	const returnedBuckets = Number(order && order.returnedBuckets) || 0
	return `${userName}+${date}/${quantity}-${returnedBuckets}`
}

function validateCustomerPayload(userData, {
	requirePassword = false
} = {}) {
	const userName = normalizeText(userData.userName)
	const password = userData.password === undefined ? '' : String(userData.password)
	const unitPrice = Number(userData.unitPrice)
	const settlementType = userData.settlementType || 'daily'

	if (!userName) return {
		valid: false,
		message: '客户名称不能为空'
	}
	if (requirePassword && !password.trim()) return {
		valid: false,
		message: '登录密码不能为空'
	}
	if (!Number.isFinite(unitPrice) || unitPrice < 0) return {
		valid: false,
		message: '配送单价必须大于或等于 0'
	}
	if (!isValidSettlementType(settlementType)) return {
		valid: false,
		message: '结算方式不合法'
	}

	return {
		valid: true,
		payload: {
			userName,
			phone: userData.phone === undefined ? '' : String(userData.phone).trim(),
			address: userData.address === undefined ? '' : String(userData.address).trim(),
			unitPrice,
			notes: userData.notes === undefined ? '' : String(userData.notes).trim(),
			password,
			settlementType
		}
	}
}

function validateOrderPayload(orderData) {
	const userName = normalizeText(orderData.userName)
	const createdDate = normalizeText(orderData.createdDate)
	const createdAt = normalizeText(orderData.createdAt)
	const operator = normalizeText(orderData.operator)
	const quantity = Number(orderData.quantity)
	const returnedBuckets = Number(orderData.returnedBuckets)
	const unitPrice = orderData.unitPrice === undefined ? 0 : Number(orderData.unitPrice)
	const totalAmount = Number(orderData.totalAmount)
	const actualAmountReceived = orderData.actualAmountReceived !== undefined ?
		Number(orderData.actualAmountReceived) :
		0
	const settlementType = orderData.settlementType || 'daily'

	if (!userName) return {
		valid: false,
		message: '客户名称不能为空'
	}
	if (!createdDate || !isValidDateString(createdDate)) return {
		valid: false,
		message: '订单日期格式不正确'
	}
	if (!createdAt) return {
		valid: false,
		message: '订单时间不能为空'
	}
	if (!Number.isInteger(quantity) || quantity < 0) return {
		valid: false,
		message: '送水数量允许为 0，但不能小于 0'
	}
	if (!Number.isInteger(returnedBuckets) || returnedBuckets < 0) return {
		valid: false,
		message: '回桶数量必须是大于或等于 0 的整数'
	}
	if (!Number.isFinite(unitPrice) || unitPrice < 0) return {
		valid: false,
		message: '配送单价必须大于或等于 0'
	}
	if (!Number.isFinite(totalAmount) || totalAmount < 0) return {
		valid: false,
		message: '应收金额不合法'
	}
	if (!Number.isFinite(actualAmountReceived) || actualAmountReceived < 0) return {
		valid: false,
		message: '实收金额不合法'
	}
	if (!isValidSettlementType(settlementType)) return {
		valid: false,
		message: '结算方式不合法'
	}

	return {
		valid: true,
		payload: {
			createdAt,
			createdDate,
			userName,
			quantity,
			returnedBuckets,
			operator,
			unitPrice,
			totalAmount,
			actualAmountReceived,
			dedup_key: buildOrderDedupKey({
				userName,
				createdDate,
				quantity,
				returnedBuckets
			}),
			logs: Array.isArray(orderData.logs) ? orderData.logs : [],
			logCount: Array.isArray(orderData.logs) ? orderData.logs.length : 0,
			settlementType,
			paymentScreenshot: orderData.paymentScreenshot || '',
			hasPaymentScreenshot: !!orderData.paymentScreenshot,
			notes: orderData.notes ? String(orderData.notes).trim() : ''
		}
	}
}

function buildDuplicateKey(order) {
	return normalizeText(order && order.dedup_key) || buildOrderDedupKey(order)
}

function toLogSafe(value) {
	try {
		return JSON.parse(JSON.stringify(value))
	} catch (error) {
		return String(value)
	}
}

function buildCustomerNameMap(users) {
	const map = new Map()
	users.forEach(user => {
		const key = getCustomerUserName(user).toLowerCase()
		if (!key) return
		map.set(key, user)
	})
	return map
}

function getPayloadEffectiveUnitPrice(payload, customerMap) {
	const orderUnitPrice = Number(payload && payload.unitPrice)
	if (Number.isFinite(orderUnitPrice) && orderUnitPrice > 0) return orderUnitPrice
	const key = normalizeText(payload && payload.userName).toLowerCase()
	if (!key || !customerMap.has(key)) return 0
	const customer = customerMap.get(key)
	const customerUnitPrice = Number(customer.unitPrice)
	return Number.isFinite(customerUnitPrice) && customerUnitPrice >= 0 ? customerUnitPrice : 0
}

function applyCustomerPricing(payload, customerMap) {
	const key = normalizeText(payload && payload.userName).toLowerCase()
	const customer = key && customerMap.has(key) ? customerMap.get(key) : null
	const effectiveUnitPrice = getPayloadEffectiveUnitPrice(payload, customerMap)
	const totalAmount = Number((Number(payload.quantity || 0) * effectiveUnitPrice).toFixed(2))
	return {
		...payload,
		unitPrice: Number(Number(payload.unitPrice) > 0 ? Number(payload.unitPrice).toFixed(2) : 0),
		totalAmount,
		dedup_key: buildOrderDedupKey({
			userName: payload.userName,
			createdDate: payload.createdDate,
			quantity: payload.quantity,
			returnedBuckets: payload.returnedBuckets
		}),
		actualAmountReceived: payload.actualAmountReceived,
		settlementType: customer && isValidSettlementType(customer.settlementType) ? customer.settlementType : payload.settlementType
	}
}

function getDbData(res) {
	if (Array.isArray(res?.data)) return res.data
	if (Array.isArray(res?.result?.data)) return res.result.data
	return []
}

async function fetchAllCollectionData(buildQuery) {
	const allData = []
	let offset = 0
	while (true) {
		const res = await buildQuery().skip(offset).limit(DB_PAGE_SIZE).get()
		const pageData = getDbData(res)
		if (!pageData.length) break
		allData.push(...pageData)
		if (pageData.length < DB_PAGE_SIZE) break
		offset += pageData.length
	}
	return allData
}

async function requireAdmin(db, sessionUserId) {
	const adminId = normalizeText(sessionUserId)
	if (!adminId) {
		throw new Error('登录状态已失效，请重新登录')
	}
	const res = await db.collection(ADMIN_COLLECTION).doc(adminId).get()
	let data = getDbData(res)
	if (!data.length) {
		const fallbackRes = await db.collection(ADMIN_COLLECTION).where({
			userName: adminId
		}).get()
		data = getDbData(fallbackRes)
	}
	if (!data.length) {
		throw new Error('登录状态已失效，请重新登录')
	}
	return {
		...sanitizeUser(data[0]),
		isAdmin: true
	}
}

async function loadUsers(db) {
	const data = await fetchAllCollectionData(() => db.collection(CUSTOMER_COLLECTION))
	return data.map(sanitizeUser)
}

async function loadOrders(db) {
	const data = await fetchAllCollectionData(() => db.collection(ORDER_COLLECTION)
		.field({
			_id: true,
			createdAt: true,
			createdDate: true,
			userName: true,
			username: true,
			quantity: true,
			returnedBuckets: true,
			operator: true,
			unitPrice: true,
			totalAmount: true,
			actualAmountReceived: true,
			dedup_key: true,
			settlementType: true,
			notes: true,
			logCount: true,
			hasPaymentScreenshot: true
		})
		.orderBy('createdAt', 'desc'))
	return data.map(sanitizeOrderForList)
}

async function loadOrderDuplicateKeys(db) {
	const data = await fetchAllCollectionData(() => db.collection(ORDER_COLLECTION)
		.field({
			dedup_key: true,
			createdDate: true,
			userName: true,
			username: true,
			quantity: true,
			returnedBuckets: true
		}))
	return data.map(buildDuplicateKey)
}

async function loadOrderMergeStatuses(db) {
	const data = await fetchAllCollectionData(() => db.collection(ORDER_MERGE_COLLECTION)
		.field({
			_id: true,
			date: true,
			createdDate: true,
			isMerged: true,
			updatedAt: true,
			updatedBy: true
		})
		.orderBy('date', 'desc'))
	return data.map(sanitizeMergeStatusRecord).filter(Boolean)
}

function sanitizeMiscRecord(record) {
	if (!record) return null
	const name = normalizeText(record.name)
	const month = normalizeText(record.month).slice(0, 7)
	if (!name || !/^\d{4}-\d{2}$/.test(month)) return null
	const amount = Number(record.amount)
	return {
		_id: record._id,
		type: normalizeText(record.type) === '工资' ? '工资' : '报销',
		name,
		desc: normalizeText(record.desc),
		amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
		month,
		createdAt: normalizeText(record.createdAt),
		updatedAt: normalizeText(record.updatedAt)
	}
}

async function loadMiscRecords(db) {
	const data = await fetchAllCollectionData(() => db.collection(MISC_RECORD_COLLECTION))
	return data.map(sanitizeMiscRecord).filter(Boolean)
}

function wrapServiceMethods(service) {
	return Object.fromEntries(Object.entries(service).map(([name, handler]) => {
		if (typeof handler !== 'function' || name === '_before') {
			return [name, handler]
		}
		return [name, async function(...args) {
			try {
				const result = await handler.apply(this, args)
				console.log(`[waterService.${name}] return:`, toLogSafe(result))
				return result
			} catch (error) {
				console.log(`[waterService.${name}] throw:`, toLogSafe({
					message: error?.message || String(error),
					stack: error?.stack || ''
				}))
				throw error
			}
		}]
	}))
}

const serviceHandlers = {
	_before: function() {
		this.db = uniCloud.database()
	},
	async login({
		userName,
		password
	} = {}) {
		const account = normalizeText(userName)
		const plainPassword = normalizeText(password === undefined ? '' : String(password))

		if (!account || !plainPassword) {
			return {
				success: false,
				error: '请输入账号和密码'
			}
		}
		const db = this.db || uniCloud.database()
		const res = await db.collection(ADMIN_COLLECTION).get()
		const data = getDbData(res)
		const matchedAdmin = data.find(admin => {
			const accountName = normalizeText(admin?.userName || admin?.username)
			const adminPassword = normalizeText(admin?.password === undefined ? '' : String(admin.password))
			return accountName === account && adminPassword === plainPassword
		})
		if (!matchedAdmin) {
			return {
				success: false,
				error: '账号或密码不正确'
			}
		}
		const currentUser = {
			...sanitizeUser(matchedAdmin),
			isAdmin: true
		}
		const users = await loadUsers(db)
		return {
			success: true,
			user: currentUser,
			users
		}
	},
	async restoreSession({
		userId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			const currentUser = await requireAdmin(db, userId)
			const users = await loadUsers(db)
			return {
				success: true,
				user: currentUser,
				users
			}
		} catch (error) {
			return {
				success: false,
				error: error.message || '登录状态已失效，请重新登录'
			}
		}
	},
	async getUserList({
		userId
	} = {}) {
		const db = this.db || uniCloud.database()
		await requireAdmin(db, userId)
		const users = await loadUsers(db)
		return {
			success: true,
			users
		}
	},
	async getOrderList({
		sessionUserId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const orders = await loadOrders(db)
			const dateSummary = orders.reduce((map, order) => {
				const key = normalizeText(order?.createdDate) || 'EMPTY_DATE'
				map[key] = (map[key] || 0) + 1
				return map
			}, {})
			console.log('[waterService.getOrderList] date summary:', toLogSafe({
				total: orders.length,
				dateSummary
			}))
			return {
				success: true,
				orders
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '获取订单列表失败'
			}
		}
	},
	async getOrderMergeStatusList({
		sessionUserId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const statuses = await loadOrderMergeStatuses(db)
			return {
				success: true,
				statuses
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '加载合并状态失败'
			}
		}
	},
	async setOrderMergeStatus({
		sessionUserId,
		date,
		isMerged
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			const currentUser = await requireAdmin(db, sessionUserId)
			const targetDate = normalizeOrderDate(date)
			if (!isValidDateString(targetDate)) {
				return {
					success: false,
					message: '日期参数不正确'
				}
			}
			const recordRes = await db.collection(ORDER_MERGE_COLLECTION).where({
				date: targetDate
			}).get()
			const recordData = getDbData(recordRes)
			if (isMerged) {
				const payload = {
					date: targetDate,
					createdDate: targetDate,
					isMerged: true,
					updatedAt: formatDateTime(new Date()),
					updatedBy: currentUser.userName || ''
				}
				if (recordData.length > 0) {
					await db.collection(ORDER_MERGE_COLLECTION).doc(recordData[0]._id).update(payload)
				} else {
					await db.collection(ORDER_MERGE_COLLECTION).add(payload)
				}
			} else if (recordData.length > 0) {
				await db.collection(ORDER_MERGE_COLLECTION).doc(recordData[0]._id).remove()
			}
			return {
				success: true,
				date: targetDate,
				isMerged: !!isMerged
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '保存合并状态失败'
			}
		}
	},
	async getOrderMedia({
		sessionUserId,
		orderId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const targetOrderId = normalizeText(orderId)
			if (!targetOrderId) {
				return {
					success: false,
					message: '订单参数不正确'
				}
			}
			const res = await db.collection(ORDER_COLLECTION).doc(targetOrderId).get()
			const data = getDbData(res)
			if (!data.length) {
				return {
					success: false,
					message: '订单不存在'
				}
			}
			const order = data[0]
			return {
				success: true,
				logs: Array.isArray(order.logs) ? order.logs : [],
				paymentScreenshot: order.paymentScreenshot || ''
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '加载附件失败'
			}
		}
	},
	async addBatchUsers({
		sessionUserId,
		users = []
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			if (!Array.isArray(users) || users.length === 0) {
				return {
					success: false,
					message: '没有可新增的客户数据'
				}
			}
			const currentUsers = await loadUsers(db)
			const duplicateUsers = []
			let addedCount = 0
			for (const userData of users) {
				const validation = validateCustomerPayload(userData || {})
				if (!validation.valid) {
					return {
						success: false,
						message: validation.message,
						addedCount,
						skippedCount: duplicateUsers.length,
						duplicateUsers
					}
				}
				const payloadData = validation.payload
				if (currentUsers.some(user => normalizeText(user.userName) === normalizeText(payloadData
						.userName))) {
					duplicateUsers.push({
						userName: payloadData.userName,
						unitPrice: payloadData.unitPrice,
						settlementType: payloadData.settlementType
					})
					continue
				}
				const now = new Date()
				await db.collection(CUSTOMER_COLLECTION).add({
					...payloadData,
					createdAt: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
					createdDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
					isAdmin: false
				})
				currentUsers.push({
					...payloadData,
					isAdmin: false
				})
				addedCount++
			}
			return {
				success: true,
				addedCount,
				skippedCount: duplicateUsers.length,
				duplicateUsers
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '批量新增客户失败',
				addedCount: 0,
				skippedCount: 0,
				duplicateUsers: []
			}
		}
	},
	async updateCustomer({
		sessionUserId,
		userId,
		userData
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const targetUserId = normalizeText(userId)
			if (!targetUserId) {
				return {
					success: false,
					message: '客户参数不正确'
				}
			}
			const validation = validateCustomerPayload(userData || {})
			if (!validation.valid) {
				return {
					success: false,
					message: validation.message
				}
			}
			const payloadData = validation.payload
			const targetRes = await db.collection(CUSTOMER_COLLECTION).doc(targetUserId).get()
			const targetUsers = getDbData(targetRes)
			const targetUser = targetUsers[0]
			if (!targetUser || targetUser.isAdmin) {
				return {
					success: false,
					message: '客户不存在'
				}
			}
			const currentUsers = await loadUsers(db)
			const hasDuplicate = currentUsers.some(user => user._id !== targetUserId && normalizeText(user
				.userName) === normalizeText(payloadData.userName))
			if (hasDuplicate) {
				return {
					success: false,
					message: '客户名称已存在'
				}
			}
			await db.collection(CUSTOMER_COLLECTION).doc(targetUserId).update({
				...payloadData,
				isAdmin: false
			})
			return {
				success: true
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '更新客户失败'
			}
		}
	},
	async deleteCustomer({
		sessionUserId,
		userId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const targetUserId = normalizeText(userId)
			if (!targetUserId) {
				return {
					success: false,
					message: '客户参数不正确'
				}
			}
			const targetRes = await db.collection(CUSTOMER_COLLECTION).doc(targetUserId).get()
			const targetUsers = getDbData(targetRes)
			const targetUser = targetUsers[0]
			if (!targetUser || targetUser.isAdmin) {
				return {
					success: false,
					message: '客户不存在'
				}
			}
			await db.collection(CUSTOMER_COLLECTION).doc(targetUserId).remove()
			return {
				success: true
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '删除客户失败'
			}
		}
	},
	async addOrder({
		sessionUserId,
		orderData
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const validation = validateOrderPayload(orderData || {})
			if (!validation.valid) {
				return {
					success: false,
					message: validation.message
				}
			}
			const customerMap = buildCustomerNameMap(await loadUsers(db))
			const payload = applyCustomerPricing(validation.payload, customerMap)
			const duplicateWhere = {
				dedup_key: payload.dedup_key
			}
			const existRes = await db.collection(ORDER_COLLECTION).where(duplicateWhere).get()
			const exists = getDbData(existRes)
			if (exists.length > 0) {
				return {
					success: false,
					code: 'DUPLICATE_ORDER',
					message: '这个数据重复录入了',
					duplicateOrders: [payload]
				}
			}
			await db.collection(ORDER_COLLECTION).add(payload)
			return {
				success: true
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '创建订单失败'
			}
		}
	},
	async addOrders({
		sessionUserId,
		orders = []
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			if (!Array.isArray(orders) || orders.length === 0) {
				return {
					success: false,
					message: '没有可提交的订单'
				}
			}
			const duplicateOrders = []
			const seenKeys = new Set()
			const validPayloads = []
			const customerMap = buildCustomerNameMap(await loadUsers(db))
			for (let i = 0; i < orders.length; i++) {
				const validation = validateOrderPayload(orders[i] || {})
				if (!validation.valid) {
					return {
						success: false,
						message: `第 ${i + 1} 笔订单无效：${validation.message}`
					}
				}
				const payload = applyCustomerPricing(validation.payload, customerMap)
				const key = buildDuplicateKey(payload)
				if (seenKeys.has(key)) {
					duplicateOrders.push(payload)
					continue
				}
				seenKeys.add(key)
				validPayloads.push(payload)
			}
			const dbDuplicateKeySet = new Set(await loadOrderDuplicateKeys(db))
			const insertPayloads = []
			validPayloads.forEach(payload => {
				if (dbDuplicateKeySet.has(buildDuplicateKey(payload))) duplicateOrders.push(payload)
				else insertPayloads.push(payload)
			})
			if (insertPayloads.length === 0) {
				return {
					success: false,
					code: 'DUPLICATE_ORDER',
					message: '这个数据重复录入了',
					duplicateOrders,
					addedCount: 0,
					skippedCount: duplicateOrders.length
				}
			}
			for (const payload of insertPayloads) {
				await db.collection(ORDER_COLLECTION).add(payload)
			}
			return {
				success: true,
				count: insertPayloads.length,
				addedCount: insertPayloads.length,
				skippedCount: duplicateOrders.length,
				duplicateOrders
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '批量创建订单失败'
			}
		}
	},
	async updateOrder({
		sessionUserId,
		orderId,
		orderData
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const targetOrderId = normalizeText(orderId)
			if (!targetOrderId) {
				return {
					success: false,
					message: '订单参数不正确'
				}
			}
			const targetRes = await db.collection(ORDER_COLLECTION).doc(targetOrderId).get()
			const targetOrders = getDbData(targetRes)
			const targetOrder = targetOrders[0]
			if (!targetOrder) {
				return {
					success: false,
					message: '订单不存在'
				}
			}
			const validation = validateOrderPayload({
				...targetOrder,
				...(orderData || {}),
				createdAt: targetOrder.createdAt,
				createdDate: targetOrder.createdDate,
				operator: targetOrder.operator || ''
			})
			if (!validation.valid) {
				return {
					success: false,
					message: validation.message
				}
			}
			const customerMap = buildCustomerNameMap(await loadUsers(db))
			const payload = applyCustomerPricing(validation.payload, customerMap)
			const duplicateRes = await db.collection(ORDER_COLLECTION).where({
				dedup_key: payload.dedup_key
			}).get()
			const duplicateData = getDbData(duplicateRes)
			if (duplicateData.some(item => String(item._id || '') !== targetOrderId)) {
				return {
					success: false,
					message: '这个数据重复录入了'
				}
			}
			await db.collection(ORDER_COLLECTION).doc(targetOrderId).update({
				userName: payload.userName,
				quantity: payload.quantity,
				returnedBuckets: payload.returnedBuckets,
				unitPrice: payload.unitPrice,
				totalAmount: payload.totalAmount,
				actualAmountReceived: payload.actualAmountReceived,
				settlementType: payload.settlementType,
				notes: payload.notes,
				dedup_key: payload.dedup_key
			})
			return {
				success: true
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '更新订单失败'
			}
		}
	},
	async deleteOrder({
		sessionUserId,
		orderId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const targetOrderId = normalizeText(orderId)
			if (!targetOrderId) {
				return {
					success: false,
					message: '订单参数不正确'
				}
			}
			const targetRes = await db.collection(ORDER_COLLECTION).doc(targetOrderId).get()
			const targetOrders = getDbData(targetRes)
			const targetOrder = targetOrders[0]
			if (!targetOrder) {
				return {
					success: false,
					message: '订单不存在'
				}
			}
			await db.collection(ORDER_COLLECTION).doc(targetOrderId).remove()
			return {
				success: true
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '删除订单失败'
			}
		}
	},
	async getMiscRecordList({
		sessionUserId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const records = await loadMiscRecords(db)
			return {
				success: true,
				records
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '\u52a0\u8f7d\u5de5\u8d44\u62a5\u9500\u8bb0\u5f55\u5931\u8d25'
			}
		}
	},
	async addMiscRecords({
		sessionUserId,
		records = []
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			if (!Array.isArray(records) || records.length === 0) {
				return {
					success: false,
					message: '\u6ca1\u6709\u53ef\u5f55\u5165\u7684\u8bb0\u5f55'
				}
			}
			const addedRecords = []
			for (const rawRecord of records) {
				const record = sanitizeMiscRecord(rawRecord)
				if (!record) continue
				const now = formatDateTime(new Date())
				const payload = {
					type: record.type,
					name: record.name,
					desc: record.desc,
					amount: record.amount,
					month: record.month,
					createdAt: record.createdAt || now,
					updatedAt: now
				}
				const res = await db.collection(MISC_RECORD_COLLECTION).add(payload)
				addedRecords.push({
					_id: res.id || res._id,
					...payload
				})
			}
			return {
				success: true,
				addedCount: addedRecords.length,
				records: addedRecords
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '\u5f55\u5165\u5de5\u8d44\u62a5\u9500\u8bb0\u5f55\u5931\u8d25'
			}
		}
	},
	async updateMiscRecord({
		sessionUserId,
		recordId,
		recordData
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const targetId = normalizeText(recordId)
			if (!targetId) {
				return {
					success: false,
					message: '\u8bb0\u5f55\u53c2\u6570\u4e0d\u6b63\u786e'
				}
			}
			const record = sanitizeMiscRecord(recordData)
			if (!record) {
				return {
					success: false,
					message: '\u8bb0\u5f55\u5185\u5bb9\u4e0d\u5b8c\u6574'
				}
			}
			await db.collection(MISC_RECORD_COLLECTION).doc(targetId).update({
				type: record.type,
				name: record.name,
				desc: record.desc,
				amount: record.amount,
				month: record.month,
				updatedAt: formatDateTime(new Date())
			})
			return {
				success: true
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '\u66f4\u65b0\u5de5\u8d44\u62a5\u9500\u8bb0\u5f55\u5931\u8d25'
			}
		}
	},
	async deleteMiscRecord({
		sessionUserId,
		recordId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			await requireAdmin(db, sessionUserId)
			const targetId = normalizeText(recordId)
			if (!targetId) {
				return {
					success: false,
					message: '\u8bb0\u5f55\u53c2\u6570\u4e0d\u6b63\u786e'
				}
			}
			await db.collection(MISC_RECORD_COLLECTION).doc(targetId).remove()
			return {
				success: true
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '\u5220\u9664\u5de5\u8d44\u62a5\u9500\u8bb0\u5f55\u5931\u8d25'
			}
		}
	},
	async test() {

		const db = uniCloud.database();
		const cmd = db.command;
		const res = await db.collection("user_list").where({
			_id: cmd.neq(null)
		}).get()
		console.log('res: ', res);
	}
}

module.exports = wrapServiceMethods(serviceHandlers)
