/**
 * 水管家配送管理系统 - 全局状态管理
 * 所有数据交互统一通过 uniCloud 云对象完成
 */
import {
	reactive
} from 'vue'
import { formatMoney } from './utils.js'

const SESSION_STORAGE_KEY = 'delivery_session_admin'

let waterService = null
let restoreSessionPromise = null

function unwrapServiceResult(rawResult) {
	if (rawResult && typeof rawResult === 'object' && rawResult.result && typeof rawResult.result === 'object') {
		return rawResult.result
	}
	return rawResult
}

function buildOrderDuplicateKey(order) {
	return [
		order.createdDate || '',
		String(order.userName || '').trim().toLowerCase(),
		Number(order.quantity) || 0,
		Number(order.returnedBuckets) || 0
	].join('|')
}

function getService() {
	if (!waterService) {
		if (typeof uniCloud === 'undefined' || !uniCloud || typeof uniCloud.importObject !== 'function') {
			throw new Error('当前环境未启用 uniCloud，无法连接云对象 waterService')
		}
		waterService = uniCloud.importObject('waterService')
		if (!waterService || typeof waterService !== 'object') {
			throw new Error('云对象 waterService 不存在或未成功导入，请检查 uniCloud 云对象是否已上传')
		}
		if (typeof waterService.login !== 'function') {
			throw new Error('云对象 waterService 缺少 login 方法，请重新上传最新云对象代码')
		}
	}
	return waterService
}

function clonePlainData(value, fallback) {
	if (value === undefined) return fallback
	try {
		return JSON.parse(JSON.stringify(value))
	} catch (error) {
		if (Array.isArray(value)) return value.map(item => clonePlainData(item, {}))
		if (value && typeof value === 'object') return {
			...value
		}
		return value
	}
}

function formatErrorMessage(error, fallback = '操作失败，请稍后重试') {
	if (!error) return fallback
	const rawMessage = typeof error === 'string' ? error : error.message || error.errMsg || error.error || ''
	const message = String(rawMessage).trim()
	if (!message) return fallback

	if (/read only property|target is readonly|readonly/i.test(message)) {
		return `数据对象不可写：${message}`
	}
	if (/network|request:fail|Failed to fetch|fetch/i.test(message)) {
		return '网络异常，请稍后重试'
	}
	if (/timeout/i.test(message)) {
		return '请求超时，请稍后重试'
	}
	return message
}

function applyBootstrapData(payload = {}) {
	if (payload.user) state.currentUser = clonePlainData(payload.user, null)
	if (Array.isArray(payload.users)) state.users = clonePlainData(payload.users, [])
	if (Array.isArray(payload.orders)) state.orders = clonePlainData(payload.orders, [])
}

function persistSessionState() {
	const currentUser = clonePlainData(state.currentUser, null)
	if (!currentUser?._id) return
	uni.setStorageSync(SESSION_STORAGE_KEY, JSON.stringify({
		_id: currentUser._id,
		user: currentUser,
		users: clonePlainData(state.users, []),
		orders: clonePlainData(state.orders, []),
		updatedAt: Date.now()
	}))
}

function readSessionState() {
	try {
		const raw = uni.getStorageSync(SESSION_STORAGE_KEY)
		if (!raw) return null
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
		return parsed && typeof parsed === 'object' ? parsed : null
	} catch (error) {
		return null
	}
}

const state = reactive({
	currentUser: null,
	users: [],
	orders: [],
	dbNotification: null,
	loading: false,
	_notificationTimer: null
})

function showNotification(msg) {
	state.dbNotification = msg
	if (state._notificationTimer) clearTimeout(state._notificationTimer)
	state._notificationTimer = setTimeout(() => {
		state.dbNotification = null
	}, 3000)
}

function formatDateTime(date) {
	const pad = (n) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatBeijingDateTime(date = new Date()) {
	const formatter = new Intl.DateTimeFormat('zh-CN', {
		timeZone: 'Asia/Shanghai',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	})
	const parts = formatter.formatToParts(date)
	const get = (type) => parts.find(part => part.type === type)?.value || '00'
	return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

function formatDate(date) {
	const pad = (n) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getSessionUserId() {
	if (state.currentUser && state.currentUser._id) return state.currentUser._id
	const parsed = readSessionState()
	if (!parsed) return ''
	return parsed._id || parsed.user?._id || ''
}

function clearSessionState() {
	state.currentUser = null
	state.users = []
	state.orders = []
	uni.removeStorageSync(SESSION_STORAGE_KEY)
}

async function fetchOrderList() {
	const result = unwrapServiceResult(await getService().getOrderList({
		sessionUserId: getSessionUserId()
	}))
	if (!result?.success) {
		return {
			success: false,
			message: formatErrorMessage(result?.message, '加载订单失败'),
			orders: []
		}
	}
	return {
		success: true,
		orders: clonePlainData(result.orders, [])
	}
}

async function getOrderMergeStatusList() {
	const result = unwrapServiceResult(await getService().getOrderMergeStatusList({
		sessionUserId: getSessionUserId()
	}))
	if (!result?.success) {
		return {
			success: false,
			message: formatErrorMessage(result?.message, '加载合并状态失败'),
			statuses: []
		}
	}
	return {
		success: true,
		statuses: clonePlainData(result.statuses, [])
	}
}

async function setOrderMergeStatus(date, isMerged) {
	const result = unwrapServiceResult(await getService().setOrderMergeStatus({
		sessionUserId: getSessionUserId(),
		date,
		isMerged: !!isMerged
	}))
	if (!result?.success) {
		return {
			success: false,
			message: formatErrorMessage(result?.message, '保存合并状态失败')
		}
	}
	return {
		success: true,
		date: result.date,
		isMerged: !!result.isMerged
	}
}

async function loadAllData() {
	const userId = getSessionUserId()
	if (!userId) {
		state.users = []
		state.orders = []
		return {
			success: false,
			message: '未登录'
		}
	}
	state.loading = true
	try {
		const userListResult = unwrapServiceResult(await getService().getUserList({
			userId
		}))
		if (!userListResult?.success) {
			clearSessionState()
			return {
				success: false,
				message: formatErrorMessage(userListResult?.error || userListResult?.message, '加载数据失败')
			}
		}
		applyBootstrapData(userListResult)
		const orderResult = await fetchOrderList()
		if (!orderResult.success) {
			return {
				success: false,
				message: orderResult.message
			}
		}
		state.orders = orderResult.orders
		persistSessionState()
		return {
			success: true
		}
	} catch (error) {
		return {
			success: false,
			message: formatErrorMessage(error, '加载数据失败')
		}
	} finally {
		state.loading = false
	}
}

async function loadUsers() {
	const result = await loadAllData()
	return result.success ? state.users : []
}

async function loadOrders() {
	const userId = getSessionUserId()
	if (!userId) {
		state.orders = []
		return []
	}
	state.loading = true
	try {
		const result = await fetchOrderList()
		if (!result.success) return []
		state.orders = result.orders
		persistSessionState()
		return state.orders
	} catch (error) {
		return []
	} finally {
		state.loading = false
	}
}

async function loginWithPassword(userName, password) {
	if (!userName || !password) {
		return {
			success: false,
			error: '请输入账号和密码'
		}
	}
	try {
		const result = unwrapServiceResult(await getService().login({
			userName: userName.trim(),
			password: password
		}))
		if (!result?.success) {
			return {
				success: false,
				error: formatErrorMessage(result?.error || result?.message, '登录失败')
			}
		}
		applyBootstrapData(result)
		const orderResult = await fetchOrderList()
		if (!orderResult.success) {
			return {
				success: false,
				error: orderResult.message
			}
		}
		state.orders = orderResult.orders
		persistSessionState()
		showNotification(`欢迎回来，${state.currentUser?.userName || result.user?.userName || ''}！`)
		return {
			success: true,
			user: state.currentUser
		}
	} catch (error) {
		return {
			success: false,
			error: formatErrorMessage(error, '登录失败')
		}
	}
}

function logout() {
	clearSessionState()
	showNotification('已退出当前账号')
}

async function restoreSession() {
	if (restoreSessionPromise) return restoreSessionPromise
	const cachedSession = readSessionState()
	if (!cachedSession?.user?._id) return false
	restoreSessionPromise = (async () => {
		try {
			applyBootstrapData({
				user: cachedSession.user || null,
				users: Array.isArray(cachedSession.users) ? cachedSession.users : [],
				orders: Array.isArray(cachedSession.orders) ? cachedSession.orders : []
			})
			return true
		} catch (error) {
			clearSessionState()
			return false
		} finally {
			restoreSessionPromise = null
		}
	})()
	return restoreSessionPromise
}

async function addBatchUsers(newUsers) {
	try {
		const result = unwrapServiceResult(await getService().addBatchUsers({
			sessionUserId: getSessionUserId(),
			users: newUsers
		}))
		if (!result?.success) {
			showNotification(result?.message || '批量操作失败')
			return {
				success: false,
				message: formatErrorMessage(result?.message),
				addedCount: result?.addedCount || 0,
				skippedCount: result?.skippedCount || 0,
				duplicateUsers: result?.duplicateUsers || []
			}
		}
		await loadUsers()
		if (result.skippedCount > 0) showNotification(`已跳过 ${result.skippedCount} 个重复账号`)
		else showNotification(`批量完成：新增 ${result.addedCount} 位客户`)
		return result
	} catch (error) {
		showNotification('批量操作失败: ' + formatErrorMessage(error))
		return {
			success: false,
			message: formatErrorMessage(error),
			addedCount: 0,
			skippedCount: 0,
			duplicateUsers: []
		}
	}
}

async function addOrder(orderData) {
	try {
		const result = unwrapServiceResult(await getService().addOrder({
			sessionUserId: getSessionUserId(),
			orderData
		}))
		if (!result?.success) {
			showNotification(result?.message || '创建订单失败')
			return {
				success: false,
				code: result?.code,
				message: formatErrorMessage(result?.message),
				duplicateOrders: result?.duplicateOrders || []
			}
		}
		await loadOrders()
		showNotification(`配送单已生成: ¥${formatMoney(orderData.totalAmount)}`)
		return {
			success: true
		}
	} catch (error) {
		showNotification('创建订单失败: ' + formatErrorMessage(error))
		return {
			success: false,
			message: formatErrorMessage(error)
		}
	}
}

async function updateCustomer(userId, userData) {
	try {
		const result = unwrapServiceResult(await getService().updateCustomer({
			sessionUserId: getSessionUserId(),
			userId,
			userData
		}))
		if (!result?.success) {
			return {
				success: false,
				message: formatErrorMessage(result?.message, '更新客户失败')
			}
		}
		await loadUsers()
		showNotification('客户信息已更新')
		return {
			success: true
		}
	} catch (error) {
		return {
			success: false,
			message: formatErrorMessage(error, '更新客户失败')
		}
	}
}

async function deleteCustomer(userId) {
	try {
		const result = unwrapServiceResult(await getService().deleteCustomer({
			sessionUserId: getSessionUserId(),
			userId
		}))
		if (!result?.success) {
			return {
				success: false,
				message: formatErrorMessage(result?.message, '删除客户失败')
			}
		}
		await loadUsers()
		showNotification('客户已删除')
		return {
			success: true
		}
	} catch (error) {
		return {
			success: false,
			message: formatErrorMessage(error, '删除客户失败')
		}
	}
}

async function addOrders(orderList) {
	if (!Array.isArray(orderList) || orderList.length === 0) return {
		success: false,
		message: '没有可提交的订单'
	}
	try {
		const result = unwrapServiceResult(await getService().addOrders({
			sessionUserId: getSessionUserId(),
			orders: orderList
		}))
		if (!result?.success) {
			showNotification(result?.message || '批量创建失败')
			return {
				success: false,
				code: result?.code,
				message: formatErrorMessage(result?.message),
				duplicateOrders: result?.duplicateOrders || []
			}
		}
		await loadOrders()
		const addedCount = Number(result.addedCount || result.count || 0)
		const skippedCount = Number(result.skippedCount || 0)
		showNotification(skippedCount > 0 ? `已创建 ${addedCount} 笔，跳过 ${skippedCount} 笔重复订单` : `已批量创建 ${addedCount} 笔订单`)
		return result
	} catch (error) {
		showNotification('批量创建失败: ' + formatErrorMessage(error))
		return {
			success: false,
			message: formatErrorMessage(error)
		}
	}
}

async function updateOrder(orderId, orderData) {
	try {
		const result = unwrapServiceResult(await getService().updateOrder({
			sessionUserId: getSessionUserId(),
			orderId,
			orderData
		}))
		if (!result?.success) {
			return {
				success: false,
				message: formatErrorMessage(result?.message, '更新订单失败')
			}
		}
		await loadOrders()
		showNotification('订单信息已更新')
		return {
			success: true
		}
	} catch (error) {
		return {
			success: false,
			message: formatErrorMessage(error, '更新订单失败')
		}
	}
}

async function deleteOrder(orderId) {
	try {
		const result = unwrapServiceResult(await getService().deleteOrder({
			sessionUserId: getSessionUserId(),
			orderId
		}))
		if (!result?.success) {
			return {
				success: false,
				message: formatErrorMessage(result?.message, '删除订单失败')
			}
		}
		await loadOrders()
		showNotification('订单已删除')
		return {
			success: true
		}
	} catch (error) {
		return {
			success: false,
			message: formatErrorMessage(error, '删除订单失败')
		}
	}
}

async function getOrderMedia(orderId) {
	try {
		const result = unwrapServiceResult(await getService().getOrderMedia({
			sessionUserId: getSessionUserId(),
			orderId
		}))
		if (!result?.success) {
			return {
				success: false,
				message: formatErrorMessage(result?.message, '加载附件失败'),
				logs: [],
				paymentScreenshot: ''
			}
		}
		return {
			success: true,
			logs: Array.isArray(result.logs) ? result.logs : [],
			paymentScreenshot: result.paymentScreenshot || ''
		}
	} catch (error) {
		return {
			success: false,
			message: formatErrorMessage(error, '加载附件失败'),
			logs: [],
			paymentScreenshot: ''
		}
	}
}

export function useStore() {
	return {
		state,
		loadUsers,
		loadOrders,
		loadAllData,
		loginWithPassword,
		logout,
		restoreSession,
		addBatchUsers,
		addOrder,
		updateCustomer,
		deleteCustomer,
		addOrders,
		updateOrder,
		deleteOrder,
		getOrderMergeStatusList,
		setOrderMergeStatus,
		getOrderMedia,
		showNotification,
		formatDateTime,
		formatBeijingDateTime,
		formatDate
	}
}
