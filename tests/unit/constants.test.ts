import { describe, it, expect } from 'vitest';
import { SYSTEM_INSTRUCTION } from '../../src/constants';

const mockConfig = {
  cornerRadius: 8,
  shadowIntensity: 'medium',
  safeMargin: 5,
  showPageNumber: false,
  footerText: '',
  titleFontSize: 32,
  subtitleFontSize: 20,
  bodyFontSize: 14,
};

describe('SYSTEM_INSTRUCTION (SC-001)', () => {
  it('contains EXACTLY constraint for title font size', () => {
    const result = SYSTEM_INSTRUCTION(
      'Minimal',
      'Clean',
      ['#000000', '#22D3EE', '#1E293B', '#F8FAFC'],
      'Inter, sans-serif',
      '',
      mockConfig
    );
    expect(result).toContain('EXACTLY');
    expect(result).toContain('32pt');
  });

  it('contains EXACTLY constraint for subtitle font size', () => {
    const result = SYSTEM_INSTRUCTION(
      'Minimal',
      'Clean',
      ['#000000', '#22D3EE', '#1E293B', '#F8FAFC'],
      'Inter, sans-serif',
      '',
      mockConfig
    );
    expect(result).toContain('20pt');
    expect(result).toContain('DO NOT deviate');
  });

  it('contains EXACTLY constraint for body font size', () => {
    const result = SYSTEM_INSTRUCTION(
      'Minimal',
      'Clean',
      ['#000000', '#22D3EE', '#1E293B', '#F8FAFC'],
      'Inter, sans-serif',
      '',
      mockConfig
    );
    expect(result).toContain('14pt');
    expect(result).toContain('DO NOT deviate');
  });

  it('forbids black as text color', () => {
    const result = SYSTEM_INSTRUCTION(
      'Minimal',
      'Clean',
      ['#000000', '#22D3EE', '#1E293B', '#F8FAFC'],
      'Inter, sans-serif',
      '',
      mockConfig
    );
    expect(result).toContain('FORBIDDEN');
    expect(result).toContain('#000000');
  });

  it('enforces fontFamily as mandatory for text elements', () => {
    const result = SYSTEM_INSTRUCTION(
      'Minimal',
      'Clean',
      ['#000000', '#22D3EE', '#1E293B', '#F8FAFC'],
      'Space Grotesk, sans-serif',
      '',
      mockConfig
    );
    expect(result).toContain('Space Grotesk, sans-serif');
    expect(result).toContain('REQUIRED fields for every text element');
  });

  it('contains no-overlap layout coordinate guides', () => {
    const result = SYSTEM_INSTRUCTION(
      'Minimal',
      'Clean',
      ['#000000', '#22D3EE', '#1E293B', '#F8FAFC'],
      'Inter, sans-serif',
      '',
      mockConfig
    );
    expect(result).toContain('split-left');
    expect(result).toContain('grid-3');
    expect(result).toContain('top-bottom');
    expect(result).toContain('2%');
  });
});
