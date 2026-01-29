import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImagePlaceholder } from './ImagePlaceholder';

describe('ImagePlaceholder', () => {
  describe('pending state', () => {
    it('renders loading skeleton with description', () => {
      render(
        <ImagePlaceholder description="时间轴图表" status="pending" />
      );

      expect(screen.getByText('时间轴图表')).toBeInTheDocument();
      expect(screen.getByText('等待生成...')).toBeInTheDocument();
    });
  });

  describe('generating state', () => {
    it('renders loading skeleton with generating message', () => {
      render(
        <ImagePlaceholder description="流程图" status="generating" />
      );

      expect(screen.getByText('流程图')).toBeInTheDocument();
      expect(screen.getByText('正在生成图片...')).toBeInTheDocument();
    });
  });

  describe('ready state', () => {
    it('renders image with caption when URL provided and loaded', async () => {
      render(
        <ImagePlaceholder
          description="供应链时间轴"
          status="ready"
          imageUrl="https://example.com/image.png"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/image.png');
      expect(img).toHaveAttribute('alt', '供应链时间轴');

      // Simulate image load to reveal figcaption
      fireEvent.load(img);

      // Wait for the figcaption to become visible
      await waitFor(() => {
        const captions = screen.getAllByText('供应链时间轴');
        const figcaption = captions.find(el => el.tagName.toLowerCase() === 'figcaption');
        expect(figcaption).toHaveClass('opacity-100');
      });
    });

    it('shows loading skeleton while image is loading', () => {
      render(
        <ImagePlaceholder
          description="加载中图片"
          status="ready"
          imageUrl="https://example.com/image.png"
        />
      );

      // Image should be hidden (opacity-0) while loading
      const img = screen.getByRole('img');
      expect(img).toHaveClass('opacity-0');

      // Loading message should be visible
      expect(screen.getByText('正在加载图片...')).toBeInTheDocument();
    });

    it('shows image with fade-in effect after load completes', async () => {
      render(
        <ImagePlaceholder
          description="已加载图片"
          status="ready"
          imageUrl="https://example.com/image.png"
        />
      );

      const img = screen.getByRole('img');

      // Simulate image load
      fireEvent.load(img);

      // Image should now be visible (opacity-100)
      await waitFor(() => {
        expect(img).toHaveClass('opacity-100');
      });

      // Skeleton overlay should be hidden (pointer-events-none means it's faded out)
      const skeleton = screen.getByText('正在加载图片...').closest('div[class*="absolute"]');
      expect(skeleton).toHaveClass('pointer-events-none');
    });

    it('falls back to failed state when image load fails', () => {
      render(
        <ImagePlaceholder
          description="测试图片"
          status="ready"
          imageUrl="https://example.com/broken.png"
        />
      );

      const img = screen.getByRole('img');
      fireEvent.error(img);

      expect(screen.getByText('[图片：测试图片]')).toBeInTheDocument();
    });
  });

  describe('failed state', () => {
    it('renders fallback text', () => {
      render(
        <ImagePlaceholder description="失败的图片" status="failed" />
      );

      expect(screen.getByText('[图片：失败的图片]')).toBeInTheDocument();
    });

    it('renders fallback even with imageUrl when status is failed', () => {
      render(
        <ImagePlaceholder
          description="失败图"
          status="failed"
          imageUrl="https://example.com/image.png"
        />
      );

      expect(screen.getByText('[图片：失败图]')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('applies custom className to container', () => {
      const { container } = render(
        <ImagePlaceholder
          description="测试"
          status="generating"
          className="custom-class"
        />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});
