export const LORESET_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_worldview_node',
      description: '向 worldview.nodes 添加一个新节点',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          id: { type: 'string', description: '新节点 ID，不填则自动生成' },
          name: { type: 'string', description: '节点名称' },
          priority: { type: 'number', description: '优先级，数字越小越重要', default: 99 },
          tags: { type: 'array', items: { type: 'string' }, description: '标签数组，第一个元素作为类型' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '简要描述' },
              detail: { type: 'string', description: '详细描述' }
            },
            required: ['description']
          }
        },
        required: ['lore_path', 'name', 'tags', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_worldview_node',
      description: '编辑已有的世界观节点',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          node_id: { type: 'string', description: '要编辑的节点 ID' },
          name: { type: 'string', description: '新名称（可选）' },
          priority: { type: 'number', description: '新优先级（可选）' },
          tags: { type: 'array', items: { type: 'string' }, description: '新标签（可选）' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '新简要描述（可选）' },
              detail: { type: 'string', description: '新详细描述（可选）' }
            }
          }
        },
        required: ['lore_path', 'node_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_worldview_node',
      description: '删除世界观节点及其关联的边',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          node_id: { type: 'string', description: '要删除的节点 ID' }
        },
        required: ['lore_path', 'node_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_edge',
      description: '向 worldview.edges 添加一条有向关系边。subject 和 object 可以是世界观节点、角色、场景、道具等任意实体的 ID',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          id: { type: 'string', description: '新边 ID，不填则自动生成' },
          subject: { type: 'string', description: '源节点 ID，边的起点' },
          relation: { type: 'string', description: '关系类型' },
          object: { type: 'string', description: '目标节点 ID，边的终点' }
        },
        required: ['lore_path', 'subject', 'relation', 'object']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_edge',
      description: '编辑已有关系边的关系类型',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          edge_id: { type: 'string', description: '要编辑的边 ID' },
          relation: { type: 'string', description: '新的关系类型' }
        },
        required: ['lore_path', 'edge_id', 'relation']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_edge',
      description: '删除关系边',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          edge_id: { type: 'string', description: '要删除的边 ID' }
        },
        required: ['lore_path', 'edge_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_scene',
      description: '向设定集或独立故事添加新场景',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          id: { type: 'string', description: '新场景 ID，不填则自动生成' },
          name: { type: 'string', description: '场景名称' },
          position: { type: 'array', items: { type: 'string' }, description: '关联的地理节点 ID 数组' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '简要描述' },
              detail: { type: 'string', description: '详细描述' }
            },
            required: ['description']
          },
          items: { type: 'array', items: { type: 'string' }, description: '位于此场景内的道具 ID 数组' }
        },
        required: ['lore_path', 'name', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_scene',
      description: '编辑已有场景',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          scene_id: { type: 'string', description: '场景 ID' },
          name: { type: 'string', description: '新名称（可选）' },
          position: { type: 'array', items: { type: 'string' }, description: '新位置（可选）' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '新简要描述（可选）' },
              detail: { type: 'string', description: '新详细描述（可选）' }
            }
          },
          items: { type: 'array', items: { type: 'string' }, description: '更新场景内道具ID列表（可选）' }
        },
        required: ['lore_path', 'scene_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_scene',
      description: '删除场景',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          scene_id: { type: 'string', description: '场景 ID' }
        },
        required: ['lore_path', 'scene_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_character',
      description: '向设定集或独立故事添加新角色',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          id: { type: 'string', description: '新角色 ID，不填则自动生成' },
          name: { type: 'string', description: '角色名称' },
          persona: { type: 'string', description: '人物画像/性格' },
          mbti: { type: 'string', description: 'MBTI 类型' },
          value: { type: 'string', description: '价值观' },
          pursuit: { type: 'string', description: '追求/动机' },
          ability: { type: 'string', description: '能力' },
          goal: { type: 'string', description: '当前目标' },
          cognition: {
            type: 'object',
            description: '角色所知晓的设定、事件、道具与角色，全都是ID。',
            properties: {
              worldview_blacklist: { type: 'array', items: { type: 'string' }, description: '角色不知道的世界观设定ID列表' },
              events: { type: 'array', items: { type: 'string' }, description: '角色知晓的事件/故事ID列表' },
              items: { type: 'array', items: { type: 'string' }, description: '角色知晓的道具ID列表' },
              characters: { type: 'object', additionalProperties: { type: 'string' }, description: '角色对其他角色的认知印象，key为角色ID，value为印象描述' }
            }
          },
          relationship: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'string', description: '发起关系的角色ID' },
                relation: { type: 'string', description: '关系类型/标签' },
                object: { type: 'string', description: '关系目标对象角色ID' },
                impression: { type: 'string', description: '当前角色对目标角色的认知 and 印象' }
              },
              required: ['subject', 'relation', 'object', 'impression']
            },
            description: '角色关系与印象列表'
          },
          memory: {
            type: 'object',
            description: '角色记忆',
            properties: {
              vital: { type: 'array', items: { type: 'string' }, description: '关键记忆（不可遗忘）' },
              longTerm: { type: 'array', items: { type: 'string' }, description: '长期记忆' },
              daily: { type: 'array', items: { type: 'string' }, description: '日常记忆' }
            }
          },
          inventory: { type: 'array', items: { type: 'string' }, description: '角色持有的道具 ID 列表' }
        },
        required: ['lore_path', 'name', 'persona', 'mbti', 'value', 'pursuit']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_character',
      description: '编辑已有角色',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          char_id: { type: 'string', description: '角色 ID' },
          name: { type: 'string', description: '新名称（可选）' },
          persona: { type: 'string', description: '新人物画像（可选）' },
          mbti: { type: 'string', description: '新MBTI（可选）' },
          value: { type: 'string', description: '新价值观（可选）' },
          pursuit: { type: 'string', description: '新追求（可选）' },
          ability: { type: 'string', description: '新能力（可选）' },
          goal: { type: 'string', description: '新目标（可选）' },
          cognition: {
            type: 'object',
            description: '更新角色的认知世界（可选）',
            properties: {
              worldview_blacklist: { type: 'array', items: { type: 'string' }, description: '新的角色不知道的世界观设定ID列表' },
              events: { type: 'array', items: { type: 'string' }, description: '新的角色知晓的事件/故事ID列表' },
              items: { type: 'array', items: { type: 'string' }, description: '新的角色知晓的道具ID列表' },
              characters: { type: 'object', additionalProperties: { type: 'string' }, description: '更新角色对其他角色的认知印象，key为角色ID，value为印象描述' }
            }
          },
          relationship: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'string', description: '发起关系的角色ID' },
                relation: { type: 'string', description: '关系类型/标签' },
                object: { type: 'string', description: '关系目标对象角色ID' },
                impression: { type: 'string', description: '当前角色对目标角色的认知 and 印象' }
              },
              required: ['subject', 'relation', 'object', 'impression']
            },
            description: '更新角色关系与印象列表（可选）'
          },
          memory: {
            type: 'object',
            description: '更新角色记忆（可选）',
            properties: {
              vital: { type: 'array', items: { type: 'string' }, description: '新的关键记忆' },
              longTerm: { type: 'array', items: { type: 'string' }, description: '新的长期记忆' },
              daily: { type: 'array', items: { type: 'string' }, description: '新的日常记忆' }
            }
          },
          inventory: { type: 'array', items: { type: 'string' }, description: '更新角色持有的道具 ID 列表（可选）' }
        },
        required: ['lore_path', 'char_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_character',
      description: '删除角色',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          char_id: { type: 'string', description: '角色 ID' }
        },
        required: ['lore_path', 'char_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'add_item',
      description: '向设定集或独立故事添加新道具',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          id: { type: 'string', description: '新道具 ID，不填则自动生成' },
          name: { type: 'string', description: '道具名称' },
          tags: { type: 'array', items: { type: 'string' }, description: '标签数组' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '简要描述' },
              detail: { type: 'string', description: '详细描述' }
            },
            required: ['description']
          },
          ability: { type: 'string', description: '能力/功能', default: '' }
        },
        required: ['lore_path', 'name', 'tags', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_item',
      description: '编辑已有道具',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          item_id: { type: 'string', description: '道具 ID' },
          name: { type: 'string', description: '新名称（可选）' },
          tags: { type: 'array', items: { type: 'string' }, description: '新标签（可选）' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '新简要描述（可选）' },
              detail: { type: 'string', description: '新详细描述（可选）' }
            }
          },
          ability: { type: 'string', description: '新能力（可选）' }
        },
        required: ['lore_path', 'item_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_item',
      description: '删除道具',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          item_id: { type: 'string', description: '道具 ID' }
        },
        required: ['lore_path', 'item_id']
      }
    }
  },

  // --- 历史事件 ---
  {
    type: 'function',
    function: {
      name: 'add_history',
      description: '向 worldview.history 添加历史事件',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          id: { type: 'string', description: '新事件 ID，不填则自动生成' },
          name: { type: 'string', description: '事件名称' },
          time: { type: 'string', description: '发生时间' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '简要描述' },
              detail: { type: 'string', description: '详细描述' }
            },
            required: ['description']
          },
          connection: { type: 'array', items: { type: 'string' }, description: '关联的世界观节点 ID 列表' }
        },
        required: ['lore_path', 'name', 'time', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_history',
      description: '编辑已有历史事件',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          history_id: { type: 'string', description: '历史事件 ID' },
          time: { type: 'string', description: '新时间（可选）' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '新简要描述（可选）' },
              detail: { type: 'string', description: '新详细描述（可选）' }
            }
          },
          connection: { type: 'array', items: { type: 'string' }, description: '新关联节点列表（可选）' }
        },
        required: ['lore_path', 'history_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_history',
      description: '删除历史事件',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          history_id: { type: 'string', description: '历史事件 ID' }
        },
        required: ['lore_path', 'history_id']
      }
    }
  },

  // --- 地理结构 ---
  {
    type: 'function',
    function: {
      name: 'add_geography',
      description: '向 worldview.geography 添加地理节点',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          id: { type: 'string', description: '新节点 ID，不填则自动生成' },
          name: { type: 'string', description: '地理节点名称' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '描述' }
            },
            required: ['description']
          },
          neighbors: { type: 'array', items: { type: 'string' }, description: '同层相邻地理节点 ID 列表' },
          layer: { type: 'number', description: '纵向空间层级' },
          father: { type: 'string', description: '归属的上一级地理区域 ID' }
        },
        required: ['lore_path', 'name', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_geography',
      description: '编辑已有地理节点',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          geo_id: { type: 'string', description: '地理节点 ID' },
          name: { type: 'string', description: '新名称（可选）' },
          content: {
            type: 'object',
            properties: {
              description: { type: 'string', description: '新描述（可选）' }
            }
          },
          neighbors: { type: 'array', items: { type: 'string' }, description: '新邻居列表（可选）' },
          layer: { type: 'number', description: '新层级（可选）' },
          father: { type: 'string', description: '新父级（可选）' }
        },
        required: ['lore_path', 'geo_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_geography',
      description: '删除地理节点',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          geo_id: { type: 'string', description: '地理节点 ID' }
        },
        required: ['lore_path', 'geo_id']
      }
    }
  },

  // --- 查询类 ---
  {
    type: 'function',
    function: {
      name: 'list_settings',
      description: '列出指定类别下所有条目的 ID 和 description',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          category: { type: 'string', enum: ['worldview', 'scene', 'character', 'item', 'history', 'geography', 'all'], description: '要列出的类别，all 表示全部', default: 'all' }
        },
        required: ['lore_path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_settings',
      description: '查询一个或多个设定条目的完整内容，包含全部字段以及当前版本号（如果是 default 则返回 version=0）。同时返回在图谱中的一跳邻居的 ID 和 description',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          ids: {
            type: 'array',
            items: { type: 'string' },
            description: '要查询的条目 ID 列表'
          }
        },
        required: ['lore_path', 'ids']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'trace_versions',
      description: '查询设定条目的历史版本。仅在故事实例中可用，设定集模板无版本历史。默认返回上一版',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          target_id: { type: 'string', description: '要查询的条目 ID' },
          count: { type: 'number', description: '读取的版本数量，默认1即上一版，填0返回所有版本', default: 1 }
        },
        required: ['lore_path', 'target_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'trace_graph',
      description: '在图谱中查找两个节点之间的路径。仅通过正向边推导，不走反向边。无路径返回 no such path',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          source_id: { type: 'string', description: '起点节点 ID' },
          target_id: { type: 'string', description: '终点节点 ID' },
          type: { type: 'string', enum: ['shortest', 'default'], description: '路径类型。shortest=BFS最短路径；default=系统查找的首条可用路径', default: 'default' },
          via: { type: 'string', description: '途径节点要求' },
          count: { type: 'number', description: '返回的路径数量', default: 3 }
        },
        required: ['lore_path', 'source_id', 'target_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_history',
      description: '查询 worldview.history 中的历史事件。可按时间范围或关联节点过滤',
      parameters: {
        type: 'object',
        properties: {
          lore_path: { type: 'string', description: '目标设定集或独立故事的路径' },
          time_range: { type: 'string', description: '按时间范围过滤' },
          connection: { type: 'string', description: '按关联节点 ID 过滤' }
        },
        required: ['lore_path']
      }
    }
  }
];
