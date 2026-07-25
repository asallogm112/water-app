const CUSTOMER_COLLECTION = 'user_list'
const ORDER_COLLECTION = 'order_list'
const ADMIN_COLLECTION = 'admin_list'
function normalizeText(value) {
	return typeof value === 'string' ? value.trim() : ''
}

function normalizeUsername(value) {
	return normalizeText(value).toLowerCase()
}

function isValidDateString(value) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value)
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
	return rest
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
		dedup_key: dedupKey,
		logs: [],
		logCount,
		hasPaymentScreenshot,
		paymentScreenshot: ''
	}
}

function buildOrderDedupKey(order) {
	const date = normalizeText(order && order.createdDate)
	const monthKey = date ? date.substring(0, 7).replace('-', '') : ''
	const quantity = Number(order && order.quantity) || 0
	const returnedBuckets = Number(order && order.returnedBuckets) || 0
	return [monthKey, quantity, returnedBuckets].join('-')
}

function validateCustomerPayload(userData, {
	requirePassword = false
} = {}) {
	const username = normalizeText(userData.username)
	const name = normalizeText(userData.name)
	const password = userData.password === undefined ? '' : String(userData.password)
	const unitPrice = Number(userData.unitPrice)
	const settlementType = userData.settlementType || 'daily'

	if (!username) return {
		valid: false,
		message: '客户账号不能为空'
	}
	if (!name) return {
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
			username,
			name,
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
	const unitPrice = Number(orderData.unitPrice)
	const totalAmount = Number(orderData.totalAmount)
	const actualAmountReceived = orderData.actualAmountReceived !== undefined ?
		Number(orderData.actualAmountReceived) :
		totalAmount
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
	if (!Number.isInteger(quantity) || quantity <= 0) return {
		valid: false,
		message: '送水数量必须是大于 0 的整数'
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
		const key = normalizeText(user && user.name).toLowerCase()
		if (!key) return
		map.set(key, user)
	})
	return map
}

function applyCustomerPricing(payload, customerMap) {
	const key = normalizeText(payload && payload.userName).toLowerCase()
	if (!key || !customerMap.has(key)) return payload
	const customer = customerMap.get(key)
	const unitPrice = Number(customer.unitPrice)
	if (!Number.isFinite(unitPrice) || unitPrice < 0) return payload
	const totalAmount = Number((Number(payload.quantity || 0) * unitPrice).toFixed(2))
	return {
		...payload,
		unitPrice,
		totalAmount,
		dedup_key: buildOrderDedupKey({
			createdDate: payload.createdDate,
			quantity: payload.quantity,
			returnedBuckets: payload.returnedBuckets
		}),
		actualAmountReceived: payload.actualAmountReceived,
		settlementType: isValidSettlementType(customer.settlementType) ? customer.settlementType : payload.settlementType
	}
}

function getDbData(res) {
	if (Array.isArray(res?.data)) return res.data
	if (Array.isArray(res?.result?.data)) return res.result.data
	return []
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
			username: adminId
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
	const res = await db.collection(CUSTOMER_COLLECTION).get()
	const data = getDbData(res)
	return data.map(sanitizeUser)
}

async function loadOrders(db) {
	const res = await db.collection(ORDER_COLLECTION)
		.field({
			_id: true,
			createdAt: true,
			createdDate: true,
			userName: true,
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
		.orderBy('createdAt', 'desc')
		.get()
	const data = getDbData(res)
	return data.map(sanitizeOrderForList)
}

async function loadOrderDuplicateKeys(db) {
	const res = await db.collection(ORDER_COLLECTION)
		.field({
			dedup_key: true,
			createdDate: true,
			quantity: true,
			returnedBuckets: true
		})
		.get()
	const data = getDbData(res)
	return data.map(buildDuplicateKey)
}

module.exports = {
	_before: function() {
		this.db = uniCloud.database()
	},
	async login({
		username,
		password
	} = {}) {
		const account = normalizeText(username)
		const plainPassword = normalizeText(password === undefined ? '' : String(password))

		if (!account || !plainPassword) {
			return {
				success: false,
				error: '请输入账号和密码'
			}
		}
		const db = this.db || uniCloud.database()
		const res = await db.collection(ADMIN_COLLECTION).where({
			username: account,
			password: plainPassword
		}).get()
		const data = getDbData(res)
		const matchedAdmin = data[0]
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
		const [users, orders] = await Promise.all([loadUsers(db), loadOrders(db)])
		return {
			success: true,
			user: currentUser,
			users,
			orders
		}
	},
	async restoreSession({
		userId
	} = {}) {
		try {
			const db = this.db || uniCloud.database()
			const currentUser = await requireAdmin(db, userId)
			const [users, orders] = await Promise.all([loadUsers(db), loadOrders(db)])
			return {
				success: true,
				user: currentUser,
				users,
				orders
			}
		} catch (error) {
			return {
				success: false,
				error: error.message || '登录状态已失效，请重新登录'
			}
		}
	},
	async getBootstrapData({
		userId
	} = {}) {
		const db = this.db || uniCloud.database()
		await requireAdmin(db, userId)
		const [users, orders] = await Promise.all([loadUsers(db), loadOrders(db)])
		return {
			success: true,
			users,
			orders
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
				if (currentUsers.some(user => normalizeUsername(user.username) === normalizeUsername(payloadData.username) ||
						normalizeText(user.name) === normalizeText(payloadData.name))) {
					duplicateUsers.push(payloadData.name)
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
			const hasDuplicate = currentUsers.some(user => user._id !== targetUserId && (
				normalizeUsername(user.username) === normalizeUsername(payloadData.username) ||
				normalizeText(user.name) === normalizeText(payloadData.name)
			))
			if (hasDuplicate) {
				return {
					success: false,
					message: '客户名称或账号已存在'
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
			const duplicateWhere = { dedup_key: payload.dedup_key }
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
				if (seenKeys.has(key)) duplicateOrders.push(payload)
				seenKeys.add(key)
				validPayloads.push(payload)
			}
			const dbDuplicateKeySet = new Set(await loadOrderDuplicateKeys(db))
			validPayloads.forEach(payload => {
				if (dbDuplicateKeySet.has(buildDuplicateKey(payload))) duplicateOrders.push(payload)
			})
			if (duplicateOrders.length > 0) {
				return {
					success: false,
					code: 'DUPLICATE_ORDER',
					message: '这个数据重复录入了',
					duplicateOrders
				}
			}
			for (const payload of validPayloads) {
				await db.collection(ORDER_COLLECTION).add(payload)
			}
			return {
				success: true,
				count: validPayloads.length
			}
		} catch (error) {
			return {
				success: false,
				message: error.message || '批量创建订单失败'
			}
		}
	}
}
