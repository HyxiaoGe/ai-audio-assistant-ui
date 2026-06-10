"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Globe } from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import EmptyState from '@/components/common/EmptyState';
import { useAPIClient } from '@/lib/use-api-client';
import { useI18n } from '@/lib/i18n-context';
import { useDateFormatter } from '@/lib/use-date-formatter';
import { formatDuration } from '@/lib/utils';
import type { PublicTaskListItem } from '@/types/api';

const PAGE_SIZE = 20;

interface ExploreProps {
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onToggleTheme?: () => void;
}

export default function Explore({ isAuthenticated, onOpenLogin, onToggleTheme }: ExploreProps) {
  const { t } = useI18n();
  const { formatDate } = useDateFormatter();
  const client = useAPIClient();

  const [items, setItems] = useState<PublicTaskListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(false);
    try {
      const data = await client.getPublicTasks({ page: targetPage, page_size: PAGE_SIZE });
      setItems(data.items);
      setTotal(data.total);
      setPage(targetPage);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load(1);
  }, [load]);

  useEffect(() => {
    // 慢隧道下消灭点击后的冷 chunk 串行:用户停留列表页时提前拉取
    // 详情页的重模块 chunk,让 chunk 下载与详情数据请求并行而非串行。
    void import('@/components/task/MarkdownContent');
    void import('@/components/pages/PublicTaskDetail');
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--app-bg)' }}>
      <Header
        isAuthenticated={isAuthenticated}
        onOpenLogin={onOpenLogin}
        onToggleTheme={onToggleTheme}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="flex items-center gap-3 mb-1">
            <Globe className="w-6 h-6" style={{ color: 'var(--app-primary)' }} />
            <h2
              className="text-h2"
              style={{ color: 'var(--app-text)' }}
            >
              {t('explore.pageTitle')}
            </h2>
          </div>
          <p className="text-base mt-2 mb-6" style={{ color: 'var(--app-text-muted)' }}>
            {t('explore.pageSubtitle')}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div
                className="size-5 border-2 rounded-full animate-spin"
                style={{ borderColor: 'var(--app-primary) transparent var(--app-primary) var(--app-primary)' }}
              />
            </div>
          ) : error ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-sm" style={{ color: 'var(--app-danger)' }}>{t('explore.loadFailed')}</p>
              <button
                onClick={() => void load(page)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-[var(--app-glass-bg-strong)] transition-colors"
                style={{ borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
              >
                {t('explore.retry')}
              </button>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              variant="default"
              title={t('explore.emptyTitle')}
              description={t('explore.emptyDescription')}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map((item) => (
                  // Link 替换 button+router.push,App Router 对视口内 Link 自动 prefetch(RSC payload+路由 chunk),
                  // 消灭慢隧道下「点了没反应」;prefetch={true} 显式标注,防未来默认值变化。
                  <Link
                    key={item.id}
                    href={`/explore/${item.id}`}
                    prefetch={true}
                    className="block text-left p-4 border rounded-xl hover:bg-[var(--app-glass-bg-strong)] transition-colors"
                    style={{ borderColor: 'var(--app-border)', background: 'var(--app-glass-bg)' }}
                  >
                    <div className="text-base mb-2 line-clamp-2" style={{ fontWeight: 500, color: 'var(--app-text)' }}>
                      {item.title || t('audio.untitled')}
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                      {item.duration_seconds != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(item.duration_seconds)}
                        </span>
                      )}
                      {item.published_at && (
                        <span>
                          {t('explore.publishedAt')} {formatDate(item.published_at)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8 text-sm" style={{ color: 'var(--app-text-muted)' }}>
                  <button
                    disabled={page <= 1}
                    onClick={() => void load(page - 1)}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-[var(--app-glass-bg-strong)] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    {t('explore.prevPage')}
                  </button>
                  <span>{page} / {totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => void load(page + 1)}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-[var(--app-glass-bg-strong)] transition-colors"
                    style={{ borderColor: 'var(--app-border)' }}
                  >
                    {t('explore.nextPage')}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
