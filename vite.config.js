import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

function formatPart(value) {
  return String(value).padStart(2, '0')
}

function createBuildInfo() {
  const now = new Date()
  const buildTime = `${now.getFullYear()}-${formatPart(now.getMonth() + 1)}-${formatPart(now.getDate())} ${formatPart(now.getHours())}:${formatPart(now.getMinutes())}:${formatPart(now.getSeconds())}`
  const buildId = `${now.getFullYear()}${formatPart(now.getMonth() + 1)}${formatPart(now.getDate())}-${formatPart(now.getHours())}${formatPart(now.getMinutes())}${formatPart(now.getSeconds())}`
  return {
    buildTime,
    buildId,
    displayText: `build ${buildId}`,
    fullText: `${buildTime} / ${buildId}`
  }
}

const buildInfo = createBuildInfo()

export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(buildInfo.buildTime),
    __BUILD_ID__: JSON.stringify(buildInfo.buildId),
    __BUILD_DISPLAY_TEXT__: JSON.stringify(buildInfo.displayText),
    __BUILD_FULL_TEXT__: JSON.stringify(buildInfo.fullText)
  },
  plugins: [uni()]
})
