import path from 'node:path'
import fs from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const storybookUrl = process.env.STORYBOOK_URL ?? 'http://127.0.0.1:6006'
const outputDir = process.env.STORYBOOK_SCREENSHOT_DIR ?? 'screenshots/storybook'

const pluginViewports = [
  { name: 'min', width: 492, height: 238 },
  { name: 'standard', width: 800, height: 400 },
  { name: 'wide', width: 1200, height: 700 },
]

const targets = [
  { id: 'plugin-spectrumanalyzer--default', name: 'spectrum-default', viewports: pluginViewports },
  { id: 'plugin-spectrumanalyzer--dense-room', name: 'spectrum-dense-room', viewports: pluginViewports },
  { id: 'plugin-spectrumanalyzer--neon-lift', name: 'spectrum-neon-lift', viewports: pluginViewports },
  { id: 'plugin-spectrumanalyzer--with-error', name: 'spectrum-with-error', viewports: pluginViewports },
]

function storyUrl(storyId) {
  const url = new URL('/iframe.html', storybookUrl)
  url.searchParams.set('id', storyId)
  url.searchParams.set('viewMode', 'story')
  return url.toString()
}

async function collectLayoutInfo(page) {
  return page.evaluate(() => {
    const rectToObject = (rect) => ({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    })

    const storyRoot = document.querySelector('#storybook-root')
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    const canvases = Array.from(document.querySelectorAll('canvas')).map((canvas) => {
      const ctx = canvas.getContext('2d')
      const imageData = ctx && canvas.width > 0 && canvas.height > 0
        ? ctx.getImageData(0, 0, canvas.width, canvas.height).data
        : null
      let nonTransparentPixels = 0

      if (imageData) {
        for (let i = 3; i < imageData.length; i += 4) {
          if (imageData[i] > 0) {
            nonTransparentPixels += 1
          }
        }
      }

      return {
        box: rectToObject(canvas.getBoundingClientRect()),
        width: canvas.width,
        height: canvas.height,
        nonTransparentPixels,
      }
    })
    const textRanges = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const epsilon = 0.5
    const mergeOverflow = (a, b) => ({
      left: a.left || b.left,
      top: a.top || b.top,
      right: a.right || b.right,
      bottom: a.bottom || b.bottom,
    })
    const getClipBox = (element) => {
      let clip = {
        left: 0,
        top: 0,
        right: viewportWidth,
        bottom: viewportHeight,
      }
      let current = element

      while (current && current !== document.documentElement) {
        const styles = window.getComputedStyle(current)
        const clipsX = styles.overflowX !== 'visible'
        const clipsY = styles.overflowY !== 'visible'

        if (clipsX || clipsY) {
          const rect = current.getBoundingClientRect()
          clip = {
            left: clipsX ? Math.max(clip.left, rect.left) : clip.left,
            top: clipsY ? Math.max(clip.top, rect.top) : clip.top,
            right: clipsX ? Math.min(clip.right, rect.right) : clip.right,
            bottom: clipsY ? Math.min(clip.bottom, rect.bottom) : clip.bottom,
          }
        }

        current = current.parentElement
      }

      return clip
    }
    let textNode = walker.nextNode()

    while (textNode) {
      const text = textNode.textContent?.replace(/\s+/g, ' ').trim() ?? ''

      if (text.length > 0) {
        const range = document.createRange()
        range.selectNodeContents(textNode)

        for (const rect of Array.from(range.getClientRects())) {
          if (rect.width > 0 && rect.height > 0) {
            const viewportOverflow = {
              left: rect.left < -epsilon,
              top: rect.top < -epsilon,
              right: rect.right > viewportWidth + epsilon,
              bottom: rect.bottom > viewportHeight + epsilon,
            }
            const clipBox = getClipBox(textNode.parentElement)
            const clipOverflow = {
              left: rect.left < clipBox.left - epsilon,
              top: rect.top < clipBox.top - epsilon,
              right: rect.right > clipBox.right + epsilon,
              bottom: rect.bottom > clipBox.bottom + epsilon,
            }
            const overflow = mergeOverflow(viewportOverflow, clipOverflow)

            textRanges.push({
              text,
              box: rectToObject(rect),
              clipBox,
              overflow,
              isOverflowing: Object.values(overflow).some(Boolean),
            })
          }
        }

        range.detach()
      }

      textNode = walker.nextNode()
    }

    return {
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
      body: {
        scrollWidth: document.body.scrollWidth,
        scrollHeight: document.body.scrollHeight,
      },
      storyRoot: storyRoot ? rectToObject(storyRoot.getBoundingClientRect()) : null,
      canvases,
      overflowingText: textRanges.filter((item) => item.isOverflowing),
    }
  })
}

async function main() {
  await mkdir(outputDir, { recursive: true })

  const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const headless = process.env.STORYBOOK_HEADLESS !== 'false'
  const launchOptions = fs.existsSync(chromePath)
    ? { executablePath: chromePath, headless }
    : { headless }

  const browser = await chromium.launch(launchOptions)
  const manifest = []
  const failures = []

  try {
    for (const target of targets) {
      for (const viewport of target.viewports) {
        const page = await browser.newPage({
          viewport: {
            width: viewport.width,
            height: viewport.height,
          },
          deviceScaleFactor: 1,
        })

        const url = storyUrl(target.id)
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.waitForSelector('#storybook-root')
        await page.waitForTimeout(250)

        const filename = `${target.name}-${viewport.name}-${viewport.width}x${viewport.height}.png`
        const screenshotPath = path.join(outputDir, filename)
        await page.screenshot({ path: screenshotPath })
        const layout = await collectLayoutInfo(page)
        const hasBodyOverflow = layout.body.scrollWidth > viewport.width || layout.body.scrollHeight > viewport.height
        const hasOverflowingText = layout.overflowingText.length > 0

        if (hasBodyOverflow || hasOverflowingText) {
          failures.push({
            storyId: target.id,
            viewport,
            hasBodyOverflow,
            overflowingText: layout.overflowingText,
          })
        }

        manifest.push({
          storyId: target.id,
          storyName: target.name,
          viewport,
          url,
          screenshotPath,
          layout,
        })

        await page.close()
      }
    }
  } finally {
    await browser.close()
  }

  const manifestPath = path.join(outputDir, 'manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`Saved ${manifest.length} screenshots to ${outputDir}`)
  console.log(`Wrote ${manifestPath}`)

  if (failures.length > 0) {
    console.error(JSON.stringify({ failures }, null, 2))
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
