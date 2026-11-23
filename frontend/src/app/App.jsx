import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { HomePage } from '../pages/HomePage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { PaperDetailPage } from '../pages/PaperDetailPage';
import { ComparePage } from '../pages/ComparePage';
import { DiscoverPage } from '../pages/DiscoverPage';
import { QuestionsPage } from '../pages/QuestionsPage';
import { ResearchGraphView } from '../pages/ResearchGraphView';
import { api } from '../services/api';
import { X } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [collections, setCollections] = useState([]);
  const [currentCollection, setCurrentCollection] = useState(null);
  const [overview, setOverview] = useState(null);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');

  // Initial load
  useEffect(() => {
    loadCollections();
  }, []);

  // Auto-poll collection overview whenever papers are processing (extracting, analysing, queued, validating)
  useEffect(() => {
    if (!currentCollection || !overview?.papers) return;

    const hasProcessing = overview.papers.some(p =>
      ['queued', 'validating', 'extracting', 'analysing'].includes(p.status)
    );

    if (!hasProcessing) return;

    const intervalId = setInterval(async () => {
      try {
        const freshOverview = await api.getCollectionOverview(currentCollection.id);
        if (freshOverview) {
          setOverview(freshOverview);
        }
      } catch (err) {
        console.error('Polling collection overview error:', err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [currentCollection, overview]);

  // Auto-poll selected paper on detail page if it is still processing
  useEffect(() => {
    if (!selectedPaper || activeTab !== 'paper_detail') return;
    if (!['queued', 'validating', 'extracting', 'analysing'].includes(selectedPaper.status)) return;

    const intervalId = setInterval(async () => {
      try {
        const freshPaper = await api.getPaper(selectedPaper.id);
        if (freshPaper) {
          setSelectedPaper(freshPaper);
        }
      } catch (err) {
        console.error('Polling paper detail error:', err);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [selectedPaper, activeTab]);

  const loadCollections = async () => {
    try {
      const list = await api.listCollections();
      setCollections(list || []);
      if (list && list.length > 0) {
        selectCollection(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  };

  const selectCollection = async (colId) => {
    try {
      const col = await api.getCollection(colId);
      setCurrentCollection(col);
      const ov = await api.getCollectionOverview(colId);
      setOverview(ov);
    } catch (err) {
      console.error('Failed to fetch collection overview:', err);
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!newTopicName.trim()) return;
    try {
      const created = await api.createCollection(newTopicName.trim());
      setCollections(prev => [created, ...prev]);
      setCurrentCollection(created);
      setOverview({
        id: created.id,
        name: created.name,
        papers: [],
        themes: [],
        insights: [],
        collection_summary: 'New collection created. Upload papers to begin.'
      });
      setShowNewModal(false);
      setNewTopicName('');
      setActiveTab('workspace');
    } catch (err) {
      alert('Could not create topic: ' + (err?.message || 'Error'));
    }
  };

  const handleUpload = async (files) => {
    if (!currentCollection) return;
    const fileList = Array.isArray(files) ? files : [files];
    if (fileList.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of fileList) {
        await api.uploadPaper(currentCollection.id, file);
      }
      // Refresh overview
      const ov = await api.getCollectionOverview(currentCollection.id);
      setOverview(ov);
    } catch (err) {
      alert(err?.message || 'Failed to upload paper');
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenPaper = async (paperId) => {
    try {
      const p = await api.getPaper(paperId);
      setSelectedPaper(p);
      setActiveTab('paper_detail');
    } catch (err) {
      console.error('Failed to open paper:', err);
    }
  };

  const handleDeletePaper = async (paperId) => {
    try {
      await api.deletePaper(paperId);
      if (currentCollection) {
        const ov = await api.getCollectionOverview(currentCollection.id);
        setOverview(ov);
      }
    } catch (err) {
      alert('Failed to delete paper');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-body">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentCollection={currentCollection}
        collections={collections}
        onSelectCollection={selectCollection}
        onNewWorkspace={() => setShowNewModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'landing' && (
          <HomePage
            onStart={() => setActiveTab('workspace')}
            onTryDemo={() => {
              if (collections.length > 0) {
                selectCollection(collections[0].id);
              }
              setActiveTab('workspace');
            }}
          />
        )}

        {activeTab === 'workspace' && (
          <WorkspacePage
            collection={currentCollection}
            overview={overview}
            onUpload={handleUpload}
            onOpenPaper={handleOpenPaper}
            onDeletePaper={handleDeletePaper}
            onNavigateTab={setActiveTab}
            isUploading={isUploading}
          />
        )}

        {activeTab === 'paper_detail' && (
          <PaperDetailPage
            paper={selectedPaper}
            onBack={() => setActiveTab('workspace')}
          />
        )}

        {activeTab === 'compare' && (
          <ComparePage
            collectionId={currentCollection?.id || 'demo'}
            papers={overview?.papers || []}
            onOpenPaper={handleOpenPaper}
          />
        )}

        {activeTab === 'graph' && (
          <ResearchGraphView
            collectionId={currentCollection?.id || 'demo'}
            onOpenPaper={handleOpenPaper}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverPage
            insights={overview?.insights || []}
            onOpenPaper={handleOpenPaper}
          />
        )}

        {activeTab === 'qa' && (
          <QuestionsPage
            collectionId={currentCollection?.id || 'demo'}
            papers={overview?.papers || []}
            onOpenPaper={handleOpenPaper}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-canvas border-t border-hairline py-8 mt-16 text-xs text-mute">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-ink text-[11px] uppercase tracking-caption-mono">SearchMate //</span>
            <span className="font-mono text-[11px] uppercase tracking-caption-mono text-mute">Frontier Research Synthesis</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-caption-mono text-mute">
            GROUNDED EVIDENCE · SECTION PARSING · UNIVERSAL SANS + GEIST MONO
          </div>
        </div>
      </footer>

      {/* New Topic Modal (ex-modal-card) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-xai max-w-md w-full bg-canvas-card border border-hairline rounded-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="eyebrow-mono block mb-1">// NEW PROTOCOL</span>
                <h3 className="text-base font-normal tracking-[-0.4px] text-ink">Create Research Topic</h3>
              </div>
              <button 
                onClick={() => setShowNewModal(false)} 
                className="text-mute hover:text-ink p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTopic}>
              <label className="block text-xs font-mono uppercase tracking-caption-mono-sm text-mute mb-2">
                Topic or Course Project Name:
              </label>
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="e.g. Graph Neural Networks, Transformer Optimizations"
                className="w-full text-xs sm:text-sm bg-canvas-soft border border-hairline rounded-sm px-3.5 py-2.5 text-ink focus:outline-none focus:border-white/50 mb-5 font-normal"
                autoFocus
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="btn-outline-sm"
                >
                  <span className="font-mono uppercase tracking-caption-mono-sm text-[11px]">Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={!newTopicName.trim()}
                  className="btn-primary"
                >
                  <span className="font-mono uppercase tracking-caption-mono-sm text-[11px]">Initialize Topic</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
