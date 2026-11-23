import React, { useState, useRef } from 'react';
import { Upload, FileUp, AlertTriangle } from 'lucide-react';

export function FileUploader({ onUpload, currentPaperCount = 0, maxPapers = 5, isUploading = false }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleFiles = (files) => {
    setErrorMsg('');
    if (!files || files.length === 0) return;

    const availableSlots = maxPapers - currentPaperCount;
    if (availableSlots <= 0) {
      setErrorMsg(`Collection limit reached. Maximum ${maxPapers} papers allowed.`);
      return;
    }

    const fileList = Array.from(files);
    const validFiles = [];
    const errors = [];

    for (const file of fileList) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        errors.push(`"${file.name}" is not a PDF file.`);
        continue;
      }

      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > 10) {
        errors.push(`"${file.name}" exceeds 10 MB limit (${sizeMb.toFixed(1)} MB).`);
        continue;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      if (errors.length > 0) setErrorMsg(errors.join(' '));
      return;
    }

    const toUpload = validFiles.slice(0, availableSlots);
    if (validFiles.length > availableSlots) {
      setErrorMsg(`Only ${availableSlots} more paper slot(s) available. Uploading first ${availableSlots}.`);
    } else if (errors.length > 0) {
      setErrorMsg(errors.join(' '));
    }

    onUpload(toUpload);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = () => {
    setIsDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border rounded-sm p-8 text-center cursor-pointer transition-colors duration-150 ${
          isDragOver
            ? 'border-white/60 bg-canvas-soft'
            : 'border-hairline hover:border-white/30 bg-canvas-card'
        }`}
      >
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={(e) => handleFiles(e.target.files)}
          accept=".pdf,application/pdf"
          className="hidden"
          disabled={isUploading || currentPaperCount >= maxPapers}
        />

        <div className="mx-auto w-10 h-10 rounded-pill border border-white/20 bg-canvas-soft flex items-center justify-center text-ink mb-3">
          <Upload className="w-4 h-4 opacity-80" />
        </div>

        <span className="eyebrow-mono block mb-1.5">
          // INGESTION PROTOCOL
        </span>

        <h3 className="text-base font-normal tracking-[-0.4px] text-ink">
          {isUploading ? 'Uploading & Parsing PDF Document(s)...' : 'Drop Research Paper PDFs Here (Select Multiple)'}
        </h3>
        
        <p className="text-[11px] font-mono uppercase tracking-caption-mono-sm text-mute mt-2">
          TEXT-BASED PDFS · 10 MB MAX · [{currentPaperCount}/{maxPapers} SLOTS FILLED]
        </p>

        <div className="mt-5 flex items-center justify-center">
          <button
            type="button"
            disabled={isUploading || currentPaperCount >= maxPapers}
            className="btn-outline-sm"
          >
            <FileUp className="w-3.5 h-3.5" />
            <span className="font-mono uppercase tracking-caption-mono-sm text-[11px]">Select Document(s)</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 p-3 bg-canvas-card border border-accent-sunset/40 rounded-sm flex items-center gap-2.5 text-xs text-accent-sunset-soft font-mono">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-accent-sunset" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
