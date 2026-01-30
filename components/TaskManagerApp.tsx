
import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, Cpu, HardDrive, LayoutGrid, Server, 
  X, Check, Search, Menu, MoreHorizontal, Settings,
  PlayCircle, PauseCircle, Wifi
} from 'lucide-react';

interface TaskManagerProps {
  windows: any[];
  onCloseWindow: (id: string) => void;
}

const HISTORY_LENGTH = 60; // 60 data points (approx 60 seconds)

export const TaskManagerApp: React.FC<TaskManagerProps> = ({ windows, onCloseWindow }) => {
  const [activeTab, setActiveTab] = useState<'processes' | 'performance'>('processes');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    cpu: [] as number[],
    memory: [] as number[],
    disk: [] as number[],
    gpu: [] as number[],
    currentCpu: 0,
    currentMem: 0,
    currentDisk: 0,
    currentGpu: 0
  });

  // Init stats with zeros
  useEffect(() => {
    setStats({
      cpu: new Array(HISTORY_LENGTH).fill(0),
      memory: new Array(HISTORY_LENGTH).fill(0),
      disk: new Array(HISTORY_LENGTH).fill(0),
      gpu: new Array(HISTORY_LENGTH).fill(0),
      currentCpu: 12,
      currentMem: 45,
      currentDisk: 1,
      currentGpu: 5
    });
  }, []);

  // Simulation Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setStats(prev => {
        // Simulate fluctuating values
        const newCpu = Math.max(2, Math.min(100, prev.currentCpu + (Math.random() * 10 - 5)));
        const newMem = Math.max(20, Math.min(90, 30 + (windows.length * 5) + (Math.random() * 2 - 1)));
        const newDisk = Math.max(0, Math.min(100, (Math.random() > 0.8 ? Math.random() * 50 : 0))); // Spiky disk usage
        const newGpu = Math.max(0, Math.min(100, (windows.some(w => w.appId === 'youtube' || w.appId === 'game') ? 40 : 2) + Math.random() * 5));

        return {
          currentCpu: Math.round(newCpu),
          currentMem: Math.round(newMem),
          currentDisk: Math.round(newDisk),
          currentGpu: Math.round(newGpu),
          cpu: [...prev.cpu.slice(1), newCpu],
          memory: [...prev.memory.slice(1), newMem],
          disk: [...prev.disk.slice(1), newDisk],
          gpu: [...prev.gpu.slice(1), newGpu],
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [windows.length]);

  const handleEndTask = () => {
    if (selectedTaskId) {
      onCloseWindow(selectedTaskId);
      setSelectedTaskId(null);
    }
  };

  // --- SUB-COMPONENTS ---

  const MiniGraph = ({ data, color }: { data: number[], color: string }) => {
    const max = 100;
    const points = data.map((val, i) => {
        const x = (i / (HISTORY_LENGTH - 1)) * 100;
        const y = 100 - ((val / max) * 100);
        return `${x},${y}`;
    }).join(' ');

    return (
      <div className="h-8 w-16 relative bg-slate-900/50 border border-slate-700 rounded overflow-hidden">
        <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
             <polyline 
                points={points} 
                fill="none" 
                stroke={color} 
                strokeWidth="2" 
                vectorEffect="non-scaling-stroke"
             />
             <polygon 
                points={`0,100 ${points} 100,100`} 
                fill={color} 
                fillOpacity="0.2"
             />
        </svg>
      </div>
    );
  };

  const BigGraph = ({ data, color, label, value, suffix }: any) => {
      const max = 100;
      const points = data.map((val: number, i: number) => {
          const x = (i / (HISTORY_LENGTH - 1)) * 100;
          const y = 100 - ((val / max) * 100);
          return `${x},${y}`;
      }).join(' ');

      return (
          <div className="flex-1 flex flex-col p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex justify-between items-start mb-4">
                  <div>
                      <h3 className="text-sm font-bold text-slate-300">{label}</h3>
                      <p className="text-2xl font-light text-white">{value}{suffix}</p>
                  </div>
              </div>
              <div className="flex-1 w-full bg-slate-900/50 border border-slate-700 rounded relative overflow-hidden">
                   {/* Grid Lines */}
                   <div className="absolute inset-0 grid grid-cols-6 grid-rows-4">
                       {[...Array(24)].map((_, i) => <div key={i} className="border-r border-b border-slate-800/50"></div>)}
                   </div>
                   
                   <svg className="absolute inset-0 w-full h-full z-10" preserveAspectRatio="none" viewBox="0 0 100 100">
                        <polyline 
                            points={points} 
                            fill="none" 
                            stroke={color} 
                            strokeWidth="1.5" 
                            vectorEffect="non-scaling-stroke"
                        />
                         <polygon 
                            points={`0,100 ${points} 100,100`} 
                            fill={color} 
                            fillOpacity="0.15"
                        />
                   </svg>
              </div>
          </div>
      );
  };

  return (
    <div className="flex h-full bg-[#1c1c1c] text-white font-sans select-none overflow-hidden">
      
      {/* SIDEBAR */}
      <div className="w-12 sm:w-16 flex flex-col items-center py-4 gap-4 bg-[#1c1c1c] border-r border-[#2d2d2d]">
          <button onClick={() => setActiveTab('processes')} className={`p-2 rounded-lg transition-all ${activeTab === 'processes' ? 'bg-white/10 text-blue-400 border-l-2 border-blue-400' : 'text-slate-400 hover:text-white'}`} title="Processes">
              <LayoutGrid size={20} />
          </button>
          <button onClick={() => setActiveTab('performance')} className={`p-2 rounded-lg transition-all ${activeTab === 'performance' ? 'bg-white/10 text-blue-400 border-l-2 border-blue-400' : 'text-slate-400 hover:text-white'}`} title="Performance">
              <Activity size={20} />
          </button>
          <div className="flex-1"></div>
          <button className="p-2 text-slate-400 hover:text-white"><Settings size={20}/></button>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#191919]">
          
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-6 border-b border-[#2d2d2d] bg-[#1c1c1c]">
              <h1 className="text-lg font-semibold">{activeTab === 'processes' ? 'Processes' : 'Performance'}</h1>
              {activeTab === 'processes' && (
                  <div className="flex items-center gap-2">
                       <button 
                         disabled={!selectedTaskId}
                         onClick={handleEndTask}
                         className="px-4 py-1.5 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white text-xs font-medium rounded border border-[#444] disabled:opacity-50 transition-colors"
                        >
                           End task
                       </button>
                       <button className="p-1.5 hover:bg-[#3a3a3a] rounded"><MoreHorizontal size={16}/></button>
                  </div>
              )}
          </div>

          {/* Processes View */}
          {activeTab === 'processes' && (
              <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-2 px-6 py-2 text-xs font-medium text-slate-400 border-b border-[#2d2d2d] bg-[#1f1f1f]">
                      <div className="col-span-5 hover:bg-white/5 cursor-pointer rounded px-2 py-1">Name</div>
                      <div className="col-span-2 text-right hover:bg-white/5 cursor-pointer rounded px-2 py-1">Status</div>
                      <div className="col-span-1 text-right hover:bg-white/5 cursor-pointer rounded px-2 py-1">CPU</div>
                      <div className="col-span-2 text-right hover:bg-white/5 cursor-pointer rounded px-2 py-1">Memory</div>
                      <div className="col-span-1 text-right hover:bg-white/5 cursor-pointer rounded px-2 py-1">Disk</div>
                      <div className="col-span-1 text-right hover:bg-white/5 cursor-pointer rounded px-2 py-1">Net</div>
                  </div>
                  
                  {/* Table Body */}
                  <div className="flex-1 overflow-y-auto">
                      {windows.map((win) => {
                          const isSelected = selectedTaskId === win.instanceId;
                          // Simulate per-process stats based on random seed from instanceId
                          const seed = parseInt(win.instanceId.slice(-3)) || 0;
                          const cpuUsage = (stats.currentCpu * (seed % 10 + 1) / 100).toFixed(1);
                          const memUsage = Math.round(50 + (seed % 200)) + ' MB';
                          
                          return (
                              <div 
                                key={win.instanceId}
                                onClick={() => setSelectedTaskId(win.instanceId)}
                                className={`grid grid-cols-12 gap-2 px-6 py-2 text-xs items-center cursor-default ${isSelected ? 'bg-[#37373d] text-white' : 'hover:bg-[#2a2d2e] text-slate-300'}`}
                              >
                                  <div className="col-span-5 flex items-center gap-3 overflow-hidden">
                                      <div className="w-4 h-4 flex items-center justify-center">
                                         {win.appData.icon.startsWith('http') ? <img src={win.appData.icon} className="w-full h-full object-cover"/> : <LayoutGrid size={14}/>}
                                      </div>
                                      <span className="truncate">{win.title}</span>
                                  </div>
                                  <div className="col-span-2 text-right text-slate-500">{win.isMinimized ? 'Suspended' : 'Running'}</div>
                                  <div className="col-span-1 text-right text-slate-300">{cpuUsage}%</div>
                                  <div className="col-span-2 text-right text-slate-300">{memUsage}</div>
                                  <div className="col-span-1 text-right text-slate-500">0.1 MB/s</div>
                                  <div className="col-span-1 text-right text-slate-500">0 Mbps</div>
                              </div>
                          );
                      })}
                      
                      {/* Fake background processes for realism */}
                      <div className="px-6 py-2 text-xs font-bold text-slate-500 bg-[#1f1f1f] mt-2">Background processes (4)</div>
                      {[
                          { name: 'System', cpu: '0.1%', mem: '120 MB' },
                          { name: 'Desktop Window Manager', cpu: '1.2%', mem: '45 MB' },
                          { name: 'Service Host: Local System', cpu: '0.0%', mem: '12 MB' },
                          { name: 'Antimalware Service Executable', cpu: '0.3%', mem: '210 MB' }
                      ].map((proc, i) => (
                           <div key={i} className="grid grid-cols-12 gap-2 px-6 py-2 text-xs items-center text-slate-400 hover:bg-[#2a2d2e]">
                               <div className="col-span-5 flex items-center gap-3"><Server size={14} className="text-slate-500"/>{proc.name}</div>
                               <div className="col-span-2 text-right text-slate-500">Running</div>
                               <div className="col-span-1 text-right">{proc.cpu}</div>
                               <div className="col-span-2 text-right">{proc.mem}</div>
                               <div className="col-span-1 text-right text-slate-600">0 MB/s</div>
                               <div className="col-span-1 text-right text-slate-600">0 Mbps</div>
                           </div>
                      ))}
                  </div>
              </div>
          )}

          {/* Performance View */}
          {activeTab === 'performance' && (
              <div className="flex-1 flex overflow-hidden">
                  {/* Left List */}
                  <div className="w-64 border-r border-[#2d2d2d] bg-[#1f1f1f] flex flex-col overflow-y-auto">
                      <div className="p-4 border-b border-[#2d2d2d] bg-[#2d2d2d]/50 border-l-4 border-l-blue-400">
                          <div className="flex justify-between mb-2">
                              <span className="font-bold text-xs text-slate-300">CPU</span>
                              <span className="font-bold text-xs text-slate-300">{stats.currentCpu}%</span>
                          </div>
                          <MiniGraph data={stats.cpu} color="#60a5fa" />
                          <div className="text-[10px] text-slate-500 mt-1">AMD Ryzen 5 4500 6-Core</div>
                      </div>

                      <div className="p-4 border-b border-[#2d2d2d] hover:bg-white/5">
                          <div className="flex justify-between mb-2">
                              <span className="font-bold text-xs text-slate-300">Memory</span>
                              <span className="font-bold text-xs text-slate-300">{stats.currentMem}%</span>
                          </div>
                          <MiniGraph data={stats.memory} color="#a78bfa" />
                          <div className="text-[10px] text-slate-500 mt-1">11.5/15.9 GB (72%)</div>
                      </div>

                      <div className="p-4 border-b border-[#2d2d2d] hover:bg-white/5">
                          <div className="flex justify-between mb-2">
                              <span className="font-bold text-xs text-slate-300">Disk 0 (C:)</span>
                              <span className="font-bold text-xs text-slate-300">{stats.currentDisk}%</span>
                          </div>
                          <MiniGraph data={stats.disk} color="#34d399" />
                          <div className="text-[10px] text-slate-500 mt-1">SSD (NVMe)</div>
                      </div>

                      <div className="p-4 border-b border-[#2d2d2d] hover:bg-white/5">
                          <div className="flex justify-between mb-2">
                              <span className="font-bold text-xs text-slate-300">GPU 0</span>
                              <span className="font-bold text-xs text-slate-300">{stats.currentGpu}%</span>
                          </div>
                          <MiniGraph data={stats.gpu} color="#f472b6" />
                          <div className="text-[10px] text-slate-500 mt-1">NVIDIA GeForce GTX 1660</div>
                      </div>
                  </div>

                  {/* Right Detail Graph */}
                  <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
                      <div className="flex justify-between items-center">
                          <h2 className="text-xl font-semibold">CPU</h2>
                          <div className="text-right">
                              <div className="text-2xl font-light">AMD Ryzen 5 4500 6-Core Processor</div>
                          </div>
                      </div>

                      {/* Main CPU Graph */}
                      <BigGraph 
                          data={stats.cpu} 
                          color="#3b82f6" 
                          label="% Utilization" 
                          value={stats.currentCpu} 
                          suffix="%" 
                      />

                      <div className="grid grid-cols-4 gap-6 text-xs text-slate-400 mt-2">
                          <div>
                              <div className="uppercase font-bold mb-1">Utilization</div>
                              <div className="text-xl text-white font-light">{stats.currentCpu}%</div>
                          </div>
                          <div>
                              <div className="uppercase font-bold mb-1">Speed</div>
                              <div className="text-xl text-white font-light">4.01 GHz</div>
                          </div>
                          <div>
                              <div className="uppercase font-bold mb-1">Processes</div>
                              <div className="text-xl text-white font-light">{145 + windows.length}</div>
                          </div>
                          <div>
                              <div className="uppercase font-bold mb-1">Up time</div>
                              <div className="text-xl text-white font-light">1:06:04:13</div>
                          </div>
                          <div>
                              <div className="uppercase font-bold mb-1">Threads</div>
                              <div className="text-xl text-white font-light">2440</div>
                          </div>
                          <div>
                              <div className="uppercase font-bold mb-1">Handles</div>
                              <div className="text-xl text-white font-light">89212</div>
                          </div>
                      </div>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};
