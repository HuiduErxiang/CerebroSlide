import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SlidePreview } from '../../src/components/SlidePreview';
import type { Slide, SlideElement } from '../../src/types';

const makeSlide = (elements: SlideElement[]): Slide => ({
  id: 'slide-1',
  title: 'Test',
  description: 'Test slide',
  timestamp: Date.now(),
  elements,
});

describe('SlidePreview (SC-004, SC-005)', () => {
  describe('SC-004: color inline style', () => {
    it('applies style.color directly without overriding to #000', () => {
      const slide = makeSlide([
        {
          type: 'text',
          x: 10, y: 10, w: 80, h: 20,
          content: 'Hello',
          style: { color: '#F8FAFC', fontSize: 16 },
        },
      ]);

      const { container } = render(
        <SlidePreview slide={slide} cornerRadius={8} />
      );

      const textEl = container.querySelector('[style*="position: absolute"]');
      expect(textEl).not.toBeNull();
      const computedStyle = (textEl as HTMLElement).style;
      expect(computedStyle.color).not.toBe('rgb(0, 0, 0)');
      expect(computedStyle.color).not.toBe('#000');
      expect(computedStyle.color).not.toBe('#000000');
    });

    it('does not set color to black when style.color is undefined', () => {
      const slide = makeSlide([
        {
          type: 'text',
          x: 10, y: 10, w: 80, h: 20,
          content: 'No color set',
          style: { fontSize: 16 },
        },
      ]);

      const { container } = render(
        <SlidePreview slide={slide} cornerRadius={8} />
      );

      const textEl = container.querySelector('[style*="position: absolute"]') as HTMLElement;
      expect(textEl.style.color).not.toBe('rgb(0, 0, 0)');
      expect(textEl.style.color).not.toBe('#000000');
    });
  });

  describe('SC-005: Google Fonts injection', () => {
    beforeEach(() => {
      document.querySelectorAll('link[id^="gf-"]').forEach(el => el.remove());
    });

    afterEach(() => {
      document.querySelectorAll('link[id^="gf-"]').forEach(el => el.remove());
    });

    it('injects a Google Fonts link tag for fontFamily used in slide', () => {
      const slide = makeSlide([
        {
          type: 'text',
          x: 10, y: 10, w: 80, h: 20,
          content: 'Hello',
          style: { fontFamily: "'Space Grotesk', sans-serif", fontSize: 16 },
        },
      ]);

      render(<SlidePreview slide={slide} cornerRadius={8} />);

      const link = document.getElementById('gf-Space-Grotesk') as HTMLLinkElement | null;
      expect(link).not.toBeNull();
      expect(link?.href).toContain('Space%20Grotesk');
    });

    it('does not inject duplicate link tags for the same font', () => {
      const slide = makeSlide([
        {
          type: 'text',
          x: 10, y: 10, w: 80, h: 20,
          content: 'Hello',
          style: { fontFamily: "'Inter', sans-serif", fontSize: 16 },
        },
        {
          type: 'text',
          x: 10, y: 40, w: 80, h: 20,
          content: 'World',
          style: { fontFamily: "'Inter', sans-serif", fontSize: 14 },
        },
      ]);

      render(<SlidePreview slide={slide} cornerRadius={8} />);

      const links = document.querySelectorAll('link[id="gf-Inter"]');
      expect(links.length).toBe(1);
    });
  });
});
