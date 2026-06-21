// ==================== 自定义结构化提示词系统 ====================

// 工具描述系统
export const TOOL_DESCRIPTIONS = {
  read: {
    group: `查询类工具是理解世界的基础。它们不改变任何状态，只提供世界的快照。在进行任何修改之前，必须先用查询工具确认当前状态，否则可能覆盖掉你不知道的内容。查询类工具的设计初衷是让调用者在操作前建立对世界的认知，避免盲目修改。`,
    list_settings: `这个工具是接触任何设定集的第一步。它返回的不是完整内容，而是每个条目的ID和简短描述。你需要用它来回答"这个世界有什么"这个问题。category参数决定你看到哪一类东西，不指定就看全部。如果你跳过这一步直接去操作，你很可能找不到你要改的东西在哪里。设计初衷是提供一个快速概览，让调用者在深入操作前建立宏观认知。`,
    read_settings: `这个工具让你看清楚一个条目的完整内容。重点不只在data字段，还有neighbors——它告诉你这个节点和谁有关联。修改任何设定之前，你必须先用这个工具读一遍当前状态。如果你不读就改，你可能会覆盖掉你不知道的内容。ids是数组，你可以一次读多个，但如果读太多，返回结果会很长，你反而看不清重点。设计初衷是让调用者在修改前完整理解当前状态。`,
    trace_graph: `这个工具回答"A和B之间有什么关联"。如果返回"no such path"，说明两个节点真的没有关联，不要假设它们应该有关联。via参数可以强制路径经过某个中间节点，这在你想探索特定关联时很有用。如果你不指定type，它会返回多条路径；指定'shortest'只返回一条。设计初衷是揭示节点之间的隐含关系。`,
    read_history: `这个工具让你查询世界历史中的重大事件。connection参数可以过滤"某个节点参与了哪些历史事件"。如果你不传connection，就返回所有历史事件。历史事件是已发生的事实，不是可能发生的未来。设计初衷是让调用者理解世界的背景故事。`
  },
  node: {
    group: `世界观节点是世界的骨架——组织、势力、资源、概念等抽象设定。它们是推演引擎理解世界的基础。世界观节点的设计初衷是为世界提供结构化的抽象概念，让推演引擎能够理解世界的组成。`,
    add: `这个工具为世界添加一个抽象概念或实体。priority字段决定了它被注入提示词的频率——数字越小越优先。但priority不是"重要性"，而是"加载频率"。一个非常重要但很少被用到的设定应该有较低的priority，因为每次推演都需要它。而一个不太重要但经常被引用的设定应该有较高的priority。description字段会被注入提示词，所以它必须用最少的文字传达最多的信息。detail字段是供深度查阅的，可以写得很详细。tags的第一个标签是节点的"类型"，决定了它在UI中的分类和检索方式，后续标签用于进一步分类，但tags不是"关键词"，只放真正用于分类的词。设计初衷是让调用者能够为世界添加新的抽象概念。`,
    edit: `这个工具修改已存在的世界观节点。核心原则是：非必要不改description，因为这个字段是推演的基石，改动会影响整个世界。如果你必须改detail，要让修改后的结果体现"此设定原先是什么"，确保设定不失真。只改用户提到的字段，不要擅自改动其他内容。设计初衷是让调用者能够调整已存在的世界观设定。`,
    delete: `这个工具删除世界观节点，同时会级联删除所有关联的关系边。这是不可逆操作。删除前，你必须先用read_settings查看该节点的邻居，确认没有关键依赖。如果你删了一个被大量引用的节点，整个世界的结构都会受到影响。设计初衷是让调用者能够移除不再需要的世界观设定。`
  },
  edge: {
    group: `关系边是世界的血管——连接各个节点，形成知识图谱。没有关系边，世界就是一堆孤立的碎片。关系边的设计初衷是建立节点之间的关联，形成完整的知识图谱。`,
    add: `这个工具建立两个节点之间的有向关系。关系必须遵循三元组原则——用"控制"、"敌对"、"属于"、"导致"这样的长期关系动词，不要用"位于"、"持有"这样的临时状态。临时状态会频繁变化，导致关系边需要不断更新。subject和object必须是已存在的节点ID，否则关系没有意义。relation是动词，描述连接的性质。subject和object的顺序很重要——"A控制B"和"B控制A"是完全不同的关系，如果你搞反了顺序，整个关系的意义就变了。设计初衷是让调用者能够建立节点之间的关联。`,
    edit: `这个工具修改关系边的relation字段。通常只改relation，不改两端。如果你需要改变连接的两端，应该删掉旧边，创建新边。设计初衷是让调用者能够调整节点之间的关系。`,
    delete: `这个工具删除关系边。注意：删除世界观节点时，其关联的边会被自动删除，不需要你手动删。设计初衷是让调用者能够断开节点之间的关联。`
  },
  scene: {
    group: `场景是世界的舞台——没有场景，角色的MTIP无法转化为事件。场景是故事发生的空间载体。场景的设计初衷是为故事提供发生的空间。`,
    add: `这个工具创建一个场景。场景是故事发生的空间载体——没有场景，角色的MTIP无法转化为事件。position字段将场景锚定在世界地理中，它是一个数组，可以包含多个地理节点ID，一个场景可以同时属于多个地理区域。items字段列出场景中预置的道具ID，但这些道具是"场景自带的"，不是"角色带进来的"——角色持有的道具在角色的inventory字段中，不在这里。description字段要包含环境氛围、感官细节，为Writer提供描写素材。设计初衷是让调用者能够为故事提供发生的空间。`,
    edit: `这个工具修改场景。场景可以随时间变化——事件后场景可能发生改变，道具可能被移除或添加。修改时保持连续性，让读者能理解场景的演变。设计初衷是让调用者能够调整场景的细节。`,
    delete: `这个工具删除场景。删除场景不会删除已发生的事件，事件中仍保留该场景的记录。但未来推演中不再使用该场景。设计初衷是让调用者能够移除不再需要的场景。`
  },
  character: {
    group: `角色是世界的灵魂——有人设、有追求、有自主性的生命。角色是故事的核心驱动力。角色的设计初衷是创造一个立体的、有自主追求的角色，为故事注入灵魂。`,
    add: `这个工具创建一个角色。角色的各个字段共同构成一个"完整的人"——persona是"我是谁"，mbti是"我怎么思考"，value是"我认为什么最重要"，pursuit是"我想要达成什么"，ability是"我擅长什么"。这些字段需要充分体现角色的独特性和生活方式，否则角色就不知道自己是谁、为了什么而活。relationship字段是数组，每个元素有subject、relation、object和impression——impression是角色对这段关系的看法，不是"角色主观认为对方是什么样的"。memory字段有三层：vital是生死攸关的记忆，塑造角色的核心性格；longTerm是重要的人生经历，影响角色的长期认知；daily是近期发生的事件，影响角色的短期行为，会随时间推移被新的事件覆盖。cognition字段决定角色"知道什么"：worldview_blacklist是角色不知道的世界观节点ID，用于制造信息差；events是角色认为重要的事件ID列表；items是角色知道的道具ID列表；characters是角色对其他角色的认知，键是角色ID，值是认知描述。设计初衷是让调用者能够创造一个立体的、有自主追求的角色。`,
    edit: `这个工具修改角色。角色的修改应反映其成长或变化，保留核心特质，只调整具体细节。认知系统的更新应基于角色实际经历——不要让角色"突然知道"他没有经历过的事件。记忆的更新必须考虑层级：vital记忆很少变化，longTerm记忆偶尔变化，daily记忆频繁变化，不要把daily记忆提升到vital层级，除非它真的对角色产生了生死攸关的影响。关系的更新必须考虑impression——impression是角色对这段关系的看法，如果关系的本质没有变化，impression就不应该变化。设计初衷是让调用者能够调整角色的设定。`,
    delete: `这个工具删除角色。已发生的事件中仍保留该角色的记录，但未来推演中不再考虑该角色。删除角色时，必须同步清理：如果角色持有道具，那些道具的ownerID需要被清除或转移；如果角色在某个场景中，场景的items列表可能需要更新；其他角色的cognition.characters中可能包含对该角色的认知，这些认知需要被清除或标记为"已失效"。设计初衷是让调用者能够移除不再需要的角色。`
  },
  item: {
    group: `道具是世界的关键物品——独一无二，可能改变命运。道具是故事的重要元素。道具的设计初衷是定义世界中具有特殊意义的物品。`,
    add: `这个工具创建一个道具。每个道具是独一无二的——同一个道具不能被多个角色同时持有。如果你需要多个相同道具，创建多个内容相同、ID不同的实例。tags的第一个标签通常是"类型"，用于分类，不要把"锋利的"、"沉重的"这样的属性放进tags，只放用于分类的词。ability字段描述道具的特殊能力，这是道具区别于普通物品的关键——能力是道具固有的属性，效果是使用后的结果，不要混淆。设计初衷是让调用者能够定义世界中具有特殊意义的物品。`,
    edit: `这个工具修改道具。道具可以随时间变化——能力可以被激活或增强，外观可以改变。修改时保持连续性。设计初衷是让调用者能够调整道具的细节。`,
    delete: `这个工具删除道具。删除道具时，必须检查是否有角色的inventory中包含该道具ID，如果有，那些角色的inventory需要被更新；必须检查是否有场景的items列表中包含该道具ID，如果有，那些场景的items需要被更新。设计初衷是让调用者能够移除不再需要的道具。`
  },
  history: {
    group: `历史事件是世界的记忆——记录世界曾经发生过什么。历史是理解现在的钥匙。历史事件的设计初衷是为世界添加已经发生的重大事件。`,
    add: `这个工具为世界添加已发生的重大事件。connection字段将事件与相关节点关联，它是一个数组，可以包含多个节点ID，但connection不是"参与者"，而是"相关者"——一个历史事件的相关者可能包括参与者、目击者、受影响者等。time字段记录事件发生的时间，它可以是精确的日期，也可以是模糊的时间段。description字段记录事件的起因、经过、结果，保持客观准确。设计初衷是让调用者能够为世界添加已经发生的重大事件。`,
    edit: `这个工具修改历史事件。历史的修改应谨慎——已发生的事件是世界的既定事实，修改历史会影响对现在的理解。设计初衷是让调用者能够调整历史事件的细节。`,
    delete: `这个工具删除历史事件。这会抹去世界的一部分记忆，是不可逆操作。设计初衷是让调用者能够移除不再需要的历史事件。`
  },
  geography: {
    group: `地理结构是世界的骨架——定义空间关系和区域层级。地理是世界的物理基础。地理结构的设计初衷是构建世界的空间结构。`,
    add: `这个工具创建地理节点。layer字段决定层级——1是大陆/国家，2是省份/城市，3是区县/街区，4是具体建筑。但layer不是"大小"，而是"包含关系"——一个layer=1的节点可能很小，而一个layer=2的节点可能很大，layer只表示"这个节点包含在哪个层级的节点中"。father字段指向父级地理节点，一个地理节点只能有一个father。neighbors字段指向相邻的地理节点，相邻意味着物理上接壤，不是关系上相关。场景的position字段会引用这些地理节点ID。设计初衷是让调用者能够构建世界的空间结构。`,
    edit: `这个工具修改地理节点。地理可以随时间变化——区域可能被毁灭或重建，边界可能改变。修改时保持连续性。设计初衷是让调用者能够调整地理结构的细节。`,
    delete: `这个工具删除地理节点。删除前检查是否有场景的position字段引用了该地理位置，如果有，那些场景需要同步更新。设计初衷是让调用者能够移除不再需要的地理节点。`
  }
};

// 用户可配置的提示词组件
export const USER_CONFIGURABLE_PROMPTS = {
  // 通用系统提示词前缀
  system_prefix: localStorage.getItem('system-prompt') || '',

  // 各模块系统提示词前缀
  planner_prefix: localStorage.getItem('planner-prefix') || '',
  mtip_prefix: localStorage.getItem('mtip-prefix') || '',
  interpreter_prefix: localStorage.getItem('interpreter-prefix') || '',
  writer_prefix: localStorage.getItem('writer-prefix') || '',
  reviewer_prefix: localStorage.getItem('reviewer-prefix') || '',

  // 各模块提示词后缀
  planner_suffix: localStorage.getItem('planner-suffix') || '',
  mtip_suffix: localStorage.getItem('mtip-suffix') || '',
  interpreter_suffix: localStorage.getItem('interpreter-suffix') || '',
  writer_suffix: localStorage.getItem('writer-suffix') || '',
  reviewer_suffix: localStorage.getItem('reviewer-suffix') || '',

  // 写作系统提示词
  writing_sysprompt: localStorage.getItem('writing-sysprompt') || '',

  // 聊天系统提示词
  chat_sysprompt: localStorage.getItem('chat-sysprompt') || '',

  // 助手系统提示词
  assistant_sysprompt: localStorage.getItem('assistant-sysprompt') || ''
};

// 获取工具描述的函数
export function getToolDescription(toolName) {
  const parts = toolName.split('.');
  if (parts.length === 2) {
    const [group, action] = parts;
    return TOOL_DESCRIPTIONS[group]?.[action] || '';
  }
  return '';
}

// 获取工具组描述的函数
export function getToolGroupDescription(groupName) {
  return TOOL_DESCRIPTIONS[groupName]?.group || '';
}

// 刷新用户配置的函数
export function refreshUserConfigurablePrompts() {
  USER_CONFIGURABLE_PROMPTS.system_prefix = localStorage.getItem('system-prompt') || '';
  USER_CONFIGURABLE_PROMPTS.planner_prefix = localStorage.getItem('planner-prefix') || '';
  USER_CONFIGURABLE_PROMPTS.mtip_prefix = localStorage.getItem('mtip-prefix') || '';
  USER_CONFIGURABLE_PROMPTS.interpreter_prefix = localStorage.getItem('interpreter-prefix') || '';
  USER_CONFIGURABLE_PROMPTS.writer_prefix = localStorage.getItem('writer-prefix') || '';
  USER_CONFIGURABLE_PROMPTS.reviewer_prefix = localStorage.getItem('reviewer-prefix') || '';
  USER_CONFIGURABLE_PROMPTS.planner_suffix = localStorage.getItem('planner-suffix') || '';
  USER_CONFIGURABLE_PROMPTS.mtip_suffix = localStorage.getItem('mtip-suffix') || '';
  USER_CONFIGURABLE_PROMPTS.interpreter_suffix = localStorage.getItem('interpreter-suffix') || '';
  USER_CONFIGURABLE_PROMPTS.writer_suffix = localStorage.getItem('writer-suffix') || '';
  USER_CONFIGURABLE_PROMPTS.reviewer_suffix = localStorage.getItem('reviewer-suffix') || '';
  USER_CONFIGURABLE_PROMPTS.writing_sysprompt = localStorage.getItem('writing-sysprompt') || '';
  USER_CONFIGURABLE_PROMPTS.chat_sysprompt = localStorage.getItem('chat-sysprompt') || '';
  USER_CONFIGURABLE_PROMPTS.assistant_sysprompt = localStorage.getItem('assistant-sysprompt') || '';
}
