import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const output = (name) => fileURLToPath(new URL(`../assets/${name}`, import.meta.url))
const icon = await readFile(new URL('../assets/qschool-icon.svg', import.meta.url))
const monogram = await readFile(new URL('../assets/qschool-monogram.svg', import.meta.url))
const monochrome = monogram.toString().replaceAll('#FF8A51', '#FFFFFF')

await Promise.all([
  sharp(icon).resize(1024, 1024).png().toFile(output('icon.png')),
  sharp(Buffer.from(monogram)).resize(512, 512).png().toFile(output('android-icon-foreground.png')),
  sharp(Buffer.from(monochrome)).resize(432, 432).png().toFile(output('android-icon-monochrome.png')),
  sharp({ create: { width: 512, height: 512, channels: 4, background: '#0062DB' } }).png().toFile(output('android-icon-background.png')),
  sharp(Buffer.from(monogram)).resize(1024, 1024).png().toFile(output('splash-icon.png')),
  sharp(icon).resize(48, 48).png().toFile(output('favicon.png')),
])

console.log(`Generated QSCHOOL icons in ${new URL('../assets/', import.meta.url).pathname}`)
