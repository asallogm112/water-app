---
name: 纯付款(0 0 X)应收必须恒为0
description: 送水0且回桶0的付款订单，应收金额必须恒为0，绝不允许把实收当应收；getOrderReceivableAmount 中 quantity<=0 判定须优先于未知客户回退实收分支
type: feedback
---

送水数=0 且 回桶=0 的订单就是**付款**（如 `0 0 100`、`1027 0 0 220`），其**应收金额必须恒为 0**（= 0 × 单价）。任何情况下都绝不允许把 `实收金额` 当成 `应收` 返回。

**Why:** 用户 2026-10-27 输入 `0 0 100`，该客户未设单价，`common/utils.js` 的 `getOrderReceivableAmount` 旧逻辑在「未知客户回退实收金额」分支里先 `return actual`（100），导致应收被 +100，严重违反「付款只进实收、不进应收」红线，用户强烈不满。

**How to apply:** `getOrderReceivableAmount(order)` 必须把 `if (quantity <= 0) return 0` 放在函数最前面，优先于「未知客户回退实收」分支。任何新增/修改应收计算的地方（订单列表、按人对账的 `getReceivableAmount` 等都调用此函数）都不得对 quantity<=0 的订单回退到 `actualAmountReceived`。改完务必用 `0 0 100`（且客户无单价）场景自测应收=0、实收=100。

## ⚠️ 二次踩坑（2026-11-03）：order-list.vue 的 `getReceivableAmount` 包装函数也有同样的兜底陷阱
- **现象**：`pages/order-list/order-list.vue` 的 `getReceivableAmount` 旧逻辑：
  ```
  const receivable = getOrderReceivableAmount(order, ...)   // 付款记录返回 0（qty0，utils 已正确）
  if (receivable > 0) return receivable
  return getActualPaidAmount(order)                          // ← 付款记录应收=0 时掉进这里，返回 实收=200，被误计入应收
  ```
  导致订单列表「当日应收」/「应收总金额」把付款 200 算成了应收，违反红线。用户 2026-11-03 为此大怒。
- **根因**：utils 本身已修对（qty0→0），但 order-list 在自己这一层又加了「应收为 0 时回退实收」的兜底，把付款记录漏掉了。
- **修复**：`getReceivableAmount` 第一行加 `if (isPaymentOrder(order)) return 0`（isPaymentOrder = 数量0 且 回桶0 且 实收>0），付款记录直接返回 0，绝不再走兜底。
- **How to apply（务必记住）**：`monthly-summary.vue`、`user-monthly-summary.vue`、`stats.vue` 的应收都**直接调用 `getOrderReceivableAmount`**，无此陷阱，正确。只有 order-list 的包装函数有兜底——以后改应收相关，**任何页面只要出现「应收为 0 时回退实收」的写法，都必须先用 `isPaymentOrder(order)` 拦截付款记录返回 0**。自测：`0 0 200` 在订单列表的「应收」必须显示 0、「实收」200、「应收总金额」不含 200。
