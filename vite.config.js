import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    // Windows 下编辑器/工具写入 .js 会用"临时文件 + 原子替换"，chokidar 的原生监听
    // 会撞上 EBUSY 并让整个 dev server 崩掉（实测多次）。改用轮询：代价极小，稳定。
    watch: { usePolling: true, interval: 250 },
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2048,
  },
})
