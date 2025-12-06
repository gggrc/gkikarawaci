// src/components/DocumentPreviewModal.tsx
import React from 'react';
import Image from "next/image";
import { X, FileText } from "lucide-react"; 
import { isImageUrlOrBase64 } from "../pages/database"; // Import helper function

interface PreviewModalData {
    url: string; 
    name: string;
    type: 'image' | 'pdf' | 'other';
}

interface DocumentPreviewModalProps {
    data: PreviewModalData | null;
    onClose: () => void;
}

export default function DocumentPreviewModal({ data, onClose }: DocumentPreviewModalProps) {
    if (!data) return null;

    const isImage = isImageUrlOrBase64(data.url);
    const isPdf = data.type === 'pdf';
    
    let content;

    if (isImage) {
        content = (
            <Image
                src={data.url}
                alt={`Preview ${data.name}`}
                width={800}
                height={600}
                className="max-h-[70vh] w-full object-contain"
                style={{ width: '100%', height: 'auto' }}
                unoptimized
            />
        );
    } else if (isPdf) {
        content = (
            <div className="w-full h-[70vh]">
                <iframe
                    src={data.url}
                    title={`PDF Preview ${data.name}`}
                    className="w-full h-full border-0 rounded-lg"
                    allowFullScreen
                >
                    <div className="p-4 text-center">
                        <p>Browser tidak dapat menampilkan PDF secara langsung.</p>
                        <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                            Klik di sini untuk mengunduh/melihat PDF di tab baru.
                        </a>
                    </div>
                </iframe>
            </div>
        );
    } else {
        content = (
            <div className="p-6 text-center">
                <FileText size={48} className="text-gray-500 mx-auto mb-3" />
                <p className="text-xl font-semibold mb-2">Format Tidak Dapat Dipreview</p>
                <p className="text-gray-600">File bukan gambar atau PDF yang dapat ditampilkan. Buka tautan di bawah:</p>
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all mt-2 inline-block">
                    {data.url}
                </a>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-bold text-gray-800 truncate">
                        Preview: {data.name}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-red-500 transition p-1 rounded-full hover:bg-red-50">
                        <X size={24} />
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-4 flex items-center justify-center">
                    {content}
                </div>
                <div className="p-4 border-t flex justify-end">
                    <a 
                        href={data.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                    >
                        Buka di Tab Baru
                    </a>
                </div>
            </div>
        </div>
    );
};