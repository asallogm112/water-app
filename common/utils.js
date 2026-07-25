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

export function createUserUnitPriceMap(users = []) {
  const map = new Map()
  users.filter(user => user && !user.isAdmin).forEach(user => {
    const key = String(user.name || '').trim()
    const price = Number(user.unitPrice)
    if (!key || !Number.isFinite(price) || price < 0) return
    map.set(key, price)
  })
  return map
}

export function getOrderUnitPrice(order, usersOrMap = []) {
  const unitPriceMap = usersOrMap instanceof Map ? usersOrMap : createUserUnitPriceMap(usersOrMap)
  const userName = String(order?.userName || '').trim()
  const mappedPrice = unitPriceMap.get(userName)
  if (Number.isFinite(mappedPrice) && mappedPrice >= 0) return mappedPrice
  const fallbackPrice = Number(order?.unitPrice)
  return Number.isFinite(fallbackPrice) && fallbackPrice >= 0 ? fallbackPrice : 0
}

export function getOrderReceivableAmount(order, usersOrMap = []) {
  const quantity = Number(order?.quantity || 0)
  const unitPrice = getOrderUnitPrice(order, usersOrMap)
  if (!Number.isFinite(quantity) || quantity <= 0) return 0
  return Number((quantity * unitPrice).toFixed(2))
}

export function getOrderActualReceivedAmount(order) {
  const actual = Number(order?.actualAmountReceived || 0)
  return Number.isFinite(actual) && actual >= 0 ? actual : 0
}

/**
 * 生成唯一ID
 */
export function generateId(prefix = '') {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 中文姓名转拼音用户名
 */
export function nameToUsername(name) {
  const pinyinMap = {
    '老': 'lao', '张': 'zhang', '李': 'li', '梅': 'mei', '田': 'tian', '王': 'wang',
    '陈': 'chen', '刘': 'liu', '黄': 'huang', '周': 'zhou', '吴': 'wu', '徐': 'xu',
    '孙': 'sun', '胡': 'hu', '朱': 'zhu', '高': 'gao', '林': 'lin', '何': 'he',
    '郭': 'guo', '马': 'ma', '罗': 'luo', '梁': 'liang', '宋': 'song', '郑': 'zheng',
    '谢': 'xie', '韩': 'han', '唐': 'tang', '冯': 'feng', '于': 'yu', '董': 'dong',
    '萧': 'xiao', '程': 'cheng', '曹': 'cao', '袁': 'yuan', '邓': 'deng', '许': 'xu',
    '傅': 'fu', '沈': 'shen', '曾': 'zeng', '彭': 'peng', '吕': 'lv', '苏': 'su',
    '卢': 'lu', '蒋': 'jiang', '蔡': 'cai', '贾': 'jia', '丁': 'ding', '魏': 'wei',
    '薛': 'xue', '叶': 'ye', '阎': 'yan', '余': 'yu', '潘': 'pan', '杜': 'du',
    '戴': 'dai', '夏': 'xia', '钟': 'zhong', '汪': 'wang', '任': 'ren'
  }

  let slug = ''
  for (const char of name) {
    if (pinyinMap[char]) {
      slug += pinyinMap[char]
    } else if (/[a-zA-Z0-9]/.test(char)) {
      slug += char.toLowerCase()
    }
  }

  if (!slug) {
    slug = 'user_' + Math.random().toString(36).substr(2, 6)
  }
  return slug
}

/**
 * 解析批量用户文本（每行: 姓名 单价 结算方式）
 */
export function parseBatchUsersText(inputText, existingUsers = []) {
  if (!inputText.trim()) return []

  const parsedUsers = []
  const lines = inputText.split(/\n+/).map(line => line.trim()).filter(Boolean)
  const existingUsernameSet = new Set(existingUsers.map(u => (u.username || '').toLowerCase()).filter(Boolean))
  const existingNameSet = new Set(existingUsers.map(u => (u.name || '').trim().toLowerCase()).filter(Boolean))
  const parsedUsernameCount = new Map()
  const parsedNameCount = new Map()

  const normalizeSettlementType = (value) => {
    const text = String(value || '').trim().toLowerCase()
    if (text === '月结' || text === 'monthly') return 'monthly'
    return 'daily'
  }

  const buildUserObj = (name, price, settlementType, index) => {
    const username = nameToUsername(name)
    const normalizedUsername = username.toLowerCase()
    const normalizedName = String(name || '').trim().toLowerCase()
    parsedUsernameCount.set(normalizedUsername, (parsedUsernameCount.get(normalizedUsername) || 0) + 1)
    parsedNameCount.set(normalizedName, (parsedNameCount.get(normalizedName) || 0) + 1)

    return {
      id: `batch-user-${Date.now()}-${index}`,
      username,
      name,
      unitPrice: Number.isFinite(price) ? price : 0,
      settlementType: normalizeSettlementType(settlementType),
      phone: '',
      address: '',
      notes: '',
      password: '',
      duplicateInDatabase: existingUsernameSet.has(normalizedUsername) || existingNameSet.has(normalizedName),
      duplicateInBatch: false,
      duplicateByUsername: existingUsernameSet.has(normalizedUsername),
      duplicateByName: existingNameSet.has(normalizedName),
      duplicateNameInBatch: false,
      duplicateUsernameInBatch: false
    }
  }

  lines.forEach((line, idx) => {
    const match = line.match(/^(.+?)(?:\s+|[:：=,，])(-?\d+(?:\.\d+)?)(?:(?:\s+|[:：=,，])(日结|月结|daily|monthly))?$/i)
    if (match) {
      const name = match[1].trim()
      const price = parseFloat(match[2])
      const settlementType = /^(月结|monthly)$/i.test(String(match[3] || '').trim()) ? 'monthly' : 'daily'
      if (name) parsedUsers.push(buildUserObj(name, price, settlementType, idx))
      return
    }

    const onlyName = line.replace(/[:：=,，]/g, ' ').trim()
    if (onlyName) {
      parsedUsers.push(buildUserObj(onlyName, 0, 'daily', idx))
    }
  })

  parsedUsers.forEach(user => {
    const normalizedUsername = (user.username || '').toLowerCase()
    const normalizedName = (user.name || '').trim().toLowerCase()
    user.duplicateUsernameInBatch = (parsedUsernameCount.get(normalizedUsername) || 0) > 1
    user.duplicateNameInBatch = (parsedNameCount.get(normalizedName) || 0) > 1
    user.duplicateInBatch = user.duplicateUsernameInBatch || user.duplicateNameInBatch
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
  return (text || '').replace(/([零〇一二两三四五六七八九十百千万]+)(?=(桶|元|块|月|号|日|\/|\s|$))/g, (match, numText) => {
    const parsed = chineseNumberToArabic(numText)
    return Number.isFinite(parsed) ? String(parsed) : match
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
  normalized = normalized.replace(/([\u4e00-\u9fa5A-Za-z]+)(\d+(?:\/\d+)?)/g, '$1 $2')
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
    .replace(/([\u4e00-\u9fa5A-Za-z]+)(\d+(?:\/\d+)?)/g, '$1 $2')
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
    const consumed = new Set()

    detailTokens.forEach((token, idx) => {
      const slashMatch = token.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
      if (!slashMatch) return
      quantity = parseFloat(slashMatch[1]) || 0
      returnedBuckets = parseFloat(slashMatch[2]) || 0
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
        consumed.add(idx)
        return
      }
      if (/(送水|送|购|买|配)/.test(prev)) {
        quantity = num
        consumed.add(idx)
      }
    })

    detailTokens.forEach((token, idx) => {
      if (consumed.has(idx)) return
      const numMatch = token.match(/^(\d+(?:\.\d+)?)$/)
      if (!numMatch) return
      const num = parseFloat(numMatch[1])
      if (quantity === 0) quantity = num
      else if (returnedBuckets === 0) returnedBuckets = num
      else if (!actualAmountTouched) {
        actualAmountReceived = num
        actualAmountTouched = true
      }
      consumed.add(idx)
    })

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(returnedBuckets) || returnedBuckets < 0) {
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
