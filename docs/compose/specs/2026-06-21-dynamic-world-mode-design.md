# Dynamic World Mode Design Specification

## [S1] 概述

### 问题陈述

WorldStory 当前采用"自上而下"的推演模式（Unfolding World）：Planner 规划 → MTIP 生成 → Interpreter 解释 → Writer 写作。这种模式的问题：

1. **角色缺乏自主性**：每个角色独立生成 MTIP，不知道其他角色在想什么
2. **无实时互动**：角色无法响应环境变化或其他角色的行为
3. **无情感/关系动态**：情感状态和关系是静态的
4. **线性推演**：无法产生涌现式叙事

### 解决方案

引入 **Dynamic World 模式**：一种"自下而上"的推演方式，Agent 自主互动产生事件，事件驱动叙事。

### 核心理念

```
用户一句话 → Agent 自主互动 → 事件涌现 → 小说生成
```

### 已确认的设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| MVP范围 | 完整模拟 | 包含所有核心机制 |
| 模式共存 | Story级别切换 | 创建Story时选择模式，运行中不可切换 |
| Writer | 复用现有Writer | 保持一致性，减少开发量 |
| 存储 | IndexedDB | 与现有系统一致，纯客户端 |

### 待讨论的设计决策

| 决策 | 推荐方案 | 备选方案 |
|------|----------|----------|
| Hook匹配机制 | LLM语义匹配 | 结构化条件表达式 / 混合方案 |
| Agent输出格式 | 结构化JSON | 自由文本+后解析 / MTIP-C扩展 |
| 整体架构 | 单循环+Hook驱动 | 多循环并行 / 事件总线架构 |

---

## [S2] 系统架构

### 整体架构（推荐：单循环+Hook驱动）

```
┌─────────────────────────────────────────────────────────────┐
│                      Dynamic World Runner                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Simulation Loop                      │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐ │  │
│  │  │ Phase 1 │→│ Phase 2 │→│ Phase 3 │→│ Phase 4 │ │  │
│  │  │ 世界推进 │  │ 事件分发 │  │ Agent调用 │  │ 记录整合 │ │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘ │  │
│  │       ↑              │              │              │  │  │
│  │       │              ▼              ▼              │  │  │
│  │       │        ┌─────────┐  ┌─────────┐           │  │  │
│  │       │        │Hook路由 │  │Agent认知 │           │  │  │
│  │       │        │  器     │  │  循环    │           │  │  │
│  │       │        └─────────┘  └─────────┘           │  │  │
│  │       │              │              │              │  │  │
│  │       └──────────────┴──────────────┴──────────────┘  │  │
│  │                    (递归，最大深度5)                    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ 情感引擎 │  │ 关系引擎 │  │ 冲突解析 │  │ Writer  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

1. **用户输入** → 触发事件或直接注入世界事件
2. **Phase 1: 世界推进** → 更新时间、天气、环境变量
3. **Phase 2: 事件分发** → Hook路由器查询注册表，生成待调用Agent列表
4. **Phase 3: Agent调用** → 按优先级调用Agent，产出事件，可能触发新Hook（递归）
5. **Phase 4: 记录整合** → 持久化事件、更新情感/关系、维护Hook
6. **Writer** → 从事件日志生成小说文本

---

## [S3] 数据模型扩展

### 角色模板扩展

在现有 `createCharacterTemplate` 基础上新增 Agent 相关字段：

```javascript
// models.js - createCharacterTemplate 扩展
{
  // ...现有字段保留...
  
  // 新增：Agent 系统字段
  agent: {
    // 情感模型 (VAD + 离散情绪)
    emotion: {
      valence: 0,          // [-1, 1] 效价：负面←→正面
      arousal: 0.5,        // [0, 1] 唤醒度：平静←→激动
      primary: 'neutral',  // 主要情绪标签
      decay_rate: 0.1      // 每tick衰减率，向中性回归
    },
    
    // 关系图谱（动态版本）
    relationships: {
      // key: 目标角色ID
      // value: 四维关系值
      'char_xxx': {
        trust: 0.5,        // [0, 1] 信任度
        affection: 0,      // [-1, 1] 好感度
        tension: 0,        // [0, 1] 紧张度
        respect: 0.5       // [0, 1] 尊重度
      }
    },
    
    // Hook声明（静态Hook）
    hooks: [
      // 示例：当有人提到"北方王国"时调用我
      { type: 'on_topic_mentioned', condition: '北方王国', priority: 8 },
      // 示例：当有人进入神殿时调用我
      { type: 'on_location_enter', condition: 'scene_神殿', priority: 5 }
    ],
    
    // 人格向量（Big Five + 自定义维度）
    personality: {
      openness: 0.5,           // 开放性
      conscientiousness: 0.5,  // 尽责性
      extraversion: 0.5,       // 外向性
      agreeableness: 0.5,      // 宜人性
      neuroticism: 0.5,        // 神经质
      ambition: 0.5,           // 野心（自定义）
      vengefulness: 0.5        // 复仇心（自定义）
    }
  }
}
```

### 事件系统升级

从扁平四元组升级为分层事件：

```javascript
// models.js - 新增分层事件工厂
function createLayeredEvent(tick, worldTime, type, scene, participants, summary) {
  return {
    id: 'evt_' + Date.now().toString(36),
    
    // L1 主事件（始终存储）
    l1: {
      tick,
      world_time: worldTime,
      type,  // 'dialogue' | 'action' | 'thought' | 'world' | 'conflict' | 'relation'
      scene_id: scene,
      location: {},
      participants,
      summary,           // 一句话概括
      intent: null,       // 发起者意图
      subtext: null,      // 潜台词
      outcome: null,      // 结果
      emotional_snapshot: {},  // {charId: {valence, arousal, primary}}
      relationship_delta: [],  // [{agents, dimension, delta}]
      narrative_weight: 0.5,
      causal_links: [],
      triggered_hooks: [],
      spawned_hooks: [],
      has_details: false
    },
    
    // L2 详情块（按需存储）
    l2: [],  // [{block_id, detail_type, content}]
    
    // L3 微细节（可选）
    l3: []   // [{micro_type, content, source}]
  };
}
```

### Hook注册表

```javascript
// models.js - 新增Hook注册表
function createHookRegistry() {
  return {
    byType: {},   // {hookType: [HookEntry, ...]}
    byAgent: {},  // {agentId: [HookEntry, ...]}
  };
}

function createHookEntry(agentId, type, condition, opts = {}) {
  return {
    id: 'hook_' + Date.now().toString(36),
    agent_id: agentId,
    type,           // 9种Hook类型之一
    condition,      // 匹配条件
    priority: opts.priority || 5,
    source: opts.source || 'static',  // 'static' | 'dynamic'
    ttl: opts.ttl || null,            // 剩余存活tick数
    trigger_limit: opts.trigger_limit || null,
    trigger_count: 0,
    cooldown: opts.cooldown || null,
    last_triggered: null,
    created_at: opts.tick || 0
  };
}
```

### Story结构扩展

```javascript
// models.js - createStory 扩展
function createStory(title, loreSetId) {
  return {
    // ...现有字段...
    mode: 'unfolding',  // 'unfolding' | 'dynamic'
    
    // Dynamic World 专用字段
    hookRegistry: createHookRegistry(),
    simulationState: {
      tick: 0,
      worldTime: { year: 0, month: 0, day: 0, hour: 0, minute: 0 },
      worldFacts: {},     // 世界状态键值对
      activeAgents: [],   // 当前活跃Agent ID列表
      eventQueue: [],     // 待处理事件队列
      chaosLevel: 0.3     // 混沌度参数，控制随机性
    }
  };
}
```

---

## [S4] Hook系统设计

### Hook类型枚举

| Hook类型 | 触发条件 | 典型场景 |
|----------|----------|----------|
| `on_direct_interaction` | 另一个Agent直接与本Agent互动 | 达克斯对凯尔说话 → 调用凯尔 |
| `on_perception_range` | Agent感知范围内发生可观测事件 | 酒馆内发生打斗 → 在酒馆的Agent都被调用 |
| `on_topic_mentioned` | 对话或事件中涉及特定话题/关键词 | 有人提到"北方王国" → 注册了此Hook的凯尔被调用 |
| `on_condition_met` | 世界状态满足特定条件 | "当守卫数量>10时调用我" |
| `on_world_event` | 特定类型的世界事件发生 | "任何天象异常调用我" |
| `on_relationship_change` | 某个关系维度越过阈值 | "任何人对我的信任低于0.2时调用我" |
| `on_time_trigger` | 到达特定时间点或时间间隔 | "每天黎明调用我祈祷" |
| `on_location_enter` | 有人进入Agent关注的地点 | "任何人进入我的密室调用我" |
| `on_emotion_spike` | 某Agent的情感波动超过阈值 | "当凯尔的情绪极化时调用我" |

### Hook路由器实现

```javascript
// hook-router.js
function routeHooks(registry, events, story) {
  const invocations = [];
  
  for (const event of events) {
    // 1. on_direct_interaction
    if (event.l1.type === 'dialogue' || event.l1.type === 'action') {
      for (const target of event.l1.participants) {
        if (target !== event.actor) {
          invocations.push({
            agentId: target,
            triggerEvent: event,
            hookType: 'on_direct_interaction',
            priority: 10
          });
        }
      }
    }
    
    // 2. on_perception_range
    const agentsInScene = getAgentsInScene(story, event.l1.scene_id);
    for (const aid of agentsInScene) {
      if (!event.l1.participants.includes(aid)) {
        invocations.push({
          agentId: aid,
          triggerEvent: event,
          hookType: 'on_perception_range',
          priority: 5
        });
      }
    }
    
    // 3-9. 其他Hook类型...
    // 使用LLM语义匹配或结构化条件表达式
  }
  
  return deduplicateAndSort(invocations);
}
```

---

## [S5] Agent认知循环

### 认知流程

```
感知 → 记忆检索 → 情感评估 → 决策 → 行动 → 产出
```

### Agent决策输出格式（待讨论）

**推荐：结构化JSON**

```json
{
  "action_type": "speech" | "action" | "thought" | "mixed",
  "content": "行动描述",
  "target": "目标角色ID（如有）",
  "emotion_update": {
    "valence_delta": 0.1,
    "arousal_delta": -0.05,
    "primary": "determination"
  },
  "relationship_updates": [
    { "target": "char_xxx", "dimension": "trust", "delta": -0.1 }
  ],
  "new_hooks": [
    { "type": "on_topic_mentioned", "condition": "...", "ttl": 10 }
  ],
  "subtext": "潜台词/深层动机"
}
```

### Agent调用流程

```javascript
// agent-cognitive.js
async function invokeAgent(story, agentId, context) {
  const agent = getAgentState(story, agentId);
  
  // 1. 感知：筛选与Agent相关的信息
  const perception = filterPerception(context, agent);
  
  // 2. 记忆检索：从事件历史中提取相关记忆
  const memories = retrieveMemories(story, agentId, perception);
  
  // 3. 情感评估：当前情感状态 + 触发事件的影响
  const emotionContext = buildEmotionContext(agent, perception);
  
  // 4. 决策：LLM生成Agent的行动
  const decision = await callLLM(
    buildAgentDecisionPrompt(agent, perception, memories, emotionContext)
  );
  
  // 5. 解析输出
  const parsed = parseAgentOutput(decision);
  
  // 6. 生成事件
  const events = generateEventsFromAgentAction(agentId, parsed, context);
  
  return {
    agentId,
    events,
    emotionUpdate: parsed.emotion_update,
    relationshipUpdates: parsed.relationship_updates,
    dynamicHooks: parsed.new_hooks || []
  };
}
```

---

## [S6] 情感引擎

### 情感模型

采用 VAD 模型（Valence-Arousal-Dominance）+ 离散情绪标签：

- **Valence** [-1, 1]：负面←→正面
- **Arousal** [0, 1]：平静←→激动
- **Primary**：离散情绪标签（grief, joy, anger, fear, surprise, disgust, trust, anticipation）

### 情感衰减机制

解决 WorldCraft 中"永远悲伤"的问题：

```javascript
// emotion-engine.js
function updateEmotion(agent, event) {
  // 1. 事件引起的情感变化
  const delta = computeEmotionDelta(event, agent.personality);
  agent.emotion.valence = clamp(agent.emotion.valence + delta.valence, -1, 1);
  agent.emotion.arousal = clamp(agent.emotion.arousal + delta.arousal, 0, 1);
  agent.emotion.primary = delta.primary || agent.emotion.primary;
  
  // 2. 时间衰减：每tick情感向中性回归
  agent.emotion.valence *= (1 - agent.emotion.decay_rate);
  agent.emotion.arousal = agent.emotion.arousal * (1 - agent.emotion.decay_rate) 
                          + 0.5 * agent.emotion.decay_rate;
}
```

---

## [S7] 关系动态引擎

### 关系模型

四维关系模型：
- **Trust** [0, 1]：信任度
- **Affection** [-1, 1]：好感度
- **Tension** [0, 1]：紧张度
- **Respect** [0, 1]：尊重度

### 关系更新规则

```javascript
// relationship-engine.js
function updateRelationship(agentA, agentB, event, outcome) {
  const relAtoB = agentA.relationships[agentB.id] || createDefaultRelationship();
  const relBtoA = agentB.relationships[agentA.id] || createDefaultRelationship();
  
  // 根据事件类型和结果计算关系变化
  const delta = computeRelationshipDelta(event, outcome, agentA.personality, agentB.personality);
  
  // 双向更新
  relAtoB.trust = clamp(relAtoB.trust + delta.a_to_b.trust, 0, 1);
  relAtoB.affection = clamp(relAtoB.affection + delta.a_to_b.affection, -1, 1);
  // ... 其他维度
  
  relBtoA.trust = clamp(relBtoA.trust + delta.b_to_a.trust, 0, 1);
  // ... 其他维度
}
```

---

## [S8] 冲突解析器

### 冲突检测

当两个Agent的行动目标相互矛盾时触发冲突：

```javascript
// conflict-resolver.js
function detectConflicts(agentOutputs) {
  const conflicts = [];
  
  for (let i = 0; i < agentOutputs.length; i++) {
    for (let j = i + 1; j < agentOutputs.length; j++) {
      const a = agentOutputs[i];
      const b = agentOutputs[j];
      
      if (isConflicting(a, b)) {
        conflicts.push({
          agentA: a.agentId,
          agentB: b.agentId,
          type: determineConflictType(a, b),  // 'combat' | 'persuasion' | 'deception'
          actionA: a.events,
          actionB: b.events
        });
      }
    }
  }
  
  return conflicts;
}
```

### 冲突解析

基于能力、情境、关系、人格的概率仲裁：

```javascript
function resolveConflict(conflict, story) {
  const agentA = getAgentState(story, conflict.agentA);
  const agentB = getAgentState(story, conflict.agentB);
  
  // 计算双方得分
  const scoreA = computeAgentScore(agentA, conflict.type);
  const scoreB = computeAgentScore(agentB, conflict.type);
  
  // 概率裁决（注入叙事不确定性）
  const chaosLevel = story.simulationState.chaosLevel || 0.3;
  const outcome = probabilisticResolution(scoreA, scoreB, chaosLevel);
  
  return {
    winner: outcome.winner,
    events: generateConflictEvents(conflict, outcome),
    relationshipChanges: computeRelationshipDelta(outcome)
  };
}
```

---

## [S9] 分层事件存储

### 三层架构

| 层级 | 名称 | 内容 | 存储策略 |
|------|------|------|----------|
| L1 | 主事件 | 高层概括，一句话描述 | 始终存储 |
| L2 | 详情块 | 对话原文、动作描述、环境描写 | 按需存储 |
| L3 | 微细节 | 感官细节、微表情、氛围 | 可选，可淘汰 |

### Writer集成

Writer主要消费L1事件，L2仅在深度渲染时使用：

```javascript
// 在Writer提示词中
const writerInput = events.map(e => {
  let input = `[${e.l1.world_time}] ${e.l1.summary}`;
  if (e.l1.intent) input += `\n意图: ${e.l1.intent}`;
  if (e.l1.outcome) input += `\n结果: ${e.l1.outcome}`;
  return input;
}).join('\n\n');
```

---

## [S10] 与现有系统的集成

### 文件结构

```
js/engine/
├── tick-runner.js          # 现有：Unfolding World 管线（不修改）
├── dynamic-runner.js       # 新增：Dynamic World 模拟循环主入口
├── agent-cognitive.js      # 新增：Agent 认知循环
├── hook-router.js          # 新增：Hook 路由器
├── conflict-resolver.js    # 新增：冲突解析器
├── emotion-engine.js       # 新增：情感引擎
├── relationship-engine.js  # 新增：关系动态引擎
└── pipeline-helpers.js     # 现有：扩展解析工具

js/prompts/
├── system-prompts.js       # 现有：新增Agent决策、冲突解析等提示词
└── prompt-builders.js      # 现有：新增Agent决策prompt builder

js/core/
└── models.js               # 现有：扩展数据模型
```

### 模式切换逻辑

```javascript
// deduction-bridge.js 或 dialogue.js
async function runStoryTick(story, userMessage, onProgress) {
  if (story.mode === 'dynamic') {
    return await runDynamicTick(story, userMessage, onProgress);
  } else {
    return await runTick(story, userMessage, onProgress);
  }
}
```

---

## [S11] 实施阶段

### Phase 1：数据层扩展
- 扩展 `models.js`：新增Agent字段、分层事件、Hook注册表
- 确保向后兼容：现有Story不受影响

### Phase 2：引擎核心
- 实现 `hook-router.js`
- 实现 `agent-cognitive.js`
- 实现 `emotion-engine.js`
- 实现 `dynamic-runner.js`

### Phase 3：辅助引擎
- 实现 `relationship-engine.js`
- 实现 `conflict-resolver.js`

### Phase 4：Writer适配
- 确保Writer能消费分层事件
- 测试小说生成质量

### Phase 5：UI集成
- 模式选择UI
- Agent状态面板
- 事件日志浏览器

---

## [S12] 待讨论事项

1. **Hook匹配机制**：LLM语义匹配 vs 结构化条件表达式 vs 混合方案
2. **Agent输出格式**：结构化JSON vs 自由文本+后解析 vs MTIP-C扩展
3. **整体架构**：单循环+Hook驱动 vs 多循环并行 vs 事件总线架构
4. **时间系统**：固定步长 vs 可变步长 vs 事件驱动
5. **NPC轻量调用**：是否需要区分核心Agent和轻量NPC

---

## [S13] 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM调用成本高 | 性能和成本 | 实现NPC轻量调用、缓存机制 |
| 事件涌现不可控 | 叙事质量 | 混沌度参数、用户可注入事件 |
| Hook递归过深 | 性能 | 最大深度限制（5层） |
| 情感/关系更新过于频繁 | 计算开销 | 批量更新、阈值触发 |
| 与现有系统冲突 | 稳定性 | Story级别隔离、独立测试 |
