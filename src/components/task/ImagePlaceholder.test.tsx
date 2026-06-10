import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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
      // 视口外配图延后拉取(lazy)+异步解码,不与首屏内容抢隧道带宽。
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('decoding', 'async');

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

  describe('直链过期回落（fallbackUrl，公开页 OSS 预签名直链场景）', () => {
    beforeEach(() => {
      getMediaTicketMock.mockClear();
      getMediaTicketMock.mockResolvedValue('fresh-tok');
    });

    it('主 URL（非代理直链）失败且有 fallbackUrl → 切到代理回落 URL 重挂（带媒体票）', async () => {
      render(
        <ImagePlaceholder
          description="直链图"
          status="ready"
          imageUrl="https://oss.example.com/img/abc.webp?Expires=1"
          mediaToken="tok1"
          fallbackUrl="/api/v1/summaries/images/abc.webp"
        />
      );

      // 初始:直链原样作 src(不拼票)
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://oss.example.com/img/abc.webp?Expires=1');

      // 直链失败(如预签名过期 403):不进显示回退,切到代理回落 URL,走既有 token 拼接
      fireEvent.error(img);
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute(
          'src',
          '/api/v1/summaries/images/abc.webp?token=tok1'
        );
      });
      expect(screen.queryByText('[图片：直链图]')).not.toBeInTheDocument();
    });

    it('回落 URL 上耗尽换票重试后才进显示回退（绝不无限切换）', async () => {
      render(
        <ImagePlaceholder
          description="回落耗尽图"
          status="ready"
          imageUrl="https://oss.example.com/img/x.webp"
          mediaToken="tok1"
          fallbackUrl="/api/v1/summaries/images/x.webp"
        />
      );

      // 直链失败 → 切回落
      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute(
          'src',
          '/api/v1/summaries/images/x.webp?token=tok1'
        );
      });

      // 回落(代理)上走既有换票重试链:失败 #1 → fresh-tok + _r=1
      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute(
          'src',
          '/api/v1/summaries/images/x.webp?token=fresh-tok&_r=1'
        );
      });
      // 失败 #2 → _r=2
      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute(
          'src',
          '/api/v1/summaries/images/x.webp?token=fresh-tok&_r=2'
        );
      });
      // 失败 #3:重试耗尽 → 终态显示回退,不再切回直链
      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByText('[图片：回落耗尽图]')).toBeInTheDocument();
      });
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('无 fallbackUrl 时行为同现状：非代理 URL 一次失败即显示回退（私有页零回归）', () => {
      render(
        <ImagePlaceholder
          description="无回落图"
          status="ready"
          imageUrl="https://example.com/broken.png"
        />
      );

      fireEvent.error(screen.getByRole('img'));
      expect(screen.getByText('[图片：无回落图]')).toBeInTheDocument();
      expect(getMediaTicketMock).not.toHaveBeenCalled();
    });

    it('代理主 URL + 无 fallbackUrl（私有页形态）：既有换票重试链零回归', async () => {
      render(
        <ImagePlaceholder
          description="私有回归图"
          status="ready"
          imageUrl="/api/v1/summaries/images/priv.webp"
          mediaToken="tok1"
        />
      );

      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute(
          'src',
          '/api/v1/summaries/images/priv.webp?token=fresh-tok&_r=1'
        );
      });
      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByRole('img')).toHaveAttribute(
          'src',
          '/api/v1/summaries/images/priv.webp?token=fresh-tok&_r=2'
        );
      });
      fireEvent.error(screen.getByRole('img'));
      await waitFor(() => {
        expect(screen.getByText('[图片：私有回归图]')).toBeInTheDocument();
      });
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

  describe('token 竞速守卫（公开详情页场景）', () => {
    beforeEach(() => {
      getMediaTicketMock.mockClear();
    });

    it('mediaToken 初始 null 时不发无票请求，token 到后 img src 带 token', async () => {
      // 代理 URL，token 初始 null：不应立即渲 <img>
      const { rerender } = render(
        <ImagePlaceholder
          description="竞速图"
          status="ready"
          imageUrl="/api/v1/summaries/images/race.webp"
          mediaToken={null}
        />
      );

      // token 未到：不渲 img，渲骨架占位
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('正在加载图片...')).toBeInTheDocument();

      // token 后到（模拟 mint 完成后父组件更新 prop）
      await act(async () => {
        rerender(
          <ImagePlaceholder
            description="竞速图"
            status="ready"
            imageUrl="/api/v1/summaries/images/race.webp"
            mediaToken="mint-tok"
          />
        );
      });

      // token 就绪后 img 出现且 src 带 token
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/api/v1/summaries/images/race.webp?token=mint-tok');
    });

    it('mediaToken 一直 null（mint 失败）→ 超时后降级发请求走重试链', async () => {
      vi.useFakeTimers();
      try {
        render(
          <ImagePlaceholder
            description="超时图"
            status="ready"
            imageUrl="/api/v1/summaries/images/timeout.webp"
            mediaToken={null}
          />
        );

        // 超时前：占位，无 img
        expect(screen.queryByRole('img')).toBeNull();

        // 推进 5s 超时，act 确保 React state 更新被 flush
        await act(async () => {
          vi.advanceTimersByTime(5000);
        });

        // 超时后降级：img 出现，src 无 token（走既有 401 重试链兜底）
        const img = screen.getByRole('img');
        // 代理 URL 无 token 时 appendMediaToken 原样返回
        expect(img).toHaveAttribute('src', '/api/v1/summaries/images/timeout.webp');
      } finally {
        vi.useRealTimers();
      }
    });

    it('非代理 URL（外链）不等待 token，立即渲染', () => {
      render(
        <ImagePlaceholder
          description="外链图"
          status="ready"
          imageUrl="https://example.com/image.png"
          mediaToken={null}
        />
      );

      // 外链图不需要票，直接渲 img
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/image.png');
    });

    it('私有页：mediaToken 挂载时即有值，直接渲 img 无骨架等待', () => {
      render(
        <ImagePlaceholder
          description="私有页图"
          status="ready"
          imageUrl="/api/v1/summaries/images/priv.webp"
          mediaToken="hot-tok"
        />
      );

      // token 初值有效，直接 img，无「正在加载图片…」骨架
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', '/api/v1/summaries/images/priv.webp?token=hot-tok');
    });
  });
});
