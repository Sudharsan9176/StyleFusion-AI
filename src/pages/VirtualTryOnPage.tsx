import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Download,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Product, TryOnSession } from '../types';
import { extractErrorMessage, productsApi, tryOnApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { BeforeAfterSlider } from '../components/BeforeAfterSlider';
import { SafeImage } from '../components/SafeImage';

export function VirtualTryOnPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessionPortrait, setSessionPortrait, addToCart, showToast } = useStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const [catalog, setCatalog] = useState<Product[]>([]);
  const [garmentSearch, setGarmentSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [category, setCategory] = useState<'upper_body' | 'lower_body' | 'dresses'>('upper_body');
  const [garmentDesc, setGarmentDesc] = useState('');
  const [denoiseSteps, setDenoiseSteps] = useState(30);

  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<TryOnSession | null>(null);
  const [history, setHistory] = useState<TryOnSession[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load products from SQLite
  useEffect(() => {
    productsApi
      .list({ limit: 40 })
      .then((data) => {
        setCatalog(data.products);
        const paramId = Number(searchParams.get('productId'));
        const found = paramId
          ? data.products.find((p) => p.id === paramId)
          : data.products[0];
        if (found) {
          selectGarment(found);
        }
      })
      .catch(() => {});
  }, [searchParams]);

  // Load user's try-on history from SQLite
  const loadHistory = async () => {
    if (!user) {
      setHistory([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await tryOnApi.history();
      setHistory(data.sessions);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  const selectGarment = (prod: Product) => {
    setSelectedProduct(prod);
    const lower = prod.category.toLowerCase();
    if (lower.includes('dress')) setCategory('dresses');
    else if (lower.includes('jean') || lower.includes('pant')) setCategory('lower_body');
    else setCategory('upper_body');
    setGarmentDesc(`${prod.name} (${prod.brand})`);
    setErrorMsg(null);
  };

  const validateAndSetPhoto = (file: File) => {
    setErrorMsg(null);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      const msg = 'Unsupported format. Please upload a JPG, JPEG, or PNG portrait photo.';
      setErrorMsg(msg);
      showToast(msg, 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      const msg = 'Image exceeds 10 MB limit. Please select a smaller file.';
      setErrorMsg(msg);
      showToast(msg, 'error');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.width < 256 || img.height < 256) {
        URL.revokeObjectURL(objectUrl);
        const msg = `Image dimensions (${img.width}x${img.height}) are too small. Minimum 256x256px required.`;
        setErrorMsg(msg);
        showToast(msg, 'error');
        return;
      }
      setSessionPortrait({
        previewUrl: objectUrl,
        file,
        serverPath: null,
        fileName: file.name,
        dimensions: `${img.width} × ${img.height}px`,
      });
      showToast('Portrait loaded and ready for try-on.', 'success');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrorMsg('Could not read the selected image file.');
    };
    img.src = objectUrl;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetPhoto(file);
  };

  const handleGenerate = async () => {
    if (!user) {
      showToast('Please sign in to run AI Virtual Try-On.', 'info');
      navigate('/login');
      return;
    }
    if (!sessionPortrait) {
      setErrorMsg('Step 1: Please upload your photograph first.');
      return;
    }
    if (!selectedProduct) {
      setErrorMsg('Step 2: Please select a clothing item from the catalog.');
      return;
    }

    setGenerating(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      if (sessionPortrait.serverPath) {
        formData.append('existing_person_image_path', sessionPortrait.serverPath);
      } else if (sessionPortrait.file) {
        formData.append('person_image', sessionPortrait.file);
      }
      formData.append('product_id', String(selectedProduct.id));
      formData.append('category', category);
      formData.append('garment_description', garmentDesc || selectedProduct.name);
      formData.append('denoise_steps', String(denoiseSteps));

      const res = await tryOnApi.generate(formData);
      if (!res || !res.session) {
        throw new Error('The try-on server returned an unexpected empty response. Please try again.');
      }
      setActiveSession(res.session);
      // Persist server path so switching garments doesn't require re-uploading the same photo
      if (res.session.original_image_path) {
        setSessionPortrait((prev) =>
          prev
            ? {
                ...prev,
                serverPath: res.session.original_image_path,
              }
            : prev
        );
      }
      await loadHistory();
      showToast('Virtual Try-On completed.', 'success');
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Virtual Try-On inference failed.');
      setErrorMsg(msg);
      showToast(msg, 'error');
      // If server returned original_image_path even on HF error, persist it for quick retries
      const savedPath = (
        err as { response?: { data?: { original_image_path?: string } } } | null | undefined
      )?.response?.data?.original_image_path;
      if (savedPath) {
        setSessionPortrait((prev) => (prev ? { ...prev, serverPath: savedPath } : prev));
      }
      await loadHistory();
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadResult = async () => {
    if (!activeSession?.generated_image_path) return;
    try {
      const response = await fetch(activeSession.generated_image_path);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extMatch = activeSession.generated_image_path.match(/\.(webp|png|jpe?g)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'png';
      a.download = `atelier-vera-tryon-${activeSession.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Unable to download image.', 'error');
    }
  };

  const handleDeleteHistory = async (id: number) => {
    try {
      await tryOnApi.remove(id);
      setHistory((prev) => prev.filter((s) => s.id !== id));
      if (activeSession?.id === id) setActiveSession(null);
      showToast('Session removed from history.', 'info');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete session.'), 'error');
    }
  };

  const filteredCatalog = catalog.filter(
    (p) =>
      p.name.toLowerCase().includes(garmentSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(garmentSearch.toLowerCase()) ||
      p.brand.toLowerCase().includes(garmentSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="border-b border-zinc-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Hugging Face Virtual Fitting Room
          </p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-1">
            AI Virtual Try-On Studio
          </h1>
        </div>
        <p className="text-xs text-zinc-500 max-w-md">
          Upload your photograph once, select any garment from our live catalog, and generate a real AI fitting using
          the configured Hugging Face Virtual Try-On endpoint.
        </p>
      </div>

      {!user && (
        <div className="mt-6 p-4 border border-zinc-300 bg-zinc-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-zinc-700">
            Sign in to upload your portrait, run Hugging Face inference, and save your Virtual Try-On history.
          </p>
          <Link
            to="/login"
            className="px-4 py-2 bg-zinc-950 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Sign In to Continue
          </Link>
        </div>
      )}

      {/* Main 3-Column / 2-Section Studio */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Step 1 (Upload Portrait) & Step 2 (Select Garment) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: User Photo Upload */}
          <div className="border border-zinc-200 bg-white p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-950 font-sans">01. Your Photograph</h2>
              {sessionPortrait && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-medium text-zinc-700 hover:text-zinc-950 underline"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionPortrait(null);
                      setActiveSession(null);
                    }}
                    className="text-xs font-medium text-red-600 hover:text-red-800 inline-flex items-center gap-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) validateAndSetPhoto(f);
                e.target.value = '';
              }}
            />

            {sessionPortrait ? (
              <div className="space-y-3">
                <div className="aspect-[3/4] max-h-[340px] w-full bg-zinc-50 border border-zinc-200 overflow-hidden">
                  <SafeImage
                    src={sessionPortrait.previewUrl}
                    alt="Uploaded portrait"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="truncate max-w-[200px]">{sessionPortrait.fileName}</span>
                  <span className="tabular-nums">{sessionPortrait.dimensions}</span>
                </div>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
                className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-zinc-950 bg-zinc-50'
                    : 'border-zinc-300 hover:border-zinc-950 bg-zinc-50/50'
                }`}
              >
                <Upload className="w-7 h-7 text-zinc-400 mx-auto mb-3 stroke-[1.5]" />
                <p className="text-sm font-medium text-zinc-900">Drag &amp; drop a front-facing photo</p>
                <p className="text-xs text-zinc-500 mt-1">or click to browse (JPG, JPEG, PNG · max 10 MB · min 256px)</p>
              </div>
            )}
          </div>

          {/* Step 2: Select Garment from SQLite Catalog */}
          <div className="border border-zinc-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-950 font-sans">02. Select Garment</h2>
              <span className="text-xs text-zinc-500">{catalog.length} in catalog</span>
            </div>

            {selectedProduct && (
              <div className="flex items-center gap-3 p-3 border border-zinc-950 bg-zinc-50">
                <div className="w-14 h-18 bg-white border border-zinc-200 shrink-0 overflow-hidden">
                  <SafeImage
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-500">
                    {selectedProduct.brand} · {selectedProduct.category}
                  </p>
                  <p className="text-sm font-semibold text-zinc-950 truncate">{selectedProduct.name}</p>
                  <p className="text-xs font-medium text-zinc-800 tabular-nums mt-0.5">
                    ${(selectedProduct.discount_price ?? selectedProduct.price).toFixed(2)}
                  </p>
                </div>
                <Check className="w-4 h-4 text-zinc-950 shrink-0" />
              </div>
            )}

            <input
              type="text"
              value={garmentSearch}
              onChange={(e) => setGarmentSearch(e.target.value)}
              placeholder="Filter garments by name or category..."
              className="w-full px-3 py-2 text-xs border border-zinc-300 bg-white focus:outline-none focus:border-zinc-950"
            />

            <div className="grid grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {filteredCatalog.map((item) => {
                const isSelected = selectedProduct?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectGarment(item)}
                    className={`text-left border transition-colors p-1.5 ${
                      isSelected ? 'border-zinc-950 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    <div className="aspect-[3/4] bg-zinc-50 overflow-hidden mb-1.5">
                      <SafeImage src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[11px] font-medium text-zinc-900 line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-zinc-500 tabular-nums">
                      ${(item.discount_price ?? item.price).toFixed(0)}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Inference Parameters */}
            <div className="pt-3 border-t border-zinc-100 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">Garment Type</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as 'upper_body' | 'lower_body' | 'dresses')}
                  className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 bg-white"
                >
                  <option value="upper_body">Upper Body</option>
                  <option value="lower_body">Lower Body</option>
                  <option value="dresses">Full Dress / Gown</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-600 mb-1">Denoising Steps</label>
                <select
                  value={denoiseSteps}
                  onChange={(e) => setDenoiseSteps(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 bg-white tabular-nums"
                >
                  <option value={20}>20 (Fast)</option>
                  <option value={30}>30 (Balanced)</option>
                  <option value={40}>40 (High Detail)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !sessionPortrait || !selectedProduct}
              className="w-full py-3.5 px-5 bg-zinc-950 text-white text-xs font-semibold tracking-wide hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500 transition-colors inline-flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Running Hugging Face Inference...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Virtual Try-On</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Step 3 (Live Output & Before/After Comparison) */}
        <div className="lg:col-span-7 border border-zinc-200 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-200">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 font-sans">03. AI Fitting Preview</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {activeSession
                  ? `Model: ${activeSession.model_name} · Session #${activeSession.id}`
                  : 'Results from Hugging Face inference appear here'}
              </p>
            </div>

            {activeSession?.generated_image_path && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadResult}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-zinc-300 text-xs font-medium text-zinc-900 hover:border-zinc-950"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-zinc-300 text-xs font-medium text-zinc-900 hover:border-zinc-950"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
                {selectedProduct && (
                  <button
                    type="button"
                    onClick={() =>
                      addToCart({
                        product_id: selectedProduct.id,
                        quantity: 1,
                        selected_size: selectedProduct.sizes[0] || 'M',
                        selected_color: selectedProduct.colors[0] || 'Black',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add Garment to Bag</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="mt-5 p-4 border border-red-200 bg-red-50 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-900">Inference Notice</p>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="px-3 py-1.5 bg-red-900 text-white text-xs font-medium shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          <div className="mt-6">
            {generating ? (
              <div className="aspect-[3/4] max-h-[540px] w-full border border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center p-8 text-center">
                <Loader2 className="w-8 h-8 text-zinc-950 animate-spin mb-4" />
                <p className="text-sm font-semibold text-zinc-950">Processing Virtual Try-On</p>
                <p className="text-xs text-zinc-500 mt-1.5 max-w-sm">
                  Sending your portrait and selected garment to Hugging Face. Public ZeroGPU Spaces typically take
                  15–45 seconds depending on queue depth.
                </p>
              </div>
            ) : activeSession?.generated_image_path ? (
              <BeforeAfterSlider
                beforeUrl={activeSession.original_image_path}
                afterUrl={activeSession.generated_image_path}
              />
            ) : (
              <div className="aspect-[3/4] max-h-[540px] w-full border border-dashed border-zinc-300 bg-zinc-50/50 flex flex-col items-center justify-center p-8 text-center">
                <Sparkles className="w-8 h-8 text-zinc-300 mb-3 stroke-[1.25]" />
                <p className="text-sm font-medium text-zinc-800">Ready to Generate</p>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                  Upload your portrait on the left, choose any garment from the catalog, and click Generate Virtual
                  Try-On to view an interactive Before/After comparison.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Try-On History */}
      {user && (
        <section className="mt-14 pt-10 border-t border-zinc-200">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-editorial text-2xl font-semibold text-zinc-950">Your Try-On History</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Saved sessions stored in SQLite</p>
            </div>
          </div>

          {loadingHistory ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-zinc-100" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 border border-zinc-200 bg-zinc-50 text-center text-xs text-zinc-500">
              No saved Virtual Try-On sessions yet. Generate your first fitting above.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {history.map((sess) => (
                <div key={sess.id} className="border border-zinc-200 bg-white flex flex-col">
                  <div className="aspect-[3/4] bg-zinc-100 overflow-hidden relative">
                    <SafeImage
                      src={sess.generated_image_path || sess.original_image_path}
                      alt={sess.product_name || 'Try-on output'}
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute top-2.5 left-2.5 px-2 py-0.5 text-[11px] font-medium ${
                        sess.status === 'completed'
                          ? 'bg-zinc-950 text-white'
                          : sess.status === 'failed'
                          ? 'bg-red-700 text-white'
                          : 'bg-zinc-700 text-white'
                      }`}
                    >
                      {sess.status}
                    </span>
                  </div>
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-zinc-950 line-clamp-1">{sess.product_name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {new Date(sess.created_at).toLocaleString()}
                      </p>
                      {sess.error_message && (
                        <p className="text-[11px] text-red-600 mt-1 line-clamp-2">{sess.error_message}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                      {sess.generated_image_path ? (
                        <button
                          type="button"
                          onClick={() => setActiveSession(sess)}
                          className="text-xs font-medium text-zinc-950 hover:underline"
                        >
                          Inspect Comparison
                        </button>
                      ) : (
                        <span className="text-[11px] text-zinc-400">No output</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteHistory(sess.id)}
                        className="text-zinc-400 hover:text-red-600 p-1"
                        aria-label="Delete try-on session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
