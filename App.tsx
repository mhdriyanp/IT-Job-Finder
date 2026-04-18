/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Home, 
  Bookmark, 
  User, 
  Filter, 
  MapPin, 
  Briefcase, 
  Clock, 
  ChevronRight, 
  ArrowLeft,
  Bell,
  Sparkles,
  X,
  CheckCircle2,
  Upload,
  LogOut,
  HelpCircle,
  Settings,
  FileText,
  ExternalLink,
  Moon,
  Shield,
  Globe,
  Lock,
  Sun,
  Info,
  Mail,
  MessageCircle,
  UserCircle,
  CreditCard,
  Share2,
  Trash2,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

import { Job, UserProfile, Screen } from './types';
import { MOCK_USER, MOCK_JOBS, TOP_COMPANIES, POPULAR_SUGGESTIONS } from './constants';
import { getJobRecommendations } from './lib/gemini';

interface Filters {
  experience: string[];
  skills: string[];
  location: string[];
  sortBy: 'newest' | 'salary-high' | 'salary-low';
  salaryRange: [number, number];
}

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recommendations, setRecommendations] = useState<{ jobId: string, matchReason: string, matchScore: number }[]>([]);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [showSmartNotification, setShowSmartNotification] = useState(false);
  const [hasResume, setHasResume] = useState(false);
  const [user, setUser] = useState<UserProfile>(MOCK_USER);
  const [filters, setFilters] = useState<Filters>({
    experience: [],
    skills: [],
    location: [],
    sortBy: 'newest',
    salaryRange: [0, 50],
  });
  const [pageDirection, setPageDirection] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const screenOrder: Screen[] = ['home', 'saved', 'profile'];

  const handleNavClick = (screen: Screen) => {
    const currentIndex = screenOrder.indexOf(currentScreen);
    const nextIndex = screenOrder.indexOf(screen);
    if (currentIndex !== -1 && nextIndex !== -1) {
      setPageDirection(nextIndex > currentIndex ? 1 : -1);
    }
    setCurrentScreen(screen);
  };

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoadingRecommendations(true);
      const res = await getJobRecommendations(user, MOCK_JOBS);
      setRecommendations(res.recommendations);
      setIsLoadingRecommendations(false);
      if (res.recommendations.length > 0) {
        setShowSmartNotification(true);
      }
    };
    fetchRecommendations();
  }, []);

  const toggleSaveJob = (jobId: string) => {
    setSavedJobs(prev => 
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    );
    const isSaving = !savedJobs.includes(jobId);
    toast(isSaving ? "Job Saved" : "Job Removed", {
      description: isSaving ? "You can find this job in your saved list." : "Job has been removed from your saved list.",
    });
  };

  const filteredJobs = useMemo(() => {
    let result = [...MOCK_JOBS];

    // 1. Search Filtering
    if (searchQuery.trim()) {
      const terms = searchQuery.toLowerCase().split(/\s+/).filter(t => t.length > 0);
      result = result
        .map(job => {
          let score = 0;
          const title = job.title.toLowerCase();
          const company = job.company.toLowerCase();
          const location = job.location.toLowerCase();
          const skills = job.skills.map(s => s.toLowerCase());
          const tags = job.tags.map(t => t.toLowerCase());

          terms.forEach(term => {
            if (title.includes(term)) score += 10;
            if (company.includes(term)) score += 5;
            if (skills.some(s => s.includes(term))) score += 3;
            if (location.includes(term)) score += 2;
            if (tags.some(t => t.includes(term))) score += 1;
          });

          return { job, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.job);
    }

    // 2. Category Filtering
    if (filters.experience.length > 0) {
      result = result.filter(job => filters.experience.includes(job.experience));
    }
    if (filters.skills.length > 0) {
      result = result.filter(job => job.skills.some(skill => filters.skills.includes(skill)));
    }
    if (filters.location.length > 0) {
      result = result.filter(job => filters.location.some(loc => job.location.includes(loc)));
    }

    // 3. Salary Range Filtering
    result = result.filter(job => 
      job.maxSalary >= filters.salaryRange[0] && job.minSalary <= filters.salaryRange[1]
    );

    // 4. Sorting
    result.sort((a, b) => {
      if (filters.sortBy === 'newest') {
        return b.createdAt - a.createdAt;
      } else if (filters.sortBy === 'salary-high') {
        return b.maxSalary - a.maxSalary;
      } else if (filters.sortBy === 'salary-low') {
        return a.minSalary - b.minSalary;
      }
      return 0;
    });

    return result;
  }, [searchQuery, filters]);

  const handleApply = async (job: Job) => {
    if (user.appliedJobIds.includes(job.id)) {
      toast.error("Already Applied", {
        description: `You have already applied for ${job.title} at ${job.company}.`,
      });
      return;
    }

    const toastId = toast.loading("Sending application...");
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    setUser(prev => ({
      ...prev,
      appliedCount: prev.appliedCount + 1,
      appliedJobIds: [...prev.appliedJobIds, job.id]
    }));

    toast.success("Application Sent!", {
      id: toastId,
      description: `Your application for ${job.title} at ${job.company} has been submitted successfully.`,
    });
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return (
          <HomeScreen 
            onJobClick={(job) => { setSelectedJob(job); setCurrentScreen('details'); }}
            onToggleSave={toggleSaveJob}
            onApply={handleApply}
            savedJobs={savedJobs}
            appliedJobIds={user.appliedJobIds}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            recommendations={recommendations}
            isLoadingRecommendations={isLoadingRecommendations}
            showSmartNotification={showSmartNotification}
            onCloseNotification={() => setShowSmartNotification(false)}
            filteredJobs={filteredJobs}
            filters={filters}
            setFilters={setFilters}
          />
        );
      case 'saved':
        return (
          <SavedJobsScreen 
            jobs={MOCK_JOBS.filter(j => savedJobs.includes(j.id))}
            onJobClick={(job) => { setSelectedJob(job); setCurrentScreen('details'); }}
            onToggleSave={toggleSaveJob}
            onApply={handleApply}
            savedJobs={savedJobs}
            appliedJobIds={user.appliedJobIds}
          />
        );
      case 'profile':
        return <ProfileScreen user={user} hasResume={hasResume} setHasResume={setHasResume} handleNavClick={handleNavClick} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
      case 'details':
        return selectedJob ? (
          <JobDetailsScreen 
            job={selectedJob} 
            user={user}
            onBack={() => setCurrentScreen('home')} 
            onApply={() => handleApply(selectedJob)}
            onToggleSave={() => toggleSaveJob(selectedJob.id)}
            isSaved={savedJobs.includes(selectedJob.id)}
            isApplied={user.appliedJobIds.includes(selectedJob.id)}
            recommendation={recommendations.find(r => r.jobId === selectedJob.id)}
          />
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-slate-950 flex flex-col font-sans text-text-main dark:text-white">
      {/* Dashboard Header */}
      <header className="bg-white dark:bg-slate-900 border-bottom border-slate-300 dark:border-slate-800 px-10 py-5 flex justify-between items-center hidden sm:flex">
        <div className="text-2xl font-extrabold text-primary flex items-center gap-2">
          Career<span className="text-accent-ai">Jump</span>
        </div>
        <div className="text-sm text-text-sub dark:text-slate-400">Fresher-First Experience Platform v2.4</div>
      </header>

      <div className="flex-1 flex justify-center items-center p-0 sm:p-5">
        <div className="w-full max-w-[320px] bg-bg-main dark:bg-slate-950 h-[100dvh] sm:h-[650px] shadow-2xl sm:rounded-[40px] overflow-hidden flex flex-col relative border-[8px] border-slate-800">
          {/* Status Bar */}
          <div className="h-6 bg-transparent flex items-center justify-between px-5 pt-1 text-text-main dark:text-white">
            <span className="text-[10px] font-semibold">9:41</span>
            <span className="text-[10px] font-semibold">5G</span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <AnimatePresence mode="popLayout" custom={pageDirection}>
              <motion.div
                key={currentScreen}
                custom={pageDirection}
                initial={(direction: number) => ({
                  x: direction > 0 ? 100 : direction < 0 ? -100 : 0,
                  opacity: 0
                })}
                animate={{ x: 0, opacity: 1 }}
                exit={(direction: number) => ({
                  x: direction > 0 ? -100 : direction < 0 ? 100 : 0,
                  opacity: 0
                })}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="pb-20"
              >
                {renderScreen()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom Navigation */}
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 h-[60px] flex justify-around items-center pb-1 z-50">
            <NavButton 
              active={currentScreen === 'home'} 
              onClick={() => handleNavClick('home')} 
              icon={<Home size={20} />} 
              label="Home" 
            />
            <NavButton 
              active={currentScreen === 'saved'} 
              onClick={() => handleNavClick('saved')} 
              icon={<Bookmark size={20} />} 
              label="Saved" 
            />
            <NavButton 
              active={currentScreen === 'profile'} 
              onClick={() => handleNavClick('profile')} 
              icon={<User size={20} />} 
              label="Profile" 
              showNotification={!hasResume}
            />
          </div>
          <Toaster position="top-center" />
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, showNotification }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, showNotification?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 transition-colors relative ${active ? 'text-primary' : 'text-text-sub dark:text-slate-500'}`}
    >
      <div className={`w-5 h-5 flex items-center justify-center rounded ${active ? 'bg-primary/10 dark:bg-primary/20' : ''}`}>
        {icon}
        {showNotification && (
          <span className="absolute top-0 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900" />
        )}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function HomeScreen({ 
  onJobClick, 
  onToggleSave, 
  onApply,
  savedJobs, 
  appliedJobIds,
  searchQuery, 
  setSearchQuery,
  recommendations,
  isLoadingRecommendations,
  showSmartNotification,
  onCloseNotification,
  filteredJobs,
  filters,
  setFilters
}: { 
  onJobClick: (job: Job) => void, 
  onToggleSave: (id: string) => void, 
  onApply: (job: Job) => void,
  savedJobs: string[],
  appliedJobIds: string[],
  searchQuery: string,
  setSearchQuery: (q: string) => void,
  recommendations: { jobId: string, matchReason: string, matchScore: number }[],
  isLoadingRecommendations: boolean,
  showSmartNotification: boolean,
  onCloseNotification: () => void,
  filteredJobs: Job[],
  filters: Filters,
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
}) {
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [visibleCount, setVisibleCount] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return POPULAR_SUGGESTIONS.filter(s => 
      s.toLowerCase().includes(searchQuery.toLowerCase()) && 
      s.toLowerCase() !== searchQuery.toLowerCase()
    ).slice(0, 5);
  }, [searchQuery]);

  const loadMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + 5);
      setIsLoadingMore(false);
    }, 800);
  };

  const toggleFilter = (category: keyof Filters, value: string) => {
    setTempFilters(prev => {
      const current = prev[category] as string[];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [category]: updated };
    });
  };

  const applyFilters = () => {
    setFilters(tempFilters);
  };

  const resetFilters = () => {
    const initial: Filters = {
      experience: [],
      skills: [],
      location: [],
      sortBy: 'newest',
      salaryRange: [0, 50],
    };
    setTempFilters(initial);
    setFilters(initial);
  };

  const activeFilterCount = useMemo(() => {
    return filters.experience.length + 
           filters.skills.length + 
           filters.location.length + 
           (filters.sortBy !== 'newest' ? 1 : 0) + 
           (filters.salaryRange[0] !== 0 || filters.salaryRange[1] !== 50 ? 1 : 0);
  }, [filters]);

  const removeFilter = (category: keyof Filters, value: any) => {
    setFilters(prev => {
      if (Array.isArray(prev[category])) {
        return {
          ...prev,
          [category]: (prev[category] as string[]).filter(v => v !== value)
        };
      }
      if (category === 'sortBy') {
        return { ...prev, sortBy: 'newest' };
      }
      if (category === 'salaryRange') {
        return { ...prev, salaryRange: [0, 50] };
      }
      return prev;
    });
  };

  return (
    <div className="space-y-0 pb-20">
      <div className="bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold text-text-main dark:text-white">CareerJump</h1>
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 relative">
            <Bell size={18} className="text-text-sub dark:text-slate-400" />
            {showSmartNotification && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900" />}
          </Button>
        </div>

        <AnimatePresence>
          {showSmartNotification && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="ai-gradient p-3 rounded-xl text-white flex items-center justify-between gap-3 shadow-lg shadow-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold">Smart Match Ready!</p>
                    <p className="text-[9px] opacity-80">We found 2 new jobs matching your profile.</p>
                  </div>
                </div>
                <button onClick={onCloseNotification} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sub" size={16} />
            <Input 
              placeholder="Search Python, Java, Freshers..." 
              className="pl-9 pr-9 h-10 bg-primary-light dark:bg-slate-800 border-blue-100 dark:border-slate-700 rounded-xl text-xs focus-visible:ring-primary"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-sub hover:text-primary transition-colors"
              >
                <X size={14} />
              </button>
            )}

            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden"
                >
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full px-4 py-3 text-left text-xs text-text-main dark:text-slate-200 hover:bg-primary-light dark:hover:bg-slate-700 hover:text-primary transition-colors flex items-center gap-3 border-b border-slate-50 dark:border-slate-700 last:border-none"
                      onClick={() => {
                        setSearchQuery(suggestion);
                        setShowSuggestions(false);
                      }}
                    >
                      <Search size={12} className="text-text-sub dark:text-slate-400" />
                      {suggestion}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <Sheet>
            <SheetTrigger 
              render={
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-blue-100 bg-primary-light dark:bg-primary/10 text-primary hover:bg-primary/10 relative" />
              }
            >
              <Filter size={18} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900">
                  {activeFilterCount}
                </span>
              )}
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[32px] h-[90vh] p-6 bg-white dark:bg-slate-900 border-none shadow-2xl flex flex-col">
              <SheetHeader className="mb-6 flex flex-row items-center gap-4">
                <SheetClose 
                  render={
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-slate-50 dark:bg-slate-800 text-text-sub dark:text-slate-400" />
                  }
                >
                  <ArrowLeft size={16} />
                </SheetClose>
                <SheetTitle className="text-lg font-bold text-text-main dark:text-white flex-1">Filter Jobs</SheetTitle>
              </SheetHeader>
              
              <div className="space-y-8 overflow-y-auto flex-1 pb-24 pr-2 scrollbar-hide">
                {/* Sort By */}
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-main dark:text-white">Sort By</h3>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'newest', label: 'Date Posted' },
                      { id: 'salary-high', label: 'Salary: High to Low' },
                      { id: 'salary-low', label: 'Salary: Low to High' }
                    ].map(sort => (
                      <Badge 
                        key={sort.id} 
                        variant={tempFilters.sortBy === sort.id ? 'default' : 'outline'}
                        onClick={() => setTempFilters(prev => ({ ...prev, sortBy: sort.id as Filters['sortBy'] }))}
                        className={`px-4 py-2 rounded-xl font-medium cursor-pointer transition-all ${
                          tempFilters.sortBy === sort.id 
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                            : 'border-slate-200 dark:border-slate-700 text-text-sub dark:text-slate-400 hover:border-primary/30'
                        }`}
                      >
                        {sort.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Salary Range */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-text-main dark:text-white">Salary Range (LPA)</h3>
                    <span className="text-xs font-bold text-primary">₹{tempFilters.salaryRange[0]}L - ₹{tempFilters.salaryRange[1]}L+</span>
                  </div>
                  <div className="px-2">
                    <input 
                      type="range" 
                      min="0" 
                      max="50" 
                      step="1"
                      value={tempFilters.salaryRange[1]}
                      onChange={(e) => setTempFilters(prev => ({ ...prev, salaryRange: [prev.salaryRange[0], parseInt(e.target.value)] }))}
                      className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between mt-2 text-[10px] text-text-sub dark:text-slate-500 font-medium">
                      <span>₹0L</span>
                      <span>₹25L</span>
                      <span>₹50L+</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-main dark:text-white">Experience Level</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Fresher', '0-1 Year', '1-2 Years', '3+ Years'].map(exp => (
                      <Badge 
                        key={exp} 
                        variant={tempFilters.experience.includes(exp) ? 'default' : 'outline'}
                        onClick={() => toggleFilter('experience', exp)}
                        className={`px-4 py-2 rounded-xl font-medium cursor-pointer transition-all ${
                          tempFilters.experience.includes(exp)
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                            : 'border-slate-200 dark:border-slate-700 text-text-sub dark:text-slate-400 hover:border-primary/30'
                        }`}
                      >
                        {exp}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-main dark:text-white">Top Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Java', 'Python', 'React', 'Node.js', 'SQL', 'AWS', 'UI/UX'].map(skill => (
                      <Badge 
                        key={skill} 
                        variant={tempFilters.skills.includes(skill) ? 'default' : 'outline'}
                        onClick={() => toggleFilter('skills', skill)}
                        className={`px-4 py-2 rounded-xl font-medium cursor-pointer transition-all ${
                          tempFilters.skills.includes(skill)
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                            : 'border-slate-200 dark:border-slate-700 text-text-sub dark:text-slate-400 hover:border-primary/30'
                        }`}
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-text-main dark:text-white">Location</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Bangalore', 'Hyderabad', 'Pune', 'Remote', 'Mumbai', 'Chennai'].map(loc => (
                      <Badge 
                        key={loc} 
                        variant={tempFilters.location.includes(loc) ? 'default' : 'outline'}
                        onClick={() => toggleFilter('location', loc)}
                        className={`px-4 py-2 rounded-xl font-medium cursor-pointer transition-all ${
                          tempFilters.location.includes(loc)
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' 
                            : 'border-slate-200 dark:border-slate-700 text-text-sub dark:text-slate-400 hover:border-primary/30'
                        }`}
                      >
                        {loc}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute bottom-6 left-6 right-6 pt-4 bg-white dark:bg-slate-900 flex gap-3">
                <Button 
                  variant="outline"
                  onClick={resetFilters}
                  className="flex-1 h-12 border-slate-200 dark:border-slate-700 text-text-sub dark:text-slate-400 text-sm font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Clear All
                </Button>
                <SheetClose 
                  render={
                    <Button 
                      onClick={applyFilters}
                      className="flex-[2] h-12 bg-primary hover:bg-primary/90 text-sm font-bold rounded-xl shadow-lg shadow-primary/20"
                    />
                  }
                >
                  Show {filteredJobs.length} Jobs
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1">
            {filters.experience.map(exp => (
              <Badge key={exp} className="bg-primary/10 dark:bg-primary/20 text-primary border-none text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                {exp}
                <X size={10} className="cursor-pointer" onClick={() => removeFilter('experience', exp)} />
              </Badge>
            ))}
            {filters.skills.map(skill => (
              <Badge key={skill} className="bg-primary/10 dark:bg-primary/20 text-primary border-none text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                {skill}
                <X size={10} className="cursor-pointer" onClick={() => removeFilter('skills', skill)} />
              </Badge>
            ))}
            {filters.location.map(loc => (
              <Badge key={loc} className="bg-primary/10 dark:bg-primary/20 text-primary border-none text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                {loc}
                <X size={10} className="cursor-pointer" onClick={() => removeFilter('location', loc)} />
              </Badge>
            ))}
            {filters.sortBy !== 'newest' && (
              <Badge className="bg-primary/10 dark:bg-primary/20 text-primary border-none text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                {filters.sortBy === 'salary-high' ? 'Salary: High to Low' : 'Salary: Low to High'}
                <X size={10} className="cursor-pointer" onClick={() => removeFilter('sortBy', null)} />
              </Badge>
            )}
            {filters.salaryRange[1] !== 50 && (
              <Badge className="bg-primary/10 dark:bg-primary/20 text-primary border-none text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap">
                Up to ₹{filters.salaryRange[1]}L
                <X size={10} className="cursor-pointer" onClick={() => removeFilter('salaryRange', null)} />
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide">
        {['All Jobs', 'Remote', 'Urgent', 'MNCs'].map((tab, i) => (
          <Badge 
            key={tab} 
            variant="outline" 
            className={`px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${i === 0 ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-800 text-text-main dark:text-slate-200 border-slate-200 dark:border-slate-700'}`}
          >
            {tab}
          </Badge>
        ))}
      </div>

      <div className="px-4 py-2 flex justify-between items-center">
        <h2 className="text-sm font-bold text-text-main">Top Companies</h2>
        <span className="text-primary text-[10px] font-semibold cursor-pointer">See all</span>
      </div>

      <div className="flex gap-3 px-4 pb-4 overflow-x-auto scrollbar-hide">
        {TOP_COMPANIES.map((company) => (
          <div key={company.name} className="min-w-[44px] h-[44px] bg-white rounded-xl shadow-sleek flex items-center justify-center p-2 border border-slate-50 overflow-hidden">
            <img 
              src={company.logo} 
              alt={company.name} 
              className="w-full h-full object-contain opacity-90" 
              referrerPolicy="no-referrer" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(company.name)}&background=random&color=fff`;
              }}
            />
          </div>
        ))}
      </div>

      <div className="px-4 py-2">
        <h2 className="text-sm font-bold text-text-main flex items-center gap-2">
          Recommended for You
          <Sparkles size={14} className="text-primary" />
        </h2>
      </div>

      <div className="px-4 overflow-x-auto scrollbar-hide flex gap-4 pb-2 snap-x snap-mandatory">
        {!searchQuery && recommendations.map((rec) => {
          const job = MOCK_JOBS.find(j => j.id === rec.jobId);
          if (!job) return null;
          const isApplied = appliedJobIds.includes(job.id);
          return (
            <Card key={rec.jobId} className="min-w-[280px] max-w-[280px] border-none bg-white rounded-sleek shadow-sleek overflow-hidden group hover:shadow-lg transition-shadow relative snap-center">
              <div className="absolute top-0 right-0 px-2 py-1 bg-primary text-white text-[8px] font-bold rounded-bl-lg z-10">
                {rec.matchScore}% Match
              </div>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center p-2 overflow-hidden">
                      <img 
                        src={job.logo} 
                        alt={job.company} 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=random&color=fff`;
                        }}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text-main text-xs line-clamp-1 group-hover:text-primary transition-colors">{job.title}</h3>
                        {isApplied && (
                          <Badge className="bg-green-100 text-green-600 border-none text-[8px] h-4 px-1.5 font-bold">
                            Applied
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-text-sub">{job.company} • {job.location.split(',')[0]}</p>
                    </div>
                  </div>
                </div>
                
                <p className="text-[10px] text-text-sub italic line-clamp-2">"{rec.matchReason}"</p>

                <div className="space-y-2">
                  <p className="text-[9px] text-text-sub font-bold uppercase tracking-wider">Required Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {job.skills.slice(0, 3).map(skill => (
                      <span key={skill} className="text-[9px] px-2 py-1 bg-primary-light text-primary rounded font-bold">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    className="flex-1 h-9 bg-primary hover:bg-primary/90 text-[11px] font-bold rounded-lg shadow-sm"
                    onClick={() => onJobClick(job)}
                  >
                    View Match
                  </Button>
                  <Button 
                    className={`flex-1 h-9 text-[11px] font-bold rounded-lg shadow-sm transition-all ${isApplied ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-white text-primary border border-primary/20 hover:bg-primary/5'}`}
                    onClick={() => onApply(job)}
                    disabled={isApplied}
                  >
                    {isApplied ? 'Applied' : 'Apply'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="px-4 py-2">
        <h2 className="text-sm font-bold text-text-main">Recent Jobs</h2>
      </div>

      <div className="px-4 space-y-3">
        {searchQuery && filteredJobs.length === 0 ? (
          <div className="py-10 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mx-auto">
              <Search size={32} />
            </div>
            <h3 className="font-bold text-text-main text-sm">No jobs found</h3>
            <p className="text-text-sub text-[11px]">Try searching for different keywords or skills.</p>
            <Button 
              variant="link" 
              className="text-primary text-xs font-bold"
              onClick={() => setSearchQuery('')}
            >
              Clear Search
            </Button>
          </div>
        ) : (
          <>
            {filteredJobs
              .filter(j => !(!searchQuery && recommendations.some(r => r.jobId === j.id)))
              .slice(0, visibleCount)
              .map((job) => (
                <JobCard 
                  key={job.id} 
                  job={job} 
                  onClick={() => onJobClick(job)} 
                  onToggleSave={() => onToggleSave(job.id)}
                  onApply={() => onApply(job)}
                  isSaved={savedJobs.includes(job.id)}
                  isApplied={appliedJobIds.includes(job.id)}
                />
              ))}
            
            {visibleCount < filteredJobs.length && (
              <div className="py-4 flex justify-center">
                <Button 
                  variant="ghost" 
                  className="text-primary font-bold text-xs flex items-center gap-2"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      Load More Jobs
                      <ChevronRight size={14} className="rotate-90" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, onClick, onToggleSave, onApply, isSaved, isApplied }: { job: Job, onClick: () => void, onToggleSave: () => void, onApply: () => void, isSaved: boolean, isApplied: boolean, key?: string }) {
  return (
    <Card className="border-none shadow-sleek bg-white dark:bg-slate-800 rounded-sleek overflow-hidden cursor-pointer group hover:shadow-lg transition-shadow" onClick={onClick}>
      <CardContent className="p-4 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex gap-3">
            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-center p-2 overflow-hidden">
              <img 
                src={job.logo} 
                alt={job.company} 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=random&color=fff`;
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text-main dark:text-white text-xs group-hover:text-primary transition-colors">{job.title}</h3>
                {isApplied && (
                  <Badge className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 border-none text-[8px] h-4 px-1.5 font-bold">
                    Applied
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-text-sub dark:text-slate-400">{job.company} • {job.location.split(',')[0]}</p>
            </div>
          </div>
          <Bookmark 
            size={16} 
            className={isSaved ? "fill-primary text-primary" : "text-slate-300 dark:text-slate-600"} 
            onClick={(e) => { e.stopPropagation(); onToggleSave(); }}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-text-sub dark:text-slate-400 font-bold uppercase tracking-wider">Top Skills</p>
            <div className="text-[10px] font-bold text-primary">{job.salary.split(' - ')[0]}</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {job.skills.slice(0, 3).map(skill => (
              <span key={skill} className="text-[9px] px-2 py-1 bg-primary-light dark:bg-primary/20 text-primary rounded font-bold">
                {skill}
              </span>
            ))}
            {job.skills.length > 3 && (
              <span className="text-[9px] px-2 py-1 bg-slate-100 dark:bg-slate-700 text-text-sub dark:text-slate-400 rounded font-bold">
                +{job.skills.length - 3}
              </span>
            )}
          </div>
        </div>

        <Button 
          className={`w-full h-9 text-[11px] font-bold rounded-lg shadow-sm transition-all ${isApplied ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-primary hover:bg-primary/90 text-white'}`}
          onClick={(e) => { e.stopPropagation(); onApply(); }}
          disabled={isApplied}
        >
          {isApplied ? (
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={12} />
              Applied
            </span>
          ) : 'Apply Now'}
        </Button>
      </CardContent>
    </Card>
  );
}

function JobDetailsScreen({ 
  job, 
  user,
  onBack, 
  onApply, 
  onToggleSave, 
  isSaved,
  isApplied,
  recommendation 
}: { 
  job: Job, 
  user: UserProfile,
  onBack: () => void, 
  onApply: () => void, 
  onToggleSave: () => void, 
  isSaved: boolean,
  isApplied: boolean,
  recommendation?: { matchReason: string, matchScore: number }
}) {
  return (
    <div className="flex flex-col h-full bg-bg-main dark:bg-slate-950">
      <div className="p-4 flex justify-between items-center bg-white dark:bg-slate-900">
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 bg-slate-50 dark:bg-slate-800 shadow-sm" onClick={onBack}>
          <ArrowLeft size={16} className="text-text-sub dark:text-slate-400" />
        </Button>
        <h2 className="font-bold text-text-main dark:text-white text-sm">Job Details</h2>
        <Bookmark 
          size={18} 
          className={isSaved ? "fill-primary text-primary" : "text-slate-300 dark:text-slate-600"} 
          onClick={onToggleSave}
        />
      </div>

      <div className="ai-gradient text-white p-4 mx-4 rounded-sleek space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-2 shadow-sm overflow-hidden">
            <img 
              src={job.logo} 
              alt={job.company} 
              className="w-full h-full object-contain" 
              referrerPolicy="no-referrer" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company)}&background=random&color=fff`;
              }}
            />
          </div>
          <div>
            <div className="text-2xl font-extrabold">{recommendation?.matchScore || 95}% Match</div>
            <div className="flex items-center gap-1.5">
              <div className="text-[11px] font-semibold">AI Smart Recommendation</div>
              <Sheet>
                <SheetTrigger 
                  render={
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-white/20 text-white/80" />
                  }
                >
                  <Info size={12} />
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[32px] p-6 bg-white dark:bg-slate-900 border-none shadow-2xl">
                  <SheetHeader className="mb-4">
                    <SheetTitle className="text-lg font-bold text-text-main dark:text-white flex items-center gap-2">
                      <Sparkles size={18} className="text-primary" />
                      AI Matching Logic
                    </SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4">
                    <div className="p-4 bg-primary-light dark:bg-primary/10 rounded-2xl">
                      <p className="text-xs text-text-main dark:text-slate-200 leading-relaxed">
                        Our AI analyzes your profile against the job requirements using several factors:
                      </p>
                    </div>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 mt-0.5">
                          <CheckCircle2 size={12} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-main dark:text-white">Skill Alignment</p>
                          <p className="text-[10px] text-text-sub dark:text-slate-400">Matches your {user.skills.length} core skills with the required stack.</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mt-0.5">
                          <Briefcase size={12} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-main dark:text-white">Experience Level</p>
                          <p className="text-[10px] text-text-sub dark:text-slate-400">Verifies your {user.qualification} fits the {job.experience} requirement.</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-5 h-5 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center text-purple-600 dark:text-purple-400 mt-0.5">
                          <MapPin size={12} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-text-main dark:text-white">Location Preference</p>
                          <p className="text-[10px] text-text-sub dark:text-slate-400">Considers your current location and the job's remote/hybrid status.</p>
                        </div>
                      </li>
                    </ul>
                    <div className="pt-2">
                      <p className="text-[10px] text-text-sub dark:text-slate-500 italic text-center">
                        This match is calculated in real-time to help you find the best opportunities.
                      </p>
                    </div>
                    <SheetClose 
                      render={
                        <Button className="w-full mt-2 h-11 bg-primary text-white font-bold text-xs rounded-xl" />
                      }
                    >
                      Got it
                    </SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
        <p className="text-[9px] opacity-80 leading-tight">
          {recommendation?.matchReason || `Your technical skills and experience are a perfect fit for this role at ${job.company}.`}
        </p>
      </div>

      <div className="mt-4 bg-white dark:bg-slate-900 rounded-t-[30px] flex-1 p-5 space-y-6 shadow-sleek">
        <div>
          <a 
            href={job.website || "#"} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="group/title inline-block"
          >
            <h1 className="text-xl font-extrabold text-text-main dark:text-white group-hover/title:text-primary transition-colors flex items-center gap-2">
              {job.title}
              <ExternalLink size={16} className="opacity-0 group-hover/title:opacity-100 transition-opacity" />
            </h1>
          </a>
          <p>
            <a 
              href={job.website || "#"} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary font-bold text-sm hover:underline"
            >
              {job.company}
            </a>
          </p>
        </div>

        <div className="space-y-3">
          <DetailItem icon="💼" label="Experience" value={job.experience} />
          <DetailItem icon="📍" label="Location" value={job.location} />
          <DetailItem icon="💰" label="Salary" value={job.salary} />
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold text-text-main dark:text-white uppercase tracking-wider">Required Skills</h3>
          <div className="flex flex-wrap gap-1.5">
            {job.skills.map(skill => (
              <span key={skill} className="text-[10px] px-3 py-1 bg-primary-light dark:bg-primary/20 text-primary rounded-md font-bold">
                {skill}
              </span>
            ))}
          </div>
        </div>

        <Button 
          className={`w-full h-12 text-sm font-bold rounded-xl shadow-lg transition-all ${isApplied ? 'bg-green-500 hover:bg-green-600 shadow-green-200' : 'bg-primary hover:bg-primary/90 shadow-primary/20'}`}
          onClick={onApply}
          disabled={isApplied}
        >
          {isApplied ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              Application Submitted
            </span>
          ) : 'Apply Now'}
        </Button>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: string, label: string, value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-primary-light dark:bg-primary/20 rounded-full flex items-center justify-center text-sm">
        {icon}
      </div>
      <div>
        <p className="text-[9px] text-text-sub dark:text-slate-400 font-bold uppercase tracking-tighter">{label}</p>
        <p className="text-xs font-bold text-text-main dark:text-slate-200">{value}</p>
      </div>
    </div>
  );
}

function SavedJobsScreen({ 
  jobs, 
  onJobClick, 
  onToggleSave, 
  onApply,
  savedJobs,
  appliedJobIds 
}: { 
  jobs: Job[], 
  onJobClick: (job: Job) => void, 
  onToggleSave: (id: string) => void, 
  onApply: (job: Job) => void,
  savedJobs: string[],
  appliedJobIds: string[]
}) {
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-bold text-text-main dark:text-white">Saved Jobs</h1>
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600">
            <Bookmark size={32} />
          </div>
          <h3 className="font-bold text-text-main dark:text-white text-sm">No saved jobs</h3>
          <p className="text-text-sub dark:text-slate-400 text-[11px]">Jobs you save will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <JobCard 
              key={job.id} 
              job={job} 
              onClick={() => onJobClick(job)} 
              onToggleSave={() => onToggleSave(job.id)}
              onApply={() => onApply(job)}
              isSaved={savedJobs.includes(job.id)}
              isApplied={appliedJobIds.includes(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileScreen({ user, hasResume, setHasResume, handleNavClick, isDarkMode, setIsDarkMode }: { user: UserProfile, hasResume: boolean, setHasResume: (val: boolean) => void, handleNavClick: (screen: Screen) => void, isDarkMode: boolean, setIsDarkMode: (val: boolean) => void }) {
  return (
    <div className="space-y-6 pb-10">
      <div className="profile-header pt-8 pb-4 px-5 relative">
        <div className="absolute top-8 left-5">
          <Button 
            variant="ghost" 
            className="h-8 px-2 -ml-2 text-text-sub dark:text-slate-400 hover:bg-transparent flex items-center gap-1"
            onClick={() => handleNavClick('home')}
          >
            <ArrowLeft size={16} />
            <span className="text-xs font-bold">Back</span>
          </Button>
        </div>
        <div className="absolute top-8 right-5 flex gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-8 w-8 bg-white dark:bg-slate-800 shadow-sm"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? <Sun size={16} className="text-yellow-500" /> : <Moon size={16} className="text-text-sub" />}
          </Button>
          <Sheet>
            <SheetTrigger 
              render={
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 bg-white dark:bg-slate-800 shadow-sm" />
              }
            >
              <Settings size={16} className="text-text-sub dark:text-slate-400" />
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[32px] h-[85vh] p-0 bg-white dark:bg-slate-900 border-none shadow-2xl flex flex-col overflow-hidden outline-none">
              <div className="p-6 pb-4 border-b border-slate-50 dark:border-slate-800/50">
                <SheetHeader className="flex flex-row items-center justify-between">
                  <SheetClose 
                    render={
                      <Button variant="ghost" className="h-8 px-2 -ml-2 text-text-sub dark:text-slate-400 hover:bg-transparent flex items-center gap-1" />
                    }
                  >
                    <ArrowLeft size={16} />
                    <span className="text-xs font-bold">Back</span>
                  </SheetClose>
                  <SheetTitle className="text-lg font-bold text-text-main dark:text-white">Settings</SheetTitle>
                  <div className="w-12" /> {/* Spacer for centering */}
                </SheetHeader>
              </div>

              <div className="flex-1 relative overflow-hidden">
                {/* Top Fade */}
                <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-white dark:from-slate-900 to-transparent z-10 pointer-events-none" />
                
                <ScrollArea className="h-full px-6 overscroll-contain">
                  <div className="py-6 space-y-8 pb-10">
                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-text-sub uppercase tracking-widest px-1">Account</h3>
                    <div className="space-y-2">
                      <SettingsItem icon={<UserCircle size={14} />} label="Edit Profile" />
                      <SettingsItem icon={<CreditCard size={14} />} label="Subscription Plan" status="Premium" />
                      <SettingsItem icon={<Smartphone size={14} />} label="Connected Devices" status="1 Active" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-text-sub uppercase tracking-widest px-1">Preferences</h3>
                    <div className="space-y-2">
                      <div onClick={() => setIsDarkMode(!isDarkMode)} className="cursor-pointer">
                        <SettingsItem icon={isDarkMode ? <Sun size={14} /> : <Moon size={14} />} label="Dark Mode" status={isDarkMode ? "On" : "Off"} />
                      </div>
                      <SettingsItem icon={<Globe size={14} />} label="Language" status="English (US)" />
                      <SettingsItem icon={<Bell size={14} />} label="Push Notifications" status="On" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-text-sub uppercase tracking-widest px-1">Privacy & Security</h3>
                    <div className="space-y-2">
                      <SettingsItem icon={<Lock size={14} />} label="Change Password" />
                      <SettingsItem icon={<Shield size={14} />} label="Privacy Policy" />
                      <SettingsItem icon={<FileText size={14} />} label="Terms of Service" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-text-sub uppercase tracking-widest px-1">Help & Support</h3>
                    <div className="space-y-2">
                      <SettingsItem icon={<HelpCircle size={14} />} label="FAQ & Help Center" />
                      <SettingsItem icon={<Mail size={14} />} label="Contact Support" />
                      <SettingsItem icon={<MessageCircle size={14} />} label="Live Chat" status="Online" />
                      <SettingsItem icon={<Share2 size={14} />} label="Share App" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-text-sub uppercase tracking-widest px-1">Danger Zone</h3>
                    <div className="space-y-2">
                      <SettingsItem icon={<Trash2 size={14} className="text-red-500" />} label="Delete Account" labelClassName="text-red-500" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-[10px] font-bold text-text-sub uppercase tracking-widest px-1">App Info</h3>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-text-sub dark:text-slate-400">Version</span>
                        <span className="font-bold text-text-main dark:text-slate-200">2.4.0 (Build 102)</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-sub dark:text-slate-400">Environment</span>
                        <span className="font-bold text-primary">Production</span>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* Bottom Fade */}
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-white dark:from-slate-900 to-transparent z-10 pointer-events-none" />
            </div>

              <div className="p-6 pt-4 border-t border-slate-50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
                <Button variant="outline" className="w-full h-12 border-red-100 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 font-bold text-xs rounded-xl transition-all active:scale-[0.98]">
                  <LogOut size={14} className="mr-2" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full border-4 border-white dark:border-slate-900 shadow-sleek overflow-hidden">
              <img src={user.photo} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div className="absolute bottom-1 right-0 w-6 h-6 bg-primary rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-white">
              <CheckCircle2 size={12} />
            </div>
          </div>
          <div className="text-left">
            <h1 className="text-xl font-extrabold text-text-main dark:text-white">{user.name}</h1>
            <p className="text-text-sub dark:text-slate-400 text-xs">{user.qualification}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className="bg-primary/10 dark:bg-primary/20 text-primary border-none text-[9px] px-2 py-0.5">Verified</Badge>
              <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-none text-[9px] px-2 py-0.5">Premium</Badge>
            </div>
          </div>
        </div>
      </div>

      <ProfileStrength hasResume={hasResume} />

      <div className="grid grid-cols-2 gap-3 px-5">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl text-center shadow-sleek border border-slate-50 dark:border-slate-700">
          <p className="text-xl font-extrabold text-primary">{user.appliedCount}</p>
          <p className="text-[10px] text-text-sub dark:text-slate-400 font-bold uppercase tracking-wider">Applied</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl text-center shadow-sleek border border-slate-50 dark:border-slate-700">
          <p className="text-xl font-extrabold text-primary">{user.matchPercentage}%</p>
          <p className="text-[10px] text-text-sub dark:text-slate-400 font-bold uppercase tracking-wider">Avg Match</p>
        </div>
      </div>

      <div className="px-5">
        <h3 className="text-sm font-bold text-text-main dark:text-white mb-3 flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          Resume & Documents
        </h3>
        <div className={`p-4 rounded-2xl border-2 border-dashed transition-all ${hasResume ? 'border-green-100 dark:border-green-900/30 bg-green-50/30 dark:bg-green-900/10' : 'border-primary/20 dark:border-primary/40 bg-primary-light dark:bg-primary/10'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${hasResume ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400' : 'bg-white dark:bg-slate-800 text-primary shadow-sm'}`}>
              <FileText size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-text-main dark:text-white">
                {hasResume ? 'Resume_Mohammed_Riyan_P.pdf' : 'No Resume Found'}
              </h3>
              <p className="text-[10px] text-text-sub dark:text-slate-400">
                {hasResume ? 'Last updated: 2 days ago' : 'Upload your resume to get 2x more job matches'}
              </p>
            </div>
          </div>
          <motion.div
            animate={!hasResume ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <Button 
              onClick={() => {
                setHasResume(true);
                toast.success("Resume Uploaded!", {
                  description: "Your profile strength has increased to 85%.",
                });
              }}
              className={`w-full mt-4 h-10 font-bold text-xs rounded-xl shadow-lg transition-all ${hasResume ? 'bg-white text-text-main border border-slate-200 hover:bg-slate-50 shadow-none' : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'}`}
            >
              <Upload size={14} className="mr-2" />
              {hasResume ? 'Update Resume' : 'Upload Resume Now'}
            </Button>
          </motion.div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        <h3 className="text-sm font-bold text-text-main dark:text-white flex items-center gap-2">
          <User size={16} className="text-primary" />
          Account Settings
        </h3>
        <div className="space-y-2">
          <ProfileMenuItem label="My Skills" status="8" icon={<Sparkles size={14} />} />
          <ProfileMenuItem label="Job Alerts" status="On" icon={<Bell size={14} />} />
          <ProfileMenuItem label="Saved Jobs" status="12" icon={<Bookmark size={14} />} />
          <ProfileMenuItem label="Help & Support" icon={<Search size={14} />} />
        </div>
      </div>

      <div className="px-5 pt-4">
        <Button variant="outline" className="w-full h-11 border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 font-bold text-xs rounded-xl">
          <LogOut size={14} className="mr-2" />
          Logout Account
        </Button>
      </div>
    </div>
  );
}

function SettingsItem({ icon, label, status, labelClassName }: { icon: React.ReactNode, label: string, status?: string, labelClassName?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl flex justify-between items-center shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-50 dark:border-slate-700 group">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-primary-light dark:bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className={`text-xs font-bold text-text-main dark:text-slate-200 ${labelClassName}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {status && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {status}
          </span>
        )}
        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
}

function ProfileMenuItem({ label, status, icon }: { label: string, status?: string, icon?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl flex justify-between items-center shadow-sleek cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-50 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-center text-text-sub dark:text-slate-400">
          {icon}
        </div>
        <span className="text-xs font-bold text-text-main dark:text-slate-200">{label}</span>
      </div>
      {status ? (
        <span className="text-xs font-bold text-primary bg-primary/5 dark:bg-primary/20 px-2 py-0.5 rounded-full">{status}</span>
      ) : (
        <ChevronRight size={16} className="text-slate-300 dark:text-slate-600" />
      )}
    </div>
  );
}

function ProfileStrength({ hasResume }: { hasResume: boolean }) {
  const strength = hasResume ? 85 : 45;
  return (
    <div className="px-5 space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-bold text-text-main uppercase tracking-wider">Profile Strength</span>
        <span className="text-xs font-bold text-primary">{strength}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${strength}%` }}
          className={`h-full ${hasResume ? 'bg-green-500' : 'bg-primary'}`}
        />
      </div>
      {!hasResume && (
        <p className="text-[9px] text-text-sub italic">Complete your profile to unlock premium job matches.</p>
      )}
    </div>
  );
}
