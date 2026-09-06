<template>
  <view class="page-container user-add-page">
    <!-- 权限检查 -->
    <view v-if="!state.currentUser?.isAdmin" class="no-permission">
      <text class="no-perm-icon">🛡️</text>
      <text class="no-perm-title">无访问权限</text>
      <text class="no-perm-desc">批量开户仅限管理员账号访问。</text>
    </view>

    <scroll-view v-else class="form-scroll" :scroll-y="!showDuplicateModal">
      <view class="form-inner">
        <view v-if="successMsg" class="success-banner">
          <text class="success-icon">✓</text>
          <view><text class="success-title">{{ successMsg }}</text><text class="success-sub">客户账号可立即用于智能匹配和日结/月结核算。</text></view>
        </view>
        <view v-if="error" class="error-banner"><text>{{ error }}</text></view>

        <view class="card batch-card">
          <textarea class="batch-textarea" :rows="4" maxlength="-1" v-model="batchText" placeholder="每行一个：客户名 单价 结算方式；如：张三 3.0 日结" placeholder-class="input-placeholder" />
          <button class="parse-btn" @tap="handleParseBatch">解析客户</button>
        </view>
        <view v-if="parsedBatchUsers.length > 0" class="card result-card">
          <text class="result-title">解析数据</text>
          <view v-for="(u, idx) in parsedBatchUsers" :key="u.id || `parsed-${idx}`" class="result-row">
            <text class="result-line">{{ formatDuplicateUserLine(u) }}</text>
            <view class="result-delete-btn" @tap="handleDeleteParsedUser(u.id)">删除</view>
          </view>
          <button class="btn-confirm-batch" @tap="handleConfirmBatchUsers">确认批量新增 {{ parsedBatchUsers.length }} 位客户</button>
        </view>
        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

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
const { state, addBatchUsers } = store

const batchText = ref('')
const parsedBatchUsers = ref([])
const successMsg = ref(''); const error = ref('')
const showDuplicateModal = ref(false)
const duplicateLines = ref([])
const uniqueLines = ref([])
let duplicateModalResolver = null

const duplicateBatchUsers = computed(() =>
  parsedBatchUsers.value.filter(u => u.duplicateInDatabase || u.duplicateInBatch)
)
const nonDuplicateBatchUsers = computed(() =>
  parsedBatchUsers.value.filter(u => !u.duplicateInDatabase && !u.duplicateInBatch)
)
const duplicateBatchCount = computed(() => duplicateBatchUsers.value.length)
const validBatchCount = computed(() => Math.max(0, parsedBatchUsers.value.length - duplicateBatchCount.value))

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

const handleParseBatch = () => {
  error.value = ''
  if (!batchText.value.trim()) { error.value = '请输入批量创建客户文本'; return }
  const list = parseBatchUsersText(batchText.value, state.users)
  if (list.length === 0) error.value = '未能识别出任何客户、单价和结算方式，请检查格式'
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
  if (parsedBatchUsers.value.length === 0) { error.value = '请先解析客户文本'; return }
  const invalidUser = parsedBatchUsers.value.find(u => !u.userName || !u.userName.trim() || Number(u.unitPrice) < 0)
  if (invalidUser) {
    error.value = '批量列表中存在空客户名或负数单价，请修正后再提交'
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
    error.value = res.message || '批量开户失败'
    return
  }
  successMsg.value = `批量操作成功！已新增 ${res.addedCount} 位客户`
  parsedBatchUsers.value = []; batchText.value = ''
  setTimeout(() => { successMsg.value = '' }, 4000)
}

</script>

<style lang="scss" scoped>
.user-add-page{min-height:100vh;background:linear-gradient(180deg,#f8fbfa 0%,#f2f6f9 100%);display:flex;flex-direction:column}
.no-permission{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center}
.no-perm-icon{font-size:32px;margin-bottom:12px}.no-perm-title{font-size:16px;font-weight:700;color:#1e293b}
.no-perm-desc{font-size:12px;color:#94a3b8;margin-top:8px;max-width:260px;line-height:1.5}
.form-scroll{flex:1}.form-inner{padding:16px;display:flex;flex-direction:column;gap:14px}
.card{background:#fff;border-radius:18px;border:1px solid #e8eef5;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.success-banner{padding:14px;background:#ecfdf5;border:1px solid #d1fae5;border-radius:12px;display:flex;align-items:flex-start;gap:12px;font-size:14px;color:#065f46;margin-bottom:16px}
.success-icon{width:20px;height:20px;background:#10b981;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:2px}
.success-title{font-weight:700;display:block}.success-sub{font-size:13px;color:#059669;margin-top:2px;display:block}
.error-banner{padding:12px;background:#fef2f2;border:1px solid #fee2e2;border-radius:12px;font-size:14px;color:#dc2626;margin-bottom:16px;display:flex;align-items:center;gap:8px}
.batch-card{padding:18px;border-color:#e8eef5;min-width:0;overflow:hidden}
.batch-textarea{display:block;width:calc(100% - 26px);max-width:calc(100% - 26px);padding:12px;background:#eee;border:1px solid #dbe4ee;border-radius:14px;font-size:14px;font-family:monospace;color:#1e293b;resize:none}
.input-placeholder{color:#cbd5e1}
.batch-hint{font-size:10px;color:#94a3b8;display:block;margin-top:4px}
.parse-btn{width:100%;height:40px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:12px;font-size:13px;font-weight:700;margin-top:10px;display:flex;align-items:center;justify-content:center;letter-spacing:0;box-shadow:0 8px 16px rgba(16,185,129,.14)}
.result-card{padding:16px}.result-title{display:block;font-size:12px;font-weight:800;color:#1e293b;margin-bottom:10px}.result-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}.result-line{display:block;flex:1;min-width:0;font-size:13px;font-weight:700;color:#334155}.result-delete-btn{flex-shrink:0;padding:6px 10px;background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;font-size:12px;font-weight:800;color:#dc2626}
.btn-confirm-batch{width:100%;height:44px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:16px;font-size:14px;font-weight:800;margin-top:0;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.duplicate-modal-mask{position:fixed;inset:0;background:rgba(15,23,42,.52);z-index:130;display:flex;align-items:flex-start;justify-content:center;padding:20px 24px 24px;box-sizing:border-box}.duplicate-modal{width:100%;max-width:560px;background:#fff;border-radius:24px;padding:18px 16px 16px;border:1px solid rgba(226,232,240,.9);box-shadow:0 24px 60px rgba(15,23,42,.24);box-sizing:border-box}.duplicate-modal-title{display:block;font-size:15px;font-weight:800;color:#1e293b}.duplicate-modal-list{max-height:320px;margin-top:12px;padding:2px 0 4px}.duplicate-modal-section+.duplicate-modal-section{margin-top:12px}.duplicate-modal-section-title{display:block;font-size:12px;font-weight:800;color:#64748b;margin-bottom:4px}.duplicate-modal-line{display:block;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:14px;font-weight:700;color:#334155}.duplicate-modal-actions{display:flex;gap:10px;margin-top:14px}.duplicate-modal-btn{flex:1;height:44px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800}.duplicate-modal-btn-muted{background:#f8fafc;border:1px solid #e2e8f0;color:#475569}.duplicate-modal-btn-primary{background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.safe-bottom{height:32px}
</style>
