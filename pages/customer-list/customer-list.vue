<template>
  <view class="page-container customer-list-page">
    <view v-if="!state.currentUser?.isAdmin" class="no-permission">
      <text class="no-perm-icon">🛡️</text>
      <text class="no-perm-title">无访问权限</text>
      <text class="no-perm-desc">客户列表仅限管理员查看。</text>
    </view>

    <scroll-view v-else class="customer-scroll" scroll-y>
      <view class="customer-inner">
        <view class="summary-band">
          <view class="summary-item">
            <text class="summary-label">客户总数</text>
            <text class="summary-value">{{ customerList.length }}</text>
          </view>
          <view class="summary-item summary-divider">
            <text class="summary-label">日结客户</text>
            <text class="summary-value summary-value-emerald">{{ dailyCount }}</text>
          </view>
          <view class="summary-item summary-divider">
            <text class="summary-label">月结客户</text>
            <text class="summary-value summary-value-indigo">{{ monthlyCount }}</text>
          </view>
        </view>

        <view class="toolbar-card">
          <view class="search-wrap">
            <uni-easyinput class="search-input" type="text" v-model="keyword" placeholder="搜索客户姓名或地址" :inputBorder="false" />
          </view>
          <view class="filter-row">
            <view v-for="item in settleOptions" :key="item.value" class="filter-chip" :class="{ 'filter-chip-active': settleFilter === item.value }" @tap="settleFilter = item.value">
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>

        <view class="section-head">
          <text class="section-title">客户信息列表</text>
          <view class="section-head-right">
            <text class="section-count">当前 {{ filteredCustomers.length }} 位</text>
				<view v-if="canManageData" class="batch-add-btn" @tap="openBatchAddModal">
					<text>批量新增</text>
				</view>
          </view>
        </view>

        <view v-if="filteredCustomers.length === 0" class="empty-state">
          <text class="empty-icon">📄</text>
          <text class="empty-title">没有匹配的客户</text>
          <text class="empty-desc">请修改搜索关键词或切换结算方式筛选。</text>
        </view>

        <view v-else class="customer-list">
          <view v-for="customer in filteredCustomers" :key="customer._id || customer.userName" class="customer-card">
            <view class="customer-card-top">
              <view class="customer-main">
                <view class="customer-name-row">
                  <text class="customer-name">{{ customer.userName }}</text>
                  <text class="settle-tag" :class="customer.settlementType === 'monthly' ? 'tag-monthly' : 'tag-daily'">
                    {{ customer.settlementType === 'monthly' ? '月结' : '日结' }}
                  </text>
                  <view v-if="canManageData" class="customer-edit-btn" @tap="openEditor(customer)">
                    <text>编辑</text>
                  </view>
                </view>
              </view>
              <view class="price-box">
                <text class="price-label">单价</text>
                <text class="price-value">¥{{ formatMoney(customer.unitPrice) }}</text>
              </view>
            </view>

            <view class="customer-meta-grid">
              <view class="meta-item">
                <text class="meta-label">配送地址</text>
                <text class="meta-value">{{ customer.address || '未填写配送地址' }}</text>
              </view>
              <view class="meta-item meta-item-compact">
                <text class="meta-label">手机号</text>
                <text class="meta-value">{{ customer.phone || '未填写手机号' }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

    <view v-if="showEditor" class="editor-mask" @tap="closeEditor" @touchmove.stop.prevent>
      <view class="editor-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <text class="editor-title">编辑客户</text>
          <text class="editor-close" @tap="closeEditor">关闭</text>
        </view>
        <scroll-view class="editor-body" scroll-y @touchmove.stop>
          <view class="editor-grid">
            <view class="editor-field">
              <text class="editor-label">客户姓名</text>
              <uni-easyinput class="editor-input" type="text" v-model="editForm.userName" :inputBorder="false" />
            </view>
            <view class="editor-field">
              <text class="editor-label">配送单价</text>
              <uni-easyinput class="editor-input" type="digit" v-model="editForm.unitPrice" :inputBorder="false" />
            </view>
            <view class="editor-field">
              <text class="editor-label">手机号</text>
              <uni-easyinput class="editor-input" type="number" v-model="editForm.phone" :inputBorder="false" />
            </view>
            <view class="editor-field editor-field-full">
              <text class="editor-label">配送地址</text>
              <uni-easyinput class="editor-input" type="text" v-model="editForm.address" :inputBorder="false" />
            </view>
            <view class="editor-field editor-field-full">
              <text class="editor-label">备注</text>
              <uni-easyinput class="editor-input" type="text" v-model="editForm.notes" :inputBorder="false" />
            </view>
            <view class="editor-field editor-field-full">
              <text class="editor-label">结算方式</text>
              <view class="editor-settle-row">
                <view v-for="item in settleEditOptions" :key="item.value" class="editor-settle-chip" :class="{ 'editor-settle-chip-active': editForm.settlementType === item.value }" @tap="editForm.settlementType = item.value">
                  <text>{{ item.label }}</text>
                </view>
              </view>
            </view>
          </view>
        </scroll-view>
        <view class="editor-footer">
          <view class="editor-delete-btn" @tap="confirmDelete">删除客户</view>
          <button class="editor-save-btn" @tap="submitEdit">保存修改</button>
        </view>
      </view>
    </view>

    <view v-if="showBatchAddModal" class="editor-mask" @tap="closeBatchAddModal" @touchmove.stop.prevent>
      <view class="batch-add-modal" @tap.stop @touchmove.stop>
        <view class="editor-header">
          <text class="editor-title">批量新增客户</text>
          <text class="editor-close" @tap="closeBatchAddModal">关闭</text>
        </view>
        <scroll-view class="batch-add-body" scroll-y @touchmove.stop>
          <view v-if="batchSuccessMsg" class="success-banner">
            <text class="success-icon"></text>
            <view><text class="success-title">{{ batchSuccessMsg }}</text><text class="success-sub">客户账号可立即用于智能匹配和日结/月结核算。</text></view>
          </view>
          <view v-if="batchError" class="error-banner"><text>{{ batchError }}</text></view>
          <view class="batch-card">
            <textarea class="batch-textarea" :rows="4" maxlength="-1" v-model="batchText" placeholder="每行一个：客户名 单价 结算方式；如：张三 3.0 日结" placeholder-class="input-placeholder" />
            <button class="parse-btn" @tap="handleParseBatch">解析客户</button>
          </view>
          <view v-if="parsedBatchUsers.length > 0" class="result-card">
            <text class="result-title">解析数据</text>
            <view v-for="(u, idx) in parsedBatchUsers" :key="u.id || `parsed-${idx}`" class="result-row">
              <text class="result-line">{{ formatDuplicateUserLine(u) }}</text>
              <view class="result-delete-btn" @tap="handleDeleteParsedUser(u.id)">删除</view>
            </view>
            <button class="btn-confirm-batch" @tap="handleConfirmBatchUsers">确认批量新增 {{ parsedBatchUsers.length }} 位客户</button>
          </view>
        </scroll-view>
      </view>
    </view>

    <view v-if="showDuplicateModal" class="duplicate-modal-mask" @tap.stop @touchmove.stop.prevent>
      <view class="duplicate-modal" @tap.stop @touchmove.stop>
        <text class="duplicate-modal-title">以下数据重复提交了</text>
        <scroll-view class="duplicate-modal-list" scroll-y @touchmove.stop>
          <view v-if="duplicateLines.length > 0" class="duplicate-modal-section">
            <text class="duplicate-modal-section-title">重复数据</text>
            <text v-for="(line, idx) in duplicateLines" :key="`duplicate-${idx}`" class="duplicate-modal-line">{{ line }}</text>
          </view>
          <view v-if="uniqueLines.length > 0" class="duplicate-modal-section">
            <text class="duplicate-modal-section-title">未重复数据</text>
            <text v-for="(line, idx) in uniqueLines" :key="`unique-${idx}`" class="duplicate-modal-line">{{ line }}</text>
          </view>
        </scroll-view>
        <view class="duplicate-modal-actions">
          <view class="duplicate-modal-btn duplicate-modal-btn-muted" @tap="resolveDuplicateModal(false)">关闭</view>
          <view class="duplicate-modal-btn duplicate-modal-btn-primary" @tap="resolveDuplicateModal(true)">提交未重复</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from '../../common/store.js'
import { formatMoney, parseBatchUsersText } from '../../common/utils.js'

const store = useStore()
const { state, updateCustomer, deleteCustomer, addBatchUsers } = store
const canManageData = computed(() => state.currentUser?.userName === 'chen')

const keyword = ref('')
const settleFilter = ref('all')
const showEditor = ref(false)
const showBatchAddModal = ref(false)
const showDuplicateModal = ref(false)
const editingCustomerId = ref('')
const batchText = ref('')
const parsedBatchUsers = ref([])
const batchSuccessMsg = ref('')
const batchError = ref('')
const duplicateLines = ref([])
const uniqueLines = ref([])
let duplicateModalResolver = null
const editForm = ref({
  userName: '',
  unitPrice: '',
  phone: '',
  address: '',
  notes: '',
  settlementType: 'daily'
})
const settleOptions = [
  { value: 'all', label: '全部' },
  { value: 'daily', label: '日结' },
  { value: 'monthly', label: '月结' }
]
const settleEditOptions = [
  { value: 'daily', label: '日结' },
  { value: 'monthly', label: '月结' }
]

const duplicateBatchUsers = computed(() =>
  parsedBatchUsers.value.filter(u => u.duplicateInDatabase || u.duplicateInBatch)
)
const nonDuplicateBatchUsers = computed(() =>
  parsedBatchUsers.value.filter(u => !u.duplicateInDatabase && !u.duplicateInBatch)
)

const customerList = computed(() => state.users.filter(user => !user.isAdmin))
const dailyCount = computed(() => customerList.value.filter(user => user.settlementType === 'daily').length)
const monthlyCount = computed(() => customerList.value.filter(user => user.settlementType === 'monthly').length)

const filteredCustomers = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  return customerList.value.filter(customer => {
    const matchSettle = settleFilter.value === 'all' || customer.settlementType === settleFilter.value
    if (!matchSettle) return false
    if (!search) return true
    const haystack = [customer.userName, customer.address, customer.phone].map(v => String(v || '').toLowerCase()).join(' ')
    return haystack.includes(search)
  })
})

const formatPrice = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0
}

const formatDuplicateUserLine = (user) => {
  if (!user) return ''
  if (typeof user === 'string') return user
  const userName = user.userName || ''
  const unitPrice = Number(user.unitPrice)
  const settlement = user.settlementType === 'monthly' ? '月结' : '日结'
  const priceText = formatMoney(unitPrice)
  return `${userName} ${priceText} ${settlement}`.trim()
}

const showDuplicateAlert = (users = [], uniqueUsers = []) => new Promise((resolve) => {
  duplicateLines.value = users.map(formatDuplicateUserLine).filter(Boolean)
  uniqueLines.value = uniqueUsers.map(formatDuplicateUserLine).filter(Boolean)
  duplicateModalResolver = resolve
  showDuplicateModal.value = true
})

const resolveDuplicateModal = (shouldSubmit) => {
  showDuplicateModal.value = false
  const resolver = duplicateModalResolver
  duplicateModalResolver = null
  duplicateLines.value = []
  uniqueLines.value = []
  if (resolver) resolver(!!shouldSubmit)
}

const refreshBatchDuplicateFlags = () => {
  const usernameCountMap = new Map()
  parsedBatchUsers.value.forEach(user => {
    const usernameKey = (user.userName || '').trim().toLowerCase()
    usernameCountMap.set(usernameKey, (usernameCountMap.get(usernameKey) || 0) + 1)
  })
  parsedBatchUsers.value = parsedBatchUsers.value.map(user => {
    const usernameKey = (user.userName || '').trim().toLowerCase()
    const duplicateUserNameInBatch = (usernameCountMap.get(usernameKey) || 0) > 1
    return {
      ...user,
      duplicateUserNameInBatch,
      duplicateInBatch: duplicateUserNameInBatch
    }
  })
}

const openEditor = (customer) => {
  if (!canManageData.value) return
  editingCustomerId.value = customer._id || ''
  editForm.value = {
    userName: customer.userName || '',
    unitPrice: String(formatPrice(customer.unitPrice)),
    phone: customer.phone || '',
    address: customer.address || '',
    notes: customer.notes || '',
    settlementType: customer.settlementType === 'monthly' ? 'monthly' : 'daily'
  }
  showEditor.value = true
}

const closeEditor = () => {
  showEditor.value = false
  editingCustomerId.value = ''
}

const openBatchAddModal = () => {
  if (!canManageData.value) return
  batchError.value = ''
  batchSuccessMsg.value = ''
  batchText.value = ''
  parsedBatchUsers.value = []
  showBatchAddModal.value = true
}

const closeBatchAddModal = () => {
  showBatchAddModal.value = false
}

const handleParseBatch = () => {
  batchError.value = ''
  if (!batchText.value.trim()) { batchError.value = '请输入批量创建客户文本'; return }
  const list = parseBatchUsersText(batchText.value, state.users)
  if (list.length === 0) batchError.value = '未能识别出任何客户、单价和结算方式，请检查格式'
  else {
    parsedBatchUsers.value = list
    refreshBatchDuplicateFlags()
  }
}

const handleDeleteParsedUser = (id) => {
  parsedBatchUsers.value = parsedBatchUsers.value.filter(user => user.id !== id)
  refreshBatchDuplicateFlags()
}

const handleConfirmBatchUsers = async () => {
  if (parsedBatchUsers.value.length === 0) { batchError.value = '请先解析客户文本'; return }
  const invalidUser = parsedBatchUsers.value.find(u => !u.userName || !u.userName.trim() || Number(u.unitPrice) < 0)
  if (invalidUser) {
    batchError.value = '批量列表中存在空客户名或负数单价，请修正后再提交'
    return
  }
  let submitUsers = parsedBatchUsers.value
  if (duplicateBatchUsers.value.length > 0) {
    const shouldSubmitUnique = await showDuplicateAlert(duplicateBatchUsers.value, nonDuplicateBatchUsers.value)
    if (!shouldSubmitUnique) return
    submitUsers = nonDuplicateBatchUsers.value
    if (submitUsers.length === 0) return
  }
  const res = await addBatchUsers(submitUsers)
  if (!res.success) {
    batchError.value = res.message || '批量开户失败'
    return
  }
  batchSuccessMsg.value = `批量操作成功！已新增 ${res.addedCount} 位客户`
  parsedBatchUsers.value = []
  batchText.value = ''
  setTimeout(() => { batchSuccessMsg.value = '' }, 4000)
}

const submitEdit = async () => {
  const payload = {
    ...editForm.value,
    unitPrice: Number(editForm.value.unitPrice || 0)
  }
  const result = await updateCustomer(editingCustomerId.value, payload)
  if (!result.success) {
    uni.showModal({ title: '保存失败', content: result.message || '更新客户失败', showCancel: false })
    return
  }
  closeEditor()
}

const confirmDelete = () => {
  uni.showModal({
    title: '确认删除',
    content: '删除后无法恢复，确认删除这个客户吗？',
    confirmColor: '#dc2626',
    success: async ({ confirm }) => {
      if (!confirm) return
      const result = await deleteCustomer(editingCustomerId.value)
      if (!result.success) {
        uni.showModal({ title: '删除失败', content: result.message || '删除客户失败', showCancel: false })
        return
      }
      closeEditor()
    }
  })
}
</script>

<style lang="scss" scoped>
.customer-list-page{min-height:100vh;background:linear-gradient(180deg,#f8fbfa 0%,#f2f6f9 100%);display:flex;flex-direction:column}
.no-permission{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center}
.no-perm-icon{font-size:32px;margin-bottom:12px}.no-perm-title{font-size:16px;font-weight:700;color:#1e293b}
.no-perm-desc{font-size:12px;color:#94a3b8;margin-top:8px;max-width:260px;line-height:1.5}
.customer-scroll{flex:1}.customer-inner{padding:16px;display:flex;flex-direction:column;gap:14px}
.summary-band{display:grid;grid-template-columns:repeat(3,1fr);background:linear-gradient(135deg,#109579,#14b8a6);border-radius:20px;padding:16px 10px;box-shadow:0 14px 28px rgba(16,185,129,.16)}
.summary-item{display:flex;flex-direction:column;align-items:center;gap:4px;color:#fff}
.summary-divider{border-left:1px solid rgba(255,255,255,.16)}
.summary-label{font-size:10px;color:rgba(255,255,255,.78)}
.summary-value{font-size:18px;font-weight:900;font-family:monospace}
.summary-value-emerald{color:#d1fae5}.summary-value-indigo{color:#dbeafe}
.toolbar-card{background:#fff;border:1px solid #e8eef5;border-radius:18px;padding:14px;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.search-wrap{margin-bottom:12px}
.search-input .uni-easyinput__content{border:1px solid #dbe4ee !important;border-radius:14px;background:#eee;min-height:42px;padding:0 12px}
.search-input .uni-easyinput__content-input{height:42px;font-size:14px;color:#1e293b;background:transparent}
.filter-row{display:flex;gap:8px}
.filter-chip{flex:1;text-align:center;padding:9px 0;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;font-weight:700;color:#475569}
.filter-chip-active{background:#0f766e;color:#fff;border-color:#0f766e}
.section-head{display:flex;align-items:center;justify-content:space-between;padding:0 4px}.section-head-right{display:flex;align-items:center;gap:10px}
.section-title{font-size:12px;font-weight:800;color:#334155}.section-count{font-size:10px;color:#94a3b8}.batch-add-btn{padding:6px 10px;border-radius:10px;background:#ecfdf5;border:1px solid #a7f3d0;font-size:11px;font-weight:800;color:#047857;line-height:1.2}
.empty-state{padding:40px 20px;text-align:center;background:#fff;border:1px solid #e8eef5;border-radius:18px;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.empty-icon{font-size:30px;display:block;margin-bottom:8px}.empty-title{font-size:14px;font-weight:700;color:#334155;display:block}.empty-desc{font-size:11px;color:#94a3b8;display:block;margin-top:6px}
.customer-list{display:flex;flex-direction:column;gap:12px}
.customer-card{background:#fff;border:1px solid #e8eef5;border-radius:18px;padding:16px;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.customer-card-top{display:flex;align-items:center;gap:12px}
.customer-main{flex:1;min-width:0}.customer-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.customer-name{font-size:14px;font-weight:800;color:#1e293b}
.settle-tag{font-size:9px;font-weight:800;padding:3px 8px;border-radius:999px}
.tag-daily{background:#ecfdf5;color:#059669;border:1px solid #d1fae5}
.tag-monthly{background:#eff6ff;color:#2563eb;border:1px solid #dbeafe}
.price-box{min-width:72px;text-align:right;flex-shrink:0}.price-label{display:block;font-size:9px;color:#94a3b8}.price-value{display:block;margin-top:2px;font-size:15px;font-weight:900;color:#dc2626;font-family:monospace}
.customer-edit-btn{padding:4px 10px;border-radius:999px;background:#eff6ff;border:1px solid #dbeafe;font-size:10px;font-weight:800;color:#2563eb;line-height:1.2}
.customer-meta-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:8px;margin-top:14px}
.meta-item{padding:10px 12px;background:#f8fafc;border:1px solid #e8eef5;border-radius:14px;min-width:0}.meta-item-compact{text-align:left}
.meta-label{display:block;font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:4px}.meta-value{display:block;font-size:12px;color:#334155;line-height:1.5;word-break:break-all}
.editor-mask{position:fixed;inset:0;background:rgba(15,23,42,.52);z-index:120;display:flex;align-items:flex-start;justify-content:center;padding:20px 20px 24px;box-sizing:border-box}.editor-modal{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:24px;padding:18px 16px 16px;border:1px solid rgba(226,232,240,.9);box-shadow:0 24px 60px rgba(15,23,42,.24);display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box}.editor-header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid #f1f5f9}.editor-title{font-size:16px;font-weight:800;color:#1e293b}.editor-close{font-size:11px;font-weight:800;color:#059669;background:#ecfdf5;padding:7px 12px;border-radius:999px;flex-shrink:0}.editor-body{flex:1;min-height:0;padding-top:12px}.editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.editor-field{min-width:0}.editor-field-full{grid-column:1 / -1}.editor-label{display:block;font-size:10px;font-weight:700;color:#64748b;margin-bottom:6px}.editor-input .uni-easyinput__content{border:1px solid #dbe4ee !important;border-radius:14px;background:#eee;min-height:40px;padding:0 12px}.editor-input .uni-easyinput__content-input{height:40px;font-size:13px;color:#1e293b;background:transparent}.editor-settle-row{display:flex;gap:8px}.editor-settle-chip{flex:1;text-align:center;padding:10px 0;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:12px;font-weight:800;color:#475569}.editor-settle-chip-active{background:#0f766e;border-color:#0f766e;color:#fff}.editor-footer{display:flex;align-items:center;gap:10px;padding-top:14px;border-top:1px solid #f1f5f9;margin-top:12px}.editor-delete-btn{height:44px;padding:0 16px;border-radius:14px;background:#fff1f2;border:1px solid #fecdd3;color:#dc2626;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;white-space:nowrap}.editor-save-btn{flex:1;height:44px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:16px;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.batch-add-modal{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:24px;padding:18px 16px 16px;border:1px solid rgba(226,232,240,.9);box-shadow:0 24px 60px rgba(15,23,42,.24);display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box}.batch-add-body{flex:1;min-height:0;padding-top:12px}.success-banner{padding:14px;background:#ecfdf5;border:1px solid #d1fae5;border-radius:12px;display:flex;align-items:flex-start;gap:12px;font-size:14px;color:#065f46;margin-bottom:16px}.success-icon{width:20px;height:20px;background:#10b981;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px}.success-title{font-weight:700;display:block}.success-sub{font-size:13px;color:#059669;margin-top:2px;display:block}.error-banner{padding:12px;background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;font-size:14px;color:#dc2626;margin-bottom:16px;display:flex;align-items:center;gap:8px}.batch-card{background:#fff;border-radius:18px;border:1px solid #e8eef5;box-shadow:0 8px 22px rgba(15,23,42,.04);padding:18px;border-color:#e8eef5;min-width:0;overflow:hidden}.batch-textarea{display:block;width:calc(100% - 26px);max-width:calc(100% - 26px);padding:12px;background:#eee;border:1px solid #dbe4ee;border-radius:14px;font-size:14px;font-family:monospace;color:#1e293b;resize:none}.input-placeholder{color:#cbd5e1}.parse-btn{width:100%;height:40px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:12px;font-size:13px;font-weight:700;margin-top:10px;display:flex;align-items:center;justify-content:center;letter-spacing:0;box-shadow:0 8px 16px rgba(16,185,129,.14)}.result-card{background:#fff;border-radius:18px;border:1px solid #e8eef5;box-shadow:0 8px 22px rgba(15,23,42,.04);padding:16px;margin-top:12px}.result-title{display:block;font-size:12px;font-weight:800;color:#1e293b;margin-bottom:10px}.result-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}.result-line{display:block;flex:1;min-width:0;font-size:13px;font-weight:700;color:#334155}.result-delete-btn{flex-shrink:0;padding:6px 10px;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;font-size:12px;font-weight:800;color:#dc2626}.btn-confirm-batch{width:100%;height:44px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:16px;font-size:14px;font-weight:800;margin-top:0;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 10px 20px rgba(16,185,129,.16)}.duplicate-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.52);z-index:130;display:flex;align-items:flex-start;justify-content:center;padding:20px 24px 24px;box-sizing:border-box}.duplicate-modal{width:100%;max-width:560px;background:#fff;border-radius:24px;padding:18px 16px 16px;border:1px solid rgba(226,232,240,.9);box-shadow:0 24px 60px rgba(15,23,42,.24);box-sizing:border-box}.duplicate-modal-title{display:block;font-size:15px;font-weight:800;color:#1e293b}.duplicate-modal-list{max-height:320px;margin-top:12px;padding:2px 0 4px}.duplicate-modal-section+.duplicate-modal-section{margin-top:12px}.duplicate-modal-section-title{display:block;font-size:12px;font-weight:800;color:#64748b;margin-bottom:4px}.duplicate-modal-line{display:block;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#334155}.duplicate-modal-actions{display:flex;gap:10px;margin-top:14px}.duplicate-modal-btn{flex:1;height:44px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}.duplicate-modal-btn-muted{background:#f8fafc;border:1px solid #e2e8f0;color:#475569}.duplicate-modal-btn-primary{background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.safe-bottom{height:32px}
</style>
