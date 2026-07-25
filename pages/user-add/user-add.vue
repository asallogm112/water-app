<template>
  <view class="page-container user-add-page">
    <!-- 权限检查 -->
    <view v-if="!state.currentUser?.isAdmin" class="no-permission">
      <text class="no-perm-icon">🛡️</text>
      <text class="no-perm-title">无访问权限</text>
      <text class="no-perm-desc">管理员新增用户页仅限超级管理员角色访问。请使用 admin 账号登录。</text>
    </view>

    <scroll-view v-else class="form-scroll" scroll-y>
      <view class="form-inner">
        <view v-if="successMsg" class="success-banner">
          <text class="success-icon"></text>
          <view><text class="success-title">{{ successMsg }}</text><text class="success-sub">客户账号可立即用于智能匹配和日结/月结核算。</text></view>
        </view>
        <view v-if="error" class="error-banner"><text>{{ error }}</text></view>

        <view class="card batch-card">
          <textarea class="batch-textarea" :rows="4" v-model="batchText" placeholder="每行一个：客户名 单价 结算方式；如：张三 3.0 日结" placeholder-class="input-placeholder" />
          <button class="parse-btn" @tap="handleParseBatch">解析客户</button>
        </view>
        <view class="safe-bottom"></view>
      </view>
    </scroll-view>

    <view v-if="showBatchPopup" class="batch-popup-mask" @tap="showBatchPopup = false">
      <view class="batch-popup" @tap.stop>
        <view class="batch-popup-header">
          <view>
            <text class="batch-popup-title">批量开户结果</text>
          </view>
          <text class="batch-popup-close" @tap="showBatchPopup = false">完成</text>
        </view>
        <scroll-view class="batch-popup-list" scroll-y>
          <view v-for="(u, idx) in parsedBatchUsers" :key="idx" class="batch-preview-item">
            <text class="batch-preview-line">{{ u.name }} {{ Number(u.unitPrice).toFixed(1) }}元/桶 {{ u.settlementType === 'monthly' ? '月结' : '日结' }}</text>
          </view>
        </scroll-view>
        <view class="batch-popup-footer">
          <button class="btn-confirm-batch" @tap="handleConfirmBatchUsers">确认批量新增 {{ parsedBatchUsers.length }} 位客户</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from '../../common/store.js'
import { parseBatchUsersText } from '../../common/utils.js'

const store = useStore()
const { state, addBatchUsers } = store

const batchText = ref('')
const parsedBatchUsers = ref([])
const successMsg = ref(''); const error = ref('')
const showBatchPopup = ref(false)

const duplicateBatchUsers = computed(() =>
  parsedBatchUsers.value.filter(u => u.duplicateInDatabase || u.duplicateInBatch)
)
const duplicateBatchCount = computed(() => duplicateBatchUsers.value.length)
const validBatchCount = computed(() => Math.max(0, parsedBatchUsers.value.length - duplicateBatchCount.value))

const showDuplicateAlert = (names = []) => {
  const preview = names.slice(0, 6).join('、')
  const extra = names.length > 6 ? ` 等 ${names.length} 个客户` : ''
  uni.showModal({
    title: '发现重复客户',
    content: preview ? `${preview}${extra} 已存在或重复，请修改后再提交。` : '存在重复客户，请修改后再提交。',
    showCancel: false,
    confirmText: '知道了'
  })
}

const refreshBatchDuplicateFlags = () => {
  const usernameCountMap = new Map()
  const nameCountMap = new Map()
  parsedBatchUsers.value.forEach(user => {
    const usernameKey = (user.username || '').toLowerCase()
    const nameKey = (user.name || '').trim().toLowerCase()
    usernameCountMap.set(usernameKey, (usernameCountMap.get(usernameKey) || 0) + 1)
    nameCountMap.set(nameKey, (nameCountMap.get(nameKey) || 0) + 1)
  })
  parsedBatchUsers.value = parsedBatchUsers.value.map(user => {
    const usernameKey = (user.username || '').toLowerCase()
    const nameKey = (user.name || '').trim().toLowerCase()
    const duplicateUsernameInBatch = (usernameCountMap.get(usernameKey) || 0) > 1
    const duplicateNameInBatch = (nameCountMap.get(nameKey) || 0) > 1
    return {
      ...user,
      duplicateUsernameInBatch,
      duplicateNameInBatch,
      duplicateInBatch: duplicateUsernameInBatch || duplicateNameInBatch
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
    showBatchPopup.value = true
  }
}
const handleConfirmBatchUsers = async () => {
  if (parsedBatchUsers.value.length === 0) { error.value = '请先解析客户文本'; return }
  const invalidUser = parsedBatchUsers.value.find(u => !u.name || !u.name.trim() || !u.username || !u.username.trim() || Number(u.unitPrice) < 0)
  if (invalidUser) {
    error.value = '批量列表中存在空客户名、空账号或负数单价，请修正后再提交'
    return
  }
  if (duplicateBatchUsers.value.length > 0) {
    showDuplicateAlert(duplicateBatchUsers.value.map(u => u.name || u.username))
    return
  }
  const res = await addBatchUsers(parsedBatchUsers.value)
  if (!res.success) {
    error.value = '批量开户失败，请稍后重试'
    return
  }
  if (res.skippedCount > 0) {
    showDuplicateAlert(res.duplicateUsers)
  }
  successMsg.value = `批量操作成功！已新增 ${res.addedCount} 位客户`
  parsedBatchUsers.value = []; batchText.value = ''
  setTimeout(() => { successMsg.value = '' }, 4000)
}

</script>

<style lang="scss" scoped>
.user-add-page{min-height:100vh;background:linear-gradient(180deg,#f8fbfa 0%,#f1f5f9 100%);display:flex;flex-direction:column}
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
.parse-btn{width:100%;height:40px;background:linear-gradient(135deg,#0f766e,#14b8a6);color:#fff;border-radius:12px;font-size:13px;font-weight:700;margin-top:10px;display:flex;align-items:center;justify-content:center;letter-spacing:0;box-shadow:0 8px 16px rgba(20,184,166,.14)}
.batch-popup-mask{position:fixed;inset:0;background:rgba(15,23,42,.52);z-index:120;display:flex;align-items:center;justify-content:center;padding:33px 28px}
.batch-popup{width:100%;max-width:560px;max-height:100%;background:#fff;border-radius:24px;padding:18px 16px 16px;box-shadow:0 24px 60px rgba(15,23,42,.24);display:flex;flex-direction:column;border:1px solid rgba(226,232,240,.9);box-sizing:border-box;overflow:hidden}
.batch-popup-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid #f1f5f9}
.batch-popup-title{display:block;font-size:14px;font-weight:800;color:#1e293b}
.batch-popup-close{font-size:11px;font-weight:800;color:#059669;background:#ecfdf5;padding:7px 12px;border-radius:999px;flex-shrink:0}
.batch-popup-list{flex:1;min-height:0;padding-top:10px;padding-bottom:12px;box-sizing:border-box}
.batch-preview-item{background:#f8fafc;padding:14px 16px;border-radius:16px;margin-bottom:10px;border:1px solid #e6edf4}
.batch-preview-line{display:block;font-size:14px;font-weight:700;color:#1e293b}
.batch-popup-footer{padding-top:12px;border-top:1px solid #f1f5f9;background:#fff}
.btn-confirm-batch{width:100%;height:44px;background:linear-gradient(135deg,#0f766e,#10b981);color:#fff;border-radius:16px;font-size:14px;font-weight:800;margin-top:0;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 10px 20px rgba(16,185,129,.16)}
.safe-bottom{height:32px}
</style>
