const applyTransform = require('jscodeshift/src/testUtils').applyTransform;
const transform = require('./refonte-codemod');

function run(src) {
  return applyTransform({ parser: 'ts', transform }, null, { source: src });
}

test('remplace /v1/publish par /v1/creations/:id/deliver', () => {
  const input = `const ENDPOINT = '/v1/publish';`;
  const out = run(input);
  expect(out).toMatch("/v1/creations/:id/deliver");
});

test('désactive autopublication (throw)', () => {
  const input = `publishToSocial({ platform: 'ig' });`;
  const out = run(input);
  expect(out).toMatch(/throw new Error\('Auto publication désactivée en V1/);
});

test('ajoute requiresPremiumConfirmation si premiumT2V:true', () => {
  const input = `const payload = { premiumT2V: true };`;
  const out = run(input);
  expect(out).toMatch(/requiresPremiumConfirmation\s*:\s*true/);
});
