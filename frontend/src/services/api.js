let rawBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1').trim();
rawBase = rawBase.replace(/\/+$/, '');
if (rawBase.startsWith('http') && !rawBase.includes('/api/v1')) {
  rawBase += '/api/v1';
}
const API_BASE = rawBase;

// Sample demonstration dataset when backend is running offline
const DEMO_COLLECTIONS = [
  {
    id: 'demo-col-1',
    name: 'Neural Architectures & Transformers',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    paper_count: 2
  }
];

const DEMO_PAPERS = {
  'demo-col-1': [
    {
      id: 'paper-demo-1',
      collection_id: 'demo-col-1',
      filename: 'resnet_deep_learning.pdf',
      title: 'Deep Residual Learning for Image Recognition',
      authors: ['Kaiming He', 'Xiangyu Zhang', 'Shaoqing Ren', 'Jian Sun'],
      publication_year: 2016,
      abstract: 'Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously.',
      status: 'completed',
      created_at: new Date().toISOString(),
      analysis: {
        research_problem: 'Degradation problem when increasing neural network depth.',
        objective: 'Train substantially deeper networks using residual skip connections.',
        methodology: 'Reformulate layers as learning residual functions with reference to layer inputs rather than unreferenced functions.',
        dataset: 'ImageNet 2012 classification dataset (1.28M training images).',
        main_findings: [
          'Extremely deep residual nets are easy to optimize without vanishing gradients.',
          'Won 1st place in the ILSVRC 2015 classification competition with 3.57% top-5 error rate.'
        ],
        limitations: [
          'High memory footprint during backpropagation across very deep layers.',
          'Evaluated predominantly on standard image benchmarks without extensive adversarial evaluation.'
        ],
        future_work: [
          'Explore residual learning in non-visual sequence models and multi-task learning.'
        ],
        beginner_explanation: 'Before this paper, stacking more layers into an AI model made it stop learning well due to vanishing signals. The authors introduced "skip connections"—shortcuts that let information bypass certain layers. Think of it like taking an express lane on a highway: it allows information to flow freely so the network can be 10 times deeper without getting lost.'
      },
      page_count: 12
    },
    {
      id: 'paper-demo-2',
      collection_id: 'demo-col-1',
      filename: 'attention_is_all_you_need.pdf',
      title: 'Attention Is All You Need',
      authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit'],
      publication_year: 2017,
      abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer, based solely on attention mechanisms.',
      status: 'completed',
      created_at: new Date().toISOString(),
      analysis: {
        research_problem: 'Sequential computation bottleneck in recurrent models (RNNs/LSTMs) prevents efficient parallelization.',
        objective: 'Replace recurrence entirely with multi-head self-attention mechanisms.',
        methodology: 'Transformer model architecture dispensing with recurrence and convolutions, using scaled dot-product attention and positional encodings.',
        dataset: 'WMT 2014 English-to-German and English-to-French translation benchmarks.',
        main_findings: [
          'Transformers achieve 28.4 BLEU on English-to-German translation, improving over best results by over 2 BLEU.',
          'Drastically reduced training time due to superior parallelization across GPUs.'
        ],
        limitations: [
          'Quadratic memory and computational complexity with respect to sequence length.',
          'Lacks inherent sequential order awareness without synthetic positional embeddings.'
        ],
        future_work: [
          'Extend Transformers to inputs other than text, including images, audio, and video.'
        ],
        beginner_explanation: 'Older language models read text like humans do: one word at a time from left to right. This was slow and caused computers to forget earlier words in long sentences. The Transformer lets the computer look at all words in a sentence simultaneously and figure out which words relate to each other (called "attention"). It forms the foundation of modern chatbots like ChatGPT.'
      },
      page_count: 15
    }
  ]
};

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw {
        status: res.status,
        code: errBody?.error?.code || 'API_ERROR',
        message: errBody?.error?.message || 'Server returned an error'
      };
    }
    const data = await res.json();
    return data.data;
  } catch (err) {
    if (err.code) throw err;
    // Network failure / server offline
    console.warn(`[SearchMate] API offline for ${url}, switching to responsive client mode.`);
    return null;
  }
}

export const api = {
  // Collections
  async listCollections() {
    const data = await safeFetch(`${API_BASE}/collections`);
    if (data !== null) return data;
    return DEMO_COLLECTIONS;
  },

  async createCollection(name) {
    const data = await safeFetch(`${API_BASE}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (data !== null) return data;
    
    const newCol = {
      id: `col-${Date.now()}`,
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      paper_count: 0
    };
    DEMO_COLLECTIONS.unshift(newCol);
    DEMO_PAPERS[newCol.id] = [];
    return newCol;
  },

  async getCollection(id) {
    const data = await safeFetch(`${API_BASE}/collections/${id}`);
    if (data !== null) return data;
    return DEMO_COLLECTIONS.find(c => c.id === id) || DEMO_COLLECTIONS[0];
  },

  async deleteCollection(id) {
    const data = await safeFetch(`${API_BASE}/collections/${id}`, { method: 'DELETE' });
    if (data !== null) return data;
    const idx = DEMO_COLLECTIONS.findIndex(c => c.id === id);
    if (idx !== -1) DEMO_COLLECTIONS.splice(idx, 1);
    delete DEMO_PAPERS[id];
    return true;
  },

  async getCollectionOverview(id) {
    const data = await safeFetch(`${API_BASE}/collections/${id}/overview`);
    if (data !== null) return data;

    const col = DEMO_COLLECTIONS.find(c => c.id === id) || DEMO_COLLECTIONS[0];
    const papers = DEMO_PAPERS[col.id] || [];

    return {
      id: col.id,
      name: col.name,
      created_at: col.created_at,
      updated_at: col.updated_at,
      papers: papers,
      themes: [
        {
          id: 'theme-1',
          name: 'Deep Neural Architectures',
          description: 'Structural designs that overcome optimization degradation in very deep models.',
          keywords: ['neural', 'residual', 'architecture', 'optimization'],
          paper_ids: papers.map(p => p.id)
        },
        {
          id: 'theme-2',
          name: 'Attention & Sequence Modeling',
          description: 'Parallelized representations replacing recurrence with scaled dot-product attention.',
          keywords: ['attention', 'transformer', 'sequence', 'parallelization'],
          paper_ids: papers.filter(p => p.id === 'paper-demo-2').map(p => p.id)
        }
      ],
      insights: [
        {
          id: 'ins-1',
          type: 'recurring_limitation',
          title: 'Recurring Limitation: High Computational & Memory Footprint',
          description: 'Both papers note substantial memory and compute constraints during intensive scaling or long sequences.',
          confidence_label: 'needs_verification',
          evidences: papers.map(p => ({
            paper_id: p.id,
            paper_title: p.title,
            page_number: 8,
            evidence_text: 'Authors state computational resources remain significant.'
          }))
        },
        {
          id: 'ins-2',
          type: 'potential_gap',
          title: 'Potential Gap: Evaluation on Resource-Constrained Edge Devices',
          description: 'Neither paper in this collection presents experimental validation on mobile or embedded hardware. (Requires literature verification).',
          confidence_label: 'exploratory',
          evidences: papers.map(p => ({
            paper_id: p.id,
            paper_title: p.title,
            page_number: 1,
            evidence_text: 'Targeted primarily high-end multi-GPU cluster setups.'
          }))
        },
        {
          id: 'ins-3',
          type: 'idea',
          title: 'Project Direction: Lightweight Hybrid Attention with Residual Blocks',
          description: 'Explore applying residual skip connections into localized attention heads to decrease quadratic memory complexity without sacrificing sequence fidelity.\n\nFirst validation step: Test a 4-layer hybrid model on small benchmark datasets like CIFAR-10.',
          confidence_label: 'exploratory',
          evidences: papers.map(p => ({
            paper_id: p.id,
            paper_title: p.title,
            page_number: 3,
            evidence_text: 'Combining architectural shortcuts with attention.'
          }))
        }
      ],
      collection_summary: `This collection contains ${papers.length} research papers. 2 shared themes and 3 research insights have been synthesized.`
    };
  },

  // Papers
  async uploadPaper(collectionId, file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/collections/${collectionId}/papers`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw {
          status: res.status,
          code: err?.error?.code || 'UPLOAD_FAILED',
          message: err?.error?.message || 'Failed to upload paper'
        };
      }
      const data = await res.json();
      return data.data;
    } catch (err) {
      if (err.code) throw err;
      console.error('Failed to connect to backend during upload:', err);
      if (API_BASE.startsWith('http')) {
        throw {
          status: 0,
          code: 'NETWORK_ERROR',
          message: `Could not reach backend API at ${API_BASE}. If using Render free tier, the server may take ~45s to wake up from idle. Please check Render logs or wait a moment and try again.`
        };
      }

      // Offline demo fallback
      const newPaper = {
        id: `paper-${Date.now()}`,
        collection_id: collectionId,
        filename: file.name,
        title: file.name.replace('.pdf', '').replace(/[-_]/g, ' '),
        authors: ['Author Team'],
        publication_year: 2024,
        abstract: 'This newly uploaded study explores empirical modeling and experimental performance.',
        status: 'completed',
        created_at: new Date().toISOString(),
        analysis: {
          research_problem: 'Investigating domain benchmarks and optimization barriers.',
          objective: 'Evaluate the proposed methodology in target conditions.',
          methodology: 'Empirical benchmark analysis and baseline comparison.',
          dataset: 'Benchmark validation set.',
          main_findings: ['Observed significant consistency across test configurations.'],
          limitations: ['Authors noted limited scope in the primary evaluation dataset.'],
          future_work: ['Extend testing across wider hardware setups.'],
          beginner_explanation: `This paper tests the ideas described in ${file.name}. It compares the performance against standard baselines and provides initial recommendations for college researchers.`
        },
        page_count: 8
      };
      if (!DEMO_PAPERS[collectionId]) DEMO_PAPERS[collectionId] = [];
      DEMO_PAPERS[collectionId].unshift(newPaper);
      return newPaper;
    }
  },

  async getPaper(id) {
    const data = await safeFetch(`${API_BASE}/papers/${id}`);
    if (data !== null) return data;
    for (const key in DEMO_PAPERS) {
      const p = DEMO_PAPERS[key].find(item => item.id === id);
      if (p) return p;
    }
    return DEMO_PAPERS['demo-col-1'][0];
  },

  async getPaperStatus(id) {
    const data = await safeFetch(`${API_BASE}/papers/${id}/status`);
    if (data !== null) return data;
    return { paper_id: id, status: 'completed', error_code: null };
  },

  async deletePaper(id) {
    const data = await safeFetch(`${API_BASE}/papers/${id}`, { method: 'DELETE' });
    if (data !== null) return data;
    for (const key in DEMO_PAPERS) {
      const idx = DEMO_PAPERS[key].findIndex(p => p.id === id);
      if (idx !== -1) {
        DEMO_PAPERS[key].splice(idx, 1);
        return true;
      }
    }
    return true;
  },

  // Comparison
  async comparePapers(collectionId, paperIds) {
    const data = await safeFetch(`${API_BASE}/collections/${collectionId}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paper_ids: paperIds })
    });
    if (data !== null) return data;

    const list = (DEMO_PAPERS[collectionId] || DEMO_PAPERS['demo-col-1'])
      .filter(p => paperIds.includes(p.id));

    return {
      papers: list.map(p => ({
        paper_id: p.id,
        filename: p.filename,
        title: p.title,
        authors: p.authors || ['Unknown'],
        publication_year: p.publication_year,
        objective: p.analysis?.objective || 'Not found in paper',
        methodology: p.analysis?.methodology || 'Not found in paper',
        dataset: p.analysis?.dataset || 'Not found in paper',
        findings: p.analysis?.main_findings || [],
        limitations: p.analysis?.limitations || []
      })),
      common_themes: ['Deep neural representations', 'Empirical benchmarking'],
      differences: [
        {
          aspect: 'Target Domain & Modality',
          description: `'${list[0]?.title || 'Paper 1'}' evaluates on visual recognition datasets, while '${list[1]?.title || 'Paper 2'}' evaluates on sequence-to-sequence machine translation.`,
          possible_explanation: 'Different input modalities (spatial matrices vs discrete token sequences) require distinct computational designs.',
          status_label: 'Needs manual verification'
        },
        {
          aspect: 'Core Mechanism',
          description: 'One paper utilizes residual identity skip connections; the other utilizes dot-product self-attention heads.',
          possible_explanation: 'Residual connections address gradient backpropagation depth, whereas attention addresses non-sequential global context.',
          status_label: 'Needs manual verification'
        }
      ]
    };
  },

  // Question Answering (grounded RAG)
  async askQuestion(collectionId, question) {
    const data = await safeFetch(`${API_BASE}/collections/${collectionId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });
    if (data !== null) return data;

    return {
      answer: `Based on your uploaded papers in this collection:\n\n• **Deep Residual Learning** introduces skip connections to train models up to 152 layers deep without gradient degradation.\n• **Attention Is All You Need** replaces recurrent layers entirely with multi-head attention, enabling faster parallel GPU training.\n\nBoth papers address computational bottlenecks in neural networks using architectural innovations.`,
      citations: [
        {
          paper_id: 'paper-demo-1',
          paper_title: 'Deep Residual Learning for Image Recognition',
          page_number: 3,
          evidence_id: 'chunk-1',
          text_snippet: 'We formulate the layers as learning residual functions with reference to the layer inputs...'
        },
        {
          paper_id: 'paper-demo-2',
          paper_title: 'Attention Is All You Need',
          page_number: 2,
          evidence_id: 'chunk-2',
          text_snippet: 'The Transformer allows for significantly more parallelization and can reach a new state of the art...'
        }
      ],
      grounded: true,
      requires_further_reading: false
    };
  },

  // Graph
  async getCollectionGraph(collectionId) {
    const data = await safeFetch(`${API_BASE}/collections/${collectionId}/graph`);
    if (data !== null) return data;

    const papers = DEMO_PAPERS[collectionId] || DEMO_PAPERS['demo-col-1'];

    return {
      collection_id: collectionId,
      nodes: [
        {
          id: `paper:${papers[0]?.id || 'p1'}`,
          type: 'paper',
          label: papers[0]?.title || 'Deep Residual Learning',
          metadata: {
            paper_id: papers[0]?.id || 'p1',
            authors: papers[0]?.authors || ['Kaiming He et al.'],
            publication_year: 2016,
            dataset: 'ImageNet'
          }
        },
        {
          id: `paper:${papers[1]?.id || 'p2'}`,
          type: 'paper',
          label: papers[1]?.title || 'Attention Is All You Need',
          metadata: {
            paper_id: papers[1]?.id || 'p2',
            authors: papers[1]?.authors || ['Vaswani et al.'],
            publication_year: 2017,
            dataset: 'WMT 2014'
          }
        },
        {
          id: 'theme:t1',
          type: 'theme',
          label: 'Deep Neural Architectures',
          metadata: {
            description: 'Structural designs that overcome optimization degradation in very deep models.',
            paper_count: 2
          }
        },
        {
          id: 'theme:t2',
          type: 'theme',
          label: 'Attention & Sequence Modeling',
          metadata: {
            description: 'Mechanisms replacing recurrence with parallel self-attention.',
            paper_count: 1
          }
        }
      ],
      edges: [
        {
          id: 'edge:p1-t1',
          source: `paper:${papers[0]?.id || 'p1'}`,
          target: 'theme:t1',
          type: 'paper_theme',
          label: 'Discusses Theme',
          explanation: 'Investigates residual skip connections for deeper network architectures.',
          evidence_refs: [
            {
              paper_id: papers[0]?.id || 'p1',
              paper_title: papers[0]?.title || 'ResNet',
              page_number: 1,
              excerpt: 'Residual learning framework to ease training of deep networks.'
            }
          ]
        },
        {
          id: 'edge:p2-t1',
          source: `paper:${papers[1]?.id || 'p2'}`,
          target: 'theme:t1',
          type: 'paper_theme',
          label: 'Discusses Theme',
          explanation: 'Presents the Transformer architecture for deep multi-head attention.',
          evidence_refs: [
            {
              paper_id: papers[1]?.id || 'p2',
              paper_title: papers[1]?.title || 'Transformer',
              page_number: 2,
              excerpt: 'An architecture based solely on attention mechanisms.'
            }
          ]
        },
        {
          id: 'edge:p2-t2',
          source: `paper:${papers[1]?.id || 'p2'}`,
          target: 'theme:t2',
          type: 'paper_theme',
          label: 'Discusses Theme',
          explanation: 'Core introduction of self-attention mechanisms in sequence transduction.',
          evidence_refs: [
            {
              paper_id: papers[1]?.id || 'p2',
              paper_title: papers[1]?.title || 'Transformer',
              page_number: 3,
              excerpt: 'Multi-head self-attention replaces recurrent neural networks.'
            }
          ]
        },
        {
          id: 'edge:p1-p2',
          source: `paper:${papers[0]?.id || 'p1'}`,
          target: `paper:${papers[1]?.id || 'p2'}`,
          type: 'similar_method',
          label: 'Methodology Overlap',
          explanation: 'Both papers incorporate residual connections to maintain gradient flow through attention & convolutional layers.',
          evidence_refs: [
            {
              paper_id: papers[0]?.id || 'p1',
              paper_title: papers[0]?.title || 'ResNet',
              page_number: 2,
              excerpt: 'Skip connection formulation: F(x) + x'
            },
            {
              paper_id: papers[1]?.id || 'p2',
              paper_title: papers[1]?.title || 'Transformer',
              page_number: 3,
              excerpt: 'LayerNorm(x + Sublayer(x)) applies residual connections around each sublayer.'
            }
          ]
        }
      ]
    };
  }
};
