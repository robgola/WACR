import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { X, FileCode } from 'lucide-react';
import { localLibrary } from '../../services/localLibrary';

const MetadataDebugModal = ({ book, onClose }) => {
    const [xmlContent, setXmlContent] = useState("Loading...");
    const [error, setError] = useState(null);
    const [loadingBlob, setLoadingBlob] = useState(false);

    useEffect(() => {
        const extractXml = async () => {
            if (!book) return;

            let targetBlob = book.blob;

            // If blob is missing, try to fetch it from DownloadManager (which hydrates it)
            if (!targetBlob) {
                try {
                    setLoadingBlob(true);
                    const fullBook = await localLibrary.getBook(book.id);
                    if (fullBook && fullBook.blob) {
                        targetBlob = fullBook.blob;
                    } else {
                        setXmlContent("No book blob available (Fetch failed).");
                        setLoadingBlob(false);
                        return;
                    }
                } catch (e) {
                    setXmlContent("Error fetching book blob: " + e.message);
                    setLoadingBlob(false);
                    return;
                } finally {
                    setLoadingBlob(false);
                }
            }

            if (!targetBlob) {
                setXmlContent("No book blob available.");
                return;
            }

            try {
                const zip = await JSZip.loadAsync(targetBlob);
                // Case insensitive search
                const xmlFile = Object.values(zip.files).find(f => f.name.toLowerCase() === 'comicinfo.xml');

                if (xmlFile) {
                    const content = await xmlFile.async("string");
                    setXmlContent(content);
                } else {
                    setXmlContent("ComicInfo.xml not found in archive.");
                }
            } catch (err) {
                console.error("Error reading zip:", err);
                setError("Failed to read archive: " + err.message);
            }
        };

        extractXml();
    }, [book]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1C1C1E] border border-white/20 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">

                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-2 text-white">
                        <FileCode className="text-blue-400" size={20} />
                        <h3 className="font-bold">ComicInfo.xml Debugger</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/70 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-[#0d0d0d] font-mono text-xs text-green-400 whitespace-pre-wrap">
                    {loadingBlob ?
                        <span className="text-yellow-500">Fetching full book blob...</span> :
                        (error ? <span className="text-red-500">{error}</span> : xmlContent)
                    }
                </div>

                <div className="p-3 border-t border-white/10 text-white/50 text-[10px] flex justify-between">
                    <span>Book: {book?.name || "Unknown"}</span>
                    <span>Size: {book?.blob?.size ? (book.blob.size / 1024 / 1024).toFixed(2) + " MB" : (loadingBlob ? "Fetching..." : "N/A")}</span>
                </div>
            </div>
        </div>
    );
};

export default MetadataDebugModal;
