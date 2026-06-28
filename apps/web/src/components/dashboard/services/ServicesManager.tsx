"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import type { ServiceRow } from "@/trpc/types";
import { Modal } from "@/components/ui/Modal";
import { ServiceForm } from "./ServiceForm";
import { ServiceCard } from "./ServiceCard";

export function ServicesManager() {
  const utils = trpc.useUtils();
  const servicesQuery = trpc.services.getServices.useQuery();

  const deleteService = trpc.services.deleteService.useMutation({
    onSuccess: () => utils.services.getServices.invalidate(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (service: ServiceRow) => {
    setEditing(service);
    setDialogOpen(true);
  };
  const closeDialog = () => setDialogOpen(false);

  const services = servicesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          {services.length > 0
            ? `${services.length} שירותים`
            : "עדיין לא הוגדרו שירותים"}
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-owner px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
        >
          <span className="text-base leading-none">+</span>
          הוספת שירות
        </button>
      </div>

      {servicesQuery.isLoading ? (
        <ListSkeleton />
      ) : services.length === 0 ? (
        <EmptyState onAdd={openCreate} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={openEdit}
              onDelete={(id) => deleteService.mutate({ id })}
              isDeleting={
                deleteService.isPending &&
                deleteService.variables?.id === service.id
              }
            />
          ))}
        </div>
      )}

      <Modal
        open={dialogOpen}
        onClose={closeDialog}
        title={editing ? "עריכת שירות" : "שירות חדש"}
      >
        <ServiceForm
          key={editing?.id ?? "new"}
          service={editing}
          onClose={closeDialog}
        />
      </Modal>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface-raised px-6 py-14 text-center">
      <p className="text-ink">עדיין אין שירותים בעסק שלכם.</p>
      <p className="max-w-sm text-sm text-ink-muted">
        הוסיפו את השירותים שאתם מציעים — שם ומחיר — כדי שלקוחות יוכלו לקבוע תור.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="cursor-pointer rounded-full bg-owner px-6 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.03]"
      >
        הוספת השירות הראשון
      </button>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-soft"
        >
          <div className="h-5 w-32 animate-pulse rounded bg-line" />
          <div className="h-4 w-full animate-pulse rounded bg-line" />
          <div className="h-4 w-20 animate-pulse rounded bg-line" />
        </div>
      ))}
    </div>
  );
}
