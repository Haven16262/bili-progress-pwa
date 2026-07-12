# 002 — 给两个模态框补退场动画与遮罩淡入淡出

- **Status**: DONE
- **Commit**: 0eb5a34
- **Severity**: MEDIUM
- **Category**: Interruptibility / 缺失退场
- **Estimated scope**: 2 files（HomePage.vue、AddVideoModal.vue 的样式），模板仅加 `<Transition>` 包裹

## Problem

两个模态框（添加视频、改名）用裸 `v-if` 挂载，进场有 `scale-in` keyframes 但**关闭时瞬间消失**，背景遮罩出现/消失都是硬切，关闭体验像"闪断"。

```html
<!-- client/src/views/HomePage.vue:84 — current -->
<AddVideoModal
  v-if="showAdd"
  @close="showAdd = false"
  @added="onVideoAdded"
/>

<!-- client/src/views/HomePage.vue:90 — current -->
<div
  v-if="editingVideo"
  class="modal-overlay"
  @click.self="editingVideo = null"
>
```

```css
/* client/src/views/HomePage.vue:462 — current（modal-sheet 内） */
animation: scale-in var(--duration-normal) var(--ease-out) forwards;
```

```css
/* client/src/components/AddVideoModal.vue:143 — current（add-modal-sheet 内） */
animation: scale-in var(--duration-normal) var(--ease-out) forwards;
```

## Target

用 Vue `<Transition name="modal">` 包裹两个模态框。进场保留现有 `scale-in` keyframes 不动；退场为**快于进场**的 150ms 缩放+淡出（退场要快，用户已决定离开）；遮罩整体随 overlay 的 opacity 渐变。

```css
/* target — 两个文件各自的 <style scoped> 中，类名前缀 modal 一致 */
.modal-enter-active {
  transition: opacity var(--duration-normal) var(--ease-out);
}
.modal-leave-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-leave-active .modal-sheet {
  transition: transform var(--duration-fast) var(--ease-out);
}
.modal-leave-to .modal-sheet {
  transform: scale(0.97);
}
```

（AddVideoModal 中把 `.modal-sheet` 换成 `.add-modal-sheet`。）

## Repo conventions to follow

- 页面级过渡已有先例：`client/src/App.vue:56-65` 的 `page-fade`（`<Transition>` + token 化时长/曲线），照它的写法。
- token：`--duration-fast: 150ms`、`--duration-normal: 300ms`、`--ease-out`（`main.css:70-76`）。不引入新数值。

## Steps

1. `client/src/views/HomePage.vue` 模板：将 `<AddVideoModal v-if="showAdd" ...>` 包进 `<Transition name="modal">`；将改名模态的 `<div v-if="editingVideo" class="modal-overlay">` 同样包进 `<Transition name="modal">`。
2. `client/src/views/HomePage.vue` 样式：追加上面 Target 的 5 条 `.modal-*` 规则（scoped 内，退场作用于 `.modal-sheet`）。注意 `.modal-overlay` 是 `position: fixed` 根元素，opacity 过渡直接加在它身上即可。
3. `client/src/components/AddVideoModal.vue`：Transition 类作用在组件根元素 `.add-modal-overlay` 上（由父级 HomePage 的 `<Transition>` 注入类名）。由于 HomePage 样式是 scoped，这几条 `.modal-*` 规则需用 `:deep()` 或写进 AddVideoModal 自己的 `<style scoped>`（推荐后者：在 AddVideoModal 内写 `.modal-enter-active` 等规则，因根元素会收到这些类）。
4. 确认进场 keyframes 与 Transition 不冲突：`scale-in` 保留在 sheet 上，overlay 的 opacity 过渡叠加在外层，二者作用于不同元素。

## Boundaries

- 不改模态框的业务逻辑、props、emit。
- 不改进场动画的时长/曲线。
- 不动 PasswordGate（无模态语义）和页面切换过渡。
- 若发现 `.modal-overlay` 结构与摘录不符，停下报告。

## Verification

- **Mechanical**: `cd client && npm run build` 成功。
- **Feel check**:
  - 打开→关闭改名模态：遮罩淡出、卡片轻微缩小消失，无闪断；快速连续开关（点圆柱→立即点遮罩）动画不卡死、不留残影。
  - DevTools Animations 面板调 10% 速度：退场是 opacity+scale 同步进行，无先后跳变。
  - Rendering 面板开 `prefers-reduced-motion: reduce`：模态开关仍瞬时（受全局 reduced-motion 规则约束，见 003），功能不受影响。
- **Done when**: 两个模态框关闭均有 150ms 退场动画，遮罩两个方向都渐变，rapid toggle 不产生视觉故障。
