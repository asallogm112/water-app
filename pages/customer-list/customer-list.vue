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
          <text class="section-count">当前 {{ filteredCustomers.length }} 位</text>
        </view>

        <view v-if="filteredCustomers.length === 0" class="empty-state">
          <text class="empty-icon">📄</text>
          <text class="empty-title">没有匹配的客户</text>
          <text class="empty-desc">请修改搜索关键词或切换结算方式筛选。</text>
        </view>

        <view v-else class="customer-list">
          <view v-for="customer in filteredCustomers" :key="customer._id || customer.username || customer.name" class="customer-card">
            <view class="customer-card-top">
              <view class="customer-main">
                <view class="customer-name-row">
                  <text class="customer-name">{{ customer.name }}</text>
                  <text class="settle-tag" :class="customer.settlementType === 'monthly' ? 'tag-monthly' : 'tag-daily'">
                    {{ customer.settlementType === 'monthly' ? '月结' : '日结' }}
                  </text>
                </view>
              </view>
              <view class="price-box">
                <text class="price-label">单价</text>
                <text class="price-value">¥{{ formatPrice(customer.unitPrice) }}</text>
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
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useStore } from '../../common/store.js'

const store = useStore()
const { state } = store

const keyword = ref('')
const settleFilter = ref('all')
const settleOptions = [
  { value: 'all', label: '全部' },
  { value: 'daily', label: '日结' },
  { value: 'monthly', label: '月结' }
]

const customerList = computed(() => state.users.filter(user => !user.isAdmin))
const dailyCount = computed(() => customerList.value.filter(user => user.settlementType === 'daily').length)
const monthlyCount = computed(() => customerList.value.filter(user => user.settlementType === 'monthly').length)

const filteredCustomers = computed(() => {
  const search = keyword.value.trim().toLowerCase()
  return customerList.value.filter(customer => {
    const matchSettle = settleFilter.value === 'all' || customer.settlementType === settleFilter.value
    if (!matchSettle) return false
    if (!search) return true
    const haystack = [customer.name, customer.address, customer.username, customer.phone].map(v => String(v || '').toLowerCase()).join(' ')
    return haystack.includes(search)
  })
})

const formatPrice = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
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
.section-head{display:flex;align-items:center;justify-content:space-between;padding:0 4px}
.section-title{font-size:12px;font-weight:800;color:#334155}.section-count{font-size:10px;color:#94a3b8}
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
.customer-meta-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:8px;margin-top:14px}
.meta-item{padding:10px 12px;background:#f8fafc;border:1px solid #e8eef5;border-radius:14px;min-width:0}.meta-item-compact{text-align:left}
.meta-label{display:block;font-size:9px;color:#94a3b8;font-weight:700;margin-bottom:4px}.meta-value{display:block;font-size:12px;color:#334155;line-height:1.5;word-break:break-all}
.safe-bottom{height:32px}
</style>
