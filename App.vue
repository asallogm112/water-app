<script>
	import { useStore } from './common/store.js'

	export default {
		onLaunch: function() {
			const { restoreSession } = useStore()
			restoreSession().then((hasSession) => {
				uni.reLaunch({
					url: hasSession ? '/pages/home/home' : '/pages/login/login'
				})
			}).catch(() => {
				uni.reLaunch({
					url: '/pages/login/login'
				})
			})
		},
		onShow: function() {},
		onHide: function() {}
	}
</script>

<style>
page {
  background-color: #f8fbfa;
}

text,
button,
input,
textarea,
picker,
label,
.uni-easyinput__content-input,
.uni-easyinput__placeholder-class {
  font-size: 1em !important;
}

input,
textarea,
.uni-easyinput__content {
  background-color: #eee !important;
  border-radius: 14px;
}

.uni-easyinput__content.is-focused {
  background-color: #eee !important;
}

/* uni-easyinput 紧凑模式 */
.easy-input-num { width: 100%; }
.easy-input-num .uni-easyinput__content-input { height: 35px; font-size: 14px; }
.item-grid-easy { width: 100%; }
.item-grid-easy .uni-easyinput__content { min-height: 0; padding: 0; }
.item-grid-easy .uni-easyinput__content-input { height: 30px; font-size: 12px; min-height: 0; }
.batch-price-easy { width: 100%; }
.batch-price-easy .uni-easyinput__content { min-height: 0; padding: 0; }
.batch-price-easy .uni-easyinput__content-input { height: 28px; font-size: 12px; min-height: 0; }
.price-input { width: 100%; }
.price-input .uni-easyinput__content { min-height: 0; padding: 0; }
.search-input .uni-easyinput__content-input { height: 34px; font-size: 14px; }
.search-input .uni-easyinput__content { min-height: 0; padding: 0; }
.login-input { width: 100%; }
.login-input .uni-easyinput__content-input { height: 42px; font-size: 15px; }
.item-date-input { flex: 1; }
.item-date-input .uni-easyinput__content { min-height: 0; padding: 0; }
.item-date-input .uni-easyinput__content-input { height: 28px; font-size: 12px; min-height: 0; }
.item-name-input { flex: 1; }
.item-name-input .uni-easyinput__content { min-height: 0; padding: 0; }
.item-name-input .uni-easyinput__content-input { height: 32px; font-size: 13px; min-height: 0; }
</style>
