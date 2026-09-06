<template>
  <view class="page-container profile-page">
    <scroll-view class="profile-content" scroll-y>
      <view class="profile-inner">
        <view class="card user-card">
          <view class="user-card-top">
            <view class="user-avatar">👤</view>
            <view>
				<text class="user-name">{{ state.currentUser?.userName }} <text v-if="state.currentUser?.isAdmin" class="admin-badge">🛡️ 管理员</text></text>
              <text class="user-account">账号: @{{ state.currentUser?.userName }}</text>
            </view>
          </view>
          <view class="user-details">
            <view class="user-detail-item"><text>📱</text><text>{{ state.currentUser?.phone || '未设置' }}</text></view>
            <view class="user-detail-item"><text>📍</text><text>{{ state.currentUser?.address || '未设置' }}</text></view>
            <view v-if="!state.currentUser?.isAdmin" class="user-price-grid">
              <view class="user-price-item"><text class="user-price-label">预设配送单价</text><text class="user-price-value">¥{{ formatMoney(state.currentUser?.unitPrice) }} 元/桶</text></view>
              <view class="user-price-item"><text class="user-price-label">结算方式</text><text class="user-price-value text-emerald">{{ state.currentUser?.settlementType === 'monthly' ? '📘 月结用户' : '📗 日结用户' }}</text></view>
            </view>
          </view>
        </view>
        <view v-if="!state.currentUser?.isAdmin" class="card stats-card">
          <text class="stats-card-title">🛒 我的历史配送数据</text>
          <view class="stats-grid">
            <view class="stats-item"><text class="stats-item-label">累计购水</text><text class="stats-item-value">{{ myTotalDelivered }} <text class="stats-item-unit">桶</text></text></view>
            <view class="stats-item"><text class="stats-item-label">累计回桶</text><text class="stats-item-value">{{ myTotalReturned }} <text class="stats-item-unit">个</text></text></view>
            <view class="stats-item"><text class="stats-item-label">累计金额</text><text class="stats-item-value stats-item-value-green">¥{{ formatMoney(myTotalRevenue) }}</text></view>
          </view>
          <view v-if="myOutstandingEmptyBuckets > 0" class="bucket-warning"><text>⚠️ 您尚有 {{ myOutstandingEmptyBuckets }} 个空水桶未退还归仓。</text></view>
        </view>
        <view class="platform-info">
          <text class="platform-title">系统信息</text>
          <text class="platform-item">• 数据存储: uniCloud 云端数据库</text>
          <text class="platform-item">• 客户总数: {{ state.users.length }} 人 · 总订单: {{ state.orders.length }} 笔</text>
        </view>
        <button class="btn-logout" @tap="handleLogout">退出登录</button>
        <view class="safe-bottom"></view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '../../common/store.js'
import { formatMoney } from '../../common/utils.js'

const store = useStore()
const { state, logout } = store
const myOrders = computed(() => state.orders.filter(o => o.userName === state.currentUser?.userName))
const myTotalRevenue = computed(() => myOrders.value.reduce((s, o) => s + o.totalAmount, 0))
const myTotalDelivered = computed(() => myOrders.value.reduce((s, o) => s + o.quantity, 0))
const myTotalReturned = computed(() => myOrders.value.reduce((s, o) => s + o.returnedBuckets, 0))
const myOutstandingEmptyBuckets = computed(() => Math.max(0, myTotalDelivered.value - myTotalReturned.value))

const handleLogout = () => { logout(); uni.reLaunch({ url: '/pages/login/login' }) }
</script>

<style lang="scss" scoped>
.profile-page{min-height:100vh;background:linear-gradient(180deg,#f8fbfa 0%,#f2f6f9 100%);display:flex;flex-direction:column}
.profile-content{flex:1}.profile-inner{padding:16px}
.card{background:#fff;border-radius:18px;border:1px solid #e8eef5;padding:18px;margin-bottom:16px;box-shadow:0 8px 22px rgba(15,23,42,.04)}
.user-card{position:relative;overflow:hidden}
.user-card::before{content:'';position:absolute;right:0;top:0;width:96px;height:96px;background:rgba(16,185,129,.06);border-radius:50%;transform:translate(24px,-24px)}
.user-card-top{display:flex;align-items:center;gap:12px}
.user-avatar{width:50px;height:50px;border-radius:18px;background:linear-gradient(135deg,#d1fae5,#ecfdf5);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
.user-name{font-size:14px;font-weight:700;color:#1e293b}
.admin-badge{font-size:9px;background:#fef3c7;color:#b45309;padding:2px 6px;border-radius:999px;font-weight:900}
.user-account{font-size:10px;color:#94a3b8;font-family:monospace;margin-top:2px;display:block}
.user-details{margin-top:12px;padding-top:12px;border-top:1px solid #f1f5f9}
.user-detail-item{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#475569;margin-bottom:8px}
.user-price-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
.user-price-item{padding:10px;background:#f8fafc;border:1px solid #e8eef5;border-radius:14px}
.user-price-label{font-size:9px;color:#94a3b8;font-weight:600;display:block}
.user-price-value{font-size:12px;font-weight:700;color:#334155;margin-top:2px;display:block}
.text-emerald{color:#059669}
.stats-card-title{font-size:10px;font-weight:700;color:#334155;display:block;margin-bottom:8px}
.stats-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.stats-item{padding:12px 10px;background:#f8fafc;border:1px solid #e8eef5;border-radius:14px;text-align:center}
.stats-item-label{font-size:8px;color:#94a3b8;font-weight:500;display:block}
.stats-item-value{font-size:14px;font-weight:800;color:#1e293b;font-family:monospace}
.stats-item-unit{font-size:9px;font-weight:400;color:#94a3b8}
.stats-item-value-green{color:#059669}
.bucket-warning{margin-top:8px;padding:8px;background:#fef2f2;border-radius:12px;font-size:10px;color:#dc2626;text-align:center;font-weight:700}
.platform-info{padding:16px;background:rgba(248,250,252,.92);border:1px solid #e8eef5;border-radius:18px;margin-bottom:16px;box-shadow:0 8px 22px rgba(15,23,42,.03)}
.platform-title{font-size:8px;font-weight:700;color:#64748b;display:block;margin-bottom:4px}
.platform-item{font-size:10px;color:#94a3b8;display:block;margin-top:2px}
.btn-logout{width:100%;height:44px;background:#fef2f2;color:#dc2626;border:1px solid #fecdd3;border-radius:14px;font-size:13px;font-weight:700;box-shadow:0 8px 18px rgba(239,68,68,.08)}
.safe-bottom{height:32px}
</style>
