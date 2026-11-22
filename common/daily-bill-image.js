/**
 * 每日账单图导出（微信小程序 canvas 2d）
 * 把一个月的每一天各画成一张图片，逐张保存到手机相册
 */

const PAGE_WIDTH = 750
const LINE_HEIGHT = 40
const TOP_HEIGHT = 260
const BOTTOM_HEIGHT = 80
const PADDING = 24

const SUMMARY_TOP_HEIGHT = 200
const SUMMARY_TOTAL_LINE_HEIGHT = 42

function formatMoney(value) {
  const num = Number(value)
  return (Number.isFinite(num) ? num : 0).toFixed(2)
}

function getCanvasNode(selector) {
  return new Promise((resolve, reject) => {
    uni.createSelectorQuery()
      .select(selector)
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res && res[0] && res[0].node
        if (node) resolve(node)
        else reject(new Error('账单画布未就绪，请稍后重试'))
      })
  })
}

function ensureAlbumAuth() {
  return new Promise((resolve, reject) => {
    uni.getSetting({
      success: (setting) => {
        if (setting.authSetting && setting.authSetting['scope.writePhotosAlbum']) {
          resolve()
          return
        }
        uni.authorize({
          scope: 'scope.writePhotosAlbum',
          success: () => resolve(),
          fail: () => reject(new Error('需要授权保存到相册，请在设置中开启「保存到相册」权限'))
        })
      },
      fail: () => reject(new Error('无法读取相册权限设置'))
    })
  })
}

function drawDay(ctx, day, monthLabel, rows) {
  const height = TOP_HEIGHT + rows.length * LINE_HEIGHT + BOTTOM_HEIGHT
  ctx.clearRect(0, 0, PAGE_WIDTH, height)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAGE_WIDTH, height)

  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`${monthLabel} 送水账单`, PADDING, 50)

  ctx.fillStyle = '#475569'
  ctx.font = '26px sans-serif'
  ctx.fillText(`日期：${day.date}`, PADDING, 100)

  ctx.fillStyle = '#0f766e'
  ctx.font = 'bold 26px sans-serif'
  ctx.fillText(`发水 ${Number(day.quantity) || 0} 桶    回桶 ${Number(day.returnedBuckets) || 0} 个`, PADDING, 150)

  ctx.fillStyle = '#b91c1c'
  ctx.fillText(`应收 ¥${formatMoney(day.totalAmount)}`, PADDING, 195)
  ctx.fillStyle = '#b91c1c'
  ctx.fillText(`欠款 ¥${formatMoney(day.totalAmount - day.actualAmount)}`, 400, 195)

  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING, 225)
  ctx.lineTo(PAGE_WIDTH - PADDING, 225)
  ctx.stroke()

  ctx.fillStyle = '#64748b'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('客户', PADDING, 248)
  ctx.textAlign = 'right'
  ctx.fillText('发水', 380, 248)
  ctx.fillText('回桶', 490, 248)
  ctx.fillText('应收', 620, 248)
  ctx.fillText('欠款', PAGE_WIDTH - PADDING, 248)

  rows.forEach((row, index) => {
    const y = TOP_HEIGHT + index * LINE_HEIGHT + LINE_HEIGHT / 2
    if (index % 2 === 1) {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(PADDING, y - LINE_HEIGHT / 2, PAGE_WIDTH - PADDING * 2, LINE_HEIGHT)
    }
    ctx.font = '24px sans-serif'
    ctx.fillStyle = '#1e293b'
    ctx.textAlign = 'left'
    ctx.fillText(row.name || '', PADDING + 6, y)
    ctx.textAlign = 'right'
    ctx.fillText(String(row.quantity || 0), 380, y)
    ctx.fillText(String(row.returned || 0), 490, y)
    ctx.fillStyle = '#b91c1c'
    ctx.fillText(formatMoney(row.receivable), 620, y)
    ctx.fillStyle = '#b91c1c'
    ctx.fillText(formatMoney(row.receivable - row.actual), PAGE_WIDTH - PADDING, y)
  })

  const bottomY = TOP_HEIGHT + rows.length * LINE_HEIGHT
  ctx.strokeStyle = '#cbd5e1'
  ctx.beginPath()
  ctx.moveTo(PADDING, bottomY)
  ctx.lineTo(PAGE_WIDTH - PADDING, bottomY)
  ctx.stroke()

  ctx.fillStyle = '#475569'
  ctx.textAlign = 'left'
  ctx.fillText(`共 ${rows.length} 位客户`, PADDING, bottomY + BOTTOM_HEIGHT / 2)

  return height
}

function drawSummary(ctx, monthLabel, summary) {
  const persons = Array.isArray(summary?.persons) ? summary.persons : []
  const totals = summary?.totals || {}
  const totalLines = [
    { label: '总发水桶数', value: `${Number(totals.quantity) || 0} 桶`, color: '#1e293b' },
    { label: '总回桶数', value: `${Number(totals.returned) || 0} 个`, color: '#1e293b' },
    { label: '应收款', value: `¥${formatMoney(totals.receivable)}`, color: '#b91c1c' },
    { label: '实收款', value: `¥${formatMoney(totals.actual)}`, color: '#047857' },
    { label: '剩余欠款金额', value: `¥${formatMoney(totals.debt)}`, color: '#b91c1c' }
  ]
  const totalsHeight = totalLines.length * SUMMARY_TOTAL_LINE_HEIGHT + 40
  const height = SUMMARY_TOP_HEIGHT + persons.length * LINE_HEIGHT + BOTTOM_HEIGHT + totalsHeight

  ctx.clearRect(0, 0, PAGE_WIDTH, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAGE_WIDTH, height)
  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(`${monthLabel} 月度统计`, PADDING, 50)

  ctx.fillStyle = '#64748b'
  ctx.font = '24px sans-serif'
  ctx.fillText(`共 ${persons.length} 位客户`, PADDING, 95)

  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING, 125)
  ctx.lineTo(PAGE_WIDTH - PADDING, 125)
  ctx.stroke()

  ctx.fillStyle = '#64748b'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('人员', PADDING, 150)
  ctx.textAlign = 'right'
  ctx.fillText('发水', 300, 150)
  ctx.fillText('回桶', 420, 150)
  ctx.fillText('欠款金额', 580, 150)
  ctx.fillText('欠桶数', PAGE_WIDTH - PADDING, 150)

  persons.forEach((person, index) => {
    const y = SUMMARY_TOP_HEIGHT + index * LINE_HEIGHT + LINE_HEIGHT / 2
    if (index % 2 === 1) {
      ctx.fillStyle = '#f8fafc'
      ctx.fillRect(PADDING, y - LINE_HEIGHT / 2, PAGE_WIDTH - PADDING * 2, LINE_HEIGHT)
    }
    ctx.font = '24px sans-serif'
    ctx.fillStyle = '#1e293b'
    ctx.textAlign = 'left'
    ctx.fillText(person.name || '', PADDING + 6, y)
    ctx.textAlign = 'right'
    ctx.fillText(String(person.quantity || 0), 300, y)
    ctx.fillText(String(person.returned || 0), 420, y)
    ctx.fillStyle = '#b91c1c'
    ctx.fillText(formatMoney(person.debt), 580, y)
    ctx.fillText(String(person.debtBuckets || 0), PAGE_WIDTH - PADDING, y)
  })

  const totalsTop = SUMMARY_TOP_HEIGHT + persons.length * LINE_HEIGHT + 20
  ctx.strokeStyle = '#cbd5e1'
  ctx.beginPath()
  ctx.moveTo(PADDING, totalsTop - 10)
  ctx.lineTo(PAGE_WIDTH - PADDING, totalsTop - 10)
  ctx.stroke()

  totalLines.forEach((line, index) => {
    const y = totalsTop + index * SUMMARY_TOTAL_LINE_HEIGHT + SUMMARY_TOTAL_LINE_HEIGHT / 2
    ctx.font = 'bold 26px sans-serif'
    ctx.fillStyle = '#475569'
    ctx.textAlign = 'left'
    ctx.fillText(line.label, PADDING + 6, y)
    ctx.fillStyle = line.color
    ctx.textAlign = 'right'
    ctx.fillText(line.value, PAGE_WIDTH - PADDING, y)
  })

  return height
}

function canvasToTempFile(canvas, height, dpr) {
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width: PAGE_WIDTH,
      height,
      destWidth: PAGE_WIDTH * dpr,
      destHeight: height * dpr,
      fileType: 'png',
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(new Error(err?.errMsg || '账单图生成失败'))
    })
  })
}

function saveToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: (err) => reject(new Error(err?.errMsg || '保存到相册失败'))
    })
  })
}

/**
 * 生成每日账单图临时文件（不保存相册），供预览后选择
 * @param {Object} options
 * @param {String} options.selector canvas 节点选择器
 * @param {String} options.monthLabel 月份标题，如 2026年11月
 * @param {Array} options.days 每天的账单数据
 * @param {Object} [options.summary] 月末统计页数据
 * @param {Function} [options.onProgress] 进度回调 (当前, 总数)
 * @returns {Array} [{ path, label, selected }]
 */
export async function generateDailyBillImageFiles({ selector, monthLabel, days = [], summary = null, onProgress }) {
  if (!Array.isArray(days) || days.length === 0) {
    throw new Error('该月份没有可导出的账单数据')
  }
  const canvas = await getCanvasNode(selector)
  const ctx = canvas.getContext('2d')
  const dpr = (uni.getSystemInfoSync().pixelRatio || 1)
  const totalSteps = days.length + (summary ? 1 : 0)
  const files = []
  let done = 0

  const render = async (height, draw, label) => {
    canvas.width = PAGE_WIDTH * dpr
    canvas.height = height * dpr
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    draw()
    const path = await canvasToTempFile(canvas, height, dpr)
    files.push({ path, label, selected: true })
    done += 1
    if (typeof onProgress === 'function') onProgress(done, totalSteps)
  }

  for (const day of days) {
    const rows = Array.isArray(day.rows) ? day.rows : []
    const height = TOP_HEIGHT + rows.length * LINE_HEIGHT + BOTTOM_HEIGHT
    await render(height, () => drawDay(ctx, day, monthLabel, rows), day.date)
  }

  if (summary) {
    const persons = Array.isArray(summary.persons) ? summary.persons : []
    const height = SUMMARY_TOP_HEIGHT + persons.length * LINE_HEIGHT + BOTTOM_HEIGHT + (5 * SUMMARY_TOTAL_LINE_HEIGHT + 40)
    await render(height, () => drawSummary(ctx, monthLabel, summary), '月度统计')
  }

  return files
}

/**
 * 把选中的账单图保存到相册
 * @param {Array} files generateDailyBillImageFiles 返回的列表（按 selected 过滤）
 * @param {Function} [onProgress] 进度回调 (当前, 总数)
 */
export async function saveBillImageFiles(files = [], onProgress) {
  const selected = files.filter(item => item && item.selected && item.path)
  if (selected.length === 0) return 0
  await ensureAlbumAuth()
  let done = 0
  for (const item of selected) {
    await saveToAlbum(item.path)
    done += 1
    if (typeof onProgress === 'function') onProgress(done, selected.length)
  }
  return done
}

const TABLE_LINE_HEIGHT = 38
const TABLE_TOP = 90

function cellText(cell) {
  if (cell && typeof cell === 'object' && !Array.isArray(cell)) return String(cell.value ?? '')
  return String(cell ?? '')
}

function cellStyle(cell) {
  return cell && typeof cell === 'object' && !Array.isArray(cell) ? (cell.style || '') : ''
}

function drawTableSheet(ctx, rows, title, maxColumns) {
  const height = TABLE_TOP + rows.length * TABLE_LINE_HEIGHT + 40
  ctx.clearRect(0, 0, PAGE_WIDTH, height)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, PAGE_WIDTH, height)
  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 30px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(title, PADDING, 45)

  const colWidth = (PAGE_WIDTH - PADDING * 2) / Math.max(maxColumns, 1)
  rows.forEach((row, rowIndex) => {
    const y = TABLE_TOP + rowIndex * TABLE_LINE_HEIGHT + TABLE_LINE_HEIGHT / 2
    const cells = Array.isArray(row) ? row : [row]
    cells.forEach((cell, colIndex) => {
      const text = cellText(cell)
      if (!text) return
      const style = cellStyle(cell)
      ctx.font = (style === 'title' ? 'bold 28px' : (style === 'header' ? 'bold 24px' : '22px')) + ' sans-serif'
      ctx.fillStyle = style === 'title' || style === 'monthly' || style === 'red'
        ? '#dc2626'
        : (style === 'green' ? '#059669' : (style === 'orange' ? '#ea580c' : (style === 'purple' ? '#7c3aed' : '#1e293b')))
      ctx.textAlign = colIndex === 0 ? 'left' : 'right'
      const x = colIndex === 0 ? PADDING + 4 : PADDING + colIndex * colWidth + colWidth - 8
      ctx.fillText(text, x, y)
    })
  })
  return height
}

/**
 * 通用表格 rows → 图片（供日账单/按人对账/数据报表导出）
 * @param {Object} options
 * @param {String} options.selector canvas 节点选择器
 * @param {String} options.title 图片标题
 * @param {Array} options.rows 二维数组，单元格可为 {value, style}
 * @param {Function} [options.onProgress] 进度回调 (当前, 总数)
 * @returns {Array} [{ path, label, selected }]
 */
export async function generateTableImageFiles({ selector, title, rows = [], onProgress }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('没有可导出的表格数据')
  }
  const canvas = await getCanvasNode(selector)
  const ctx = canvas.getContext('2d')
  const dpr = (uni.getSystemInfoSync().pixelRatio || 1)
  const maxColumns = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 1), 1)
  const height = TABLE_TOP + rows.length * TABLE_LINE_HEIGHT + 40
  canvas.width = PAGE_WIDTH * dpr
  canvas.height = height * dpr
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  drawTableSheet(ctx, rows, title, maxColumns)
  const path = await canvasToTempFile(canvas, height, dpr)
  if (typeof onProgress === 'function') onProgress(1, 1)
  return [{ path, label: title, selected: true }]
}
