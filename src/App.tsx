/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Scissors, Grid, Download, Trash2, Plus, X, 
  MoveHorizontal, MoveVertical, RefreshCw, ChevronRight, 
  ChevronLeft, Settings, Info, Image as ImageIcon,
  Maximize2, Minimize2, Layers, MousePointer2, Menu, PanelLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// 分割線のインターフェース
interface SplitLine {
  id: string;
  type: 'h' | 'v';
  position: number; // 0から1（幅/高さのパーセンテージ）
}

// 分割結果のインターフェース
interface SplitResult {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [lines, setLines] = useState<SplitLine[]>([]);
  const [results, setResults] = useState<SplitResult[]>([]);
  const [gridRows, setGridRows] = useState(2);
  const [gridCols, setGridCols] = useState(2);
  const [draggingLineId, setDraggingLineId] = useState<string | null>(null);
  const [hoveringLineId, setHoveringLineId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'results'>('edit');
  const [zoom, setZoom] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState<number>(1);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 画像アップロードのハンドリング
  const onImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setImageSrc(event.target?.result as string);
          setLines([]);
          setResults([]);
          setActiveTab('edit');
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // 2点間の距離を計算（ピンチズーム用）
  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // キャンバスサイズを更新する関数
  const updateCanvasSize = useCallback(() => {
    if (image && containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48; // パディング
      const containerHeight = containerRef.current.clientHeight - 48;
      const imgAspect = image.width / image.height;
      const containerAspect = containerWidth / containerHeight;

      let w, h;
      if (imgAspect > containerAspect) {
        w = containerWidth;
        h = containerWidth / imgAspect;
      } else {
        h = containerHeight;
        w = containerHeight * imgAspect;
      }
      setCanvasSize({ width: w * zoom, height: h * zoom });
    }
  }, [image, zoom]);

  // ResizeObserverを使用してコンテナのサイズ変更を監視
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      updateCanvasSize();
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updateCanvasSize]);

  // 画像が変更されたときにもサイズを更新
  useEffect(() => {
    updateCanvasSize();
  }, [image, zoom, updateCanvasSize]);

  // キャンバスに線を描画
  useEffect(() => {
    if (!canvasRef.current || !canvasSize.width) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
    
    // 線を描画
    lines.forEach(line => {
      const isActive = line.id === draggingLineId || line.id === hoveringLineId;
      
      ctx.beginPath();
      ctx.strokeStyle = isActive ? '#ef4444' : '#fca5a5';
      ctx.lineWidth = isActive ? 3 : 1.5;
      
      if (!isActive) {
        ctx.setLineDash([8, 4]);
      } else {
        ctx.setLineDash([]);
      }
      
      if (line.type === 'v') {
        const x = line.position * canvasSize.width;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasSize.height);
      } else {
        const y = line.position * canvasSize.height;
        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize.width, y);
      }
      ctx.stroke();

      // ドラッグハンドル（中央）
      if (isActive) {
        ctx.beginPath();
        ctx.fillStyle = '#ef4444';
        if (line.type === 'v') {
          ctx.arc(line.position * canvasSize.width, canvasSize.height / 2, 6, 0, Math.PI * 2);
        } else {
          ctx.arc(canvasSize.width / 2, line.position * canvasSize.height, 6, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    });
  }, [lines, canvasSize, draggingLineId, hoveringLineId]);

  // 分割線を追加
  const addLine = (type: 'h' | 'v') => {
    const newLine: SplitLine = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      position: 0.5,
    };
    setLines([...lines, newLine]);
  };

  // 分割線を削除
  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
  };

  // グリッドを適用
  const applyGrid = () => {
    const newLines: SplitLine[] = [];
    for (let i = 1; i < gridCols; i++) {
      newLines.push({ id: `v-${i}-${Date.now()}`, type: 'v', position: i / gridCols });
    }
    for (let i = 1; i < gridRows; i++) {
      newLines.push({ id: `h-${i}-${Date.now()}`, type: 'h', position: i / gridRows });
    }
    setLines(newLines);
  };

  // マウス/タッチイベントの座標計算
  const getEventPos = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: (clientX - rect.left) / canvasSize.width,
      y: (clientY - rect.top) / canvasSize.height
    };
  };

  // ホバー判定
  const findClosestLine = (x: number, y: number) => {
    const threshold = 0.05; // モバイル向けに少し広めに設定
    let closestLineId = null;
    let minDistance = threshold;

    lines.forEach(line => {
      const dist = line.type === 'v' ? Math.abs(line.position - x) : Math.abs(line.position - y);
      if (dist < minDistance) {
        minDistance = dist;
        closestLineId = line.id;
      }
    });
    return closestLineId;
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    // ピンチズームの開始
    if ('touches' in e && e.touches.length === 2) {
      setInitialDistance(getDistance(e.touches));
      setInitialZoom(zoom);
      setDraggingLineId(null);
      return;
    }

    const { x, y } = getEventPos(e);
    const id = findClosestLine(x, y);
    if (id) {
      setDraggingLineId(id);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    // ピンチズームの処理
    if ('touches' in e && e.touches.length === 2 && initialDistance !== null) {
      const currentDistance = getDistance(e.touches);
      const newZoom = Math.max(0.5, Math.min(2, initialZoom * (currentDistance / initialDistance)));
      setZoom(newZoom);
      return;
    }

    const { x, y } = getEventPos(e);
    
    if (draggingLineId) {
      const pos = Math.max(0, Math.min(1, draggingLineId.startsWith('v') || lines.find(l => l.id === draggingLineId)?.type === 'v' ? x : y));
      setLines(lines.map(l => l.id === draggingLineId ? { ...l, position: pos } : l));
    } else if (!('touches' in e)) {
      setHoveringLineId(findClosestLine(x, y));
    }
  };

  const handleEnd = () => {
    setDraggingLineId(null);
    setInitialDistance(null);
  };

  // 画像分割処理の実行
  const processSplit = async () => {
    if (!image) return;
    setIsProcessing(true);
    
    const vLines = [...lines.filter(l => l.type === 'v').map(l => l.position), 0, 1].sort((a, b) => a - b);
    const hLines = [...lines.filter(l => l.type === 'h').map(l => l.position), 0, 1].sort((a, b) => a - b);

    const uniqueV = vLines.filter((v, i) => i === 0 || v - vLines[i-1] > 0.001);
    const uniqueH = hLines.filter((h, i) => i === 0 || h - hLines[i-1] > 0.001);

    const newResults: SplitResult[] = [];
    const offCanvas = document.createElement('canvas');
    const ctx = offCanvas.getContext('2d');

    if (!ctx) return;

    for (let i = 0; i < uniqueH.length - 1; i++) {
      for (let j = 0; j < uniqueV.length - 1; j++) {
        const x = uniqueV[j] * image.width;
        const y = uniqueH[i] * image.height;
        const w = (uniqueV[j+1] - uniqueV[j]) * image.width;
        const h = (uniqueH[i+1] - uniqueH[i]) * image.height;

        offCanvas.width = w;
        offCanvas.height = h;
        ctx.drawImage(image, x, y, w, h, 0, 0, w, h);
        
        newResults.push({
          id: `${i}-${j}`,
          url: offCanvas.toDataURL('image/png'),
          x: j,
          y: i,
          width: w,
          height: h
        });
      }
    }

    setResults(newResults);
    setIsProcessing(false);
    setActiveTab('results');
  };

  const downloadAll = () => {
    results.forEach((res) => {
      const link = document.createElement('a');
      link.href = res.url;
      link.download = `cut_${res.y + 1}_${res.x + 1}.png`;
      link.click();
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      {/* ナビゲーション */}
      <nav className="h-14 glass-card flex items-center justify-between px-4 lg:px-6 z-50 sticky top-0">
        <div className="flex items-center gap-2 lg:gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white shrink-0">
              <Scissors size={18} />
            </div>
            <span className="font-bold tracking-tight text-zinc-800 hidden sm:inline">画像分割プロ</span>
          </div>
          <div className="h-4 w-px bg-zinc-200 mx-1 lg:mx-2" />
          <div className="flex bg-zinc-100 p-1 rounded-lg scale-90 sm:scale-100 origin-left">
            <button 
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${activeTab === 'edit' ? 'bg-white shadow-sm text-brand' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              エディター
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              disabled={results.length === 0}
              className={`px-3 py-1 text-[10px] sm:text-xs font-bold rounded-md transition-all ${activeTab === 'results' ? 'bg-white shadow-sm text-brand' : 'text-zinc-500 hover:text-zinc-700 disabled:opacity-50'}`}
            >
              結果 {results.length > 0 && `(${results.length})`}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
          {imageSrc && (
            <button 
              onClick={() => { setImage(null); setImageSrc(null); setLines([]); setResults([]); setIsSidebarOpen(false); }}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            >
              <RefreshCw size={14} />
              <span className="hidden xs:inline">リセット</span>
            </button>
          )}
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="p-2 text-zinc-400 hover:text-zinc-600"
            aria-label="ヘルプ"
          >
            <Info size={18} />
          </button>
          <button className="p-2 text-zinc-400 hover:text-zinc-600">
            <Settings size={18} />
          </button>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden relative">
        {/* サイドバー (デスクトップ) / ドロワー (モバイル) */}
        <AnimatePresence>
          {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024)) && (
            <motion.aside 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed inset-y-0 left-0 w-72 studio-panel flex flex-col z-[60] lg:relative lg:z-40 lg:translate-x-0 ${isSidebarOpen ? 'shadow-2xl' : ''}`}
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 lg:hidden">
                <span className="font-bold text-zinc-800">ツールパネル</span>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-zinc-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              {!imageSrc ? (
                <div className="p-6 space-y-4">
                  <div className="p-4 bg-brand-light rounded-xl border border-brand/10">
                    <p className="text-xs font-bold text-brand uppercase tracking-wider mb-1">クイックスタート</p>
                    <p className="text-xs text-brand/80 leading-relaxed">画像をアップロードして、分割ラインを配置するだけで簡単に画像を切り分けることができます。</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-4 border-b border-zinc-100">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">ツール</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => { addLine('v'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }}
                        className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-200 transition-all group"
                      >
                        <MoveVertical size={18} className="text-zinc-400 group-hover:text-brand" />
                        <span className="text-[10px] font-bold text-zinc-600">垂直カット</span>
                      </button>
                      <button 
                        onClick={() => { addLine('h'); if(window.innerWidth < 1024) setIsSidebarOpen(false); }}
                        className="flex flex-col items-center justify-center gap-2 p-3 bg-zinc-50 hover:bg-zinc-100 rounded-xl border border-zinc-200 transition-all group"
                      >
                        <MoveHorizontal size={18} className="text-zinc-400 group-hover:text-brand" />
                        <span className="text-[10px] font-bold text-zinc-600">水平カット</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 border-b border-zinc-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">グリッド設定</p>
                      <button onClick={() => { applyGrid(); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="text-[10px] font-bold text-brand hover:underline">適用</button>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">行数</span>
                        <div className="flex items-center bg-zinc-100 rounded-lg p-1">
                          <button 
                            onClick={() => setGridRows(Math.max(1, gridRows - 1))} 
                            className="w-8 h-8 flex items-center justify-center hover:bg-white rounded shadow-sm transition-all"
                          >
                            <ChevronLeft size={16}/>
                          </button>
                          <span className="w-10 text-center text-xs font-mono font-bold">{gridRows}</span>
                          <button 
                            onClick={() => setGridRows(gridRows + 1)} 
                            className="w-8 h-8 flex items-center justify-center hover:bg-white rounded shadow-sm transition-all"
                          >
                            <ChevronRight size={16}/>
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">列数</span>
                        <div className="flex items-center bg-zinc-100 rounded-lg p-1">
                          <button 
                            onClick={() => setGridCols(Math.max(1, gridCols - 1))} 
                            className="w-8 h-8 flex items-center justify-center hover:bg-white rounded shadow-sm transition-all"
                          >
                            <ChevronLeft size={16}/>
                          </button>
                          <span className="w-10 text-center text-xs font-mono font-bold">{gridCols}</span>
                          <button 
                            onClick={() => setGridCols(gridCols + 1)} 
                            className="w-8 h-8 flex items-center justify-center hover:bg-white rounded shadow-sm transition-all"
                          >
                            <ChevronRight size={16}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">カットライン ({lines.length})</p>
                      {lines.length > 0 && (
                        <button onClick={() => setLines([])} className="text-[10px] font-bold text-red-500 hover:underline">クリア</button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <AnimatePresence>
                        {lines.map((line) => (
                          <motion.div 
                            key={line.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all ${hoveringLineId === line.id ? 'bg-brand-light border-brand/20' : 'bg-white border-zinc-100'}`}
                            onMouseEnter={() => setHoveringLineId(line.id)}
                            onMouseLeave={() => setHoveringLineId(null)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${line.type === 'v' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {line.type === 'v' ? <MoveVertical size={14} /> : <MoveHorizontal size={14} />}
                              </div>
                              <span className="text-[10px] font-mono font-bold text-zinc-500">{(line.position * 100).toFixed(1)}%</span>
                            </div>
                            <button 
                              onClick={() => removeLine(line.id)}
                              className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg lg:opacity-0 lg:group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
                    <button 
                      onClick={() => { processSplit(); setIsSidebarOpen(false); }}
                      disabled={isProcessing || !imageSrc}
                      className="w-full py-3 bg-brand hover:bg-brand-dark disabled:bg-zinc-300 text-white rounded-xl font-bold text-sm shadow-lg shadow-brand/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {isProcessing ? <RefreshCw size={18} className="animate-spin" /> : <Scissors size={18} />}
                      画像を分割する
                    </button>
                  </div>
                </>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* モバイル用オーバーレイ */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ヘルプモーダル */}
        <AnimatePresence>
          {isHelpOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsHelpOpen(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-brand/10 text-brand rounded-lg flex items-center justify-center">
                      <Info size={18} />
                    </div>
                    <h3 className="font-bold text-zinc-800">使い方ガイド</h3>
                  </div>
                  <button onClick={() => setIsHelpOpen(false)} className="p-2 hover:bg-zinc-100 rounded-lg transition-all">
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0">
                        <MousePointer2 size={20} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-800">ラインの操作</p>
                        <p className="text-xs text-zinc-500 leading-relaxed">分割ラインをタップまたはドラッグして移動できます。ホバーすると赤く強調されます。</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0">
                        <Maximize2 size={20} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-800">ズーム操作</p>
                        <p className="text-xs text-zinc-500 leading-relaxed">ピンチイン・アウトで画像を拡大縮小できます。右下のコントロールでも操作可能です。</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center shrink-0">
                        <PanelLeft size={20} className="text-zinc-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-800">ツールパネル</p>
                        <p className="text-xs text-zinc-500 leading-relaxed">左下のボタンからツールパネルを開き、カットの追加やグリッド設定が行えます。</p>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsHelpOpen(false)}
                    className="w-full py-3 bg-zinc-900 text-white rounded-xl font-bold text-sm hover:bg-zinc-800 transition-all"
                  >
                    閉じる
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* メインビューポート */}
        <main className="flex-1 relative bg-zinc-100 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {activeTab === 'edit' ? (
              <motion.div 
                key="edit"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                {!imageSrc ? (
                  <div className="flex-1 flex items-center justify-center p-4 sm:p-12">
                    <label className="max-w-xl w-full aspect-video glass-card rounded-3xl border-2 border-dashed border-zinc-300 flex flex-col items-center justify-center gap-4 sm:gap-6 cursor-pointer hover:border-brand hover:bg-brand-light/20 transition-all group">
                      <input type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
                      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl shadow-xl border border-zinc-100 flex items-center justify-center text-zinc-300 group-hover:text-brand group-hover:scale-110 transition-all duration-500">
                        <Upload size={32} />
                      </div>
                      <div className="text-center px-4">
                        <h3 className="text-lg sm:text-xl font-bold text-zinc-800 mb-1">画像をアップロード</h3>
                        <p className="text-[10px] sm:text-sm text-zinc-500">ドロップするか、クリックして選択</p>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="flex-1 relative overflow-auto p-4 sm:p-12 flex items-center justify-center" ref={containerRef}>
                    <div className="relative shadow-2xl rounded-sm overflow-hidden bg-white">
                      <img 
                        src={imageSrc} 
                        alt="Editor" 
                        className="block pointer-events-none"
                        style={{ width: canvasSize.width, height: canvasSize.height }}
                      />
                      <canvas
                        ref={canvasRef}
                        width={canvasSize.width}
                        height={canvasSize.height}
                        onMouseDown={handleStart}
                        onMouseMove={handleMove}
                        onMouseUp={handleEnd}
                        onMouseLeave={handleEnd}
                        onTouchStart={handleStart}
                        onTouchMove={handleMove}
                        onTouchEnd={handleEnd}
                        className="absolute inset-0 z-10 cursor-crosshair touch-none"
                      />
                    </div>
                    
                    {/* ズームコントロール */}
                    <div className="absolute bottom-4 right-4 sm:bottom-8 sm:right-8 flex items-center bg-white rounded-xl shadow-xl border border-zinc-200 p-1.5 gap-1">
                      <button 
                        onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} 
                        className="w-10 h-10 flex items-center justify-center hover:bg-zinc-100 rounded-lg text-zinc-500 active:scale-90 transition-all"
                        aria-label="ズームアウト"
                      >
                        <Minimize2 size={18}/>
                      </button>
                      <span className="w-12 text-center text-xs font-bold text-zinc-600">{Math.round(zoom * 100)}%</span>
                      <button 
                        onClick={() => setZoom(Math.min(2, zoom + 0.1))} 
                        className="w-10 h-10 flex items-center justify-center hover:bg-zinc-100 rounded-lg text-zinc-500 active:scale-90 transition-all"
                        aria-label="ズームイン"
                      >
                        <Maximize2 size={18}/>
                      </button>
                    </div>

                    {/* モバイル用ツールボタン */}
                    <button 
                      onClick={() => setIsSidebarOpen(true)}
                      className="lg:hidden absolute bottom-4 left-4 w-14 h-14 bg-brand text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-all z-20"
                      aria-label="メニューを開く"
                    >
                      <PanelLeft size={28} />
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex-1 flex flex-col p-4 sm:p-8 overflow-y-auto"
              >
                <div className="max-w-6xl mx-auto w-full space-y-6 sm:space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-zinc-800">分割結果</h2>
                      <p className="text-xs sm:text-sm text-zinc-500">{results.length}個のパーツに分割されました</p>
                    </div>
                    <button 
                      onClick={downloadAll}
                      className="flex items-center justify-center gap-2 px-6 py-3 bg-brand text-white rounded-xl font-bold text-sm shadow-lg shadow-brand/20 hover:bg-brand-dark transition-all"
                    >
                      <Download size={18} />
                      すべてダウンロード
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                    {results.map((res, i) => (
                      <motion.div 
                        key={res.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="group relative studio-panel rounded-2xl overflow-hidden aspect-square flex flex-col"
                      >
                        <div className="flex-1 bg-zinc-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
                          <img src={res.url} alt="Part" className="max-w-full max-h-full object-contain shadow-sm" />
                        </div>
                        <div className="p-2 sm:p-3 bg-white border-t border-zinc-100 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[8px] sm:text-[10px] font-bold text-zinc-400 uppercase">位置</span>
                            <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-600">{res.y + 1}行 - {res.x + 1}列</span>
                          </div>
                          <a 
                            href={res.url} 
                            download={`cut_${res.y + 1}_${res.x + 1}.png`}
                            className="p-1.5 sm:p-2 bg-brand-light text-brand rounded-lg hover:bg-brand hover:text-white transition-all"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ステータスバー */}
          <footer className="h-8 glass-card border-t border-zinc-200 px-4 flex items-center justify-between text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${imageSrc ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                <span className="hidden xs:inline">{imageSrc ? '読み込み済み' : '待機中'}</span>
              </div>
              {image && (
                <div className="flex items-center gap-1.5">
                  <ImageIcon size={12} />
                  {image.width}x{image.height}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-1.5">
                <MousePointer2 size={12} />
                <span className="hidden sm:inline">{draggingLineId ? 'ドラッグ中' : '選択可能'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers size={12} />
                <span className="hidden xs:inline">レイヤー:</span> {lines.length + 1}
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
