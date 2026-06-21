window._currentAbortController = null;

export async function callLLM(messages, tools, onStream) {
  const providers = JSON.parse(localStorage.getItem('providers-list') || '[]');
  const activeModel = localStorage.getItem('global-active-model') || '';
  const providerMapKey = 'model-provider-map:' + activeModel;
  const providerId = localStorage.getItem(providerMapKey);
  const provider = providers.find(p => p.id === providerId) || providers[0];

  if (!provider || !provider.url || !provider.key) {
    throw new Error('未配置 API 请在设置中添加模型提供商');
  }

  const baseUrl = provider.url.replace(/\/+$/, '');
  const temp = parseFloat(localStorage.getItem('temperature') || '0.7');
  const topP = parseFloat(localStorage.getItem('topp') || '0.9');
  const maxTokens = parseInt(localStorage.getItem('maxtokens') || '65536');

  const body = {
    model: activeModel,
    messages,
    temperature: temp,
    top_p: topP,
    max_tokens: maxTokens,
    stream: !!onStream
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const abortController = new AbortController();
  window._currentAbortController = abortController;

  const resp = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + provider.key },
    body: JSON.stringify(body),
    signal: abortController.signal
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error('API 请求失败 (' + resp.status + '): ' + err);
  }

  if (!onStream) {
    const data = await resp.json();
    return data.choices?.[0]?.message || { role: 'assistant', content: '' };
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let fullReasoning = '';
  let toolCalls = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const chunk = JSON.parse(jsonStr);
        const delta = chunk.choices?.[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          fullContent += delta.content;
          if (onStream) onStream({ type: 'content', text: delta.content });
        }
        if (delta.reasoning_content) {
          fullReasoning += delta.reasoning_content;
          if (onStream) onStream({ type: 'reasoning', text: delta.reasoning_content });
        }
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCalls[idx]) toolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      } catch (e) { /* ignore parse errors in stream */ }
    }
  }

  return {
    role: 'assistant',
    content: fullContent,
    reasoning_content: fullReasoning,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined
  };
}
