function parseModelResponse(rawModelResponse) {
  const raw = typeof rawModelResponse === 'string'
    ? rawModelResponse
    : rawModelResponse && typeof rawModelResponse.response === 'string'
      ? rawModelResponse.response
      : JSON.stringify(rawModelResponse);
  const cleanedResult = normalizeJsonResponse(raw || '');

  if (!cleanedResult.success) {
    return {
      success: false,
      errors: cleanedResult.errors.map((error) => `Model response was not valid JSON: ${error}`)
    };
  }

  try {
    return {
      success: true,
      value: JSON.parse(cleanedResult.value)
    };
  } catch (error) {
    return {
      success: false,
      errors: [`Model response was not valid JSON: ${error.message}`]
    };
  }
}

function normalizeJsonResponse(value) {
  const trimmed = stripJsonFence(String(value || '')).trim();
  if (trimmed.length === 0) {
    return {
      success: false,
      errors: ['Model response was empty and not valid JSON.']
    };
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return {
      success: true,
      value: trimmed
    };
  }

  const extracted = extractSingleJsonObject(trimmed);
  if (!extracted.success) {
    return extracted;
  }

  return {
    success: true,
    value: extracted.value
  };
}

function stripJsonFence(value) {
  const trimmed = String(value || '').trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function extractSingleJsonObject(value) {
  const matches = [];
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      if (depth === 0) startIndex = index;
      depth += 1;
      continue;
    }

    if (character === '}') {
      if (depth === 0) {
        return {
          success: false,
          errors: ['Model response included an unmatched closing brace and was not valid JSON.']
        };
      }

      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        matches.push(value.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  if (depth !== 0 || inString) {
    return {
      success: false,
      errors: ['Model response did not contain a complete JSON object.']
    };
  }

  if (matches.length !== 1) {
    return {
      success: false,
      errors: [`Model response must contain exactly one JSON object; found ${matches.length}.`]
    };
  }

  return {
    success: true,
    value: matches[0]
  };
}

function buildJsonRepairPrompt(rawModelResponse) {
  return [
    'Convert the following attempted response into valid JSON.',
    'Return JSON only. Do not add new facts.',
    'Use only this top-level shape:',
    JSON.stringify({
      vocabulary: [],
      concepts: [],
      referenceFormulas: [],
      uncertainSections: []
    }),
    '',
    'Attempted response:',
    String(rawModelResponse || '')
  ].join('\n');
}


module.exports = {
  parseModelResponse,
  normalizeJsonResponse,
  stripJsonFence,
  extractSingleJsonObject,
  buildJsonRepairPrompt
};
