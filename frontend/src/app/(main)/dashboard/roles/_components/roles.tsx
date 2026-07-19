"use client";
"use no memo";

import { useEffect, useState } from "react";

import {
  type ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
} from "@tanstack/react-table";
import { AlertCircle, FileUp, Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUsers } from "@/lib/users-api";

import { rolesColumns } from "./roles-table/columns";
import { toRoles, type Role } from "./roles-table/data";
import { RolesTable } from "./roles-table/table";

function getRoleTypeFilter(groupFilter: string) {
  if (groupFilter === "System roles") {
    return "System";
  }

  if (groupFilter === "Custom roles") {
    return "Custom";
  }

  return "All";
}

function getRoleGroupFilterValue(typeFilter: string) {
  if (typeFilter === "System") {
    return "System roles";
  }

  if (typeFilter === "Custom") {
    return "Custom roles";
  }

  return undefined;
}

export function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      setRoles(toRoles(await getUsers()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách vai trò.");
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, []);

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 12,
  });

  const table = useReactTable({
    data: roles,
    columns: rolesColumns,
    defaultColumn: {
      size: 140,
      minSize: 80,
      maxSize: 420,
    },
    state: { columnFilters, pagination },
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    autoResetPageIndex: false,
    initialState: {
      columnVisibility: { group: false, search: false },
    },
  });

  const search = (table.getColumn("search")?.getFilterValue() as string | undefined) ?? "";
  const groupFilter = (table.getColumn("group")?.getFilterValue() as string | undefined) ?? "";
  const typeFilter = getRoleTypeFilter(groupFilter);
  const ownerFilter = (table.getColumn("owner")?.getFilterValue() as string | undefined) ?? "All";
  const statusFilter = (table.getColumn("status")?.getFilterValue() as string | undefined) ?? "All";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Vai trò & quyền hạn</h1>
          <p className="text-muted-foreground text-sm">Quản lý vai trò và quyền truy cập trong tổ chức.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <FileUp data-icon="inline-start" />
            Nhập JSON
          </Button>
          <Button size="sm">Tạo vai trò</Button>
        </div>
      </div>

      <Tabs className="h-full gap-4" defaultValue="roles">
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b ps-0 *:data-[slot=tabs-trigger]:flex-none"
        >
          <TabsTrigger value="roles">Vai trò</TabsTrigger>
          <TabsTrigger value="permission-sets">Bộ quyền</TabsTrigger>
          <TabsTrigger value="access-reviews">Rà soát quyền</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
              <div className="flex flex-col items-stretch gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <InputGroup className="h-7 w-full rounded-md sm:w-82">
                  <InputGroupAddon>
                    <Search />
                  </InputGroupAddon>
                  <InputGroupInput
                    className="h-7"
                    placeholder="Tìm vai trò..."
                    value={search}
                    onChange={(e) => {
                      table.getColumn("search")?.setFilterValue(e.target.value || undefined);
                      table.setPageIndex(0);
                    }}
                  />
                </InputGroup>

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={typeFilter}
                    onValueChange={(v) => {
                      table.getColumn("group")?.setFilterValue(getRoleGroupFilterValue(v));
                      table.setPageIndex(0);
                    }}
                  >
                    <SelectTrigger size="sm">
                      <span className="text-muted-foreground">Loại:</span>
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start">
                      <SelectGroup>
                        <SelectItem value="All">Tất cả</SelectItem>
                        <SelectItem value="System">Hệ thống</SelectItem>
                        <SelectItem value="Custom">Tùy chỉnh</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select
                    value={ownerFilter}
                    onValueChange={(v) => {
                      table.getColumn("owner")?.setFilterValue(v === "All" ? undefined : v);
                      table.setPageIndex(0);
                    }}
                  >
                    <SelectTrigger size="sm">
                      <span className="text-muted-foreground">Chủ sở hữu:</span>
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start">
                      <SelectGroup>
                        <SelectItem value="All">Tất cả</SelectItem>
                        <SelectItem value="System">Hệ thống</SelectItem>
                        <SelectItem value="Jane Doe">Jane Doe</SelectItem>
                        <SelectItem value="Alex Kim">Alex Kim</SelectItem>
                        <SelectItem value="Chris Lee">Chris Lee</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>

                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      table.getColumn("status")?.setFilterValue(v === "All" ? undefined : v);
                      table.setPageIndex(0);
                    }}
                  >
                    <SelectTrigger size="sm">
                      <span className="text-muted-foreground">Trạng thái:</span>
                      <SelectValue placeholder="Tất cả" />
                    </SelectTrigger>
                    <SelectContent position="popper" align="start">
                      <SelectGroup>
                        <SelectItem value="All">Tất cả</SelectItem>
                        <SelectItem value="Active">Đang hoạt động</SelectItem>
                        <SelectItem value="Needs review">Cần rà soát</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="flex min-h-32 items-center justify-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" /> Đang tải vai trò...
                </div>
              ) : error ? (
                <div className="flex min-h-32 flex-col items-center justify-center gap-3 text-destructive text-sm">
                  <div className="flex items-center gap-2"><AlertCircle className="size-4" /> {error}</div>
                  <Button size="sm" variant="outline" onClick={() => void loadRoles()}>Thử lại</Button>
                </div>
              ) : roles.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center text-muted-foreground text-sm">
                  Chưa có vai trò nào được gán.
                </div>
              ) : (
                <RolesTable table={table} />
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="permission-sets">
          <div className="flex h-full items-center justify-center rounded-md border border-dashed text-muted-foreground text-sm">
            Bộ quyền đang được phát triển
          </div>
        </TabsContent>
        <TabsContent value="access-reviews">
          <div className="flex h-full items-center justify-center rounded-md border border-dashed text-muted-foreground text-sm">
            Rà soát quyền đang được phát triển
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
