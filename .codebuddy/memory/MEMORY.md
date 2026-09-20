# MEMORY（长期记忆）

## 用户偏好
- **绝对不要乱改逻辑**：用户单人使用的小程序，改动必须可控；UI 优化只动视觉，不碰数据流/交互逻辑
- **需求模糊时先问清再动手**，严格按字面要求改，不要自行扩大改动范围（顺序/文案/导出等都别"顺手统一"）；改错了用户会很愤怒
- **杂事页（现名"工资报销"）规则**：无 segment 切换，列表工资+报销混排；编辑报销时金额锁定只改事项，新增报销才从内容提取金额；报销紫/工资橙颜色语义不变
- **UI 风格基准**：用户满意 uni-agent 时期开发的风格，优化时以 home / order-list / customer-list 三页为设计基准，向它们对齐，而不是另起炉灶
- unicloud 按量收费，尽量减少不必要的数据请求（单人操作，不要频繁刷新拉取）
- 沟通用简体中文

## 项目设计基准 Token（2026-09-06 全站统一后）
- 页面背景：`linear-gradient(180deg,#f8fbfa 0%,#f2f6f9 100%)`；App.vue page 底色 `#f8fbfa`
- 卡片 .card：`#fff` / r18 / 边框 `#e8eef5` / 阴影 `0 8px 22px rgba(15,23,42,.04)`
- Hero 渐变：`linear-gradient(135deg,#109579,#14b8a6)`
- 主按钮渐变：`linear-gradient(135deg,#0f766e,#10b981)` + 阴影 `0 10px 20px rgba(16,185,129,.16)`
- 主按钮规格：h44 / r16 / fs14 / w800；小型解析按钮 h38/r12/fs12/w800
- 大表单弹窗遮罩 `rgba(15,23,42,.52)`、容器 r24；轻面板遮罩 `.42`、面板 r20
- 日期切换按钮：`#fff` / 边框 `#e2e8f0` / h34 / r12 / 阴影 `0 6px 16px rgba(15,23,42,.04)`
- 输入框：底 `#eee` / r14 / 边框 `#dbe4ee`（App.vue 全局有 `#eee !important` 兜底）
- 字号：弹窗标题 16px/w800、summary-title 14px/w700、section-title 10px、关闭钮 11px/w800/r999
- 页面左右 padding 16px
- 功能色：杂事页拉水紫 `#7c3aed`、回桶橙 `#ea580c`（保留，不要统一掉）

## 环境：Git 推送（重要）
- 本机代理软件是**自由猫（ziyoumaoC），监听 `127.0.0.1:7892`**；环境变量里残留的 `HTTP_PROXY=127.0.0.1:7890` 是错的（会导致 "Failed to connect to 127.0.0.1:7890"）
- **正确的推送命令**（用真实端口、屏蔽错误环境变量）：
  `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY git -c http.proxy=http://127.0.0.1:7892 -c https.proxy=http://127.0.0.1:7892 push origin main`
- **不要加 `-c http.version=HTTP/1.1`**（会导致 `SSL_ERROR_SYSCALL`）；不加即可成功
- 远程：https://github.com/asallogm112/water-app.git，主分支 main
- 已发布 tag：v5.0（工资报销初版）、v10.0（所有功能完善，含工资报销）

## 数据同步策略（用户红线，2026-09-20 定案）
- **只有「输入账号密码登录」和「首页 ↻ 刷新按钮」允许请求服务器**；所有页面进入（onShow/onMounted/onLoad）**一律不请求**
- 登录后自动执行一次全量同步（`refreshAll({ skipUsers: true })`，4 次请求：login/order/mergeStatus/misc）；**自动登录 restoreSession 不请求**
- 页面进入只读本机缓存/storage；`store.refreshAll()` = 全量同步（客户+订单+合并状态+工资报销），并把合并状态、工资报销写入本机 storage
- 写操作（增删改订单/客户/工资报销）仍会请求云端（数据准确性必需）
- 因此：换手机/首次使用后，需要**手动点一次首页刷新**才能拿到云端数据

## 成本约束（用户红线）
- **uniCloud 按请求次数计费**，用户反复强调：**单人使用，本机与服务器数据 99% 一致，绝不能每次进页面都请求云端**
- 页面级"已加载"标记（组件内 ref）**无效**（navigateTo 会重建组件）→ 必须用 **store.js 模块级幂等标记**
- 已有幂等方法：`ensureBootstrapLoaded()` / `ensureMergeStatusList()` / `ensureMiscRecordsLoaded()`（命中缓存返回 `{success:true, cached:true}`）
- 允许真实请求的场景：写操作后的刷新、用户主动下拉刷新、合并状态变更后
- 用户说的"黑色加载框"= `uni.showToast` 的黑底白字提示（不是 showLoading，项目里没有 showLoading）

## 技术要点
- **数据存储**：订单/客户/合并状态/工资报销全部走 uniCloud 云对象 `waterService`（集合：order_list、user_list、admin_list、order_merge_status、misc_record_list）；本机 storage 仅作缓存兜底
- **⚠️ 行尾陷阱**：`index.obj.js`、`store.js` 等是**混合行尾**（CRLF+LF），`replace_in_file` 会统一成 LF 造成全文件 diff。改这类文件必须 `git checkout` 恢复后用 python 二进制插入（沿用原位行尾）
- 大段 replace 后必须验证语法闭合（lint 抓不到半个未闭合函数，需括号配对扫描）——曾因残留半个函数整包编译失败
- common/ 只有 JS（store/utils/export-excel），无公共样式文件，样式是各页复制粘贴的，改 token 需逐页同步
- 存储 key：杂事 `misc_records_v2`；登录信息已做本地持久化（不每次重登）
- 按人对账备注解析规则（2026-09-13 最终版）：
  - **写了两个数字** → 严格按位置：第 1 个=拉水、第 2 个=回桶（0 是占位符，代表该项没问题、不计算）
  - **只写一个数字** → 必须写「拉水」或「回桶」关键词指明项目（只写"回桶"→回桶，只写"拉水"→拉水，两个都写按拉水）；**没有关键词 → 当普通备注，直接显示原文**
  - 非拉水回桶的备注（纯文字、无法判定）→ 直接显示备注原文
  - 颜色=盈亏语义（客户少记拉水=红亏钱，客户少记回桶=绿占便宜）；"多记/少记"文案
  - 能解析且差值全 0 → 不显示（数据没问题）
