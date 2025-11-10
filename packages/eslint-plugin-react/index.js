const DEFAULT_ALLOWED_GLOBALS = new Set(['Fragment']);

function createJsxNoUndefRule(context) {
  const [options = {}] = context.options;
  const allow = new Set(options.allow ?? []);
  const allowGlobals = new Set([...(options.allowGlobals ?? []), ...DEFAULT_ALLOWED_GLOBALS]);
  const reported = new Set();

  return {
    'Program:exit'() {
      const through = context.sourceCode?.scopeManager?.globalScope?.through ?? [];

      for (const reference of through) {
        const identifier = reference.identifier;
        if (!identifier || identifier.type !== 'JSXIdentifier') continue;

        const name = identifier.name;
        if (!name || name[0] === name[0].toLowerCase()) continue;
        if (allow.has(name) || allowGlobals.has(name)) continue;
        if (reported.has(identifier)) continue;

        reported.add(identifier);
        context.report({
          node: identifier,
          messageId: 'undef',
          data: { identifier: name },
        });
      }
    },
  };
}

const plugin = {
  meta: { name: 'local-react-plugin', version: '0.0.2' },
  rules: {
    'jsx-no-undef': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow using undefined JSX identifiers.',
        },
        schema: [
          {
            type: 'object',
            properties: {
              allow: { type: 'array', items: { type: 'string' } },
              allowGlobals: { type: 'array', items: { type: 'string' } },
            },
            additionalProperties: false,
          },
        ],
        messages: {
          undef: "'{{identifier}}' must be defined when used in JSX.",
        },
      },
      create: createJsxNoUndefRule,
    },
    'react-in-jsx-scope': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Stub rule to satisfy flat config when disabling react/react-in-jsx-scope.',
        },
        schema: [],
      },
      create() {
        return {};
      },
    },
  },
};

export default plugin;
