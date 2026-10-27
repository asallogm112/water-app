---
name: 纯付款(0 0 X)应收必须恒为0
description: 送水0且回桶0的付款订单，应收金额必须恒为0，绝不允许把实收当应收；getOrderReceivableAmount 中 quantity<=0 判定须优先于未知客户回退实收分支
type: feedback
---

送水数=0 且 回桶=0 的订单就是**付款**（如 `0 0 100`、`1027 0 0 220`），其**应收金额必须恒为 0**（= 0 × 单价）。任何情况下都绝不允许把 `实收金额` 当成 `应收` 返回。

**Why:** 用户 2026-10-27 输入 `0 0 100`，该客户未设单价，`common/utils.js` 的 `getOrderReceivableAmount` 旧逻辑在「未知客户回退实收金额」分支里先 `return actual`（100），导致应收被 +100，严重违反「付款只进实收、不进应收」红线，用户强烈不满。

**How to apply:** `getOrderReceivableAmount(order)` 必须把 `if (quantity <= 0) return 0` 放在函数最前面，优先于「未知客户回退实收」分支。任何新增/修改应收计算的地方（订单列表、按人对账的 `getReceivableAmount` 等都调用此函数）都不得对 quantity<=0 的订单回退到 `actualAmountReceived`。改完务必用 `0 0 100`（且客户无单价）场景自测应收=0、实收=100。
