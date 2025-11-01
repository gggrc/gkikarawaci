// src/components/EventManagementModal.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { X, Pencil } from 'lucide-react';

// --- Tipe Data ---

export type EventModalType = 'add-single' | 'add-periodical' | 'edit-single' | 'edit-periodical-confirm' | 'flow-select';

export interface EventModalData {
    type: EventModalType;
    dateKey: string | null;
    oldName: string | null;
    newName: string;
    periodicalDayOfWeek: number | null;
    periodicalPeriod: string;
}

interface EventManagementModalProps {
    data: Partial<EventModalData>;
    onUpdateData: (newData: Partial<EventModalData>) => void;
    onClose: () => void;
    onAction: () => void;
    generateDatesForPeriod?: (startDayKey: string, dayOfWeek: number, period: string) => string[];
}

// --- UTILITY CONSTANTS ---

// Menambahkan opsi 1 hingga 12 bulan
const MONTHLY_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
    value: `${i + 1}m`,
    label: `${i + 1} Bulan`,
}));

const PERIOD_OPTIONS = [
  ...MONTHLY_OPTIONS,
  { value: '1y', label: '1 Tahun' },
  { value: '10y', label: 'Selamanya (10 Tahun Simulasi)' }, 
];

// --- KOMPONEN MODAL UTAMA ---

export default function EventManagementModal({ 
    data, 
    onUpdateData, 
    onClose, 
    onAction
}: EventManagementModalProps) {
    
    // Defaulting state to avoid undefined issues
    const { 
        type = 'flow-select', 
        dateKey = null, 
        oldName = null, 
        newName = '', 
        periodicalDayOfWeek = new Date(dateKey ?? '').getDay(), 
        periodicalPeriod = '2m' 
    } = data;
    
    let title = '';
    let actionButtonText = '';
    let content;

    const isEdit = type === 'edit-single';
    const isAdd = type === 'add-single' || type === 'add-periodical' || type === 'flow-select';
    const isPeriodicalAdd = type === 'add-periodical';
    const isPeriodicalConfirm = type === 'edit-periodical-confirm';
    const isDeletion = isPeriodicalConfirm && newName === ''; // Logic untuk menghapus event berkala

    const dateDisplay = dateKey ? new Date(dateKey).toLocaleDateString("id-ID") : 'N/A';
    const dayOptions = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    if (type === 'flow-select') {
        title = 'Pilih Mode Penambahan Event';
        actionButtonText = 'Lanjut ke Mode Satuan';
        
        content = (
            <div className="space-y-6">
                <p className="text-lg text-gray-700">Event akan ditambahkan untuk tanggal: <span className="font-bold text-indigo-600">{dateDisplay}</span></p>
                <div className="flex flex-col gap-3">
                    <button 
                        type="button"
                        onClick={() => onUpdateData({ type: 'add-single', periodicalDayOfWeek: null, periodicalPeriod: '2m' })}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-md"
                    >
                        <span className="font-bold">Mode Satuan:</span> Hanya untuk tanggal ini
                    </button>
                    <button 
                        type="button"
                        onClick={() => onUpdateData({ type: 'add-periodical', periodicalDayOfWeek: new Date(dateKey ?? '').getDay(), newName: newName ?? '' })}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition shadow-md"
                    >
                        <span className="font-bold">Mode Berkala:</span> Ulangi di masa depan
                    </button>
                </div>
            </div>
        );
    } else if (isPeriodicalConfirm) {
        title = oldName ? (newName ? `Edit Berkala: ${oldName}` : `Hapus Berkala: ${oldName}`) : 'Konfirmasi Aksi Berkala';
        actionButtonText = newName ? 'Simpan Perubahan Berkala' : 'Hapus Semua Kejadian';
        const actionText = newName ? `mengubah nama event dari "${oldName}" menjadi "${newName}"` : `menghapus event "${oldName}"`;

        content = (
            <div className="space-y-4 p-2">
                <p className={`text-lg font-medium ${newName ? 'text-blue-700' : 'text-red-700'}`}>
                    PERINGATAN! Aksi ini akan berlaku untuk **SEMUA** event bernama **"{oldName}"** pada tanggal **{dateDisplay}** dan **semua tanggal setelahnya**.
                </p>
                <p className="text-gray-700">Anda akan {actionText} mulai dari {dateDisplay} dan ke depannya (hingga 10 tahun simulasi).</p>
                {/* Input hanya muncul saat mode EDIT (newName ada isinya dan bukan mode deletion) */}
                {!isDeletion && (
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => onUpdateData({ newName: e.target.value })}
                        className="w-full border-2 border-indigo-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                        placeholder="Nama Event Baru"
                        autoFocus
                    />
                )}
            </div>
        );
    } else if (isEdit) {
        title = `Edit Event: ${oldName}`;
        actionButtonText = 'Simpan Perubahan';
        
        content = (
            <div className="space-y-4">
                <p className="text-sm text-gray-500">Tanggal: <span className="font-semibold">{dateDisplay}</span></p>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => onUpdateData({ newName: e.target.value })}
                    className="w-full border-2 border-indigo-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                    placeholder="Nama Event Baru"
                    autoFocus
                />
            </div>
        );
    } else if (isAdd) {
        title = isPeriodicalAdd ? 'Tambah Event Berkala' : 'Tambah Event Satuan';
        actionButtonText = isPeriodicalAdd ? 'Tambah Event Berkala' : 'Tambah Event Satuan';
        
        content = (
            <div className="space-y-4">
                <div className="flex justify-between">
                    <button 
                        type="button"
                        onClick={() => onUpdateData({ type: 'add-single', periodicalDayOfWeek: null, periodicalPeriod: '2m' })}
                        className={`px-4 py-2 text-sm rounded-lg font-semibold transition ${!isPeriodicalAdd ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        Mode Satuan
                    </button>
                    <button 
                        type="button"
                        onClick={() => onUpdateData({ type: 'add-periodical', periodicalDayOfWeek: new Date(dateKey ?? '').getDay() })}
                        className={`px-4 py-2 text-sm rounded-lg font-semibold transition ${isPeriodicalAdd ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        Mode Berkala
                    </button>
                </div>

                <p className="text-sm text-gray-500 bg-indigo-50 p-2 rounded">
                    Tanggal: <span className="font-semibold">{dateDisplay}</span>
                </p>
                
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => onUpdateData({ newName: e.target.value })}
                    className="w-full border-2 border-indigo-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                    placeholder="Nama Event (Contoh: Kebaktian I : 07:00)"
                    autoFocus
                />
                
                {isPeriodicalAdd && (
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Hari Perulangan</label>
                            <select
                                value={periodicalDayOfWeek ?? 0}
                                onChange={(e) => onUpdateData({ periodicalDayOfWeek: parseInt(e.target.value, 10) })}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                            >
                                {dayOptions.map((day, index) => (
                                    <option key={day} value={index}>{day}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Periode Hingga</label>
                            <select
                                value={periodicalPeriod}
                                onChange={(e) => onUpdateData({ periodicalPeriod: e.target.value })}
                                className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-indigo-500 focus:outline-none"
                            >
                                {PERIOD_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">*Berlaku mulai hari setelah tanggal ini</p>
                        </div>
                    </div>
                )}
            </div>
        );
    } else {
        return null; 
    }
    
    // FIX: NewName check for periodical confirm should only check if deletion is not intended
    const isActionDisabled = isPeriodicalConfirm 
        ? (!newName && !isDeletion)
        : (isAdd && !newName?.trim());

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-xl font-bold text-indigo-600">{title}</h3>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-red-500 transition p-1 rounded-full hover:bg-red-50">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6">
                    {content}
                </div>
                <div className="p-4 border-t flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        onClick={onAction}
                        disabled={isActionDisabled}
                        className={`px-6 py-2 ${isActionDisabled ? 'bg-gray-400 cursor-not-allowed' : (isPeriodicalConfirm && isDeletion ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700')} text-white rounded-lg transition`} 
                    >
                        {actionButtonText}
                    </button>
                </div>
            </div>
        </div>
    );
}