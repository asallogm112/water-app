---
name: 付款记录时间必须是当前日期时间
description: 创建付款记录时 paidDate 必须设为记录生成的当前日期时间(年月日-时分秒)，绝不能用所关联订单的 MMDD 日期
type: feedback
---

创建付款记录(`createPaymentRecord`)时,`paidDate`(记录时间/主显示时间)必须设为**记录被创建的当前日期时间**(`formatBeijingDateTime(new Date())`,含 年月日-时分秒)。绝不允许把 `paidDate` 设为所关联订单的日期(如 `item.customDate` / `item.createdDate` 的 MMDD)。

**Why:** 用户 2026-10-27 录入 `1027 0 0 220`,付款记录页顶部显示的却是订单的 MMDD 日期(10月27),而不是实际录入当天(如 10月29)。根因:`batch-order-add.vue` 与 `user-monthly-summary.vue` 创建付款记录时把 `paidDate` 传成了订单日期;`payment-records.vue` 顶部显示 `rec.paidDate || rec.createdAt`,于是优先显示了订单日期。用户明确要求付款记录时间=当前日期时间。

**How to apply:** 任何创建付款记录的地方:
- `paidDate` = `formatBeijingDateTime(new Date())`(当前日期时间,带时分秒)
- `orderDate` 才保留订单的 MMDD 日期(只是关联信息,在卡片底部「订单日期」单独展示,不参与记录时间)
- 不要动 `createdAt`(本来就是 new Date())。改完确认付款记录页顶部显示的日期 = 录入当天,而非订单 MMDD。
