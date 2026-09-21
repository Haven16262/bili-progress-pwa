/**
 * 删除视频的二次确认（首页弹窗与设置页已看完列表共用，保证文案逐字一致）。
 *
 * @param {{ custom_name?: string, title?: string }} video
 * @returns {boolean} true = 用户确认删除；false = 用户取消
 */
export function confirmVideoDelete(video) {
  const name = video.custom_name || video.title || '该视频'
  return window.confirm(
    `确定要删除「${name}」吗？\n\n此操作不可恢复，本地重命名、置顶状态与「已看完」标记也会一并丢失。`
  )
}
