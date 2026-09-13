function escapeXml(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

function sanitizeSheetName(name) {
	return String(name || 'Sheet1').replace(/[\\/?*\[\]:]/g, '_').slice(0, 31) || 'Sheet1'
}

function sanitizeFileName(name) {
	return String(name || 'export').replace(/[\\/:*?"<>|]/g, '_')
}

function ensureWeixinEnv() {
	if (typeof wx === 'undefined' || !wx?.getFileSystemManager || !wx?.env?.USER_DATA_PATH) {
		throw new Error('当前环境不支持 Excel 文件导出')
	}
	return wx
}

function numberToColumnName(index) {
	let result = ''
	let current = index
	while (current > 0) {
		const remainder = (current - 1) % 26
		result = String.fromCharCode(65 + remainder) + result
		current = Math.floor((current - 1) / 26)
	}
	return result || 'A'
}

function isNumericCell(value) {
	return typeof value === 'number' && Number.isFinite(value)
}

function normalizeCell(cell) {
	if (cell && typeof cell === 'object' && !Array.isArray(cell) && Object.prototype.hasOwnProperty.call(cell, 'value')) {
		return {
			value: cell.value,
			style: cell.style || ''
		}
	}
	return {
		value: cell,
		style: ''
	}
}

function getStyleId(style) {
	if (style === 'title') return 1
	if (style === 'header') return 2
	if (style === 'monthly') return 3
	if (style === 'green') return 4
	if (style === 'red') return 5
	if (style === 'orange') return 6
	if (style === 'purple') return 7
	if (style === 'black') return 8
	return 0
}

function buildCellXml(cell, rowIndex, columnIndex) {
	const normalizedCell = normalizeCell(cell)
	const value = normalizedCell.value
	const cellRef = `${numberToColumnName(columnIndex)}${rowIndex}`
	const styleId = getStyleId(normalizedCell.style)
	const styleAttr = styleId ? ` s="${styleId}"` : ''
	if (isNumericCell(value)) {
		return `<c r="${cellRef}"${styleAttr}><v>${value}</v></c>`
	}
	return `<c r="${cellRef}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function buildWorksheetXml(sheet) {
	const rows = Array.isArray(sheet?.rows) ? sheet.rows : []
	const defaultRowHeight = Number(sheet?.defaultRowHeight) > 0 ? Number(sheet.defaultRowHeight) : 18
	const columnWidths = Array.isArray(sheet?.columnWidths) ? sheet.columnWidths : []
	const rowHeights = sheet?.rowHeights && typeof sheet.rowHeights === 'object' ? sheet.rowHeights : {}
	const merges = Array.isArray(sheet?.merges) ? sheet.merges.filter(item => item && item.start && item.end) : []
	const maxColumns = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 1), 0)
	const lastCellRef = `${numberToColumnName(Math.max(maxColumns, 1))}${Math.max(rows.length, 1)}`
	const colsXml = columnWidths.length > 0
		? `<cols>${columnWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${Number(width) > 0 ? Number(width) : 12}" customWidth="1"/>`).join('')}</cols>`
		: ''
	const mergeCellsXml = merges.length > 0
		? `<mergeCells count="${merges.length}">${merges.map(item => `<mergeCell ref="${item.start}:${item.end}"/>`).join('')}</mergeCells>`
		: ''
	const rowXml = rows.map((row, rowIndex) => {
		const cells = Array.isArray(row) ? row : [row]
		const cellXml = cells.map((cell, columnIndex) => buildCellXml(cell, rowIndex + 1, columnIndex + 1)).join('')
		const rowHeight = Number(rowHeights[rowIndex + 1]) > 0 ? Number(rowHeights[rowIndex + 1]) : 0
		const rowHeightAttr = rowHeight ? ` ht="${rowHeight}" customHeight="1"` : ''
		return `<row r="${rowIndex + 1}"${rowHeightAttr}>${cellXml}</row>`
	}).join('')
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
	<dimension ref="A1:${lastCellRef}"/>
	<sheetViews><sheetView workbookViewId="0"/></sheetViews>
	<sheetFormatPr defaultRowHeight="${defaultRowHeight}"/>
	${colsXml}
	<sheetData>${rowXml}</sheetData>
	${mergeCellsXml}
</worksheet>`
}

function buildWorkbookXml(sheets) {
	const sheetXml = sheets.map((sheet, index) => {
		const safeName = escapeXml(sanitizeSheetName(sheet?.name || `Sheet${index + 1}`))
		return `<sheet name="${safeName}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
	}).join('')
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
	<sheets>${sheetXml}</sheets>
</workbook>`
}

function buildWorkbookRelsXml(sheets) {
	const relsXml = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	${relsXml}
	<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
}

function buildRootRelsXml() {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
	<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
}

function buildStylesXml() {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
	<fonts count="9">
		<font>
			<sz val="10"/>
			<name val="Microsoft YaHei"/>
		</font>
		<font>
			<b/>
			<sz val="16"/>
			<color rgb="FFFF0000"/>
			<name val="Microsoft YaHei"/>
		</font>
		<font>
			<b/>
			<sz val="14"/>
			<color rgb="FFFF0000"/>
			<name val="Microsoft YaHei"/>
		</font>
		<font>
			<sz val="10"/>
			<color rgb="FFFF0000"/>
			<name val="Microsoft YaHei"/>
		</font>
		<font>
			<b/>
			<sz val="10"/>
			<color rgb="FF059669"/>
			<name val="Microsoft YaHei"/>
		</font>
		<font>
			<b/>
			<sz val="10"/>
			<color rgb="FFDC2626"/>
			<name val="Microsoft YaHei"/>
		</font>
		<font>
			<b/>
			<sz val="10"/>
			<color rgb="FFEA580C"/>
			<name val="Microsoft YaHei"/>
		</font>
		<font>
			<b/>
			<sz val="10"/>
			<color rgb="FF7C3AED"/>
			<name val="Microsoft YaHei"/>
		</font>
		<font>
			<sz val="10"/>
			<color rgb="FF000000"/>
			<name val="Microsoft YaHei"/>
		</font>
	</fonts>
	<fills count="2">
		<fill><patternFill patternType="none"/></fill>
		<fill><patternFill patternType="gray125"/></fill>
	</fills>
	<borders count="1">
		<border><left/><right/><top/><bottom/><diagonal/></border>
	</borders>
	<cellStyleXfs count="1">
		<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
	</cellStyleXfs>
	<cellXfs count="9">
		<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
		<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
	</cellXfs>
	<cellStyles count="1">
		<cellStyle name="Normal" xfId="0" builtinId="0"/>
	</cellStyles>
</styleSheet>`
}

function buildContentTypesXml(sheets) {
	const overrides = sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
	<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
	<Default Extension="xml" ContentType="application/xml"/>
	<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
	<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
	${overrides}
</Types>`
}

function createUtf8Bytes(content) {
	const text = String(content ?? '')
	const bytes = []
	for (let i = 0; i < text.length; i += 1) {
		let codePoint = text.charCodeAt(i)
		if (codePoint >= 0xD800 && codePoint <= 0xDBFF && i + 1 < text.length) {
			const next = text.charCodeAt(i + 1)
			if (next >= 0xDC00 && next <= 0xDFFF) {
				codePoint = ((codePoint - 0xD800) << 10) + (next - 0xDC00) + 0x10000
				i += 1
			}
		}

		if (codePoint <= 0x7F) {
			bytes.push(codePoint)
			continue
		}
		if (codePoint <= 0x7FF) {
			bytes.push(0xC0 | (codePoint >> 6), 0x80 | (codePoint & 0x3F))
			continue
		}
		if (codePoint <= 0xFFFF) {
			bytes.push(0xE0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3F), 0x80 | (codePoint & 0x3F))
			continue
		}
		bytes.push(
			0xF0 | (codePoint >> 18),
			0x80 | ((codePoint >> 12) & 0x3F),
			0x80 | ((codePoint >> 6) & 0x3F),
			0x80 | (codePoint & 0x3F)
		)
	}
	return new Uint8Array(bytes)
}

function makeCrc32Table() {
	const table = new Uint32Array(256)
	for (let i = 0; i < 256; i += 1) {
		let c = i
		for (let j = 0; j < 8; j += 1) {
			c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
		}
		table[i] = c >>> 0
	}
	return table
}

const CRC32_TABLE = makeCrc32Table()

function crc32(bytes) {
	let crc = 0xFFFFFFFF
	for (let i = 0; i < bytes.length; i += 1) {
		crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)
	}
	return (crc ^ 0xFFFFFFFF) >>> 0
}

function createZip(files) {
	const preparedFiles = files.map((file) => {
		const nameBytes = createUtf8Bytes(file.path)
		const dataBytes = file.data instanceof Uint8Array ? file.data : createUtf8Bytes(file.data)
		return {
			name: file.path,
			nameBytes,
			dataBytes,
			crc: crc32(dataBytes)
		}
	})

	let localSize = 0
	let centralSize = 0
	preparedFiles.forEach((file) => {
		localSize += 30 + file.nameBytes.length + file.dataBytes.length
		centralSize += 46 + file.nameBytes.length
	})

	const totalSize = localSize + centralSize + 22
	const output = new Uint8Array(totalSize)
	const view = new DataView(output.buffer)
	let offset = 0
	let centralOffset = localSize

	preparedFiles.forEach((file) => {
		file.localOffset = offset
		view.setUint32(offset, 0x04034b50, true)
		view.setUint16(offset + 4, 20, true)
		view.setUint16(offset + 6, 0, true)
		view.setUint16(offset + 8, 0, true)
		view.setUint16(offset + 10, 0, true)
		view.setUint16(offset + 12, 0, true)
		view.setUint32(offset + 14, file.crc, true)
		view.setUint32(offset + 18, file.dataBytes.length, true)
		view.setUint32(offset + 22, file.dataBytes.length, true)
		view.setUint16(offset + 26, file.nameBytes.length, true)
		view.setUint16(offset + 28, 0, true)
		output.set(file.nameBytes, offset + 30)
		output.set(file.dataBytes, offset + 30 + file.nameBytes.length)
		offset += 30 + file.nameBytes.length + file.dataBytes.length
	})

	preparedFiles.forEach((file) => {
		view.setUint32(centralOffset, 0x02014b50, true)
		view.setUint16(centralOffset + 4, 20, true)
		view.setUint16(centralOffset + 6, 20, true)
		view.setUint16(centralOffset + 8, 0, true)
		view.setUint16(centralOffset + 10, 0, true)
		view.setUint16(centralOffset + 12, 0, true)
		view.setUint16(centralOffset + 14, 0, true)
		view.setUint32(centralOffset + 16, file.crc, true)
		view.setUint32(centralOffset + 20, file.dataBytes.length, true)
		view.setUint32(centralOffset + 24, file.dataBytes.length, true)
		view.setUint16(centralOffset + 28, file.nameBytes.length, true)
		view.setUint16(centralOffset + 30, 0, true)
		view.setUint16(centralOffset + 32, 0, true)
		view.setUint16(centralOffset + 34, 0, true)
		view.setUint16(centralOffset + 36, 0, true)
		view.setUint32(centralOffset + 38, 0, true)
		view.setUint32(centralOffset + 42, file.localOffset, true)
		output.set(file.nameBytes, centralOffset + 46)
		centralOffset += 46 + file.nameBytes.length
	})

	view.setUint32(centralOffset, 0x06054b50, true)
	view.setUint16(centralOffset + 4, 0, true)
	view.setUint16(centralOffset + 6, 0, true)
	view.setUint16(centralOffset + 8, preparedFiles.length, true)
	view.setUint16(centralOffset + 10, preparedFiles.length, true)
	view.setUint32(centralOffset + 12, centralSize, true)
	view.setUint32(centralOffset + 16, localSize, true)
	view.setUint16(centralOffset + 20, 0, true)

	return output.buffer
}

function buildWorkbookBuffer(sheets) {
	const files = [
		{
			path: '[Content_Types].xml',
			data: buildContentTypesXml(sheets)
		},
		{
			path: '_rels/.rels',
			data: buildRootRelsXml()
		},
		{
			path: 'xl/workbook.xml',
			data: buildWorkbookXml(sheets)
		},
		{
			path: 'xl/_rels/workbook.xml.rels',
			data: buildWorkbookRelsXml(sheets)
		},
		{
			path: 'xl/styles.xml',
			data: buildStylesXml()
		}
	]

	sheets.forEach((sheet, index) => {
		files.push({
			path: `xl/worksheets/sheet${index + 1}.xml`,
			data: buildWorksheetXml(sheet)
		})
	})

	return createZip(files)
}

function writeFile(filePath, data) {
	const runtime = ensureWeixinEnv()
	const fs = runtime.getFileSystemManager()
	return new Promise((resolve, reject) => {
		fs.writeFile({
			filePath,
			data,
			success: () => resolve(filePath),
			fail: reject
		})
	})
}

function saveFile(tempFilePath) {
	const runtime = ensureWeixinEnv()
	return new Promise((resolve, reject) => {
		runtime.saveFile({
			tempFilePath,
			success: resolve,
			fail: reject
		})
	})
}

function openDocument(filePath) {
	return new Promise((resolve, reject) => {
		uni.openDocument({
			filePath,
			showMenu: true,
			success: resolve,
			fail: reject
		})
	})
}

function shareFile(filePath, fileName) {
	const runtime = ensureWeixinEnv()
	if (typeof runtime.shareFileMessage !== 'function') {
		return Promise.reject(new Error('当前微信版本不支持文件分享'))
	}
	return new Promise((resolve, reject) => {
		runtime.shareFileMessage({
			filePath,
			fileName,
			success: resolve,
			fail: reject
		})
	})
}

export async function exportExcelWorkbook({ fileName, sheets }) {
	const runtime = ensureWeixinEnv()
	if (!Array.isArray(sheets) || sheets.length === 0) {
		throw new Error('没有可导出的表格数据')
	}
	const safeName = `${sanitizeFileName(fileName || '导出数据')}.xlsx`
	const tempFilePath = `${runtime.env.USER_DATA_PATH}/${Date.now()}_${safeName}`
	const workbookBuffer = buildWorkbookBuffer(sheets)
	await writeFile(tempFilePath, workbookBuffer)
	return {
		fileName: safeName,
		tempFilePath
	}
}

export function openExcelDocument(filePath) {
	return openDocument(filePath)
}

export function showExcelPreviewShareActions({ fileName, tempFilePath }) {
	uni.showActionSheet({
		itemList: ['打开预览', '分享到微信'],
		success: async ({ tapIndex }) => {
			try {
				if (tapIndex === 0) {
					await openDocument(tempFilePath)
					return
				}
				await shareFile(tempFilePath, fileName)
			} catch (error) {
				// 失败静默处理，不弹窗打扰用户
			}
		}
	})
}

export function showExcelExportActions({ fileName, tempFilePath }) {
	uni.showActionSheet({
		itemList: ['打开预览', '保存文件', '分享到微信'],
		success: async ({ tapIndex }) => {
			try {
				if (tapIndex === 0) {
					await openDocument(tempFilePath)
					return
				}
				if (tapIndex === 1) {
					const result = await saveFile(tempFilePath)
					uni.showModal({
						title: '保存成功',
						content: `文件已保存：${result.savedFilePath || fileName}`,
						showCancel: false
					})
					return
				}
				await shareFile(tempFilePath, fileName)
			} catch (error) {
				// 失败静默处理，不弹窗打扰用户
			}
		}
	})
}
