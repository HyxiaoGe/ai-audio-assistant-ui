import { describe, it, expect } from 'vitest';
import {
  extractPlaceholderDescription,
  findImagePlaceholders,
  containsImagePlaceholder,
  isCompleteImagePlaceholder,
  extractImagePlaceholder,
} from './image-placeholder';

describe('image-placeholder utilities', () => {
  describe('extractPlaceholderDescription', () => {
    it('extracts description from valid placeholder', () => {
      expect(extractPlaceholderDescription('{{IMAGE: 供应链时间轴}}')).toBe('供应链时间轴');
    });

    it('trims whitespace from description', () => {
      expect(extractPlaceholderDescription('{{IMAGE:   时间轴  }}')).toBe('时间轴');
    });

    it('handles English descriptions', () => {
      expect(extractPlaceholderDescription('{{IMAGE: Supply Chain Timeline}}')).toBe('Supply Chain Timeline');
    });

    it('returns original string if no match', () => {
      expect(extractPlaceholderDescription('not a placeholder')).toBe('not a placeholder');
    });

    it('handles minimal whitespace', () => {
      expect(extractPlaceholderDescription('{{IMAGE:test}}')).toBe('test');
    });
  });

  describe('findImagePlaceholders', () => {
    it('finds single placeholder in content', () => {
      const content = '这是一段文字 {{IMAGE: 时间轴}} 后面还有内容';
      expect(findImagePlaceholders(content)).toEqual(['{{IMAGE: 时间轴}}']);
    });

    it('finds multiple placeholders', () => {
      const content = '{{IMAGE: 图1}} 中间文字 {{IMAGE: 图2}} 结尾 {{IMAGE: 图3}}';
      expect(findImagePlaceholders(content)).toEqual([
        '{{IMAGE: 图1}}',
        '{{IMAGE: 图2}}',
        '{{IMAGE: 图3}}',
      ]);
    });

    it('returns empty array when no placeholders', () => {
      expect(findImagePlaceholders('普通文本内容')).toEqual([]);
    });

    it('handles multiline content', () => {
      const content = `
## 标题

{{IMAGE: 第一张图}}

一些文字

{{IMAGE: 第二张图}}
`;
      expect(findImagePlaceholders(content)).toEqual([
        '{{IMAGE: 第一张图}}',
        '{{IMAGE: 第二张图}}',
      ]);
    });
  });

  describe('containsImagePlaceholder', () => {
    it('returns true when placeholder exists', () => {
      expect(containsImagePlaceholder('文字 {{IMAGE: 图片}} 文字')).toBe(true);
    });

    it('returns false when no placeholder', () => {
      expect(containsImagePlaceholder('普通文本')).toBe(false);
    });

    it('returns false for partial placeholder', () => {
      expect(containsImagePlaceholder('{{IMAGE: 未闭合')).toBe(false);
    });
  });

  describe('isCompleteImagePlaceholder', () => {
    it('returns true for exact placeholder', () => {
      expect(isCompleteImagePlaceholder('{{IMAGE: 时间轴}}')).toBe(true);
    });

    it('returns true with surrounding whitespace', () => {
      expect(isCompleteImagePlaceholder('  {{IMAGE: 图片}}  ')).toBe(true);
    });

    it('returns false for partial placeholder', () => {
      expect(isCompleteImagePlaceholder('{{IMAGE: 未完成')).toBe(false);
    });

    it('returns false for text with placeholder', () => {
      expect(isCompleteImagePlaceholder('前缀 {{IMAGE: 图}} 后缀')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isCompleteImagePlaceholder('')).toBe(false);
    });
  });

  describe('extractImagePlaceholder', () => {
    it('extracts placeholder from text', () => {
      expect(extractImagePlaceholder('前缀 {{IMAGE: 图片}} 后缀')).toBe('{{IMAGE: 图片}}');
    });

    it('returns first placeholder when multiple exist', () => {
      expect(extractImagePlaceholder('{{IMAGE: 一}} 和 {{IMAGE: 二}}')).toBe('{{IMAGE: 一}}');
    });

    it('returns null when no placeholder', () => {
      expect(extractImagePlaceholder('普通文本')).toBe(null);
    });

    it('handles placeholder on its own line', () => {
      expect(extractImagePlaceholder('{{IMAGE: 流程图}}')).toBe('{{IMAGE: 流程图}}');
    });
  });
});
