import { describe, expect, it } from 'vitest';
import { canDepart, canEditLines, canValidate } from './permissions';

describe('canEditLines', () => {
  it('autorise sur un ordre Brouillon', () => {
    expect(canEditLines({ status: 0 })).toBe(true);
  });

  it('refuse sur un ordre Validé', () => {
    expect(canEditLines({ status: 1 })).toBe(false);
  });

  it('refuse sur un ordre Parti', () => {
    expect(canEditLines({ status: 2 })).toBe(false);
  });
});

describe('canValidate', () => {
  it('autorise un LOGISTICS_MANAGER sur un ordre Brouillon non vide', () => {
    expect(canValidate({ status: 0, lineCount: 2 }, 'LOGISTICS_MANAGER')).toBe(true);
  });

  it('refuse un DISPATCHER même sur un ordre valide', () => {
    expect(canValidate({ status: 0, lineCount: 2 }, 'DISPATCHER')).toBe(false);
  });

  it('refuse un ordre vide (0 commande)', () => {
    expect(canValidate({ status: 0, lineCount: 0 }, 'LOGISTICS_MANAGER')).toBe(false);
  });

  it('refuse un ordre déjà Validé', () => {
    expect(canValidate({ status: 1, lineCount: 2 }, 'LOGISTICS_MANAGER')).toBe(false);
  });

  it('refuse un ordre déjà Parti', () => {
    expect(canValidate({ status: 2, lineCount: 2 }, 'LOGISTICS_MANAGER')).toBe(false);
  });
});

describe('canDepart', () => {
  it('autorise sur un ordre Validé', () => {
    expect(canDepart({ status: 1 })).toBe(true);
  });

  it('refuse sur un ordre Brouillon', () => {
    expect(canDepart({ status: 0 })).toBe(false);
  });

  it('refuse sur un ordre déjà Parti', () => {
    expect(canDepart({ status: 2 })).toBe(false);
  });
});
