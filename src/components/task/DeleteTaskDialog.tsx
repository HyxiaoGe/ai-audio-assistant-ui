import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n-context';

interface DeleteTaskDialogProps {
  open: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
}

export function DeleteTaskDialog({ open, isDeleting, onClose, onConfirm, title }: DeleteTaskDialogProps) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !isDeleting) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("task.deleteConfirmTitle")}</DialogTitle>
          <DialogDescription>
            {t("task.deleteConfirmDesc")}
            {title && (
              <span
                className="mt-2 block text-sm font-medium"
                style={{ color: "var(--app-text)" }}
              >
                {title}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? t("task.deleteProcessing") : t("common.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
