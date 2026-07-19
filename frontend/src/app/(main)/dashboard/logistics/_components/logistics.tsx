"use client";

import * as React from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api-client";

import type { Shipment } from "./shipment-data";
import { ShipmentDetails } from "./shipment-details";
import { ShipmentList } from "./shipment-list";

interface ShipmentApiResponse {
  shipment_code: string;
  status: string;
  payload: Partial<Shipment>;
}

export function Logistics() {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [shipments, setShipments] = React.useState<Shipment[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    apiFetch<ShipmentApiResponse[]>("/shipments")
      .then((rows) => {
        if (!active) return;
        const mapped = rows.map((row) => ({ ...row.payload, id: row.shipment_code, status: row.status }) as Shipment);
        setShipments(mapped);
        setSelectedShipmentId(mapped[0]?.id ?? null);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Không thể tải dữ liệu vận chuyển."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const selectedShipment = shipments.find((shipment) => shipment.id === selectedShipmentId) ?? null;

  function handleSelectShipment(shipmentId: string) {
    setSelectedShipmentId(shipmentId);
    if (window.innerWidth < 1024) setDetailsOpen(true);
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Đang tải dữ liệu vận chuyển…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;
  if (!shipments.length) return <div className="p-6 text-sm text-muted-foreground">Chưa có dữ liệu lô hàng từ hệ thống.</div>;

  return (
    <>
      <div data-content-padding="false" className="grid h-[calc(100dvh-var(--dashboard-header-height))] overflow-hidden lg:grid-cols-[400px_minmax(0,1fr)] lg:divide-x">
        <div className="h-full overflow-hidden"><ShipmentList shipments={shipments} selectedShipmentId={selectedShipmentId} onSelectShipment={handleSelectShipment} /></div>
        <div className="hidden h-full overflow-hidden lg:block"><ShipmentDetails shipment={selectedShipment} /></div>
      </div>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-none data-[side=right]:md:w-3/4">
          <SheetHeader className="sr-only">
            <SheetTitle>{selectedShipment ? `Chi tiết lô hàng ${selectedShipment.id}` : "Chi tiết lô hàng"}</SheetTitle>
            <SheetDescription>Chi tiết lô hàng và tuyến vận chuyển.</SheetDescription>
          </SheetHeader>
          <ShipmentDetails shipment={selectedShipment} />
        </SheetContent>
      </Sheet>
    </>
  );
}
