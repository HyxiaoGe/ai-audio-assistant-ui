import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImagePlaceholder } from './ImagePlaceholder';
import { getMediaTicket } from '@/lib/media-ticket';

// 重试逻辑只对走鉴权的媒体代理 URL 生效，需要换新票据；mock 掉票据来源。
vi.mock('@/lib/media-ticket', () => ({
  getMediaTicket: vi.fn(() => Promise.resolve('fresh-tok')),
  getMediaTicketSync: vi.fn(() => null),
}));

const getMediaTicketMock = vi.mocked(getMediaTicket);

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

    it('renders image at full column width with no height cap', () => {
      // 回归守卫：配图必须铺满正文列宽，不得再被 max-h-96 高度帽限成窄居中。
      render(
        <ImagePlaceholder
          description="满宽图"
          status="ready"
          imageUrl="https://example.com/image.png"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveClass('w-full');
      expect(img).toHaveClass('h-full');
      expect(img).toHaveClass('object-contain');
      // 旧的 max-h-96(384px 高度帽)是图变窄居中的根因，必须移除。
      expect(img).not.toHaveClass('max-h-96');
      expect(img).not.toHaveClass('h-auto');
    });

    it('reserves a 16:9 frame around the image (no load-time height jump)', () => {
      const { container } = render(
        <ImagePlaceholder
          description="十六比九"
          status="ready"
          imageUrl="https://example.com/image.png"
        />
      );

      expect(container.querySelector('.aspect-video')).not.toBeNull();
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

  describe('proxy URL token + retry', () => {
    beforeEach(() => {
      getMediaTicketMock.mockClear();
      getMediaTicketMock.mockResolvedValue('fresh-tok');
    });

    it('appends the media token to a proxy image URL', () => {
      render(
        <ImagePlaceholder
          description="代理图"
          status="ready"
          imageUrl="/api/v1/summaries/images/abc.webp"
          mediaToken="tok1"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/api/v1/summaries/images/abc.webp?token=tok1');
    });

    it('retries with a fresh ticket + cache-bust on error before giving up', async () => {
      render(
        <ImagePlaceholder
          description="重试图"
          status="ready"
          imageUrl="/api/v1/summaries/images/abc.webp"
          mediaToken="tok1"
        />
      );

      const img = screen.getByRole('img');

      // 第一次失败：不立即回退，换新票据 + _r=1 重试。
      fireEvent.error(img);
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute(
          'src',
          '/api/v1/summaries/images/abc.webp?token=fresh-tok&_r=1'
        );
      });
      expect(getMediaTicketMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByText('[图片：重试图]')).not.toBeInTheDocument();

      // 第二次失败：再换票 + _r=2。
      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute(
          'src',
          '/api/v1/summaries/images/abc.webp?token=fresh-tok&_r=2'
        );
      });
      expect(getMediaTicketMock).toHaveBeenCalledTimes(2);

      // 第三次失败：超过 MAX_IMAGE_RETRIES(2)，终态回退到文本。
      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByText('[图片：重试图]')).toBeInTheDocument();
      });
      // 不再继续换票。
      expect(getMediaTicketMock).toHaveBeenCalledTimes(2);
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
