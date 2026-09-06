/**
 * 水管家配送管理系统 - 工具函数
 */

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss
 */
export function formatDateTime(date) {
  const pad = (n) => n.toString().padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
export function formatDate(date) {
  const pad = (n) => n.toString().padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  return `${y}-${m}-${d}`
}

export function roundMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Number(amount.toFixed(2))
}

export function formatMoney(value) {
  const amount = roundMoney(value)
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
}

export function createUserUnitPriceMap(users = []) {
  const map = new Map()
  users.filter(user => user && !user.isAdmin).forEach(user => {
    const key = String(user.userName || '').trim()
    const price = Number(user.unitPrice)
    if (!key || !Number.isFinite(price) || price < 0) return
    map.set(key, price)
  })
  return map
}

const DEFAULT_UNKNOWN_USER_UNIT_PRICE = 2.2

function getUnknownUserResolvedUnitPrice(order) {
  const quantity = Number(order?.quantity || 0)
  const actual = getOrderActualReceivedAmount(order)
  if (quantity > 0 && actual > 0) return roundMoney(actual / quantity)
  return roundMoney(DEFAULT_UNKNOWN_USER_UNIT_PRICE)
}

export function getOrderUnitPrice(order, usersOrMap = []) {
  const unitPriceMap = usersOrMap instanceof Map ? usersOrMap : createUserUnitPriceMap(usersOrMap)
  const orderUnitPrice = Number(order?.unitPrice)
  if (Number.isFinite(orderUnitPrice) && orderUnitPrice > 0) return roundMoney(orderUnitPrice)
  const userName = String(order?.userName || '').trim()
  const mappedPrice = unitPriceMap.get(userName)
  if (Number.isFinite(mappedPrice) && mappedPrice >= 0) return roundMoney(mappedPrice)
  return getUnknownUserResolvedUnitPrice(order)
}

export function getOrderReceivableAmount(order, usersOrMap = []) {
  const userName = String(order?.userName || '').trim()
  if (userName === '散户') {
    return getOrderActualReceivedAmount(order)
  }
  const unitPriceMap = usersOrMap instanceof Map ? usersOrMap : createUserUnitPriceMap(usersOrMap)
  const quantity = Number(order?.quantity || 0)
  const orderUnitPrice = Number(order?.unitPrice)
  const mappedPrice = unitPriceMap.get(userName)
  const usesUnknownUserDefaultPrice = (!Number.isFinite(orderUnitPrice) || orderUnitPrice <= 0) &&
    (!Number.isFinite(mappedPrice) || mappedPrice < 0)
  if (usesUnknownUserDefaultPrice) {
    const actual = getOrderActualReceivedAmount(order)
    if (actual > 0) return actual
  }
  const unitPrice = getOrderUnitPrice(order, unitPriceMap)
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  return roundMoney(quantity * unitPrice)
}

export function getOrderActualReceivedAmount(order) {
  const actual = Number(order?.actualAmountReceived || 0)
  return Number.isFinite(actual) && actual >= 0 ? roundMoney(actual) : 0
}

/**
 * 生成唯一ID
 */
export function generateId(prefix = '') {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 解析批量用户文本（每行: 姓名 单价 结算方式）
 */
export function parseBatchUsersText(inputText, existingUsers = []) {
  if (!inputText.trim()) return []

  const parsedUsers = []
  const lines = inputText.split(/\n+/).map(line => line.trim()).filter(Boolean)
  const existingUserNameSet = new Set(existingUsers.map(u => (u.userName || '').trim().toLowerCase()).filter(Boolean))
  const parsedUserNameCount = new Map()

  const normalizeSettlementType = (value) => {
    const text = String(value || '').trim().toLowerCase()
    if (text === '月结' || text === 'monthly') return 'monthly'
    return 'daily'
  }

  const isSettlementToken = (value) => /^(日结|月结|daily|monthly)$/i.test(String(value || '').trim())

  const parseLine = (line) => {
    const normalizedLine = String(line || '').replace(/[：:=,，]/g, ' ').replace(/\s+/g, ' ').trim()
    if (!normalizedLine) return null
    const tokens = normalizedLine.split(' ').filter(Boolean)
    if (tokens.length === 0) return null

    let settlementType = 'daily'
    let endIndex = tokens.length
    const lastToken = tokens[tokens.length - 1]
    if (isSettlementToken(lastToken)) {
      settlementType = normalizeSettlementType(lastToken)
      endIndex -= 1
    }

    if (endIndex >= 2) {
      const priceToken = tokens[endIndex - 1]
      if (/^-?\d+(?:\.\d+)?$/.test(priceToken)) {
        const userName = tokens.slice(0, endIndex - 1).join(' ').trim()
        const price = parseFloat(priceToken)
        if (userName) {
          return {
            userName,
            price,
            settlementType
          }
        }
      }
    }

    return {
      userName: normalizedLine,
      price: 0,
      settlementType: 'daily'
    }
  }

  const buildUserObj = (userName, price, settlementType, index) => {
    const normalizedUserName = String(userName || '').trim().toLowerCase()
    parsedUserNameCount.set(normalizedUserName, (parsedUserNameCount.get(normalizedUserName) || 0) + 1)

    return {
      id: `batch-user-${Date.now()}-${index}`,
      userName,
      unitPrice: Number.isFinite(price) ? roundMoney(price) : 0,
      settlementType: normalizeSettlementType(settlementType),
      phone: '',
      address: '',
      notes: '',
      password: '',
      duplicateInDatabase: existingUserNameSet.has(normalizedUserName),
      duplicateInBatch: false,
      duplicateByUserName: existingUserNameSet.has(normalizedUserName),
      duplicateUserNameInBatch: false
    }
  }

  lines.forEach((line, idx) => {
    const parsedLine = parseLine(line)
    if (!parsedLine?.userName) return
    parsedUsers.push(buildUserObj(parsedLine.userName, parsedLine.price, parsedLine.settlementType, idx))
  })

  parsedUsers.forEach(user => {
    const normalizedUserName = (user.userName || '').trim().toLowerCase()
    user.duplicateUserNameInBatch = (parsedUserNameCount.get(normalizedUserName) || 0) > 1
    user.duplicateInBatch = user.duplicateUserNameInBatch
  })

  return parsedUsers
}

/**
 * 解析批量订单文本中的日期
 */
export function parseDateFromText(str, baseDate = '') {
  if (!str) return null

  const normalizedBase = /^\d{4}-\d{2}-\d{2}$/.test(baseDate) ? baseDate : formatDate(new Date())
  const [baseYear, baseMonth] = normalizedBase.split('-')

  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, YYYY年MM月DD日/号
  const fullMatch = str.match(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*(?:日|号)?/)
  if (fullMatch) {
    const y = fullMatch[1]
    const m = fullMatch[2].padStart(2, '0')
    const d = fullMatch[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // MM-DD, MM/DD, MM.DD, MM月DD日/号
  const shortMatch = str.match(/(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*(?:日|号)?/)
  if (shortMatch) {
    const m = shortMatch[1].padStart(2, '0')
    const d = shortMatch[2].padStart(2, '0')
    if (parseInt(m, 10) >= 1 && parseInt(m, 10) <= 12 && parseInt(d, 10) >= 1 && parseInt(d, 10) <= 31) {
      const currentYear = new Date().getFullYear()
      return `${currentYear}-${m}-${d}`
    }
  }

  // 仅日期：20号，继承 baseDate 的年月
  const dayOnlyMatch = str.match(/(^|\D)(\d{1,2})\s*号(?!\d)/)
  if (dayOnlyMatch) {
    const d = dayOnlyMatch[2].padStart(2, '0')
    if (parseInt(d, 10) >= 1 && parseInt(d, 10) <= 31) {
      return `${baseYear}-${baseMonth}-${d}`
    }
  }

  return null
}

export function stripDateText(str) {
  if (!str) return ''
  return str
    .replace(/(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*(?:日|号)?/g, ' ')
    .replace(/(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*(?:日|号)?/g, ' ')
    .replace(/(^|\D)(\d{1,2})\s*号(?!\d)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
}

function chineseNumberToArabic(input) {
  const digitMap = { '零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 }
  if (!input) return NaN
  if (/^\d+$/.test(input)) return parseInt(input, 10)

  let result = 0
  let section = 0
  let number = 0
  const unitMap = { '十': 10, '百': 100, '千': 1000, '万': 10000 }

  for (const char of input) {
    if (digitMap[char] !== undefined) {
      number = digitMap[char]
      continue
    }
    const unit = unitMap[char]
    if (!unit) return NaN
    if (unit === 10000) {
      section = (section + (number || 0)) * unit
      result += section
      section = 0
      number = 0
      continue
    }
    section += (number || 1) * unit
    number = 0
  }

  return result + section + number
}

function replaceChineseNumberPhrases(text) {
  return (text || '').replace(/(^|[\s:：,，])([零〇一二两三四五六七八九十百千万]+)(?=(桶|元|块|月|号|日|\/|\s|$))/gm, (match, prefix, numText) => {
    const parsed = chineseNumberToArabic(numText)
    return Number.isFinite(parsed) ? `${prefix}${parsed}` : match
  })
}

export function normalizeRecognizedOrderText(text) {
  if (!text) return ''

  let normalized = replaceChineseNumberPhrases(text)
  normalized = normalized.replace(/[。；;]/g, '\n')
  normalized = normalized.replace(/[，、,]/g, ' ')
  normalized = normalized.replace(/(\d)\.(?=\s|$)/g, '$1 ')
  normalized = normalized.replace(/(送水|回桶|退桶|付款|实收|收款|扫码付|金额)/g, ' $1 ')
  normalized = normalized.replace(/(送|回|退|付|收|扫码)(\d)/g, '$1 $2')
  normalized = normalized.replace(/([\u4e00-\u9fa5A-Za-z]+)(\d+(?:\/\d+){1,2})/g, '$1 $2')
  normalized = normalized.replace(/(\d+(?:\.\d+)?)(桶|元|块|号|日)/g, '$1 $2 ')
  normalized = normalized.replace(/(桶|元|块|号|日)([\u4e00-\u9fa5A-Za-z])/g, '$1 $2')
  normalized = normalized.replace(/(\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}(?:日|号)?)([\u4e00-\u9fa5A-Za-z])/g, '$1\n$2')

  return normalized
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export function parseCompactOrderSegments(text) {
  if (!text) return []
  const normalized = text
    .replace(/[，,；;。]/g, ' ')
    .replace(/(\d)\.(?=\s|$)/g, '$1 ')
    .replace(/([\u4e00-\u9fa5A-Za-z]+)(\d+(?:\/\d+){1,2})/g, '$1 $2')
    .replace(/(送水|送|回桶|回|退桶|退|付款|付|实收|收款|收|扫码付|扫码|金额)(\d+(?:\.\d+)?)/g, '$1 $2')
    .replace(/(\d+(?:\.\d+)?)(桶|元|块)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
  const segments = []
  const tokens = normalized.split(' ').filter(Boolean)

  const isNameToken = (token) => {
    if (!token || /\d/.test(token)) return false
    return isPotentialName(token, [])
  }

  const parseSegmentTokens = (name, detailTokens) => {
    if (!name) return null

    let quantity = 0
    let returnedBuckets = 0
    let actualAmountReceived = 0
    let actualAmountTouched = false
    let quantityAssigned = false
    let returnedBucketsAssigned = false
    const consumed = new Set()
    const positionalNumbers = []

    detailTokens.forEach((token, idx) => {
      const slashMatch = token.match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))(?:\/(\d+(?:\.\d+)?))?$/)
      if (!slashMatch) return
      quantity = parseFloat(slashMatch[1]) || 0
      returnedBuckets = parseFloat(slashMatch[2]) || 0
      quantityAssigned = true
      returnedBucketsAssigned = true
      if (slashMatch[3] !== undefined) {
        actualAmountReceived = parseFloat(slashMatch[3]) || 0
        actualAmountTouched = true
      }
      consumed.add(idx)
    })

    detailTokens.forEach((token, idx) => {
      if (consumed.has(idx)) return
      const numMatch = token.match(/^(\d+(?:\.\d+)?)$/)
      if (!numMatch) return
      const num = parseFloat(numMatch[1])
      const prev = detailTokens[idx - 1] || ''
      const next = detailTokens[idx + 1] || ''

      if (/(付款|付|实收|收款|收|扫码付|扫码|金额)/.test(prev) || /^(元|块)$/.test(next)) {
        actualAmountReceived = num
        actualAmountTouched = true
        consumed.add(idx)
        return
      }
      if (/(回桶|回|退桶|退)/.test(prev)) {
        returnedBuckets = num
        returnedBucketsAssigned = true
        consumed.add(idx)
        return
      }
      if (/(送水|送|购|买|配)/.test(prev)) {
        quantity = num
        quantityAssigned = true
        consumed.add(idx)
        return
      }

      positionalNumbers.push(num)
    })

    if (positionalNumbers.length > 0) {
      if (!quantityAssigned && positionalNumbers[0] !== undefined) {
        quantity = positionalNumbers[0]
        quantityAssigned = true
      }
      if (!returnedBucketsAssigned && positionalNumbers[1] !== undefined) {
        returnedBuckets = positionalNumbers[1]
        returnedBucketsAssigned = true
      }
      if (!actualAmountTouched && positionalNumbers[2] !== undefined) {
        actualAmountReceived = positionalNumbers[2]
        actualAmountTouched = true
      }
    }

    if (!quantityAssigned || !returnedBucketsAssigned || !Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(returnedBuckets) || returnedBuckets < 0) {
      return null
    }

    return {
      name,
      quantity: Number(quantity),
      returnedBuckets: Number(returnedBuckets),
      actualAmountReceived: actualAmountTouched ? Number(actualAmountReceived) : undefined,
      actualAmountTouched
    }
  }

  let currentName = ''
  let currentDetailTokens = []

  const pushCurrent = () => {
    const parsed = parseSegmentTokens(currentName, currentDetailTokens)
    if (parsed) segments.push(parsed)
  }

  tokens.forEach(token => {
    if (isNameToken(token)) {
      if (currentName) pushCurrent()
      currentName = token.trim()
      currentDetailTokens = []
      return
    }
    if (currentName) currentDetailTokens.push(token)
  })

  if (currentName) pushCurrent()

  return segments
}

/**
 * 判断 token 是否是潜在客户名称
 */
export function isPotentialName(token, systemUserNames = []) {
  const clean = token.replace(/[\(\)（）:,，：]/g, '').trim()
  if (!clean) return false

  if (systemUserNames.some(u => u.toLowerCase() === clean.toLowerCase())) {
    return true
  }

  if (/\d/.test(clean)) {
    return false
  }

  const excludedKeywords = [
    '个', '只', '桶', '送水', '回桶', '元', '块', '扫码', '现场', '支付', '微信',
    '支付宝', '付款', '收款', '实收', '收', '金额', '现金', '刷卡', '月结', '日结', '扫码付', 'eg', '备注', '送', '回', '水', '日期'
  ]
  if (excludedKeywords.some(kw => clean.includes(kw) || kw === clean)) {
    return false
  }

  return clean.length >= 1 && clean.length <= 10
}
