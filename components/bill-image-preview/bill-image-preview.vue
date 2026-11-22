<template>
  <view v-if="visible" class="bip-mask" @touchmove.stop.prevent>
    <view class="bip-panel" @tap.stop>
      <view class="bip-header">
        <text class="bip-title">{{ title }}</text>
        <text class="bip-close" @tap="$emit('close')">关闭</text>
      </view>
      <view class="bip-toolbar">
        <text class="bip-count">共 {{ files.length }} 张 · 已选 {{ selectedCount }} 张</text>
        <view class="bip-actions">
          <text class="bip-action" @tap="selectAll(true)">全选</text>
          <text class="bip-action" @tap="selectAll(false)">全不选</text>
        </view>
      </view>
      <scroll-view class="bip-list" scroll-y>
        <view
          v-for="(item, index) in files"
          :key="item.path"
          class="bip-item"
          :class="{ 'bip-item-off': !item.selected }"
        >
          <view class="bip-thumb" @tap="zoom(index)">
            <image class="bip-image" :src="item.path" mode="aspectFill" />
            <text class="bip-hint">点图放大</text>
          </view>
          <view class="bip-item-footer" @tap="toggle(index)">
            <text class="bip-label">{{ item.label }}</text>
            <view class="bip-check" :class="{ 'bip-check-on': item.selected }">
              <text v-if="item.selected" class="bip-check-mark">✓</text>
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="bip-footer">
        <view class="bip-export" :class="{ 'bip-export-off': saving }" @tap="save">
          <text>{{ saving ? '保存中…' : '导出所选到相册' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { saveBillImageFiles } from '../../common/daily-bill-image.js'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '图片预览' },
  files: { type: Array, default: () => [] }
})
const emit = defineEmits(['close', 'saved'])

const saving = ref(false)
const selectedCount = computed(() => props.files.filter(item => item.selected).length)

const toggle = (index) => {
  const item = props.files[index]
  if (item) item.selected = !item.selected
}
const selectAll = (selected) => {
  props.files.forEach(item => { item.selected = selected })
}
const zoom = (index) => {
  const urls = props.files.map(item => item.path)
  if (urls.length) uni.previewImage({ current: index, urls })
}
const save = async () => {
  if (saving.value) return
  if (selectedCount.value === 0) {
    uni.showToast({ title: '请至少选择一张图片', icon: 'none' })
    return
  }
  saving.value = true
  uni.showLoading({ title: `保存 0/${selectedCount.value}`, mask: true })
  try {
    const saved = await saveBillImageFiles(props.files, (done, total) => {
      uni.showLoading({ title: `保存 ${done}/${total}`, mask: true })
    })
    emit('saved', saved)
  } catch (error) {
    uni.showToast({ title: error?.message || '保存到相册失败', icon: 'none' })
  } finally {
    uni.hideLoading()
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.bip-mask { position: fixed; inset: 0; background: rgba(15,23,42,.62); z-index: 200; }
.bip-panel { width: 100%; height: 100vh; background: #f8fafc; display: flex; flex-direction: column; box-sizing: border-box; }
.bip-header { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; background: #fff; border-bottom: 1px solid #e2e8f0; }
.bip-title { font-size: 16px; font-weight: 800; color: #1e293b; }
.bip-close { font-size: 12px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 7px 14px; border-radius: 999px; }
.bip-toolbar { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center; padding: 12px 18px; background: #fff; border-bottom: 1px solid #e2e8f0; }
.bip-count { font-size: 12px; font-weight: 700; color: #475569; }
.bip-actions { display: flex; gap: 8px; }
.bip-action { font-size: 12px; font-weight: 700; color: #0f766e; padding: 6px 12px; border: 1px solid #99f6e4; border-radius: 999px; background: #f0fdfa; }
.bip-list { flex-shrink: 0; height: calc(100vh - 250px); padding: 14px 16px; box-sizing: border-box; }
.bip-item { display: inline-block; width: calc(50% - 7px); margin: 0 14px 14px 0; vertical-align: top; background: #fff; border: 2px solid #10b981; border-radius: 16px; overflow: hidden; box-shadow: 0 6px 18px rgba(15,23,42,.06); box-sizing: border-box; }
.bip-item:nth-child(2n) { margin-right: 0; }
.bip-item-off { border-color: #cbd5e1; opacity: .5; }
.bip-thumb { position: relative; width: 100%; height: 200px; background: #e2e8f0; overflow: hidden; }
.bip-image { width: 100%; height: 100%; display: block; }
.bip-hint { position: absolute; right: 8px; bottom: 8px; font-size: 10px; font-weight: 700; color: #fff; background: rgba(15,23,42,.55); padding: 3px 8px; border-radius: 999px; }
.bip-item-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-top: 1px solid #f1f5f9; }
.bip-label { font-size: 12px; font-weight: 700; color: #334155; }
.bip-check { width: 22px; height: 22px; border-radius: 6px; border: 2px solid #cbd5e1; display: flex; align-items: center; justify-content: center; background: #fff; }
.bip-check-on { border-color: #10b981; background: #10b981; }
.bip-check-mark { color: #fff; font-size: 14px; font-weight: 800; }
.bip-footer { flex-shrink: 0; padding: 12px 16px 20px; background: #fff; border-top: 1px solid #e2e8f0; box-sizing: border-box; }
.bip-export { height: 46px; border-radius: 16px; background: linear-gradient(135deg,#0f766e,#10b981); box-shadow: 0 10px 20px rgba(16,185,129,.16); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #fff; }
.bip-export-off { opacity: .5; }
</style>
