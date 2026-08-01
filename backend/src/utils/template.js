const TOKEN_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export const renderTemplate = (template, values = {}) =>
  String(template || "").replace(TOKEN_PATTERN, (_, key) => {
    const value = values[key];
    return value === undefined || value === null ? `{{${key}}}` : String(value);
  });

export const unresolvedTemplateVariables = (text) => {
  const variables = new Set();
  for (const match of String(text || "").matchAll(TOKEN_PATTERN)) {
    variables.add(match[1]);
  }
  return [...variables];
};
