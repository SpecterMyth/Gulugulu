# `skipMain` 接线说明

`useOnboardingDirector()` 现在返回 `skipMain(): Promise<GameSave | null>`。
它不改存档结构，而是按后端已经认可的游标顺序逐步提交回执；工厂 C 段使用后端现有的
`C12` 整体回执。因此老存档、教学赠送的幂等规则和 `DONE` 状态都保持兼容。

当前唯一未接线点在 `src/App.tsx` 的 `<OnboardingGoal />`。后续可在产品确认交互后传入：

```tsx
<OnboardingGoal
  directive={coach.directive}
  onAction={handleOnboardingAction}
  onRecover={recoverOnboardingRoute}
  onSkip={() => {
    // 建议先展示一次确认框，再执行：
    void coach.skipMain();
  }}
/>
```

`OnboardingGoal` 只有收到 `onSkip` 时才显示双语“跳过整个新手引导”入口，所以本次没有
擅自在 `App.tsx` 中改变现有 UI。跳过执行期间应禁用重复点击；`skipMain` 自身已经和其它
onboarding 回执共用串行队列。
