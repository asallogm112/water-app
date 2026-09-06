<template>
	<view class="page-container login-page">
		<view class="login-wrapper">
			<view class="hero-panel">
				<view class="brand-header">
					<text class="brand-title">桶装水业务管理系统</text>
					<text class="brand-subtitle">管理员工作台</text>
				</view>
				<view class="hero-metrics">
					<view class="hero-metric"><text class="hero-metric-value">订单</text><text
							class="hero-metric-label">录入与汇总</text></view>
					<view class="hero-metric"><text class="hero-metric-value">客户</text><text
							class="hero-metric-label">开户与对账</text></view>
					<view class="hero-metric"><text class="hero-metric-value">账单</text><text
							class="hero-metric-label">汇总与统计</text></view>
				</view>
			</view>
			<view class="login-card card">
				<view class="login-card-head">
					<text class="login-card-title">账号登录</text>
					<text class="login-card-subtitle">输入管理员账号和密码进入工作台</text>
				</view>
				<view v-if="loggingIn" class="loading-hint"><text>⏳ 正在验证…</text></view>
				<view v-if="error" class="error-banner">
					<text class="error-banner-text">⚠️ {{ error }}</text>
					<button class="error-copy-btn" @tap="copyError">复制内容</button>
				</view>
				<view class="login-form" v-if="!loggingIn">
					<view class="form-group">
						<text class="form-label">账号</text>
						<uni-easyinput class="login-input" type="text" v-model="userName"
							placeholder="输入登录账号" :inputBorder="false" />
					</view>
					<view class="form-group">
						<text class="form-label">密码</text>
						<uni-easyinput class="login-input" type="password" v-model="password"
							placeholder="输入登录密码" :inputBorder="false" />
					</view>
					<button class="btn-login-submit" @tap="handlePasswordLogin">立即登录</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		useStore
	} from '../../common/store.js'

	const SAVED_USERNAME_KEY = 'saved_username'

	export default {
		setup() {
			const {
				state,
				loginWithPassword,
				restoreSession
			} = useStore()
			return {
				state,
				loginWithPassword,
				restoreSession
			}
		},
		data() {
			return {
				userName: '',
				password: '',
				error: '',
				loggingIn: false,
				checkingSession: false
			}
		},
		onLoad() {
			// 填充上次记住的账号
			try {
				const saved = uni.getStorageSync(SAVED_USERNAME_KEY)
				if (saved) this.userName = saved
			} catch (e) {}
			// 已有登录会话则自动进入首页，无需重新登录
			this.checkingSession = true
			this.restoreSession().then((hasSession) => {
				if (hasSession) {
					uni.reLaunch({
						url: '/pages/home/home'
					})
				}
			}).catch(() => {}).finally(() => {
				this.checkingSession = false
			})
		},
		methods: {
			async handlePasswordLogin() {
				this.error = '';
				uni.hideKeyboard()
				this.loggingIn = true
				try {
					const result = await this.loginWithPassword(this.userName, this.password)
					if (result.success) {
						// 记住账号，下次自动填充
						uni.setStorageSync(SAVED_USERNAME_KEY, String(this.userName || '').trim())
						this.password = ''
						uni.hideKeyboard()
						uni.reLaunch({
							url: '/pages/home/home'
						})
					}
					else this.error = result.error
				} catch (e) {
					this.error = e && (e.message || e.errMsg) ? String(e.message || e.errMsg) : '登录失败，请稍后重试'
				} finally {
					this.loggingIn = false
				}
			},
			copyError() {
				if (!this.error) return
				uni.setClipboardData({
					data: this.error,
					success: () => {
						uni.showToast({ title: '已复制', icon: 'none' })
					}
				})
			}
		}
	}
</script>

<style lang="scss">
	.login-page {
		min-height: 100vh;
		background: radial-gradient(circle at top, rgba(16, 185, 129, .14), transparent 34%), linear-gradient(180deg, #fbfffd 0%, #edf5f1 100%);
		display: flex;
		align-items: stretch;
		justify-content: flex-start;
	}

	.login-wrapper {
		width: 100%;
		max-width: 412px;
		padding: 10px 15px 15px;
		margin: 0 auto;
	}

	.hero-panel {
		background: linear-gradient(135deg, #0f766e 0%, #109579 52%, #1fbe8f 100%);
		border-radius: 26px;
		padding: 14px 22px 20px 22px;
		box-shadow: 0 18px 38px rgba(15, 118, 110, .16);
		margin-bottom: 16px;
	}

	.brand-header {
		text-align: center;
	}

	.brand-logo-text {
		font-size: 34px;
	}

	.brand-title {
		display: block;
		font-size: 23px;
		font-weight: 800;
		color: #fff;
	}

	.brand-subtitle {
		display: block;
		font-size: 12px;
		color: rgba(255, 255, 255, .78);
		margin-top: 6px;
	}

	.hero-metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-top: 18px;
	}

	.hero-metric {
		background: rgba(255, 255, 255, .12);
		border: 1px solid rgba(255, 255, 255, .1);
		border-radius: 14px;
		padding: 11px 8px;
		text-align: center;
	}

	.hero-metric-value {
		display: block;
		font-size: 15px;
		font-weight: 800;
		color: #fff;
	}

	.hero-metric-label {
		display: block;
		margin-top: 4px;
		font-size: 11px;
		color: rgba(255, 255, 255, .76);
	}

	.login-card {
		background: rgba(255, 255, 255, .98);
		border-radius: 22px;
		padding: 24px 20px 20px;
		box-shadow: 0 14px 30px rgba(15, 23, 42, .07);
		border: 1px solid rgba(226, 232, 240, .8);
	}

	.login-card-head {
		margin-bottom: 18px;
	}

	.login-card-title {
		display: block;
		text-align: center;
		font-size: 20px;
		font-weight: 800;
		color: #0f172a;
	}

	.login-card-subtitle {
		display: block;
		text-align: center;
		font-size: 11px;
		color: #94a3b8;
		margin-top: 5px;
	}

	.loading-hint {
		text-align: center;
		padding: 20px 0;
		color: #10b981;
		font-size: 16px;
	}

	.error-banner {
		padding: 12px;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 12px;
		color: #dc2626;
		font-size: 15px;
		margin-bottom: 16px;
		line-height: 1.5;
	}

	.error-banner-text {
		display: block;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.error-copy-btn {
		margin-top: 10px;
		height: 34px;
		line-height: 34px;
		padding: 0 12px;
		background: #fff;
		color: #b91c1c;
		border: 1px solid #fecaca;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 700;
	}

	.login-form {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 7px;
	}

	.form-label {
		font-size: 14px;
		font-weight: 700;
		color: #475569;
		padding-left: 2px;
	}

	.login-input {
		width: 100%;
	}

	.login-input .uni-easyinput__content {
		border: 1px solid #dbe4ee;
		border-radius: 14px;
		background: #eee;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, .65);
	}

	.login-input .uni-easyinput__content-input {
		height: 44px;
		font-size: 16px;
		color: #0f172a;
		caret-color: #0f766e;
	}

	.login-input-placeholder {
		color: #a3b2c2;
	}

	.btn-login-submit {
		width: 100%;
		height: 44px;
		background: linear-gradient(135deg, #0f766e, #10b981);
		color: #fff;
		border: none;
		border-radius: 14px;
		font-size: 16px;
		font-weight: 800;
		margin-top: 4px;
		box-shadow: 0 8px 18px rgba(16, 185, 129, .18);
	}

	.btn-login-submit:active {
		opacity: .96;
		transform: translateY(1px);
	}
</style>
