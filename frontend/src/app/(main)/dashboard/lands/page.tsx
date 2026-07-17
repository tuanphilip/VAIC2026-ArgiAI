"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Award,
  BarChart3,
  Edit,
  Grid3X3,
  Layers,
  MapPin,
  Plus,
  Save,
  Sprout,
  Trash,
  Compass,
  List,
  Grid,
  Map as MapIcon,
  User,
  Calendar,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useUserStore } from "@/stores/user-store";

interface Land {
  id: string;
  crop: string;
  cropType: "Lúa" | "Cà phê" | "Rau vụ đông";
  size: number;
  seedingDate: string;
  status: "growing" | "harvested" | "disease_outbreak";
  moisture: string;
  health: "Khỏe mạnh" | "Cảnh báo độ ẩm" | "Sâu bệnh nhẹ";
  color: string;
  lat: number;
  lng: number;
  owner: string;
}

const initialLands: Land[] = [
  { id: "A1", crop: "Seng Cù", cropType: "Lúa", size: 2.5, seedingDate: "2026-05-10", status: "growing", moisture: "58%", health: "Khỏe mạnh", color: "bg-emerald-500", lat: 21.520, lng: 103.220, owner: "Nguyễn Văn A" },
  { id: "A2", crop: "Cải ngọt hữu cơ", cropType: "Rau vụ đông", size: 1.0, seedingDate: "2026-06-01", status: "harvested", moisture: "62%", health: "Khỏe mạnh", color: "bg-green-600", lat: 21.515, lng: 103.230, owner: "Nguyễn Văn A" },
  { id: "B1", crop: "Catimor", cropType: "Cà phê", size: 5.0, seedingDate: "2026-04-15", status: "growing", moisture: "42%", health: "Cảnh báo độ ẩm", color: "bg-amber-500", lat: 21.510, lng: 103.225, owner: "Nguyễn Văn A" },
  { id: "B2", crop: "Robusta Mường Ảng", cropType: "Cà phê", size: 1.8, seedingDate: "2026-05-20", status: "growing", moisture: "65%", health: "Khỏe mạnh", color: "bg-teal-500", lat: 21.525, lng: 103.235, owner: "Lê Văn C" },
  { id: "C1", crop: "Cà chua VietGAP", cropType: "Rau vụ đông", size: 1.2, seedingDate: "2026-06-10", status: "disease_outbreak", moisture: "55%", health: "Sâu bệnh nhẹ", color: "bg-rose-500", lat: 21.530, lng: 103.215, owner: "Phạm Thị D" },
  { id: "C2", crop: "Bơ Booth chín sớm", cropType: "Rau vụ đông", size: 3.2, seedingDate: "2026-05-05", status: "growing", moisture: "60%", health: "Khỏe mạnh", color: "bg-emerald-500", lat: 21.505, lng: 103.210, owner: "Hoàng Văn E" },
];

export default function Page() {
  const { activeUser } = useUserStore();
  const [lands, setLands] = useState<Land[]>(initialLands);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Tab state for Admin: "map" or "list"
  const [activeTab, setActiveTab] = useState<"map" | "list">("map");

  // Display view mode state: "card" or "table"
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editCrop, setEditCrop] = useState("");
  const [editCropType, setEditCropType] = useState<"Lúa" | "Cà phê" | "Rau vụ đông">("Lúa");
  const [editSize, setEditSize] = useState("");
  const [editSeedingDate, setEditSeedingDate] = useState("");
  const [editHealth, setEditHealth] = useState<"Khỏe mạnh" | "Cảnh báo độ ẩm" | "Sâu bệnh nhẹ">("Khỏe mạnh");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editStatus, setEditStatus] = useState<"growing" | "harvested" | "disease_outbreak">("growing");

  // Add Mode state
  const [isAdding, setIsAdding] = useState(false);
  const [newId, setNewId] = useState("");
  const [newCrop, setNewCrop] = useState("");
  const [newCropType, setNewCropType] = useState<"Lúa" | "Cà phê" | "Rau vụ đông">("Lúa");
  const [newSize, setNewSize] = useState("");
  const [newSeedingDate, setNewSeedingDate] = useState("");
  const [newHealth, setNewHealth] = useState<"Khỏe mạnh" | "Cảnh báo độ ẩm" | "Sâu bệnh nhẹ">("Khỏe mạnh");
  const [newLat, setNewLat] = useState("");
  const [newLng, setNewLng] = useState("");
  const [newOwner, setNewOwner] = useState("");

  // Map elements
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // Filter displayed lands based on user role (Farmer only sees their own lands, Cán bộ sees all)
  const displayedLands = activeUser.role === "farmer" 
    ? lands.filter((l) => l.owner.includes("Nguyễn Văn A")) 
    : lands;

  const selectedLand = lands.find((l) => l.id === selectedId);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current || (activeUser.role !== "official" && activeTab !== "map")) return;

    // Load leaflet stylesheet dynamically to prevent head conflicts
    const linkId = "leaflet-css-link";
    if (!document.getElementById(linkId)) {
      const link = document.createElement("link");
      link.id = linkId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const L = require("leaflet");

    // Leaflet marker default icon fix
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([21.517, 103.224], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    // Clear old markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Add markers for displayed lands
    displayedLands.forEach((land) => {
      const statusText = 
        land.status === "growing" ? "Đang gieo trồng" :
        land.status === "harvested" ? "Đã thu hoạch" : "Dịch bệnh bùng phát";
      
      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; font-size: 11px; min-width: 140px; line-height: 1.4;">
          <h4 style="margin: 0 0 4px 0; font-size: 12px; font-weight: 700; color: #0f172a;">Lô ${land.id} - ${land.crop}</h4>
          <p style="margin: 2px 0;"><b>Chủ sở hữu:</b> ${land.owner}</p>
          <p style="margin: 2px 0;"><b>Diện tích:</b> ${land.size} Ha</p>
          <p style="margin: 2px 0;"><b>Loại cây:</b> ${land.cropType}</p>
          <p style="margin: 2px 0;"><b>Trạng thái:</b> ${statusText}</p>
          <p style="margin: 2px 0;"><b>Độ ẩm:</b> ${land.moisture}</p>
          <p style="margin: 2px 0;"><b>Tọa độ:</b> ${land.lat.toFixed(4)}, ${land.lng.toFixed(4)}</p>
          <div style="margin-top: 6px; display: flex; gap: 4px;">
            <button onclick="window.handleMapEditClick('${land.id}')" style="background: #059669; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 600;">Xem chi tiết</button>
          </div>
        </div>
      `;

      const marker = L.marker([land.lat, land.lng])
        .addTo(mapRef.current)
        .bindPopup(popupHtml);

      markersRef.current.push(marker);
    });

    // Set globally accessible callback for Leaflet popup button
    (window as any).handleMapEditClick = (id: string) => {
      setSelectedId(id);
      setIsAdding(false);
      startEditById(id);
      setIsEditing(false); // Default open in view details mode
    };

  }, [displayedLands, activeTab, activeUser.role]);

  // Adjust Leaflet map sizing on tab toggle
  useEffect(() => {
    if (activeTab === "map" && mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 200);
    }
  }, [activeTab]);

  // Center Leaflet map when selecting a land
  useEffect(() => {
    if (selectedId && mapRef.current && activeTab === "map") {
      const land = lands.find((l) => l.id === selectedId);
      if (land) {
        mapRef.current.setView([land.lat, land.lng], 15);
      }
    }
  }, [selectedId, activeTab]);

  const handleGetCurrentLocation = (isNew: boolean) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latStr = position.coords.latitude.toFixed(6);
          const lngStr = position.coords.longitude.toFixed(6);
          if (isNew) {
            setNewLat(latStr);
            setNewLng(lngStr);
          } else {
            setEditLat(latStr);
            setEditLng(lngStr);
          }
        },
        (error) => {
          alert("Không thể lấy GPS: " + error.message);
        }
      );
    } else {
      alert("Trình duyệt của bạn không hỗ trợ định vị GPS.");
    }
  };

  const startEditById = (id: string) => {
    const land = lands.find((l) => l.id === id);
    if (!land) return;
    setEditCrop(land.crop);
    setEditCropType(land.cropType);
    setEditSize(land.size.toString());
    setEditSeedingDate(land.seedingDate);
    setEditHealth(land.health);
    setEditLat(land.lat.toString());
    setEditLng(land.lng.toString());
    setEditOwner(land.owner);
    setEditStatus(land.status);
  };

  const startEdit = () => {
    if (!selectedLand) return;
    startEditById(selectedLand.id);
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    const sizeNum = Number.parseFloat(editSize) || 0;
    const latNum = Number.parseFloat(editLat) || 21.517;
    const lngNum = Number.parseFloat(editLng) || 103.224;

    setLands(
      lands.map((l) =>
        l.id === selectedId
          ? {
              ...l,
              crop: editCrop,
              cropType: editCropType,
              size: sizeNum,
              seedingDate: editSeedingDate,
              health: editHealth,
              lat: latNum,
              lng: lngNum,
              owner: editOwner,
              status: editStatus,
              color: editStatus === "disease_outbreak" ? "bg-rose-500" : editStatus === "harvested" ? "bg-slate-500" : "bg-emerald-500",
            }
          : l
      )
    );
    setIsEditing(false);
    setSelectedId(null); // Close panel on success
  };

  const handleAddPlot = (e: React.FormEvent) => {
    e.preventDefault();
    const sizeNum = Number.parseFloat(newSize) || 0;
    const latNum = Number.parseFloat(newLat) || 21.517;
    const lngNum = Number.parseFloat(newLng) || 103.224;

    const newLand: Land = {
      id: newId,
      crop: newCrop,
      cropType: newCropType,
      size: sizeNum,
      seedingDate: newSeedingDate,
      status: "growing",
      moisture: "60%",
      health: newHealth,
      color: "bg-emerald-500",
      lat: latNum,
      lng: lngNum,
      owner: newOwner || (activeUser.role === "farmer" ? activeUser.name : "Nguyễn Văn A"),
    };

    setLands([...lands, newLand]);
    setSelectedId(null);
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-800 dark:text-emerald-400">
            {activeUser.role === "farmer" ? "Sơ đồ Thửa đất & Cây trồng của tôi" : "Quản lý Thửa đất & Cây trồng địa bàn"}
          </h1>
          <p className="text-muted-foreground font-medium">
            {activeUser.role === "farmer"
              ? "Bản đồ số hóa phân vùng canh tác và thông tin cây trồng của hộ gia đình."
              : "Quản lý dữ liệu địa lý, chủ sở hữu, giống cây trồng và tình hình dịch tễ nông nghiệp Điện Biên."}
          </p>
        </div>
        <Button
          onClick={() => {
            setIsAdding(true);
            setSelectedId(null);
            setIsEditing(false);
            setNewId(`D${lands.length + 1}`);
            setNewCrop("");
            setNewCropType("Lúa");
            setNewSize("");
            setNewSeedingDate(new Date().toISOString().split("T")[0]);
            setNewHealth("Khỏe mạnh");
            setNewLat("21.517");
            setNewLng("103.224");
            setNewOwner(activeUser.role === "farmer" ? activeUser.name : "");
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
        >
          <Plus className="size-4" /> Đăng ký lô đất mới
        </Button>
      </div>

      {/* Admin Tab bar */}
      {activeUser.role === "official" && (
        <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border max-w-[320px]">
          <button
            onClick={() => setActiveTab("map")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === "map"
                ? "bg-white dark:bg-slate-950 shadow-sm text-emerald-700 dark:text-emerald-400"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MapIcon className="size-4" /> Bản đồ phân vùng
          </button>
          <button
            onClick={() => setActiveTab("list")}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === "list"
                ? "bg-white dark:bg-slate-950 shadow-sm text-emerald-700 dark:text-emerald-400"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <List className="size-4" /> Danh sách quản lý
          </button>
        </div>
      )}

      {/* Full-width container (Takes 100% space) */}
      <div className="w-full space-y-4">
        {/* Controls for toggling Card/Table views when showing list */}
        {(activeUser.role === "farmer" || activeTab === "list") && (
          <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-4 rounded-xl border shadow-xs">
            <span className="text-xs font-bold text-slate-500 uppercase">Chế độ hiển thị danh sách</span>
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-lg border">
              <button
                onClick={() => setViewMode("card")}
                className={`p-1.5 rounded-md transition ${viewMode === "card" ? "bg-white dark:bg-slate-950 text-emerald-600 shadow-xs" : "text-slate-400"}`}
              >
                <Grid className="size-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition ${viewMode === "table" ? "bg-white dark:bg-slate-950 text-emerald-600 shadow-xs" : "text-slate-400"}`}
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Render Map (Tab Map for Admin only) */}
        {activeUser.role === "official" && activeTab === "map" && (
          <Card className="shadow-sm overflow-hidden border">
            <CardHeader className="pb-3 border-b">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Bản đồ số hóa vệ tinh địa lý</CardTitle>
                  <CardDescription>Click vào từng marker và chọn &quot;Xem chi tiết&quot; để quản lý và chỉnh sửa.</CardDescription>
                </div>
                <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200">
                  <Layers className="size-3.5 mr-1" /> Mường Ảng OSM Map
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative">
              <div ref={mapContainerRef} className="w-full h-[550px] z-10" />
            </CardContent>
          </Card>
        )}

        {/* Render List Views (Tab List for Admin, or default for Farmer) */}
        {(activeUser.role === "farmer" || activeTab === "list") && (
          <>
            {viewMode === "card" ? (
              /* Card view grid - Full screen grid (3 columns on desktop) */
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {displayedLands.map((land) => (
                  <Card
                    key={land.id}
                    onClick={() => {
                      setSelectedId(land.id);
                      setIsEditing(false);
                      setIsAdding(false);
                      startEditById(land.id);
                    }}
                    className={`cursor-pointer hover:shadow-md transition duration-200 hover:-translate-y-0.5 border ${
                      selectedId === land.id ? "ring-2 ring-emerald-500 border-emerald-300" : ""
                    }`}
                  >
                    <CardHeader className="pb-2 border-b bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase">Thửa {land.id}</span>
                        <Badge className={
                          land.status === "growing" ? "bg-emerald-100 text-emerald-800" :
                          land.status === "harvested" ? "bg-slate-100 text-slate-800" : "bg-rose-100 text-rose-800"
                        }>
                          {land.status === "growing" ? "Đang trồng" : land.status === "harvested" ? "Đã thu hoạch" : "Dịch bệnh"}
                        </Badge>
                      </div>
                      <CardTitle className="text-base font-bold mt-1 text-slate-800 dark:text-slate-100">
                        {land.cropType} - {land.crop}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Diện tích:</span>
                        <span className="font-bold">{land.size} Ha</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Chủ sở hữu:</span>
                        <span className="font-semibold">{land.owner}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Ngày xuống giống:</span>
                        <span>{land.seedingDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Tọa độ GPS:</span>
                        <span className="font-mono text-[10px] text-slate-500">{land.lat.toFixed(5)}, {land.lng.toFixed(5)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              /* Table list view - Full screen table */
              <Card className="shadow-sm border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-900/40 text-[10px] text-slate-500 font-semibold border-b">
                        <tr>
                          <th className="p-4">Thửa</th>
                          <th className="p-4">Chủ sở hữu</th>
                          <th className="p-4">Loại cây</th>
                          <th className="p-4">Giống cây</th>
                          <th className="p-4">Diện tích</th>
                          <th className="p-4">Ngày gieo</th>
                          <th className="p-4">Tọa độ GPS</th>
                          <th className="p-4">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {displayedLands.map((land) => (
                          <tr
                            key={land.id}
                            onClick={() => {
                              setSelectedId(land.id);
                              setIsEditing(false);
                              setIsAdding(false);
                              startEditById(land.id);
                            }}
                            className={`cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition ${
                              selectedId === land.id ? "bg-emerald-50/20 dark:bg-emerald-950/10 font-medium" : ""
                            }`}
                          >
                            <td className="p-4 font-bold">{land.id}</td>
                            <td className="p-4">{land.owner}</td>
                            <td className="p-4 font-semibold">{land.cropType}</td>
                            <td className="p-4 text-slate-500">{land.crop}</td>
                            <td className="p-4 font-bold">{land.size} Ha</td>
                            <td className="p-4 text-slate-400">{land.seedingDate}</td>
                            <td className="p-4 font-mono text-[10px] text-slate-500">{land.lat.toFixed(4)}, {land.lng.toFixed(4)}</td>
                            <td className="p-4">
                              <Badge className={
                                land.status === "growing" ? "bg-emerald-100 text-emerald-800" :
                                land.status === "harvested" ? "bg-slate-100 text-slate-800" : "bg-rose-100 text-rose-800"
                              }>
                                {land.status === "growing" ? "Đang trồng" : land.status === "harvested" ? "Đã thu hoạch" : "Dịch bệnh"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* ==========================================
          SHEET 1: REGISTER NEW PLOT
          ========================================== */}
      <Sheet open={isAdding} onOpenChange={(open) => setIsAdding(open)}>
        <SheetContent side="right" className="sm:max-w-xl p-6 overflow-y-auto">
          <SheetHeader className="p-0 mb-6">
            <SheetTitle className="text-xl font-bold text-emerald-700 dark:text-emerald-400">Đăng ký Thửa đất {newId}</SheetTitle>
            <SheetDescription>Nhập thông tin địa lý và nông học cho lô đất mới gieo trồng.</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleAddPlot} className="space-y-4 text-xs">
            <div>
              <label className="text-xs font-semibold block mb-1">Chủ sở hữu</label>
              <input
                type="text"
                placeholder="Tên người sở hữu thửa đất"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                disabled={activeUser.role === "farmer"}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Loại cây</label>
                <select
                  value={newCropType}
                  onChange={(e) => setNewCropType(e.target.value as any)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                >
                  <option>Lúa</option>
                  <option>Cà phê</option>
                  <option>Rau vụ đông</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Giống cây cụ thể</label>
                <input
                  type="text"
                  placeholder="VD: Seng Cù"
                  value={newCrop}
                  onChange={(e) => setNewCrop(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Diện tích (Ha)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="VD: 1.5"
                  value={newSize}
                  onChange={(e) => setNewSize(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Ngày xuống giống</label>
                <input
                  type="date"
                  value={newSeedingDate}
                  onChange={(e) => setNewSeedingDate(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  required
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Tọa độ địa lý GPS</span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => handleGetCurrentLocation(true)}
                  className="text-[10px] text-emerald-600 gap-1 py-1 h-auto"
                >
                  <Compass className="size-3.5" /> Định vị GPS hiện tại
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Vĩ độ (Lat)</span>
                  <input
                    type="text"
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    className="w-full text-xs p-1.5 border rounded-md dark:bg-slate-950"
                    required
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block mb-0.5">Kinh độ (Lng)</span>
                  <input
                    type="text"
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    className="w-full text-xs p-1.5 border rounded-md dark:bg-slate-950"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAdding(false)}>
                Hủy
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1">
                <Save className="size-4 mr-1" /> Đăng ký Thửa đất
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* ==========================================
          SHEET 2: PLOT DETAIL & UPDATE
          ========================================== */}
      <Sheet
        open={selectedId !== null && !isAdding}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setIsEditing(false);
          }
        }}
      >
        <SheetContent side="right" className="sm:max-w-xl p-6 overflow-y-auto">
          <SheetHeader className="p-0 mb-6">
            <SheetTitle className="text-xl font-bold text-emerald-800 dark:text-emerald-400">
              {isEditing ? `Chỉnh sửa Thửa đất ${selectedLand?.id}` : `Hồ sơ Thửa đất ${selectedLand?.id}`}
            </SheetTitle>
            <SheetDescription>
              {isEditing ? "Thay đổi các thông tin địa lý hoặc cây trồng gieo cấy." : `Thông tin chi tiết thuộc hộ ${selectedLand?.owner}`}
            </SheetDescription>
          </SheetHeader>

          {isEditing ? (
            /* EDIT FORM INSIDE SHEET */
            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="text-xs font-semibold block mb-1">Chủ sở hữu</label>
                <input
                  type="text"
                  value={editOwner}
                  onChange={(e) => setEditOwner(e.target.value)}
                  className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  disabled={activeUser.role === "farmer"}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Loại cây</label>
                  <select
                    value={editCropType}
                    onChange={(e) => setEditCropType(e.target.value as any)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  >
                    <option>Lúa</option>
                    <option>Cà phê</option>
                    <option>Rau vụ đông</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Giống cây cụ thể</label>
                  <input
                    type="text"
                    value={editCrop}
                    onChange={(e) => setEditCrop(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Diện tích (Ha)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editSize}
                    onChange={(e) => setEditSize(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Ngày xuống giống</label>
                  <input
                    type="date"
                    value={editSeedingDate}
                    onChange={(e) => setEditSeedingDate(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Hiện trạng</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  >
                    <option value="growing">Đang trồng</option>
                    <option value="harvested">Đã thu hoạch</option>
                    <option value="disease_outbreak">Dịch bệnh</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Sức khỏe cây</label>
                  <select
                    value={editHealth}
                    onChange={(e) => setEditHealth(e.target.value as any)}
                    className="w-full text-xs p-2 border rounded-lg dark:bg-slate-950 focus:outline-emerald-500"
                  >
                    <option>Khỏe mạnh</option>
                    <option>Cảnh báo độ ẩm</option>
                    <option>Sâu bệnh nhẹ</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Tọa độ địa lý GPS</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => handleGetCurrentLocation(false)}
                    className="text-[10px] text-emerald-600 gap-1 py-1 h-auto"
                  >
                    <Compass className="size-3.5" /> GPS hiện tại
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Vĩ độ (Lat)</span>
                    <input
                      type="text"
                      value={editLat}
                      onChange={(e) => setEditLat(e.target.value)}
                      className="w-full text-xs p-1.5 border rounded-md dark:bg-slate-950"
                      required
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-0.5">Kinh độ (Lng)</span>
                    <input
                      type="text"
                      value={editLng}
                      onChange={(e) => setEditLng(e.target.value)}
                      className="w-full text-xs p-1.5 border rounded-md dark:bg-slate-950"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>
                  Hủy
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex-1">
                  <Save className="size-3.5 mr-1" /> Lưu thay đổi
                </Button>
              </div>
            </form>
          ) : selectedLand ? (
            /* DETAILED PLOT INFORMATION VIEW */
            <div className="space-y-6 text-xs">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border">
                <div className="flex items-center gap-3">
                  <User className="size-5 text-emerald-600" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Chủ sở hữu</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{selectedLand.owner}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Sprout className="size-5 text-emerald-600" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Cây trồng</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{selectedLand.cropType} ({selectedLand.crop})</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Grid3X3 className="size-5 text-slate-500" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Diện tích canh tác</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{selectedLand.size} Ha</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <Calendar className="size-5 text-slate-500" />
                  <div>
                    <span className="text-[10px] text-muted-foreground block">Ngày xuống giống</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{selectedLand.seedingDate}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MapPin className="size-5 text-slate-400" />
                    <span className="font-semibold text-sm">Vị trí địa lý (GPS)</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-normal">OSM Registered</Badge>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400 font-mono text-xs">
                  <span>Vĩ độ (Lat): <b className="text-slate-800 dark:text-slate-200">{selectedLand.lat.toFixed(6)}</b></span>
                  <span>Kinh độ (Lng): <b className="text-slate-800 dark:text-slate-200">{selectedLand.lng.toFixed(6)}</b></span>
                </div>
              </div>

              <div className="p-4 border rounded-xl space-y-3">
                <span className="font-semibold text-sm block">Tình trạng sinh trưởng & Sức khỏe</span>
                <div className="flex flex-wrap gap-2">
                  <Badge className={
                    selectedLand.status === "growing" ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-xs py-1 px-2.5" :
                    selectedLand.status === "harvested" ? "bg-slate-100 text-slate-800 border-slate-200 text-xs py-1 px-2.5" : "bg-rose-100 text-rose-800 border-rose-200 text-xs py-1 px-2.5"
                  }>
                    Trạng thái: {selectedLand.status === "growing" ? "Đang trồng" : selectedLand.status === "harvested" ? "Đã thu hoạch" : "Dịch bệnh"}
                  </Badge>
                  <Badge className={
                    selectedLand.health === "Khỏe mạnh" ? "bg-emerald-100 text-emerald-800 border-emerald-200 text-xs py-1 px-2.5" :
                    selectedLand.health === "Cảnh báo độ ẩm" ? "bg-amber-100 text-amber-800 border-amber-200 text-xs py-1 px-2.5" : "bg-rose-100 text-rose-800 border-rose-200 text-xs py-1 px-2.5"
                  }>
                    Sức khỏe: {selectedLand.health}
                  </Badge>
                  <Badge variant="outline" className="text-xs py-1 px-2.5">Độ ẩm đất: {selectedLand.moisture}</Badge>
                </div>
              </div>

              <div className="pt-6 border-t flex flex-col gap-3">
                <Link href={`/dashboard/lands/${selectedLand.id}`} className="w-full">
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-3 h-auto">
                    Xem chi tiết nhật ký sinh trưởng
                  </Button>
                </Link>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={startEdit} className="flex-1 gap-1 text-xs py-2.5 h-auto">
                    <Edit className="size-4" /> Chỉnh sửa hồ sơ
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (confirm(`Bạn có chắc chắn muốn xóa thửa đất ${selectedLand.id}?`)) {
                        setLands(lands.filter((l) => l.id !== selectedLand.id));
                        setSelectedId(null);
                      }
                    }}
                    className="flex-1 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 gap-1 text-xs py-2.5 h-auto"
                  >
                    <Trash className="size-4" /> Xóa thửa
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
