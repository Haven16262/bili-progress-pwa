# 005 — 给底部导航和添加列表补按压反馈

- **Status**: DONE
- **Commit**: 0eb5a34
- **Severity**: LOW
- **Category**: Physicality（按压反馈）
- **Estimated scope**: 2 files（BottomNav.vue、AddVideoModal.vue），纯 CSS

## Problem

项目多数按钮已有按压反馈（如 `PasswordGate.vue:138`、`SettingsPage.vue:392`、`HomePage.vue:329` 均为 `:active { transform: scale(0.97) }` 系），但两处高频触点没有——触屏上点下去"没有确认感"：

- `client/src/components/BottomNav.vue` — 导航链接无任何 `:active` 规则
- `client/src/components/AddVideoModal.vue` — 列表项（`.add-modal-item`）、重试按钮（`.add-modal-error__retry`）无 `:active` 规则

## Target

与库内已有先例完全一致的按压反馈：`scale(0.97)`、过渡 `var(--duration-fast) var(--ease-out)`（150ms，微超 AUDIT 推荐上限 160ms 的同族值，沿用 token 不新造数值）。

```css
/* target — BottomNav.vue */
.nav-link:active .nav-icon {
  transform: scale(0.95);
}
```

（导航图标 active 用 0.95：图标本身只有 1.5rem，0.97 视觉上不可辨。`.nav-icon` 已有 `transition: transform var(--duration-fast) var(--ease-out)`（:95），无需新增过渡。）

```css
/* target — AddVideoModal.vue */
.add-modal-item:active {
  transform: scale(0.98);
  background: rgb(255 255 255 / 0.05);
}

.add-modal-error__retry:active {
  transform: scale(0.97);
}
```

（列表项是全宽行，缩放幅度更小取 0.98，背景加深一档作为辅助信号。）

## Repo conventions to follow

- 先例：`client/src/components/PasswordGate.vue:138-140`：
  ```css
  .gate-card__btn:active {
    transform: scale(0.97);
  }
  ```
- `.add-modal-item` 当前 hover 背景是 `rgb(255 255 255 / 0.03)`（AddVideoModal.vue:272-274），active 用 0.05 保持同一色系递进。

## Steps

1. `client/src/components/BottomNav.vue`：在 `.nav-link:hover .nav-icon` 规则附近追加 Target 中的 `:active` 规则（**放在 001 的媒体查询块之外**——触屏也要有按压反馈）。
2. `client/src/components/AddVideoModal.vue`：给 `.add-modal-item` 与 `.add-modal-error__retry` 追加 `:active` 规则；确认二者的 `transition` 是否包含 `transform`——`.add-modal-item` 当前只 `transition: background`（:269），需扩为 `transition: background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);`。

## Boundaries

- 不动已有按压反馈的按钮。
- 不加 JS、不加 ripple 之类的花活。
- 与 001 并存：`:active` 永远在 hover 媒体查询之外。

## Verification

- **Mechanical**: `cd client && npm run build` 成功。
- **Feel check**: 手机模拟（touch）下按住底部导航图标/添加列表项：按下时轻微缩小，松手回弹；反复快速点击不闪烁（transition 可中断重定向）。
- **Done when**: 全部可点元素按下均有可感知的按压反馈，且触屏与桌面一致。
